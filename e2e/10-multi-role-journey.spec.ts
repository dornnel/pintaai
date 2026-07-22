/**
 * 10 — Jornada multi-perfil
 *
 * Mesmo usuário percorre 3 fases:
 *  1. Cadastro como cliente → envia lead pelo chat
 *  2. Adiciona perfil de pintor → acessa portal do pintor
 *  3. Assina Clube Pinte Rápido → acessa ferramentas exclusivas
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { deleteUserByEmail } from './helpers/admin-api'

dotenv.config({ path: '.env.test.local' })
dotenv.config({ path: '.env' })

const SB_URL  = process.env.VITE_SUPABASE_URL!
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appDb   = createClient(SB_URL, SB_KEY, { db: { schema: 'pintae' } })
const authDb  = createClient(SB_URL, SB_KEY)

// Supabase localStorage key: sb-{projectRef}-auth-token
const PROJECT_REF = SB_URL.split('//')[1].split('.')[0]
const LS_KEY = `sb-${PROJECT_REF}-auth-token`

const USER = {
  email:    'multi.role.teste@pintaai.dev',
  password: 'Teste@12345',
  name:     'Jorge Multi Teste',
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Creates (or re-uses) the test user in both Auth + pintae.users */
async function seedUser(): Promise<string> {
  // Attempt reuse
  const { data: existing } = await appDb.from('users').select('id').eq('email', USER.email).maybeSingle()
  if (existing) return existing.id

  const { data: authData, error: authErr } = await authDb.auth.admin.createUser({
    email: USER.email, password: USER.password, email_confirm: true,
  })
  if (authErr || !authData.user) throw authErr ?? new Error('Failed to create auth user')

  const { data: row, error: insertErr } = await appDb.from('users').insert({
    auth_user_id: authData.user.id,
    email: USER.email,
    name: USER.name,
    phone: '48999000000',  // NOT NULL in pintae.users — required placeholder
    role: 'customer',
    roles: ['customer'],
    status: 'active',
    registration_source: 'test',
  }).select('id').single()

  if (insertErr) throw insertErr
  return row!.id
}

/**
 * Programmatic login: signs in via Supabase anon client, injects the session
 * token into the browser's localStorage — bypasses the UI login form entirely.
 * Much more reliable in e2e tests than clicking through multi-step forms.
 */
async function loginProgrammatic(context: BrowserContext): Promise<void> {
  const tempClient = createClient(SB_URL, SB_ANON)
  const { data, error } = await tempClient.auth.signInWithPassword({
    email: USER.email,
    password: USER.password,
  })
  if (error || !data.session) throw error ?? new Error('Programmatic login failed')

  // Inject session into the app page so localStorage is on the right origin.
  const page = await context.newPage()
  await page.goto('/')  // must be on app origin — about:blank blocks localStorage
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      }))
    },
    { key: LS_KEY, session: data.session }
  )
  await page.close()
}

/** Open a new page that is already authenticated */
async function newAuthPage(context: BrowserContext): Promise<Page> {
  await loginProgrammatic(context)
  const page = await context.newPage()
  return page
}

// ── suite ─────────────────────────────────────────────────────────────────────

