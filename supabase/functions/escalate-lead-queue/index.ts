import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'pintae' } })
  const sbAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  let escalated = 0
  let proDistributed = 0

  try {
    // ── 1. Cascade escalation: expired response deadlines ──
    const { data: expired } = await sb.from('lead_painter_interactions')
      .select('id, lead_id, painter_id, queue_position')
      .eq('status', 'notified')
      .not('response_deadline_at', 'is', null)
      .lt('response_deadline_at', new Date().toISOString())

    for (const int of expired || []) {
      // Mark as expired
      await sb.from('lead_painter_interactions').update({ status: 'expired' }).eq('id', int.id)

      // Find next in queue
      const { data: next } = await sb.from('lead_painter_interactions')
        .select('id, painter_id')
        .eq('lead_id', int.lead_id)
        .eq('status', 'queued')
        .order('queue_position')
        .limit(1)
        .maybeSingle()

      if (next) {
        // Get response window from settings
        const { data: windowSetting } = await sb.from('platform_settings')
          .select('value').eq('key', 'painter_response_window_hours').maybeSingle()
        const responseHours = Number(windowSetting?.value) || 4

        await sb.from('lead_painter_interactions').update({
          status: 'notified',
          notified_at: new Date().toISOString(),
          response_deadline_at: new Date(Date.now() + responseHours * 3600000).toISOString(),
        }).eq('id', next.id)

        // Send notification email
        sbAuth.functions.invoke('notify-painter', {
          body: { painter_id: next.painter_id, lead_id: int.lead_id },
        }).catch(err => console.error('[Escalate] notify error:', err))

        escalated++
        console.log(`[Escalate] Lead ${int.lead_id}: painter ${int.painter_id.slice(0,8)} expired → next: ${next.painter_id.slice(0,8)}`)
      }
    }

    // ── 2. Pro early access expiration: distribute to free painters ──
    const { data: proExpired } = await sb.from('leads')
      .select('id, protocol, neighborhood, service_interest')
      .eq('distribution_round', 1)
      .not('pro_access_expires_at', 'is', null)
      .lt('pro_access_expires_at', new Date().toISOString())
      .eq('proposals_closed', false)

    for (const lead of proExpired || []) {
      // Get max painters setting
      const { data: maxSetting } = await sb.from('platform_settings')
        .select('value').eq('key', 'max_painters_per_lead').maybeSingle()
      const maxPainters = Number(maxSetting?.value) || 3

      // Count existing proposals
      const { count: existingCount } = await sb.from('lead_painter_interactions')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', lead.id)
        .in('status', ['notified', 'proposal_sent', 'replied'])

      const slotsLeft = maxPainters - (existingCount || 0)
      if (slotsLeft <= 0) {
        await sb.from('leads').update({ distribution_round: 2 }).eq('id', lead.id)
        continue
      }

      // Find free painters not yet notified for this lead
      const { data: alreadyNotified } = await sb.from('lead_painter_interactions')
        .select('painter_id').eq('lead_id', lead.id)
      const notifiedIds = (alreadyNotified || []).map(r => r.painter_id)

      const { data: freePainters } = await sb.from('painters')
        .select('id, last_lead_received_at, active_leads_count, last_seen_at')
        .eq('availability_status', 'available')
        .not('pro_plan_status', 'eq', 'active')

      const eligible = (freePainters || []).filter(p => !notifiedIds.includes(p.id))
      if (eligible.length === 0) {
        await sb.from('leads').update({ distribution_round: 2 }).eq('id', lead.id)
        continue
      }

      // Pick top N by simple scoring (recency + load)
      const scored = eligible.map(p => {
        const hoursSince = p.last_lead_received_at
          ? (Date.now() - new Date(p.last_lead_received_at).getTime()) / 3600000
          : 999
        return { id: p.id, score: Math.min(hoursSince / 24, 1) * 0.6 + Math.max(0, 1 - (p.active_leads_count || 0) / 5) * 0.4 }
      }).sort((a, b) => b.score - a.score).slice(0, slotsLeft)

      for (const p of scored) {
        await sb.from('lead_painter_interactions').upsert({
          lead_id: lead.id, painter_id: p.id, status: 'notified', notified_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,painter_id' })

        await sb.from('painters').update({
          last_lead_received_at: new Date().toISOString(),
        }).eq('id', p.id)

        sbAuth.functions.invoke('notify-painter', {
          body: { painter_id: p.id, lead_id: lead.id },
        }).catch(err => console.error('[ProExpiry] notify error:', err))
      }

      await sb.from('leads').update({ distribution_round: 2 }).eq('id', lead.id)
      proDistributed += scored.length
      console.log(`[ProExpiry] Lead ${lead.protocol}: distributed to ${scored.length} free painters`)
    }

    return new Response(JSON.stringify({ ok: true, escalated, proDistributed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('escalate-lead-queue error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
