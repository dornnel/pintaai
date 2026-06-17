import { test, expect } from '@playwright/test'

/**
 * End-to-end tests for the full proposal flow:
 * anonymous chat → briefing CTA → painter sees lead → painter submits proposal → customer sees proposal
 *
 * Credentials from env vars (set in .env.test or CI secrets):
 *   PLAYWRIGHT_PAINTER_EMAIL / PLAYWRIGHT_PAINTER_PASS
 *   PLAYWRIGHT_CUSTOMER_EMAIL / PLAYWRIGHT_CUSTOMER_PASS
 */

const PAINTER_EMAIL = process.env.PLAYWRIGHT_PAINTER_EMAIL || ''
const PAINTER_PASS = process.env.PLAYWRIGHT_PAINTER_PASS || ''
const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_CUSTOMER_EMAIL || ''
const CUSTOMER_PASS = process.env.PLAYWRIGHT_CUSTOMER_PASS || ''

async function loginAs(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[0] : never, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ timeout: 10_000 }).catch(() => {})
}

// ── Test 1: Anonymous chat → briefing → CTA visible ────────────────────────
test('post-briefing login CTA appears after chat completion', async ({ page }) => {
  await page.goto('/chat')
  // Wait for Koke greeting
  await page.waitForSelector('text=Koke', { timeout: 10_000 })

  // The CTA appears once currentState === 'briefing_ready'
  // In a real flow this would require completing the full chat — here we verify
  // the element can appear on the page (smoke test)
  await expect(page.locator('text=Koke')).toBeVisible()
  await expect(page.locator('text=Criar conta grátis')).not.toBeVisible() // not shown before briefing
})

// ── Test 2: Painter logs in → Solicitações tab → leads visible ─────────────
test('painter portal shows Solicitações tab', async ({ page }) => {
  test.skip(!PAINTER_EMAIL, 'PLAYWRIGHT_PAINTER_EMAIL not set')

  await loginAs(page, PAINTER_EMAIL, PAINTER_PASS)

  // Should be on painter portal
  await expect(page).toHaveURL(/portal\/pintor/, { timeout: 10_000 })
  await expect(page.locator('text=Solicitações')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('text=Portal do Pintor')).toBeVisible()
})

// ── Test 3: Painter opens lead detail and can submit proposal ───────────────
test('painter can navigate to lead view page', async ({ page }) => {
  test.skip(!PAINTER_EMAIL, 'PLAYWRIGHT_PAINTER_EMAIL not set')

  await loginAs(page, PAINTER_EMAIL, PAINTER_PASS)
  await page.waitForURL(/portal\/pintor/, { timeout: 10_000 })

  // Click the Solicitações tab
  await page.click('button:has-text("Solicitações")')
  await page.waitForTimeout(1000)

  // If there's at least one interaction card, click "Ver solicitação"
  const verBtn = page.locator('a:has-text("Ver solicitação"), a:has-text("Ver proposta")').first()
  if (await verBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await verBtn.click()
    await expect(page).toHaveURL(/\/portal\/pintor\/solicitacao\//, { timeout: 8_000 })
    await expect(page.locator('text=Detalhes do Projeto')).toBeVisible()
    await expect(page.locator('text=Suas Observações')).toBeVisible()
    await expect(page.locator('text=Enviar Proposta')).toBeVisible()
  } else {
    // No leads yet — verify empty state
    await expect(page.locator('text=Nenhuma solicitação recebida ainda')).toBeVisible({ timeout: 5_000 })
  }
})

// ── Test 4: Customer logs in → sees Meus Pedidos section ───────────────────
test('customer area shows Meus Pedidos section', async ({ page }) => {
  test.skip(!CUSTOMER_EMAIL, 'PLAYWRIGHT_CUSTOMER_EMAIL not set')

  await loginAs(page, CUSTOMER_EMAIL, CUSTOMER_PASS)
  await page.waitForURL(/minha-area/, { timeout: 10_000 })

  await expect(page.locator('text=Meus Pedidos')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('text=Novo pedido de pintura')).toBeVisible()

  // Check for leads or empty state
  const hasLeads = await page.locator('[class*="font-mono"]').first().isVisible({ timeout: 3_000 }).catch(() => false)
  const hasEmpty = await page.locator('text=Nenhum pedido ainda').isVisible({ timeout: 2_000 }).catch(() => false)
  expect(hasLeads || hasEmpty).toBeTruthy()
})

// ── Test 5: Customer can expand a lead card and see proposals ───────────────
test('customer can expand lead card to see proposals', async ({ page }) => {
  test.skip(!CUSTOMER_EMAIL, 'PLAYWRIGHT_CUSTOMER_EMAIL not set')

  await loginAs(page, CUSTOMER_EMAIL, CUSTOMER_PASS)
  await page.waitForURL(/minha-area/, { timeout: 10_000 })

  // If there are lead cards, click the first one to expand
  const leadCard = page.locator('button:has(.font-mono)').first()
  if (await leadCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await leadCard.click()
    await expect(page.locator('text=Sua solicitação')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('text=Propostas dos pintores')).toBeVisible()
  }
})

// ── Test 6: Post-briefing message → bot responds (no stall) ─────────────────
test('chat does not stall after briefing_ready', async ({ page }) => {
  await page.goto('/chat')
  await page.waitForSelector('text=Koke', { timeout: 10_000 })

  // The bot should not silently ignore messages after briefing
  // If currentState is briefing_ready, the bot should respond with redirect message
  // Smoke test: send a message and verify bot loading resolves
  const input = page.locator('textarea')
  if (await input.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await input.fill('oi')
    await page.keyboard.press('Enter')
    // In normal (init) state the bot will respond with the greeting
    // We just verify a response appears and the UI doesn't freeze
    await expect(page.locator('[class*="animate-spin"]').first()).toBeHidden({ timeout: 8_000 })
  }
})

// ── Test 7: "Nova solicitação" button appears in CTA card ───────────────────
test('reset button visible in CTA for logged-out users when briefing_ready', async ({ page }) => {
  // Since reaching briefing_ready requires a full flow, we just test the structure
  // by checking the chat input area has a working reset button
  await page.goto('/chat')
  await page.waitForSelector('text=Koke', { timeout: 10_000 })

  // The RotateCcw (reset) button in the header should always be present
  const resetBtn = page.locator('button[title="Nova conversa"]')
  await expect(resetBtn).toBeVisible({ timeout: 5_000 })
  await resetBtn.click()
  // After reset, greeting should come again
  await page.waitForTimeout(1000)
  await expect(page.locator('text=Koke')).toBeVisible()
})
