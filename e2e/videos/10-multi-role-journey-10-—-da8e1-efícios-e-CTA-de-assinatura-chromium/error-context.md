# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-multi-role-journey.spec.ts >> 10 — Jornada multi-perfil (cliente → pintor → clube) >> Fase 3A — /clube carrega com benefícios e CTA de assinatura
- Location: e2e/10-multi-role-journey.spec.ts:337:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1, h2').filter({ hasText: /Clube|Pinte Rápido/i }).first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('h1, h2').filter({ hasText: /Clube|Pinte Rápido/i }).first()

```

```yaml
- text: Clube Pinte Rápido
- heading "Transforme sua reforma com IA e pintores parceiros" [level=1]
- paragraph: Visualize o resultado antes de pintar, conte com pintores certificados e tenha toda a experiência gerenciada pela nossa equipe.
- button "Assinar o Clube — R$49/mês"
- paragraph: 10 créditos de IA inclusos · Cancele quando quiser
- heading "O que está incluso" [level=2]
- paragraph: 10 créditos de IA por mês
- paragraph: Use a Prévia com IA para visualizar a pintura antes de contratar.
- paragraph: Pintores parceiros certificados
- paragraph: Acesso prioritário aos pintores verificados e avaliados pela Pinte Rápido.
- paragraph: Descontos em materiais
- paragraph: Descontos exclusivos com fornecedores parceiros de tinta, massa e primer.
- paragraph: Acompanhamento exclusivo
- paragraph: Equipe dedicada da Pinte Rápido monitora seu projeto do início ao fim.
- paragraph: WhatsApp dedicado
- paragraph: Canal direto com especialistas para tirar dúvidas e resolver imprevistos.
- paragraph: Retenção de pagamento
- paragraph: O pagamento fica retido na plataforma e só é liberado após aprovação do serviço.
- text: R$49 /mês
- paragraph: 10 créditos de IA renovados mensalmente
- list:
  - listitem: Prévia com IA — 10 gerações/mês
  - listitem: Pintores certificados Pinte Rápido
  - listitem: Acompanhamento exclusivo da equipe
  - listitem: Descontos em materiais parceiros
- button "Quero ser membro"
- heading "Perguntas frequentes" [level=3]
- paragraph: O que são os créditos de IA?
- paragraph: Cada crédito gera uma prévia da pintura com IA. Você recebe 10 créditos por mês, renovados na data de renovação.
- paragraph: Como funciona o acompanhamento exclusivo?
- paragraph: "Nossa equipe gerencia todo o processo: indica pintores, acompanha o andamento e garante que o resultado atenda às expectativas."
- paragraph: Como cancelo?
- paragraph: Cancele na página do Clube a qualquer momento, sem multa. Não há reembolso proporcional.
- link "Ver ferramentas gratuitas →":
  - /url: /ferramentas
- paragraph: Usamos cookies 🍪
- paragraph:
  - text: Utilizamos cookies para melhorar sua experiência, analisar o uso da plataforma e personalizar conteúdo. Seus dados são protegidos pela
  - link "Política de Privacidade":
    - /url: /privacidade
  - text: e pela LGPD.
- button
- button "Só essenciais"
- button "Aceitar tudo"
- navigation:
  - link "Início":
    - /url: /
  - link "Ferramentas":
    - /url: /ferramentas
  - link "Chat":
    - /url: /chat
  - link "Loja":
    - /url: /marketplace
  - link "Eu":
    - /url: /minha-area
