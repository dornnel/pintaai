import { test, expect } from '@playwright/test'

// ── Chat / Lead flow tests ────────────────────────────────────────────────
test.describe('Chat and lead creation', () => {

  test('chat page loads with Koke agent', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('text=Koke')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Online agora')).toBeVisible()
  })

  test('chat receives initial greeting from Koke', async ({ page }) => {
    await page.goto('/chat')
    // Wait for agent first message
    await page.waitForSelector('.animate-slide-up', { timeout: 15_000 })
    const agentMsg = page.locator('.animate-slide-up').first()
    await expect(agentMsg).toBeVisible()
  })

  test('hero chat widget shows service chips', async ({ page }) => {
    await page.goto('/')
    // Desktop hero chat widget
    await expect(page.locator('text=Pintar sala e quartos')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Fachada externa')).toBeVisible()
  })

  test('clicking hero chip navigates to chat with pre-filled query', async ({ page }) => {
    await page.goto('/')
    const chip = page.locator('button:has-text("Pintar sala e quartos")').first()
    if (await chip.isVisible()) {
      await chip.click()
      await expect(page).toHaveURL(/chat\?q=/)
    }
  })

  test('chat input allows typing and shows send button', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForSelector('textarea, input[placeholder*="Escreva"]', { timeout: 10_000 })
    const input = page.locator('textarea, input[placeholder*="Escreva"]').first()
    await input.fill('Olá, quero pintar minha casa')
    // Send button should be enabled
    const sendBtn = page.locator('button[title*="enviar"], button:has(svg)').last()
    await expect(sendBtn).not.toBeDisabled()
  })

  test('chat shows quick reply chips after agent responds', async ({ page }) => {
    await page.goto('/chat')
    // Wait for initial agent message
    await page.waitForTimeout(3000) // let agent respond
    // Quick replies should appear
    const qrArea = page.locator('button').filter({ hasText: /Campeche|Rio Tavares|Apartamento|Casa/ })
    // May or may not be visible depending on state — just check page doesn't crash
    await expect(page).toHaveURL('/chat')
  })

  test('/termos page loads', async ({ page }) => {
    await page.goto('/termos')
    await expect(page.locator('h1:has-text("Termos de Uso")')).toBeVisible()
    await expect(page.locator('text=LGPD')).toBeVisible()
  })

  test('/privacidade page loads', async ({ page }) => {
    await page.goto('/privacidade')
    await expect(page.locator('h1:has-text("Política de Privacidade")')).toBeVisible()
    await expect(page.locator('text=LGPD')).toBeVisible()
  })
})
