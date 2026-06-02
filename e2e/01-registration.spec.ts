import { test, expect } from '@playwright/test'

// ── Registration tests ─────────────────────────────────────────────────────
// NOTE: These tests require a real Supabase connection and may create real records.
// Run with: npx playwright test e2e/01-registration.spec.ts

test.describe('Registration flows', () => {
  const TS = Date.now()

  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=O pintor certo')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Koke')).toBeVisible()
  })

  test('login page shows register tab', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('button:has-text("Criar conta")')).toBeVisible()
    await expect(page.locator('button:has-text("Entrar com Google")')).toBeVisible()
  })

  test('register tab opens on /login?tab=register', async ({ page }) => {
    await page.goto('/login?tab=register')
    await expect(page.locator('text=Você é...')).toBeVisible()
    await expect(page.locator('text=Cliente')).toBeVisible()
    await expect(page.locator('text=Pintor')).toBeVisible()
    await expect(page.locator('text=Loja parceira')).toBeVisible()
  })

  test('registration form validates required fields', async ({ page }) => {
    await page.goto('/login?tab=register')
    // Try to submit without filling anything
    const submitBtn = page.locator('button[type="submit"]:has-text("Criar conta")')
    await expect(submitBtn).toBeDisabled() // disabled until terms accepted
  })

  test('customer registration flow UI is complete', async ({ page }) => {
    await page.goto('/login?tab=register')

    // Select role
    await page.click('text=Cliente')

    // Fill form
    await page.fill('input[placeholder="Seu nome completo"]', `Ana Teste ${TS}`)
    await page.fill('input[placeholder="seu@email.com"]', `ana.teste.${TS}@example.com`)
    await page.fill('input[placeholder="Mínimo 6 caracteres"]', 'teste123!')

    // Check terms
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()

    const submitBtn = page.locator('button[type="submit"]:has-text("Criar conta")')
    await expect(submitBtn).toBeEnabled()
  })

  test('painter registration selects painter role', async ({ page }) => {
    await page.goto('/login?tab=register')
    await page.click('text=Pintor')
    // Verify role selected (orange border)
    const paintor = page.locator('label:has-text("Pintor")').first()
    await expect(paintor).toHaveClass(/border-brand/)
  })

  test('forgot password tab shows email input', async ({ page }) => {
    await page.goto('/login')
    // Click forgot password link
    await page.click('text=Esqueci minha senha')
    await expect(page.locator('text=Redefinir senha')).toBeVisible()
    await expect(page.locator('button:has-text("Enviar link")')).toBeVisible()
  })

  test('Inscreva-se nav button opens register tab', async ({ page }) => {
    await page.goto('/')
    // Desktop nav "Inscreva-se" button
    const inscrevaBtn = page.locator('a:has-text("Inscreva-se"), button:has-text("Inscreva-se")').first()
    if (await inscrevaBtn.isVisible()) {
      await inscrevaBtn.click()
      await expect(page).toHaveURL(/tab=register/)
      await expect(page.locator('text=Você é...')).toBeVisible()
    }
  })
})
