import { Page } from '@playwright/test'

export const TEST_USERS = {
  customer: { email: 'cliente.teste@pintai.dev', password: 'teste123!', name: 'Ana Silva Teste' },
  painter:  { email: 'pintor.teste@pintai.dev',  password: 'teste123!', name: 'Carlos Mendes Teste' },
  partner:  { email: 'loja.teste@pintai.dev',    password: 'teste123!', name: 'Casa das Tintas Teste' },
  admin:    { email: 'andre@agenscia.com',        password: process.env.ADMIN_PASSWORD || 'admin123!' },
}

export async function signUpEmail(page: Page, email: string, password: string, name: string, role: 'customer' | 'painter' | 'partner' = 'customer') {
  await page.goto('/login?tab=register')
  await page.waitForSelector('input[placeholder="Seu nome completo"]')

  // Select role
  const roleLabels = { customer: 'Cliente', painter: 'Pintor', partner: 'Loja parceira' }
  await page.click(`text=${roleLabels[role]}`)

  await page.fill('input[placeholder="Seu nome completo"]', name)
  await page.fill('input[placeholder="seu@email.com"]', email)
  await page.fill('input[placeholder="Mínimo 6 caracteres"]', password)
  await page.click('label:has(input[type="checkbox"])') // accept terms
  await page.click('button:has-text("Criar conta")')

  // Wait for success message (email confirmation required in Supabase)
  await page.waitForSelector('text=Conta criada', { timeout: 10_000 })
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.click('button:has-text("Entrar"):not([type="submit"])') // tab switch
  await page.fill('input[placeholder="seu@email.com"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]:has-text("Entrar")')
  await page.waitForURL(/\/(admin|portal|minha-area|onboarding)/, { timeout: 15_000 })
}

export async function signOut(page: Page) {
  // Click Sair if visible
  const sairBtn = page.locator('button:has-text("Sair"), a:has-text("Sair")').first()
  if (await sairBtn.isVisible()) await sairBtn.click()
  await page.waitForURL('/', { timeout: 5_000 }).catch(() => {})
}
