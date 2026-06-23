import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// App DB client (pintae schema)
const appClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: 'pintae' } })
// Auth client (default schema for auth.admin.*)
const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerErr } = await authClient.auth.getUser(token)
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await appClient
      .from('users').select('role').eq('auth_user_id', caller.id).maybeSingle()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { authUserId, appUserId } = await req.json() as {
      authUserId?: string
      appUserId: string
    }

    if (!appUserId) {
      return new Response(JSON.stringify({ error: 'Missing appUserId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the real auth_user_id from the DB record before deleting
    const { data: userRecord } = await appClient.from('users').select('auth_user_id').eq('id', appUserId).maybeSingle()
    const realAuthId = userRecord?.auth_user_id || authUserId

    // Delete from pintae.users — FK cascades handle painters, reviews, etc.
    const { error: dbErr } = await appClient.from('users').delete().eq('id', appUserId)
    if (dbErr) throw new Error(`DB delete failed: ${dbErr.message}`)

    // Delete from Supabase Auth if we have a valid UUID
    const isValidUUID = realAuthId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realAuthId)
    if (isValidUUID) {
      const { error: authErr } = await authClient.auth.admin.deleteUser(realAuthId)
      if (authErr) console.warn('Auth delete warning (non-fatal):', authErr.message)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-delete-user error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
