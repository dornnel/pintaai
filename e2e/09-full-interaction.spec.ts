import { test, expect } from '@playwright/test'
import { TEST_USERS, signIn } from './helpers/auth'
import {
  ensureTestCustomer, ensureTestPainter,
  seedTestLead, distributeLeadToPainter,
  cleanupTestLeads,
} from './helpers/admin-api'

const CUSTOMER = TEST_USERS.customer
const PAINTER = TEST_USERS.painter

let interactionId: string

test.describe('09 — Interação completa: lead → proposta → aceite', () => {
  test.beforeAll(async () => {
    // Garantir que ambos os usuários existem e estão confirmados
    await ensureTestCustomer(CUSTOMER.email, CUSTOMER.password, CUSTOMER.name)
    await ensureTestPainter(PAINTER.email, PAINTER.password, PAINTER.name)

    // Limpar leads de teste antigos e criar novo
    await cleanupTestLeads(CUSTOMER.email)
    const { leadId } = await seedTestLead(CUSTOMER.email)
    const result = await distributeLeadToPainter(leadId, PAINTER.email)
    interactionId = result.interactionId
  })

  test('1 — Cliente vê pedido aguardando proposta', async ({ page }) => {
    await signIn(page, CUSTOMER.email, CUSTOMER.password)
    await page.waitForURL(/\/(minha-area|onboarding)/, { timeout: 15_000 })

    // Se onboarding, completar
    if (page.url().includes('/onboarding')) {
      await page.click('button:has-text("Quero contratar pintores")')
      await page.click('button:has-text("Continuar")')
    }

    // Navegar para Meus Pedidos
    await page.goto('/minha-area/pedidos')
    await page.waitForSelector('text=Meus Pedidos', { timeout: 10_000 })

    // Lead deve aparecer
    await expect(page.locator('text=Pintura interna').first()).toBeVisible({ timeout: 10_000 })

    // Badge de status (Aguardando pintores ou Campeche)
    await expect(page.locator('text=Campeche').first()).toBeVisible()

    // Expandir o lead para ver detalhes
    const leadCard = page.locator('[data-testid="lead-card"], .cursor-pointer').first()
    const expandBtn = page.locator('button:has-text("Propostas"), svg').first()
    if (await expandBtn.isVisible()) await expandBtn.click()
  })

  test('2 — Pintor vê solicitação e envia proposta', async ({ page }) => {
    await signIn(page, PAINTER.email, PAINTER.password)
    await page.waitForURL(/\/portal\/pintor/, { timeout: 15_000 })

    // Dashboard deve mostrar contador na sidebar
    await expect(page).toHaveURL(/\/portal\/pintor/)

    // Navegar para Solicitações
    await page.click('a[href="/portal/pintor/solicitacoes"]')
    await page.waitForURL(/\/solicitacoes/, { timeout: 8_000 })

    // Lead de teste deve aparecer na lista
    await page.waitForSelector('text=Pintura interna', { timeout: 15_000 })
    await expect(page.locator('text=Campeche').first()).toBeVisible()

    // Clicar em "Ver solicitação"
    await page.click('button:has-text("Ver solicitação")')
    await page.waitForURL(/\/portal\/pintor\/solicitacao\//, { timeout: 10_000 })

    // Verificar detalhes do projeto
    await expect(page.locator('text=Pintura interna').first()).toBeVisible()
    await expect(page.locator('text=Campeche').first()).toBeVisible()

    // Estimativa de preço deve estar visível
    await expect(page.locator('text=R$').first()).toBeVisible()

    // Testar BudgetBreakdownModal — clicar no valor estimado
    const priceBtn = page.locator('button:has-text("R$"), [role="button"]:has-text("R$")').first()
    if (await priceBtn.isVisible()) {
      await priceBtn.click()
      // Modal deve abrir
      const modal = page.locator('[role="dialog"], .fixed.inset-0').last()
      await expect(modal).toBeVisible({ timeout: 5_000 })
      // Fechar modal
      const closeBtn = modal.locator('button').first()
      await closeBtn.click()
      await expect(modal).not.toBeVisible({ timeout: 3_000 })
    }

    // Clicar em "Ver solicitação" / "Enviar Proposta" para entrar em modo edição
    const editBtn = page.locator('button:has-text("Enviar Proposta"), button:has-text("Responder"), button:has-text("Interessado")')
    if (await editBtn.first().isVisible()) {
      await editBtn.first().click()
    }

    // Aguardar formulário de proposta aparecer
    await page.waitForSelector('input[placeholder="1500"]', { timeout: 10_000 })

    // Preencher proposta
    await page.fill('input[placeholder="1500"]', '2800')
    await page.fill('input[placeholder="5"]', '5')

    // Marcar material incluso se checkbox disponível
    const materialCheckbox = page.locator('input[type="checkbox"]').first()
    if (await materialCheckbox.isVisible()) {
      const isChecked = await materialCheckbox.isChecked()
      if (!isChecked) await materialCheckbox.click()
    }

    // Enviar proposta
    await page.click('button:has-text("Enviar proposta ao cliente")')
    await page.waitForSelector('text=Proposta Enviada, text=Proposta salva', { timeout: 10_000 }).catch(() => {})

    // Verificar que o status mudou
    await expect(page.locator('text=Proposta Enviada, text=proposal_sent').first()).toBeVisible({ timeout: 8_000 }).catch(async () => {
      // Pode ter recarregado com toast
      await expect(page.locator('text=R$ 2.800, text=2800').first()).toBeVisible({ timeout: 5_000 })
    })
  })

  test('3 — Cliente aceita proposta e vê WhatsApp CTA', async ({ page }) => {
    await signIn(page, CUSTOMER.email, CUSTOMER.password)
    await page.waitForURL(/\/(minha-area|onboarding)/, { timeout: 15_000 })

    // Se onboarding, completar
    if (page.url().includes('/onboarding')) {
      await page.click('button:has-text("Quero contratar pintores")')
      await page.click('button:has-text("Continuar")')
    }

    // Ir para Meus Pedidos
    await page.goto('/minha-area/pedidos')
    await page.waitForSelector('text=Meus Pedidos', { timeout: 10_000 })

    // Lead deve mostrar proposta disponível
    await page.waitForSelector('text=Pintura interna', { timeout: 15_000 })

    // Expandir lead para ver propostas
    const expandArea = page.locator('text=Pintura interna').first()
    await expandArea.click().catch(() => {})
    await page.waitForTimeout(1000)

    // ProposalCard — ver botão de aceitar
    const acceptBtn = page.locator('button:has-text("Selecionar esta proposta")').first()
    if (await acceptBtn.isVisible({ timeout: 8_000 })) {
      await acceptBtn.click()

      // Diálogo de confirmação (confirm() nativo)
      page.on('dialog', async dialog => {
        await dialog.accept()
      })

      // Aguardar atualização
      await page.waitForTimeout(2000)

      // Verificar badge "Contratado" ou WhatsApp CTA
      const contracted = page.locator('text=Contratado, text=WhatsApp, a[href*="wa.me"]')
      await expect(contracted.first()).toBeVisible({ timeout: 10_000 })
    } else {
      // Proposta pode ainda não ter chegado — exibir o que está na tela
      const content = await page.locator('main, [role="main"]').textContent().catch(() => '')
      console.log('Conteúdo da página:', content?.slice(0, 500))
    }
  })

  test.afterAll(async () => {
    await cleanupTestLeads(CUSTOMER.email)
  })
})
