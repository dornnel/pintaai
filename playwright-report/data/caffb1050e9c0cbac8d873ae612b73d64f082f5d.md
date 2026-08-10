# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-multi-role-journey.spec.ts >> 10 — Jornada multi-perfil (cliente → pintor → clube) >> Fase 3D — Estimativa IA (gratuita) calcula faixa de preço
- Location: e2e/10-multi-role-journey.spec.ts:405:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[type="number"]').first()

```

# Test source

```ts
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
  344 |     ).toBeVisible({ timeout: 8_000 })
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
> 418 |     await page.locator('input[type="number"]').first().fill('100')
      |                                                        ^ Error: locator.fill: Test timeout of 60000ms exceeded.
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
  445 |       await cancelBtn.click()
  446 |       await page.waitForTimeout(600)
  447 |       // Modal de confirmação
  448 |       await expect(
  449 |         page.locator('text=/Cancelar o Clube|Cancelar assinatura\\?/').first()
  450 |       ).toBeVisible()
  451 |       // Fechar sem confirmar
  452 |       await page.locator('button:has-text("Manter")').click()
  453 |       await expect(
  454 |         page.locator('text=/Cancelar o Clube|Cancelar assinatura\\?/').first()
  455 |       ).not.toBeVisible()
  456 |     }
  457 |   })
  458 | 
  459 |   // ────────────────────────────────────────────────────────────────────────────
  460 |   // FASE 4 — Navegação mobile (BottomNav)
  461 |   // ────────────────────────────────────────────────────────────────────────────
  462 | 
  463 |   test('Fase 4 — BottomNav tab Ferramentas navega corretamente (iPhone 14)', async ({ context }) => {
  464 |     const page = await newAuthPage(context)
  465 |     await page.setViewportSize({ width: 390, height: 844 })
  466 |     await page.goto('/')
  467 |     await page.waitForLoadState('networkidle')
  468 | 
  469 |     const ferrTab = page.locator('a[href="/ferramentas"]').first()
  470 |     await expect(ferrTab).toBeVisible({ timeout: 5_000 })
  471 |     await ferrTab.click()
  472 |     await page.waitForURL(/\/ferramentas/, { timeout: 8_000 })
  473 | 
  474 |     await expect(
  475 |       page.locator('h1').filter({ hasText: /Ferramentas/i }).first()
  476 |     ).toBeVisible()
  477 |   })
  478 | })
  479 | 
```