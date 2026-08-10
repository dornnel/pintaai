# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-multi-role-journey.spec.ts >> 10 — Jornada multi-perfil (cliente → pintor → clube) >> Fase 1A — Login e acesso à área do cliente
- Location: e2e/10-multi-role-journey.spec.ts:119:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1, h2').filter({ hasText: /Olá|Bem-vindo|Dashboard|Pedidos/i }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('h1, h2').filter({ hasText: /Olá|Bem-vindo|Dashboard|Pedidos/i }).first()

```

```yaml
- complementary:
  - text: Pinte Rápido Minha Área
  - paragraph: Jorge Multi Teste
  - paragraph: multi.role.teste@pintaai.dev
  - navigation:
    - link "Início":
      - /url: /minha-area
    - link "Minhas Solicitações":
      - /url: /minha-area/pedidos
    - link "Pedidos":
      - /url: /minha-area/contratos
    - link "Avaliações":
      - /url: /minha-area/avaliacoes
    - link "Perfil":
      - /url: /minha-area/perfil
    - button "Nova solicitação"
  - button "Voltar ao site"
  - button "Sair"
- banner: Pinte Rápido Minha Área
- main:
  - heading "Minha Área" [level=1]
  - paragraph: Acompanhe suas solicitações e as propostas dos pintores.
  - link "0 Solicitações":
    - /url: /minha-area/pedidos
    - paragraph: "0"
    - paragraph: Solicitações
  - link "0 Propostas":
    - /url: /minha-area/pedidos
    - paragraph: "0"
    - paragraph: Propostas
  - link "0 Pedidos":
    - /url: /minha-area/contratos
    - paragraph: "0"
    - paragraph: Pedidos
  - link "Nova solicitação de orçamento Receba propostas de pintores qualificados":
    - /url: /chat
    - paragraph: Nova solicitação de orçamento
    - paragraph: Receba propostas de pintores qualificados
  - heading "Solicitações Recentes" [level=2]
  - paragraph: Nenhuma solicitação ainda.
  - paragraph: Use o chat para solicitar um orçamento grátis!
- paragraph: Usamos cookies 🍪
- paragraph:
  - text: Utilizamos cookies para melhorar sua experiência, analisar o uso da plataforma e personalizar conteúdo. Seus dados são protegidos pela
  - link "Política de Privacidade":
    - /url: /privacidade
  - text: e pela LGPD.
