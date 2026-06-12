// Script local único — cria as contas de Auth para os 2 pintores de teste
// (já seedados na tabela pintae.users pela migration 019_seed_test_painters.sql).
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/create-test-painters.mjs
//
// NUNCA commitar a SERVICE_ROLE_KEY. Defina-a apenas como variável de ambiente local.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como variáveis de ambiente antes de rodar este script.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: 'pintae' } })

const TEST_PAINTERS = [
  { email: 'pintor.teste1@pintae.com.br', phone: '+5548999990001', label: 'Pintor Teste 1 (Sul da Ilha)' },
  { email: 'pintor.teste2@pintae.com.br', phone: '+5548999990002', label: 'Pintor Teste 2 (Centro/Norte)' },
]

function randomPassword() {
  return `Pintae${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 100)}`
}

async function main() {
  for (const painter of TEST_PAINTERS) {
    const password = randomPassword()

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: painter.email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      console.error(`Falha ao criar auth user para ${painter.email}:`, createErr.message)
      continue
    }

    const authUserId = created.user.id

    const { error: updateErr } = await supabase
      .from('users')
      .update({ auth_user_id: authUserId, status: 'active' })
      .eq('phone', painter.phone)

    if (updateErr) {
      console.error(`Falha ao vincular auth_user_id para ${painter.email}:`, updateErr.message)
      continue
    }

    console.log(`✅ ${painter.label}`)
    console.log(`   email: ${painter.email}`)
    console.log(`   senha temporária: ${password}`)
    console.log('')
  }

  console.log('Pronto. Use essas credenciais para testar o login em /login.')
}

main()