```

# Test source

```ts
  244 |     await page.waitForSelector('img[alt="Koke"]', { timeout: 10_000 })
  245 |     await page.waitForTimeout(1000)
  246 | 
  247 |     const ta = page.locator('textarea').first()
  248 |     await ta.fill('Quero me cadastrar como pintor')
  249 |     await page.keyboard.press('Enter')
  250 | 
  251 |     // Agente reage com fluxo de pintor
  252 |     await page.waitForSelector(
  253 |       'text=/pintor|cadastro|experiência|especialidade|Finalizar|Seja/',
  254 |       { timeout: 15_000 }
  255 |     )
  256 | 
  257 |     // CTA de finalizar cadastro de pintor deve aparecer
  258 |     await page.waitForSelector(
  259 |       'a[href="/seja-pintor"], button:has-text("Finalizar cadastro"), a:has-text("cadastro de pintor")',
  260 |       { timeout: 20_000 }
  261 |     )
  262 | 
  263 |     // Upsell do Pro aparece ~2.5s depois
  264 |     await page.waitForSelector('text=/Plano Pro|R\\$97/', { timeout: 10_000 })
  265 |   })
  266 | 
  267 |   test('Fase 2C — DB: promover para painter e acessar portal do pintor', async ({ context }) => {
  268 |     // Promover via admin API (simula ser-pintor / aprovação admin)
  269 |     await appDb.from('users').update({
  270 |       role: 'painter',
  271 |       roles: ['painter', 'customer'],
  272 |     }).eq('id', pintaeUserId)
  273 | 
  274 |     const { data: nbhoods } = await appDb.from('neighborhoods').select('id').limit(2)
  275 |     await appDb.from('painters').upsert({
  276 |       user_id: pintaeUserId,
  277 |       bio: 'Pintor e cliente multi-role para testes',
  278 |       experience_years: 5,
  279 |       neighborhoods_served: (nbhoods ?? []).map(n => n.id),
  280 |       service_types: ['Pintura interna'],
  281 |       pro_plan_status: 'none',
  282 |     }, { onConflict: 'user_id' })
  283 | 
  284 |     const page = await newAuthPage(context)
  285 |     await page.goto('/portal/pintor')
  286 |     await page.waitForURL(/\/portal\/pintor/, { timeout: 15_000 })
  287 | 
  288 |     await expect(
  289 |       page.locator('h1, h2').filter({ hasText: /Dashboard|Solicitações|Bem-vindo|Pintor/i }).first()
  290 |     ).toBeVisible({ timeout: 8_000 })
  291 |   })
  292 | 
  293 |   test('Fase 2D — Formulário de assinatura Pro (R$97) renderiza', async ({ context }) => {
  294 |     const page = await newAuthPage(context)
  295 |     await page.goto('/portal/pintor/assinatura')
  296 |     await page.waitForLoadState('networkidle')
  297 | 
  298 |     await expect(
  299 |       page.locator('h1, h2').filter({ hasText: /Assinatura|Plano/i }).first()
  300 |     ).toBeVisible({ timeout: 8_000 })
  301 | 
  302 |     // Preço Pro deve estar visível
  303 |     await expect(page.locator('text=/R\\$97|97\\/mês/')).toBeVisible()
  304 | 
  305 |     // Se há botão Assinar → clica para ir ao checkout
  306 |     const subscribeBtn = page.locator(
  307 |       'button:has-text("Assinar"), button:has-text("Ver Plano"), button:has-text("Upgrade")'
  308 |     ).first()
  309 |     if (await subscribeBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
  310 |       await subscribeBtn.click()
  311 |       await page.waitForTimeout(600)
  312 |     }
  313 | 
  314 |     // Formulário de checkout deve aparecer (ou já estava visível)
  315 |     const checkoutVisible = await page.locator('text=/Forma de pagamento|Assinar Plano Pro/').isVisible({ timeout: 5_000 }).catch(() => false)
  316 |     if (checkoutVisible) {
  317 |       // Teste Boleto
  318 |       await page.locator('button:has-text("Boleto")').click()
  319 |       await page.waitForTimeout(400)
  320 |       const cpfField = page.locator('input[placeholder*="CPF"]').first()
  321 |       await expect(cpfField).toBeVisible()
  322 |       await expect(
  323 |         page.locator('button[type="submit"]:has-text("Confirmar")').first()
  324 |       ).toBeVisible()
  325 | 
  326 |       // Troca para Cartão — deve mostrar campos de cartão
  327 |       await page.locator('button:has-text("Cartão")').click()
  328 |       await page.waitForTimeout(400)
  329 |       await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).toBeVisible()
  330 |     }
  331 |   })
  332 | 
  333 |   // ────────────────────────────────────────────────────────────────────────────
  334 |   // FASE 3 — Clube Pinte Rápido
  335 |   // ────────────────────────────────────────────────────────────────────────────
  336 | 
  337 |   test('Fase 3A — /clube carrega com benefícios e CTA de assinatura', async ({ context }) => {
  338 |     const page = await newAuthPage(context)
  339 |     await page.goto('/clube')
  340 |     await page.waitForLoadState('networkidle')
  341 | 
  342 |     await expect(
  343 |       page.locator('h1, h2').filter({ hasText: /Clube|Pinte Rápido/i }).first()
> 344 |     ).toBeVisible({ timeout: 8_000 })
      |       ^ Error: expect(locator).toBeVisible() failed
  345 | 
  346 |     await expect(page.locator('text=/créditos de IA|Pintores parceiros|Descontos/')).toBeVisible()
  347 |     await expect(
  348 |       page.locator('button:has-text("Assinar"), button:has-text("Clube"), a:has-text("Assinar")').first()
  349 |     ).toBeVisible()
  350 |   })
  351 | 
  352 |   test('Fase 3B — Checkout do Clube: campos dinâmicos Cartão / Pix', async ({ context }) => {
  353 |     const page = await newAuthPage(context)
  354 |     await page.goto('/clube')
  355 |     await page.waitForLoadState('networkidle')
  356 | 
  357 |     // Clicar em assinar
  358 |     const joinBtn = page.locator(
  359 |       'button:has-text("Assinar o Clube"), button:has-text("Quero entrar"), button:has-text("Assinar")'
  360 |     ).first()
  361 |     await joinBtn.click()
  362 |     await page.waitForTimeout(800)
  363 | 
  364 |     await page.waitForSelector('text=/Assinar o Clube|Forma de pagamento/', { timeout: 8_000 })
  365 | 
  366 |     // Trocar para Cartão → campos dinâmicos aparecem
  367 |     await page.locator('button:has-text("Cartão")').click()
  368 |     await page.waitForTimeout(500)
  369 |     await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).toBeVisible()
  370 |     await expect(page.locator('input[placeholder*="0000 0000"]')).toBeVisible()
  371 |     await expect(page.locator('input[placeholder*="MM/"]')).toBeVisible()
  372 | 
  373 |     // Trocar para Pix → campos de cartão somem, aparece instrução Pix
  374 |     await page.locator('button:has-text("Pix")').click()
  375 |     await page.waitForTimeout(400)
  376 |     await expect(page.locator('input[placeholder="NOME SOBRENOME"]')).not.toBeVisible()
  377 |     await expect(page.locator('text=/QR Code Pix/')).toBeVisible()
  378 |   })
  379 | 
  380 |   test('Fase 3C — DB: ativar Clube e verificar ferramentas desbloqueadas', async ({ context }) => {
  381 |     // Simula webhook de pagamento confirmado — ativa clube diretamente no DB
  382 |     await appDb.from('users').update({
  383 |       is_club_member: true,
  384 |       club_credits: 10,
  385 |     }).eq('id', pintaeUserId)
  386 | 
  387 |     const page = await newAuthPage(context)
  388 |     await page.goto('/ferramentas')
  389 |     await page.waitForLoadState('networkidle')
  390 | 
  391 |     // Badge CLUBE no header
  392 |     await expect(page.locator('text=CLUBE').first()).toBeVisible({ timeout: 8_000 })
  393 | 
  394 |     // Créditos disponíveis visíveis
  395 |     await expect(
  396 |       page.locator('text=/10 crédito|créditos disponíveis/i').first()
  397 |     ).toBeVisible({ timeout: 8_000 })
  398 | 
  399 |     // Zona de upload desbloqueada (sem Lock, com "Toque para enviar")
  400 |     await expect(
  401 |       page.locator('text=/Toque para enviar|enviar foto do ambiente/i').first()
  402 |     ).toBeVisible()
  403 |   })
  404 | 
  405 |   test('Fase 3D — Estimativa IA (gratuita) calcula faixa de preço', async ({ context }) => {
  406 |     const page = await newAuthPage(context)
  407 |     await page.goto('/ferramentas')
  408 |     await page.waitForLoadState('networkidle')
  409 | 
  410 |     // Expandir o card de estimativa se necessário
  411 |     const expandBtn = page.locator('button:has-text("Estimativa de Orçamento")').first()
  412 |     if (await expandBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
  413 |       await expandBtn.click()
  414 |       await page.waitForTimeout(400)
  415 |     }
  416 | 
  417 |     // Preencher área
  418 |     await page.locator('input[type="number"]').first().fill('100')
  419 |     await page.waitForTimeout(400)
  420 | 
  421 |     // Resultado com faixa de preço deve aparecer
  422 |     await expect(
  423 |       page.locator('text=/Estimativa calculada/').first()
  424 |     ).toBeVisible({ timeout: 5_000 })
  425 |     await expect(
  426 |       page.locator('text=/R\\$.*–|–.*R\\$/').first()
  427 |     ).toBeVisible()
  428 |   })
  429 | 
  430 |   test('Fase 3E — /clube mostra status de membro + modal de cancelamento', async ({ context }) => {
  431 |     const page = await newAuthPage(context)
  432 |     await page.goto('/clube')
  433 |     await page.waitForLoadState('networkidle')
  434 | 
  435 |     // Status de membro (créditos ou badge)
  436 |     await expect(
  437 |       page.locator('text=/crédito|membro|Clube ativo|CLUBE/i').first()
  438 |     ).toBeVisible({ timeout: 8_000 })
  439 | 
  440 |     // Botão cancelar
  441 |     const cancelBtn = page.locator(
  442 |       'button:has-text("Cancelar"), button:has-text("cancelar assinatura")'
  443 |     ).first()
  444 |     if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
```