import { test, expect } from '@playwright/test'
import { TEST_USERS, signIn } from './helpers/auth'
import { deleteUserByEmail, confirmUserByEmail } from './helpers/admin-api'

const PAINTER = TEST_USERS.painter

test.describe('08 — Pintor: onboarding e exploração do portal', () => {
  test.beforeAll(async () => {
    await deleteUserByEmail(PAINTER.email)
  })

  test('Pintor se cadastra via /seja-pintor e explora o portal completo', async ({ page }) => {
    // 1. /seja-pintor → redireciona para login como Pintor
    await page.goto('/seja-pintor')
    await page.waitForURL(/\/login/, { timeout: 8_000 })
    await expect(page).toHaveURL(/login/)

    // 2. Garantir que estamos na aba de registro com papel Pintor pré-selecionado
    // Clicar em "Criar conta" tab se necessário
    const registerTab = page.locator('button:has-text("Criar conta"):not([type="submit"])')
    if (await registerTab.isVisible()) await registerTab.click()

    await page.waitForSelector('input[placeholder="Seu nome completo"]', { timeout: 8_000 })

    // 3. Selecionar papel Pintor
    await page.click('button:has-text("Pintor"), label:has-text("Pintor")')

    // 4. Preencher formulário
    await page.fill('input[placeholder="Seu nome completo"]', PAINTER.name)
    await page.fill('input[placeholder="seu@email.com"]', PAINTER.email)
    await page.fill('input[placeholder="Mínimo 6 caracteres"]', PAINTER.password)

    // 5. Aceitar termos
    const checkbox = page.locator('label:has(input[type="checkbox"])').first()
    await checkbox.click()

    // 6. Criar conta → aguardar confirmação
    await page.click('button[type="submit"]:has-text("Criar conta")')
    await page.waitForSelector('text=Conta criada', { timeout: 15_000 })

    // 7. Confirmar email via Admin API
    await confirmUserByEmail(PAINTER.email)

    // 8. Fazer login → deve redirecionar para /seja-pintor (BecomePainterPage)
    await signIn(page, PAINTER.email, PAINTER.password)
    await page.waitForURL(/\/(seja-pintor|onboarding|portal)/, { timeout: 15_000 })

    // Se caiu no onboarding, selecionar "Sou pintor"
    if (page.url().includes('/onboarding')) {
      await page.click('button:has-text("Sou pintor")')
      await page.click('button:has-text("Continuar")')
      await page.waitForURL(/\/(seja-pintor|portal)/, { timeout: 10_000 })
    }

    // Se está no /seja-pintor (BecomePainterPage), preencher o formulário
    if (page.url().includes('/seja-pintor')) {
      await page.waitForSelector('text=Torne-se um pintor parceiro', { timeout: 10_000 })

      // 9. Preencher bio
      await page.fill('textarea', 'Pintor experiente em Floripa, especializado em pintura interna e fachada.')

      // 10. Anos de experiência
      const yearsInput = page.locator('input[type="number"]')
      await yearsInput.fill('5')

      // 11. Especialidades
      await page.click('button:has-text("Pintura interna")')
      await page.click('button:has-text("Fachada")')

      // 12. Bairros de atuação
      await page.click('button:has-text("Campeche")')
      await page.click('button:has-text("Rio Tavares")')

      // 13. Concluir cadastro
      await page.click('button:has-text("Concluir cadastro de pintor")')
      await page.waitForURL(/\/portal\/pintor$/, { timeout: 15_000 })
    }

    // Garantir que está no portal
    await expect(page).toHaveURL(/\/portal\/pintor/)

    // 14. Verificar sidebar com todos os itens
    await expect(page.locator('text=Início').first()).toBeVisible()
    await expect(page.locator('a:has-text("Solicitações"), nav *:has-text("Solicitações")').first()).toBeVisible()
    await expect(page.locator('text=Propostas').first()).toBeVisible()
    await expect(page.locator('text=Avaliações').first()).toBeVisible()
    await expect(page.locator('text=Ferramentas').first()).toBeVisible()
    await expect(page.locator('text=Assinatura').first()).toBeVisible()
    await expect(page.locator('text=Perfil').first()).toBeVisible()

    // 15. Dashboard: welcome card com stats
    await expect(page.locator('text=Solicitações').first()).toBeVisible()

    // 16. Navegar para Assinatura
    await page.click('a[href="/portal/pintor/assinatura"]')
    await page.waitForURL(/\/assinatura/, { timeout: 8_000 })
    await expect(page.locator('text=Grátis').first()).toBeVisible()
    await expect(page.locator('text=Pro').first()).toBeVisible()
    await expect(page.locator('text=R$').first()).toBeVisible()

    // 17. Navegar para Ferramentas
    await page.click('a[href="/portal/pintor/ferramentas"]')
    await page.waitForURL(/\/ferramentas/, { timeout: 8_000 })
    await expect(page.locator('text=Calculadora').first()).toBeVisible()
    await expect(page.locator('text=Visualizador').first()).toBeVisible()

    // 18. Navegar para Solicitações → empty state
    await page.click('a[href="/portal/pintor/solicitacoes"]')
    await page.waitForURL(/\/solicitacoes/, { timeout: 8_000 })
    await page.waitForSelector('text=Nenhuma solicitação', { timeout: 10_000 })
  })
})
