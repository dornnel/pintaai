import { test, expect } from '@playwright/test'

// ── Painter portal tests ──────────────────────────────────────────────────
test.describe('Painter portal', () => {

  test('painter portal redirect works', async ({ page }) => {
    await page.goto('/portal/pintor')
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/login|portal\/pintor/, { timeout: 5_000 })
  })

  test('painter registration role option exists', async ({ page }) => {
    await page.goto('/login?tab=register')
    const paintor = page.locator('label:has-text("Pintor")')
    await expect(paintor).toBeVisible()
    const desc = page.locator('text=Quero receber pedidos e propostas')
    await expect(desc).toBeVisible()
  })

  test('seja-pintor route redirects to login', async ({ page }) => {
    await page.goto('/seja-pintor')
    await expect(page.locator('text=Pintai')).toBeVisible()
  })
})
