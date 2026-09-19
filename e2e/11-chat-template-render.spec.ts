import { test, expect, type Page } from '@playwright/test'

// Regressão: os steps sintéticos property_scope/visit_preference vazavam
// {{property_type}} cru e sequências \n\n literais no chat. Após a introdução
// do motor conversacional único (chat_turn), a fase de descoberta não usa mais
// chips fixos — dirige por texto livre e verifica que nenhum template cru
// aparece em nenhuma resposta ao longo da conversa.
test.describe('Koke template rendering', () => {
  test.setTimeout(90_000)

  async function dismissCookieBanner(page: Page) {
    const accept = page.locator('button:has-text("Aceitar tudo")')
    if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) await accept.click()
  }

  test('no raw {{placeholder}} or literal \\n leaks anywhere in a full discovery conversation', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForSelector('.animate-slide-up', { timeout: 20_000 })
    await dismissCookieBanner(page)

    const input = page.locator('textarea, input[placeholder*="Escreva"]').first()
    async function send(text: string) {
      await input.fill(text)
      await input.press('Enter')
      await page.waitForTimeout(8000)
    }

    await send('quero pintar a fachada da minha casa no campeche')
    await send('paredes e portas')
    await send('tem rachaduras e mofo')

    const body = await page.locator('body').innerText()
    expect(body, `placeholder cru encontrado:\n${body}`).not.toMatch(/\{\{\s*\w+\s*\}\}/)
    expect(body).not.toContain('\\n')
    expect(body).toMatch(/casa/i)
  })
})
