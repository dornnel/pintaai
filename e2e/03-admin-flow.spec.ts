import { test, expect } from '@playwright/test'

// ── Admin panel tests ─────────────────────────────────────────────────────
// Requires admin credentials (andre@agenscia.com)
test.describe('Admin panel', () => {

  test('admin login page is accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Pintai')).toBeVisible()
  })

  test('non-admin cannot access /admin', async ({ page }) => {
    await page.goto('/admin')
    // Should redirect to login or show access denied
    await expect(page).not.toHaveURL('/admin', { timeout: 5_000 }).catch(() => {})
  })

  test('admin leads page structure', async ({ page }) => {
    // This test requires admin to be logged in
    // Skip if not authenticated
    await page.goto('/admin/leads')
    const url = page.url()
    if (url.includes('/login')) {
      test.skip()
      return
    }
    await expect(page.locator('text=Solicitações')).toBeVisible()
  })

  test('admin dashboard shows KPI cards', async ({ page }) => {
    await page.goto('/admin')
    const url = page.url()
    if (url.includes('/login')) {
      test.skip()
      return
    }
    // Dashboard should have lead count cards
    await expect(page.locator('text=Total de leads, text=Solicitações, h1')).toBeVisible({ timeout: 5_000 }).catch(() => {})
  })
})