- button
- button "Só essenciais"
- button "Aceitar tudo"
```

# Test source

```ts
  26  | const LS_KEY = `sb-${PROJECT_REF}-auth-token`
  27  | 
  28  | const USER = {
  29  |   email:    'multi.role.teste@pintaai.dev',
  30  |   password: 'Teste@12345',
  31  |   name:     'Jorge Multi Teste',
  32  | }
  33  | 
  34  | // ── helpers ───────────────────────────────────────────────────────────────────
  35  | 
  36  | /** Creates (or re-uses) the test user in both Auth + pintae.users */
  37  | async function seedUser(): Promise<string> {
  38  |   // Attempt reuse
  39  |   const { data: existing } = await appDb.from('users').select('id').eq('email', USER.email).maybeSingle()
  40  |   if (existing) return existing.id
  41  | 
  42  |   const { data: authData, error: authErr } = await authDb.auth.admin.createUser({
  43  |     email: USER.email, password: USER.password, email_confirm: true,
  44  |   })
  45  |   if (authErr || !authData.user) throw authErr ?? new Error('Failed to create auth user')
  46  | 
  47  |   const { data: row, error: insertErr } = await appDb.from('users').insert({
  48  |     auth_user_id: authData.user.id,
  49  |     email: USER.email,
  50  |     name: USER.name,
  51  |     phone: '48999000000',  // NOT NULL in pintae.users — required placeholder
  52  |     role: 'customer',
  53  |     roles: ['customer'],
  54  |     status: 'active',
  55  |     registration_source: 'test',
  56  |   }).select('id').single()
  57  | 
  58  |   if (insertErr) throw insertErr
  59  |   return row!.id
  60  | }
  61  | 
  62  | /**
  63  |  * Programmatic login: signs in via Supabase anon client, injects the session
  64  |  * token into the browser's localStorage — bypasses the UI login form entirely.
  65  |  * Much more reliable in e2e tests than clicking through multi-step forms.
  66  |  */
  67  | async function loginProgrammatic(context: BrowserContext): Promise<void> {
  68  |   const tempClient = createClient(SB_URL, SB_ANON)
  69  |   const { data, error } = await tempClient.auth.signInWithPassword({
  70  |     email: USER.email,
  71  |     password: USER.password,
  72  |   })
  73  |   if (error || !data.session) throw error ?? new Error('Programmatic login failed')
  74  | 
  75  |   // Inject session into the app page so localStorage is on the right origin.
  76  |   const page = await context.newPage()
  77  |   await page.goto('/')  // must be on app origin — about:blank blocks localStorage
  78  |   await page.evaluate(
  79  |     ({ key, session }) => {
  80  |       localStorage.setItem(key, JSON.stringify({
  81  |         access_token: session.access_token,
  82  |         refresh_token: session.refresh_token,
  83  |         expires_at: session.expires_at,
  84  |         expires_in: session.expires_in,
  85  |         token_type: session.token_type,
  86  |         user: session.user,
  87  |       }))
  88  |     },
  89  |     { key: LS_KEY, session: data.session }
  90  |   )
  91  |   await page.close()
  92  | }
  93  | 
  94  | /** Open a new page that is already authenticated */
  95  | async function newAuthPage(context: BrowserContext): Promise<Page> {
  96  |   await loginProgrammatic(context)
  97  |   const page = await context.newPage()
  98  |   return page
  99  | }
  100 | 
  101 | // ── suite ─────────────────────────────────────────────────────────────────────
  102 | 
  103 | test.describe('10 — Jornada multi-perfil (cliente → pintor → clube)', () => {
  104 |   let pintaeUserId: string
  105 | 
  106 |   test.beforeAll(async () => {
  107 |     await deleteUserByEmail(USER.email)
  108 |     pintaeUserId = await seedUser()
  109 |   })
  110 | 
  111 |   test.afterAll(async () => {
  112 |     await deleteUserByEmail(USER.email)
  113 |   })
  114 | 
  115 |   // ────────────────────────────────────────────────────────────────────────────
  116 |   // FASE 1 — Cliente: login + lead pelo chat
  117 |   // ────────────────────────────────────────────────────────────────────────────
  118 | 
  119 |   test('Fase 1A — Login e acesso à área do cliente', async ({ context }) => {
  120 |     const page = await newAuthPage(context)
  121 |     await page.goto('/minha-area')
  122 |     await page.waitForURL(/\/minha-area/, { timeout: 15_000 })
  123 | 
  124 |     await expect(
  125 |       page.locator('h1, h2').filter({ hasText: /Olá|Bem-vindo|Dashboard|Pedidos/i }).first()
> 126 |     ).toBeVisible({ timeout: 10_000 })
      |       ^ Error: expect(locator).toBeVisible() failed
  127 | 
  128 |     await expect(
  129 |       page.locator('a[href="/minha-area/pedidos"], nav a:has-text("Pedidos")').first()
  130 |     ).toBeVisible()
  131 |   })
  132 | 
  133 |   test('Fase 1B — Envia lead pelo chat (auth gate não aparece — já logado)', async ({ context }) => {
  134 |     const page = await newAuthPage(context)
  135 |     await page.goto('/chat')
  136 |     await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })
  137 | 
  138 |     // Aguarda o agente inicializar e clica na sugestão
  139 |     await page.waitForTimeout(1000)
  140 |     const startBtn = page.locator('button:has-text("Quero um orçamento")').first()
  141 |     if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
  142 |       await startBtn.click()
  143 |     } else {
  144 |       const ta = page.locator('textarea').first()
  145 |       await ta.fill('Quero um orçamento')
  146 |       await page.keyboard.press('Enter')
  147 |     }
  148 |     await page.waitForTimeout(2000)
  149 | 
  150 |     // Responde sequencialmente — tenta chip primeiro, depois textarea
  151 |     async function reply(text: string) {
  152 |       const chip = page.locator(`button[class*="rounded-full"]:has-text("${text}")`).first()
  153 |       if (await chip.isVisible({ timeout: 2500 }).catch(() => false)) {
  154 |         await chip.click()
  155 |       } else {
  156 |         const ta = page.locator('textarea').first()
  157 |         await ta.fill(text)
  158 |         await page.keyboard.press('Enter')
  159 |       }
  160 |       await page.waitForTimeout(1500)
  161 |     }
  162 | 
  163 |     // Fluxo tipo de serviço → imóvel → bairro → área → condição → prazo → material
  164 |     await reply('Pintura interna')
  165 |     await reply('Apartamento')
  166 |     await reply('Campeche')
  167 |     await reply('60')
  168 |     await reply('Repintura simples')
  169 |     await reply('Até 1 mês')
  170 |     await reply('Tinta inclusa no orçamento')
  171 | 
  172 |     // Aguarda briefing (envolve edge function — até 30s)
  173 |     await page.waitForSelector('text=/Pedido enviado|Protocolo|PT-/', { timeout: 30_000 })
  174 | 
  175 |     // Auth gate NÃO deve ter aparecido (usuário já estava autenticado)
  176 |     await expect(page.locator('text=Entrar na Pinte Rápido')).not.toBeVisible()
  177 | 
  178 |     // Upsell do Clube deve aparecer ~3.5s depois do briefing
  179 |     await page.waitForSelector('text=/Clube Pinte Rápido|R\\$49/', { timeout: 12_000 })
  180 |   })
  181 | 
  182 |   test('Fase 1C — Auth gate aparece para usuário não logado', async ({ page }) => {
  183 |     await page.goto('/chat')
  184 |     await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })
  185 |     await page.waitForTimeout(1000)
  186 | 
  187 |     // Helper: chip first, textarea fallback
  188 |     const ta = page.locator('textarea').first()
  189 |     async function send(text: string, waitMs = 1800) {
  190 |       const chip = page.locator(`button[class*="rounded-full"]:has-text("${text}")`).first()
  191 |       if (await chip.isVisible({ timeout: 2000 }).catch(() => false)) {
  192 |         await chip.click()
  193 |       } else {
  194 |         await ta.fill(text)
  195 |         await page.keyboard.press('Enter')
  196 |       }
  197 |       await page.waitForTimeout(waitMs)
  198 |     }
  199 | 
  200 |     // Responde fluxo completo até o auth gate aparecer
  201 |     await send('Quero um orçamento')
  202 |     await send('Maria Visitante')           // nome
  203 |     await send('Pintura interna')           // tipo de serviço
  204 |     await send('Apartamento')               // tipo de imóvel
  205 |     await send('Campeche')                  // bairro
  206 |     await send('60')                        // área m²
  207 |     await send('Repintura simples')         // condição das paredes
  208 |     await send('Até 1 mês')                // prazo
  209 | 
  210 |     // Auth gate deve aparecer antes ou durante o step de email
  211 |     await page.waitForSelector(
  212 |       'text=/já tem uma conta|Já tenho conta|Entrar com Google|Preencher meus dados/',
  213 |       { timeout: 20_000 }
  214 |     )
  215 | 
  216 |     // Clicar "Já tenho conta" → card de login inline
  217 |     const jaTemConta = page.locator('button:has-text("Já tenho conta"), button:has-text("✅")').first()
  218 |     await jaTemConta.click()
  219 |     await page.waitForTimeout(800)
  220 |     await page.waitForSelector('text=Entrar na Pinte Rápido', { timeout: 5_000 })
  221 | 
  222 |     await expect(page.locator('input[type="email"][placeholder*="email"]').first()).toBeVisible()
  223 |     await expect(page.locator('input[type="password"]').first()).toBeVisible()
  224 |     await expect(page.locator('text=Continuar com Google')).toBeVisible()
  225 |   })
  226 | 
```