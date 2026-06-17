/**
 * WhatsApp Webhook — wraps agent-chat and returns only the `message` text.
 *
 * Supports multiple gateway formats:
 *   - Z-API: POST body { "body": "...", "from": "+55...", "phone": "..." }
 *   - Evolution API: POST body { "data": { "message": { "conversation": "..." }, "key": { "remoteJid": "..." } } }
 *   - Generic: POST body { "message": "...", "from": "..." }
 *   - Twilio: POST form-encoded with Body= and From= fields
 *
 * Set WHATSAPP_GATEWAY to one of: "zapi" | "evolution" | "twilio" | "generic"
 * Set ZAPI_INSTANCE_ID and ZAPI_TOKEN for Z-API
 * Set EVOLUTION_API_URL and EVOLUTION_API_KEY for Evolution API
 * Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for Twilio
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const GATEWAY = (Deno.env.get('WHATSAPP_GATEWAY') || 'zapi').toLowerCase()
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Z-API config
const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID') || ''
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN') || ''
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || ''

// Evolution API config
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') || ''

// Twilio config
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || ''

// ─── Parse incoming message from gateway ──────────────────────────────────────

interface ParsedMessage {
  from: string       // phone number with country code
  text: string       // message text
  sessionId: string  // unique session identifier
}

async function parseMessage(req: Request): Promise<ParsedMessage | null> {
  const contentType = req.headers.get('content-type') || ''

  if (GATEWAY === 'zapi') {
    const body = await req.json() as Record<string, unknown>
    const text = (body.body as string) || (body.text as string) || ''
    const from = (body.phone as string) || (body.from as string) || ''
    if (!text || !from || body.fromMe) return null
    return { from, text, sessionId: `whatsapp_${from.replace(/\D/g, '')}` }
  }

  if (GATEWAY === 'evolution') {
    const body = await req.json() as Record<string, unknown>
    const data = body.data as Record<string, unknown> | undefined
    if (!data) return null
    const msgData = data.message as Record<string, unknown> | undefined
    const keyData = data.key as Record<string, unknown> | undefined
    const text = (msgData?.conversation as string) || (msgData?.extendedTextMessage as Record<string, unknown>)?.text as string || ''
    const from = (keyData?.remoteJid as string)?.replace('@s.whatsapp.net', '') || ''
    const fromMe = keyData?.fromMe as boolean
    if (!text || !from || fromMe) return null
    return { from, text, sessionId: `whatsapp_${from.replace(/\D/g, '')}` }
  }

  if (GATEWAY === 'twilio') {
    const formText = await req.text()
    const params = new URLSearchParams(formText)
    const text = params.get('Body') || ''
    const from = (params.get('From') || '').replace('whatsapp:', '')
    if (!text || !from) return null
    return { from, text, sessionId: `whatsapp_${from.replace(/\D/g, '')}` }
  }

  // Generic fallback
  const body = await req.json() as Record<string, unknown>
  const text = (body.message as string) || (body.text as string) || (body.body as string) || ''
  const from = (body.from as string) || (body.phone as string) || ''
  if (!text || !from) return null
  return { from, text, sessionId: `whatsapp_${from.replace(/\D/g, '')}` }
}

// ─── Call agent-chat and extract just the message text ─────────────────────────

async function getAgentReply(sessionId: string, userMessage: string): Promise<{ message: string; quickReplies: string[] | null }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ session_id: sessionId, message: userMessage }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('agent-chat error:', err)
    return { message: 'Desculpe, tive um problema. Pode repetir?', quickReplies: null }
  }

  const data = await res.json() as Record<string, unknown>
  const message = (data.message as string) || ''
  const quickReplies = (data.quick_replies as string[] | null) || null
  return { message, quickReplies }
}

// ─── Send reply via gateway ────────────────────────────────────────────────────

async function sendReply(to: string, message: string, quickReplies: string[] | null): Promise<void> {
  // Format message with quick replies as numbered options (WhatsApp doesn't support buttons)
  let text = message
  if (quickReplies && quickReplies.length > 0) {
    text += '\n\n' + quickReplies.map((r, i) => `${i + 1}. ${r}`).join('\n')
  }

  if (GATEWAY === 'zapi' && ZAPI_INSTANCE_ID && ZAPI_TOKEN) {
    await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: to, message: text }),
    })
    return
  }

  if (GATEWAY === 'evolution' && EVOLUTION_API_URL && EVOLUTION_INSTANCE) {
    await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: to, text }),
    })
    return
  }

  if (GATEWAY === 'twilio' && TWILIO_SID) {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
    const body = new URLSearchParams({
      From: TWILIO_FROM || `whatsapp:${to}`,
      To: `whatsapp:${to}`,
      Body: text,
    })
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    return
  }

  console.warn(`[whatsapp-webhook] No gateway configured to send reply to ${to}`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Webhook verification (some gateways do GET with challenge)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const challenge = url.searchParams.get('hub.challenge')
    if (challenge) return new Response(challenge, { status: 200 })
    return new Response('WhatsApp Webhook OK', { status: 200 })
  }

  try {
    const parsed = await parseMessage(req)
    if (!parsed) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { from, text, sessionId } = parsed
    console.log(`[whatsapp-webhook] ${sessionId}: ${text.substring(0, 80)}`)

    // Resolve quick replies by number (user may type "1" instead of full text)
    let resolvedText = text
    const numMatch = text.trim().match(/^(\d+)$/)
    if (numMatch) {
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('collected_data')
        .eq('session_id', sessionId)
        .single()
      const lastReplies = (session?.collected_data as Record<string, unknown>)?.last_quick_replies as string[] | undefined
      if (lastReplies) {
        const idx = parseInt(numMatch[1]) - 1
        if (idx >= 0 && idx < lastReplies.length) {
          resolvedText = lastReplies[idx]
        }
      }
    }

    const { message, quickReplies } = await getAgentReply(sessionId, resolvedText)

    // Store quick replies for next round (so user can type "1", "2", etc.)
    if (quickReplies) {
      await supabase.from('conversation_sessions')
        .upsert({ session_id: sessionId, updated_at: new Date().toISOString() })
        .select()
        .maybeSingle()
      // Store as metadata via supabase update (best effort)
      await supabase.from('conversation_sessions')
        .update({ collected_data: { last_quick_replies: quickReplies } })
        .eq('session_id', sessionId)
    }

    await sendReply(from, message, quickReplies)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[whatsapp-webhook] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
