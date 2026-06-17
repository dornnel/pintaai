import { test, expect } from '@playwright/test'
import { TEST_USERS, signIn } from './helpers/auth'
import { deleteUserByEmail, confirmUserByEmail } from './helpers/admin-api'

const CUSTOMER = TEST_USERS.customer

test.describe('07 — Cliente: onboarding completo', () => {
  test.beforeAll(async () => {
    await deleteUserByEmail(CUSTOMER.email)
  })

  test('Cliente se cadastra, aceita termos e acessa Minha Área', async ({ page }) => {
    // 1. Landing page → CTA principal
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
    await page.locator('a[href="/chat"], button:has-text("Pedir orçamento"), a:has-text("Pedir orçamento")').first().click()
    await page.waitForURL(/\/chat/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/chat/)

    // 2. Ir para registro
    await page.goto('/login?tab=register')
    await page.waitForSelector('text=Criar conta', { timeout: 10_000 })

    // 3. Selecionar papel Cliente
    await page.click('button:has-text("Cliente"), label:has-text("Cliente")')

    // 4. Preencher formulário
    await page.fill('input[placeholder="Seu nome completo"]', CUSTOMER.name)
    await page.fill('input[placeholder="seu@email.com"]', CUSTOMER.email)
    await page.fill('input[placeholder="Mínimo 6 caracteres"]', CUSTOMER.password)

    // 5. Abrir Termos de Uso e voltar
    const termsLink = page.locator('a:has-text("Termos de Uso"), a[href="/termos"]').first()
    if (await termsLink.isVisible()) {
      const [termsPage] = await Promise.all([
        page.waitForEvent('popup').catch(() => null),
        termsLink.click(),
      ])
      if (termsPage) {
        await termsPage.waitForLoadState()
        await termsPage.close()
      } else {
        await page.waitForURL(/\/termos/, { timeout: 5_000 }).catch(() => {})
        await page.goBack()
        await page.waitForURL(/\/login/, { timeout: 5_000 }).catch(() => {})
      }
    }

    // 6. Aceitar termos (checkbox LGPD)
    const checkbox = page.locator('label:has(input[type="checkbox"])').first()
    await checkbox.click()

    // 7. Criar conta
    await page.click('button[type="submit"]:has-text("Criar conta")')
    await page.waitForSelector('text=Conta criada', { timeout: 15_000 })

    // 8. Confirmar email via Admin API
    await confirmUserByEmail(CUSTOMER.email)

    // 9. Fazer login
    await signIn(page, CUSTOMER.email, CUSTOMER.password)

    // 10. Pode ir para onboarding ou direto para minha-area
    await page.waitForURL(/\/(onboarding|minha-area)/, { timeout: 15_000 })

    // 11. Se caiu no onboarding, selecionar "Quero contratar pintores"
    if (page.url().includes('/onboarding')) {
      await page.click('button:has-text("Quero contratar pintores")')
      await page.click('button:has-text("Continuar")')
      await page.waitForURL(/\/minha-area/, { timeout: 10_000 })
    }

    // 12. Verificar CustomerLayout: sidebar com itens de navegação
    await expect(page.locator('text=Início')).toBeVisible()
    await expect(page.locator('text=Meus Pedidos')).toBeVisible()
    await expect(page.locator('text=Avaliações')).toBeVisible()
    await expect(page.locator('text=Perfil')).toBeVisible()

    // 13. Verificar stats zerados no dashboard
    await expect(page.locator('text=Pedidos').first()).toBeVisible()
    await expect(page.locator('text=Novo pedido de pintura')).toBeVisible()

    // 14. Clicar no CTA "Novo pedido" → vai para /chat
    await page.click('text=Novo pedido de pintura')
    await page.waitForURL(/\/chat/, { timeout: 8_000 })
    await expect(page).toHaveURL(/\/chat/)

    // 15. Voltar e navegar para Meus Pedidos → empty state
    await page.goto('/minha-area/pedidos')
    await page.waitForSelector('text=Nenhum pedido', { timeout: 10_000 })

    // 16. Navegar para Perfil → nome e email presentes
    await page.goto('/minha-area/perfil')
    await page.waitForSelector('text=Meu Perfil', { timeout: 8_000 })
    await expect(page.locator(`text=${CUSTOMER.email}`)).toBeVisible()
  })
})
