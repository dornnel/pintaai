import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { email, password, name, role } = await req.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Create auth user with auto-confirm (bypasses SMTP)
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name || '', role: role || 'customer' },
    })

    if (authErr) {
      const msg = authErr.message?.includes('already been registered')
        ? 'Este email já tem conta. Faça login.'
        : authErr.message || 'Erro ao criar conta'
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Erro ao criar usuário' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create pintae.users record
    const sbPintae = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'pintae' } })
    const trimmedEmail = email.toLowerCase().trim()

    const { data: existing } = await sbPintae.from('users')
      .select('id').eq('email', trimmedEmail).maybeSingle()

    if (existing) {
      await sbPintae.from('users').update({
        auth_user_id: authData.user.id,
        name: name || undefined,
        status: 'pending',
        terms_accepted_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await sbPintae.from('users').insert({
        auth_user_id: authData.user.id,
        role: role || 'customer',
        roles: [role || 'customer'],
        name: name || '',
        email: trimmedEmail,
        phone: `auto_${authData.user.id.slice(0, 8)}`,
        status: 'pending',
        terms_accepted_at: new Date().toISOString(),
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      user_id: authData.user.id,
      email: authData.user.email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('register-user error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