test.describe('10 — Jornada multi-perfil (cliente → pintor → clube)', () => {
  let pintaeUserId: string

  test.beforeAll(async () => {
    await deleteUserByEmail(USER.email)
    pintaeUserId = await seedUser()
  })

  test.afterAll(async () => {
    await deleteUserByEmail(USER.email)
  })

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 1 — Cliente: login + lead pelo chat
  // ────────────────────────────────────────────────────────────────────────────

  test('Fase 1A — Login e acesso à área do cliente', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/minha-area')
    await page.waitForURL(/\/minha-area/, { timeout: 15_000 })

    await expect(
      page.locator('h1, h2').filter({ hasText: /Olá|Bem-vindo|Dashboard|Pedidos/i }).first()
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.locator('a[href="/minha-area/pedidos"], nav a:has-text("Pedidos")').first()
    ).toBeVisible()
  })

  test('Fase 1B — Envia lead pelo chat (auth gate não aparece — já logado)', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/chat')
    await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })

    // Aguarda o agente inicializar e clica na sugestão
    await page.waitForTimeout(1000)
    const startBtn = page.locator('button:has-text("Quero um orçamento")').first()
    if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startBtn.click()
    } else {
      const ta = page.locator('textarea').first()
      await ta.fill('Quero um orçamento')
      await page.keyboard.press('Enter')
    }
    await page.waitForTimeout(2000)

    // Responde sequencialmente — tenta chip primeiro, depois textarea
    async function reply(text: string) {
      const chip = page.locator(`button[class*="rounded-full"]:has-text("${text}")`).first()
      if (await chip.isVisible({ timeout: 2500 }).catch(() => false)) {
        await chip.click()
      } else {
        const ta = page.locator('textarea').first()
        await ta.fill(text)
        await page.keyboard.press('Enter')
      }
      await page.waitForTimeout(1500)
    }

    // Fluxo tipo de serviço → imóvel → bairro → área → condição → prazo → material
    await reply('Pintura interna')
    await reply('Apartamento')
    await reply('Campeche')
    await reply('60')
    await reply('Repintura simples')
    await reply('Até 1 mês')
    await reply('Tinta inclusa no orçamento')

    // Aguarda briefing (envolve edge function — até 30s)
    await page.waitForSelector('text=/Pedido enviado|Protocolo|PT-/', { timeout: 30_000 })

    // Auth gate NÃO deve ter aparecido (usuário já estava autenticado)
    await expect(page.locator('text=Entrar na Pinte Rápido')).not.toBeVisible()

    // Upsell do Clube deve aparecer ~3.5s depois do briefing
    await page.waitForSelector('text=/Clube Pinte Rápido|R\\$49/', { timeout: 12_000 })
  })

  test('Fase 1C — Auth gate aparece para usuário não logado', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })
    await page.waitForTimeout(1000)

    // Helper: chip first, textarea fallback
    const ta = page.locator('textarea').first()
    async function send(text: string, waitMs = 1800) {
      const chip = page.locator(`button[class*="rounded-full"]:has-text("${text}")`).first()
      if (await chip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chip.click()
      } else {
        await ta.fill(text)
        await page.keyboard.press('Enter')
      }
      await page.waitForTimeout(waitMs)
    }

    // Responde fluxo completo até o auth gate aparecer
    await send('Quero um orçamento')
    await send('Maria Visitante')           // nome
    await send('Pintura interna')           // tipo de serviço
    await send('Apartamento')               // tipo de imóvel
    await send('Campeche')                  // bairro
    await send('60')                        // área m²
    await send('Repintura simples')         // condição das paredes
    await send('Até 1 mês')                // prazo

    // Auth gate deve aparecer antes ou durante o step de email
    await page.waitForSelector(
      'text=/já tem uma conta|Já tenho conta|Entrar com Google|Preencher meus dados/',
      { timeout: 20_000 }
    )

    // Clicar "Já tenho conta" → card de login inline
    const jaTemConta = page.locator('button:has-text("Já tenho conta"), button:has-text("✅")').first()
    await jaTemConta.click()
    await page.waitForTimeout(800)
    await page.waitForSelector('text=Entrar na Pinte Rápido', { timeout: 5_000 })

    await expect(page.locator('input[type="email"][placeholder*="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('text=Continuar com Google')).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 2 — Virar pintor
  // ────────────────────────────────────────────────────────────────────────────

  test('Fase 2A — /seja-pintor carrega página de cadastro de pintor', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/seja-pintor')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('h1, h2').filter({ hasText: /Pintor|Cadastrar|seja|parceiro/i }).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Fase 2B — Chat detecta intenção de pintor e roteia corretamente', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/chat')
    await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })
    await page.waitForTimeout(1000)

    const ta = page.locator('textarea').first()
    await ta.fill('Quero me cadastrar como pintor')
    await page.keyboard.press('Enter')

    // Agente reage com fluxo de pintor
    await page.waitForSelector(
      'text=/pintor|cadastro|experiência|especialidade|Finalizar|Seja/',
      { timeout: 15_000 }
    )

    // CTA de finalizar cadastro de pintor deve aparecer
    await page.waitForSelector(
      'a[href="/seja-pintor"], button:has-text("Finalizar cadastro"), a:has-text("cadastro de pintor")',
      { timeout: 20_000 }
    )

    // Upsell do Pro aparece ~2.5s depois
    await page.waitForSelector('text=/Plano Pro|R\\$97/', { timeout: 10_000 })
  })

  test('Fase 2C — DB: promover para painter e acessar portal do pintor', async ({ context }) => {
    // Promover via admin API (simula ser-pintor / aprovação admin)
    await appDb.from('users').update({
      role: 'painter',
      roles: ['painter', 'customer'],
    }).eq('id', pintaeUserId)

    const { data: nbhoods } = await appDb.from('neighborhoods').select('id').limit(2)
    await appDb.from('painters').upsert({
      user_id: pintaeUserId,
      bio: 'Pintor e cliente multi-role para testes',
      experience_years: 5,
      neighborhoods_served: (nbhoods ?? []).map(n => n.id),
      service_types: ['Pintura interna'],
      pro_plan_status: 'none',
    }, { onConflict: 'user_id' })

    const page = await newAuthPage(context)
    await page.goto('/portal/pintor')
    await page.waitForURL(/\/portal\/pintor/, { timeout: 15_000 })

    await expect(
      page.locator('h1, h2').filter({ hasText: /Dashboard|Solicitações|Bem-vindo|Pintor/i }).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Fase 2D — Formulário de assinatura Pro (R$97) renderiza', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/portal/pintor/assinatura')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('h1, h2').filter({ hasText: /Assinatura|Plano/i }).first()
    ).toBeVisible({ timeout: 8_000 })

    // Preço Pro deve estar visível
    await expect(page.locator('text=/R\\$97|97\\/mês/')).toBeVisible()

    // Se há botão Assinar → clica para ir ao checkout
    const subscribeBtn = page.locator(
      'button:has-text("Assinar"), button:has-text("Ver Plano"), button:has-text("Upgrade")'
    ).first()
    if (await subscribeBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await subscribeBtn.click()
      await page.waitForTimeout(600)
    }

    // Formulário de checkout deve aparecer (ou já estava visível)
    const checkoutVisible = await page.locator('text=/Forma de pagamento|Assinar Plano Pro/').isVisible({ timeout: 5_000 }).catch(() => false)
    if (checkoutVisible) {
      // Teste Boleto
      await page.locator('button:has-text("Boleto")').click()
      await page.waitForTimeout(400)
      const cpfField = page.locator('input[placeholder*="CPF"]').first()
      await expect(cpfField).toBeVisible()
      await expect(
        page.locator('button[type="submit"]:has-text("Confirmar")').first()
      ).toBeVisible()

      // Troca para Cartão — deve mostrar campos de cartão
      await page.locator('button:has-text("Cartão")').click()
      await page.waitForTimeout(400)
      await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).toBeVisible()
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 3 — Clube Pinte Rápido
  // ────────────────────────────────────────────────────────────────────────────

  test('Fase 3A — /clube carrega com benefícios e CTA de assinatura', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/clube')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('h1, h2').filter({ hasText: /Clube|Pinte Rápido/i }).first()
    ).toBeVisible({ timeout: 8_000 })

    await expect(page.locator('text=/créditos de IA|Pintores parceiros|Descontos/')).toBeVisible()
    await expect(
      page.locator('button:has-text("Assinar"), button:has-text("Clube"), a:has-text("Assinar")').first()
    ).toBeVisible()
  })

  test('Fase 3B — Checkout do Clube: campos dinâmicos Cartão / Pix', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/clube')
    await page.waitForLoadState('networkidle')

    // Clicar em assinar
    const joinBtn = page.locator(
      'button:has-text("Assinar o Clube"), button:has-text("Quero entrar"), button:has-text("Assinar")'
    ).first()
    await joinBtn.click()
    await page.waitForTimeout(800)

    await page.waitForSelector('text=/Assinar o Clube|Forma de pagamento/', { timeout: 8_000 })

    // Trocar para Cartão → campos dinâmicos aparecem
    await page.locator('button:has-text("Cartão")').click()
    await page.waitForTimeout(500)
    await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="0000 0000"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="MM/"]')).toBeVisible()

    // Trocar para Pix → campos de cartão somem, aparece instrução Pix
    await page.locator('button:has-text("Pix")').click()
    await page.waitForTimeout(400)
    await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).not.toBeVisible()
    await expect(page.locator('text=/QR Code Pix/')).toBeVisible()
  })

  test('Fase 3C — DB: ativar Clube e verificar ferramentas desbloqueadas', async ({ context }) => {
    // Simula webhook de pagamento confirmado — ativa clube diretamente no DB
    await appDb.from('users').update({
      is_club_member: true,
      club_credits: 10,
    }).eq('id', pintaeUserId)

    const page = await newAuthPage(context)
    await page.goto('/ferramentas')
    await page.waitForLoadState('networkidle')

    // Badge CLUBE no header
    await expect(page.locator('text=CLUBE').first()).toBeVisible({ timeout: 8_000 })

    // Créditos disponíveis visíveis
    await expect(
      page.locator('text=/10 crédito|créditos disponíveis/i').first()
    ).toBeVisible({ timeout: 8_000 })

    // Zona de upload desbloqueada (sem Lock, com "Toque para enviar")
    await expect(
      page.locator('text=/Toque para enviar|enviar foto do ambiente/i').first()
    ).toBeVisible()
  })

  test('Fase 3D — Estimativa IA (gratuita) calcula faixa de preço', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/ferramentas')
    await page.waitForLoadState('networkidle')

    // Expandir o card de estimativa se necessário
    const expandBtn = page.locator('button:has-text("Estimativa de Orçamento")').first()
    if (await expandBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    // Preencher área
    await page.locator('input[type="number"]').first().fill('100')
    await page.waitForTimeout(400)

    // Resultado com faixa de preço deve aparecer
    await expect(
      page.locator('text=/Estimativa calculada/').first()
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.locator('text=/R\\$.*–|–.*R\\$/').first()
    ).toBeVisible()
  })

  test('Fase 3E — /clube mostra status de membro + modal de cancelamento', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.goto('/clube')
    await page.waitForLoadState('networkidle')

    // Status de membro (créditos ou badge)
    await expect(
      page.locator('text=/crédito|membro|Clube ativo|CLUBE/i').first()
    ).toBeVisible({ timeout: 8_000 })

    // Botão cancelar
    const cancelBtn = page.locator(
      'button:has-text("Cancelar"), button:has-text("cancelar assinatura")'
    ).first()
    if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cancelBtn.click()
      await page.waitForTimeout(600)
      // Modal de confirmação
      await expect(
        page.locator('text=/Cancelar o Clube|Cancelar assinatura\\?/').first()
      ).toBeVisible()
      // Fechar sem confirmar
      await page.locator('button:has-text("Manter")').click()
      await expect(
        page.locator('text=/Cancelar o Clube|Cancelar assinatura\\?/').first()
      ).not.toBeVisible()
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 4 — Navegação mobile (BottomNav)
  // ────────────────────────────────────────────────────────────────────────────

  test('Fase 4 — BottomNav tab Ferramentas navega corretamente (iPhone 14)', async ({ context }) => {
    const page = await newAuthPage(context)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const ferrTab = page.locator('a[href="/ferramentas"]').first()
    await expect(ferrTab).toBeVisible({ timeout: 5_000 })
    await ferrTab.click()
    await page.waitForURL(/\/ferramentas/, { timeout: 8_000 })

    await expect(
      page.locator('h1').filter({ hasText: /Ferramentas/i }).first()
    ).toBeVisible()
  })
})
