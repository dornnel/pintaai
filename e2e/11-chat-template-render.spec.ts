import { test, expect, type Page } from '@playwright/test'

// Regressão: os steps sintéticos property_scope/visit_preference vazavam
// {{property_type}} cru e sequências \n\n literais no chat.
test.describe('Koke template rendering', () => {

  async function dismissCookieBanner(page: Page) {
    const accept = page.locator('button:has-text("Aceitar tudo")')
    if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) await accept.click()
  }

  async function clickChip(page: Page, label: string) {
    const chip = page.locator(`button:has-text("${label}")`).last()
    await chip.waitFor({ state: 'visible', timeout: 20_000 })
    await chip.click()
  }

  test('property_scope question renders property_type, not a raw placeholder', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForSelector('.animate-slide-up', { timeout: 20_000 })
    await dismissCookieBanner(page)

    const input = page.locator('textarea, input[placeholder*="Escreva"]').first()
    await input.fill('quero pintar minha casa')
    await input.press('Enter')

    // fluxo guiado: serviço -> bairro -> chega em property_type=Casa -> property_scope sintético
    await clickChip(page, '1ª pintura (imóvel novo)')
    await page.waitForTimeout(1500)
    await clickChip(page, 'Campeche')
    await page.waitForTimeout(1500)
    await clickChip(page, 'Casa')

    await page.waitForSelector('text=/interna, externa ou ambas/i', { timeout: 20_000 })
    const body = await page.locator('body').innerText()

    expect(body, `placeholder cru encontrado:\n${body}`).not.toMatch(/\{\{\s*\w+\s*\}\}/)
    expect(body).not.toContain('\\n')
    expect(body).toMatch(/casa/i)
  })
})
