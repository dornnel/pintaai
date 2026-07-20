import OpenAI from 'npm:openai@4'
import { createClient } from 'npm:@supabase/supabase-js@2'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const SYSTEM_PROMPT = `Você é o Koke, assistente da Pintai Floripa. Humano, direto, simpático — nunca robótico.

Tom: PT-BR natural, curto. **Negrito** só em campos-chave. Máx 2 linhas por mensagem. Emojis com moderação.

REGRA DE OURO: Se o usuário já informou qualquer dado (nome, bairro, tipo de imóvel, metragem…), NÃO pergunte de novo. Reconheça e avance.

JORNADA DO CLIENTE (colete nesta ordem, UMA pergunta por vez, pulando o que já foi informado):

1. **Tipo de serviço** — Pintura interna / Fachada / Repintura / Textura / Grafiato / 1ª pintura (imóvel novo)
2. **Bairro** — Campeche, Rio Tavares, Armação, Morro das Pedras, Pântano do Sul, Outro
3. **Tipo de imóvel** — Apartamento / Casa / Sala-Escritório / Loja-Comércio / Outro
   → Casa: pergunte se é pintura Interna, Externa (fachada/muros) ou Ambas
   → Apartamento: não pergunte sobre visita técnica (orçamento a distância suficiente)
   → Outros (Loja, Escritório): pergunte se quer visita técnica ou orçamento a distância
4. **Superfícies** (multi-select) — Paredes / Teto / Portas / Janelas / Rodapés / Colunas
5. **Ambientes** — Ex: "2 quartos + sala + cozinha + 1 banheiro" (texto livre, pode pular)
6. **Metragem aproximada** — Até 25m² / 25-50m² / 50-75m² / 75-100m² / 100-125m² / Acima de 125m² (pode pular)
7. **Estado das paredes** (pode marcar vários) — Bom estado / Manchas / Descascando / Rachaduras / Mofo / Pós-obra
8. **Extras** (multi-select, opcional) — Tem infiltrações / Precisa de reparos / Lavagem da fachada / Nenhum
9. **Prazo** — Urgente / Em 2 semanas / Próximo mês / Sem pressa
10. **Material** — Incluso / Vou comprar / Pintor que indique
11. **Fotos/vídeos** — peça gentilmente, explique que aumentam a precisão
12. **WhatsApp** e/ou **E-mail** para receber as propostas

REGRAS:
- Nunca prometa preço final ou faixa de preço
- Se houver urgência, reconheça e priorize
- Fotos recebidas: agradeça e prossiga
- Mensagens inadequadas: recuse educadamente e retome

Sempre responda em JSON:
{
  "message": "texto natural",
  "quick_replies": ["opção 1", "opção 2"] | null,
  "action": "generate_briefing" | "register_painter" | null,
  "collected": {
    "role": "client" | "painter" | null,
    "neighborhood": "...",
    "property_type": "...",
    "property_scope": "Apenas interna | Apenas externa | Ambas | null",
    "service_type": "...",
    "surfaces": "...",
    "wall_condition": "...",
    "extras": "...",
    "deadline": "...",
    "material": "..."
  }
}`

interface RequestBody {
  session_id: string
  message: string
  history: { role: string; content: string }[]
  media_urls?: string[]
  metadata?: Record<string, unknown>
  action?: string
  collected?: Record<string, unknown>
  previous_field?: string | null
  previous_value?: string | null
  next_question?: string
  collected_data?: Record<string, unknown>
  user_name?: string
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = (await req.json()) as RequestBody
    const { session_id, message, history, media_urls, metadata, action, collected, previous_field, previous_value, next_question, collected_data, user_name } = body

    // Persist conversation session (async, fire-and-forget)
    supabase.from('conversation_sessions').upsert({
      session_id,
      user_identifier: session_id,
      channel: 'web',
      current_state: 'active',
      collected_data: { _metadata: metadata || {} },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' }).then(() => {}).catch(console.error)

    // Verifica se o email já está cadastrado na plataforma
    if (action === 'check_email') {
      const emailAddr = (body as Record<string, string>).email
      if (!emailAddr) {
        return new Response(JSON.stringify({ exists: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: existing } = await supabase
        .from('users')
        .select('id, name, auth_user_id')
        .eq('email', emailAddr)
        .maybeSingle()
      return new Response(
        JSON.stringify({ exists: !!existing, name: existing?.name ?? null, has_account: !!existing?.auth_user_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Generic AI assistant mode — painter/admin context-aware chat
    if (action === 'assistant' || (body as Record<string, unknown>).adminMode === true) {
      const customMessages = (body as Record<string, unknown>).messages as { role: string; content: string }[] | undefined
      if (customMessages && customMessages.length > 0) {
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          temperature: 0.7,
          messages: customMessages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
        })
        return new Response(
          JSON.stringify({ message: resp.choices[0].message.content?.trim() || '' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // Generate a natural, conversational question or validation feedback
    if (action === 'generate_question' && collected) {
      const { field, context } = collected as { field: string; context: Record<string, unknown> }

      let questionPrompt: string
      if (field.startsWith('validation_')) {
        const realField = field.replace('validation_', '')
        const { value, hint } = context as { value: string; hint: string }
        questionPrompt = `Você é o Koke, assistente da Pintai Floripa. Tom: amigável, empático, PT-BR natural.

O usuário tentou preencher o campo "${realField}" com: "${value}"
Problema: ${hint}

Gere UMA mensagem curta e amigável explicando que esse valor não serve para "${realField}" e pedindo novamente de forma natural. Não seja repetitivo. Máx 1-2 linhas. Sem JSON.`
      } else {
        questionPrompt = `Você é o Koke, assistente da Pintai Floripa. Tom: amigável, direto, PT-BR natural.

Dados já coletados: ${JSON.stringify(context)}
Campo que precisa coletar agora: ${field}

Gere UMA pergunta curta e natural para coletar "${field}". Varie o estilo — não seja repetitivo.
Se tiver contexto relevante (ex: nome do usuário), use-o na pergunta.
Retorne APENAS o texto da pergunta, sem JSON, sem aspas extras.`
      }

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 128,
        temperature: 0.8,
        messages: [{ role: 'user', content: questionPrompt }],
      })
      const question = resp.choices[0].message.content?.trim() || ''
      return new Response(
        JSON.stringify({ message: question }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Gera mensagem de transição: reage à resposta/texto anterior e emenda a próxima pergunta
    if (action === 'generate_transition' && next_question) {
      const contextLine = user_name ? `Nome do usuário: ${user_name}\n` : ''

      const transitionPrompt = previous_field
        ? `O usuário respondeu ao campo "${previous_field}" com: "${previous_value}"
${contextLine}Dados já coletados: ${JSON.stringify(collected_data || {})}

Gere UMA mensagem curta (1-2 frases) que primeiro reaja brevemente e de forma natural a essa resposta, e depois emende a pergunta abaixo, preservando o sentido original dela:
"${next_question}"

Mantenha as formatações **negrito**, quebras de linha e emojis já presentes na pergunta. Retorne APENAS o texto puro, sem JSON, sem aspas extras.`
        : `O usuário disse, em texto livre, ao iniciar a conversa: "${previous_value}"
${contextLine}
Gere UMA mensagem curta (1-2 frases) que primeiro reaja de forma natural e acolhedora a essa mensagem (interpretando que é um cliente buscando um serviço de pintura), e depois emende a pergunta abaixo, preservando o sentido original dela:
"${next_question}"

Mantenha as formatações **negrito**, quebras de linha e emojis já presentes na pergunta. Retorne APENAS o texto puro, sem JSON, sem aspas extras.`

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        temperature: 0.6,
        messages: [
          { role: 'system', content: 'Você é o Koke, assistente da Pintai Floripa. Tom: natural, simpático, PT-BR. Responda em texto puro, sem JSON, sem markdown de bloco de código.' },
          { role: 'user', content: transitionPrompt },
        ],
      })
      let transitionMessage = resp.choices[0].message.content?.trim() || next_question
      // Guard: se o modelo retornar JSON mesmo assim, extrai o campo message
      try {
        const parsed = JSON.parse(transitionMessage)
        if (typeof parsed?.message === 'string') transitionMessage = parsed.message
      } catch { /* texto puro, como esperado */ }
      return new Response(
        JSON.stringify({ message: transitionMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // If explicit briefing generation, skip conversation
    if (action === 'generate_briefing' && collected) {
      const briefingData = await generateBriefing(collected, history, media_urls)
      return new Response(
        JSON.stringify({ message: 'Briefing gerado.', briefing: briefingData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Extração em massa de todos os campos de uma mensagem inicial rica
    if (action === 'extract_initial_context') {
      const extractPrompt = `Você é um extrator de dados para uma plataforma de pintura em Florianópolis.

Mensagem do cliente: "${message}"

Extraia TODOS os dados identificáveis. Para campos não encontrados, use null. Retorne SOMENTE JSON válido:
{
  "name": "nome da pessoa (somente nome, ex: André) ou null",
  "service_type": "Pintura interna|Fachada / Externa|Repintura – mesma cor|Repintura – nova cor|Textura / Grafiato|1ª pintura (imóvel novo) ou null",
  "area_m2": número OU string de faixa ("25–50 m²") ou null,
  "property_type": "Apartamento|Casa|Sala / Escritório|Loja / Comércio|Outro ou null",
  "property_scope": "Apenas interna|Apenas externa|Ambas (interna + externa) ou null (só para Casa)",
  "neighborhood": "nome do bairro (Campeche, Rio Tavares, Armação, Morro das Pedras, Pântano do Sul, etc.) ou null",
  "surfaces": "Paredes|Teto|Portas|Janelas|Rodapés (pode ser combinação com ' + ') ou null",
  "wall_condition": "Bom estado|Manchas / sujeira|Descascando|Rachaduras|Mofo|Pós-obra / novo (pode ser combinação com ' + ') ou null",
  "extras": "Tem infiltrações|Precisa de reparos|Incluir lavagem da fachada ou null",
  "deadline": "🔴 Urgente – o quanto antes|📅 Em 2 semanas|🗓️ Próximo mês|⏳ Sem pressa ou null",
  "material": "Incluso no serviço|Vou comprar separado|Pintor que indique ou null",
  "whatsapp": "número com DDD somente dígitos ou null",
  "role": "painter (se a pessoa disser que É pintor e quer se cadastrar) ou null"
}

Exemplos:
- "kitnet de 40m2, paredes e teto" → property_type:"Apartamento", area_m2:40, surfaces:"Paredes + Teto"
- "casa no Campeche, pintura interna, 3 quartos" → property_type:"Casa", property_scope:"Apenas interna", neighborhood:"Campeche"
- "vou comprar o material separado" → material:"Vou comprar separado"
- "devolver imóvel de 60m2 para imobiliária" → area_m2:60, service_type:"Pintura interna"
- "parede com rachadura e mofo" → wall_condition:"Rachaduras + Mofo"
- "oi meu nome é André" → name:"André"
- "preciso urgente" → deadline:"🔴 Urgente – o quanto antes"
- "fachada da loja" → property_type:"Loja / Comércio", service_type:"Fachada / Externa"`

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0,
        messages: [{ role: 'user', content: extractPrompt }],
      })

      const rawExtracted = resp.choices[0].message.content?.trim() || '{}'
      let extracted: Record<string, unknown> = {}
      try {
        const m = rawExtracted.match(/\{[\s\S]*\}/)
        if (m) extracted = JSON.parse(m[0])
      } catch { /* return empty */ }

      for (const k of Object.keys(extracted)) {
        if (extracted[k] === null || extracted[k] === 'null' || extracted[k] === '') {
          delete extracted[k]
        }
      }

      return new Response(
        JSON.stringify({ extracted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Extração de campo via linguagem natural (gpt-4o-mini, barato)
    if (action === 'extract_field' && collected) {
      const { field, text: inputText } = collected as { field: string; text: string }
      const fieldDescriptions: Record<string, string> = {
        name: 'nome de uma pessoa (apenas o nome, sem frases)',
        email: 'endereço de e-mail válido no formato usuario@dominio.com',
        whatsapp: 'número de telefone celular com DDD (apenas dígitos)',
      }
      const extractionPrompt =
        `Extraia "${fieldDescriptions[field] || field}" da mensagem abaixo.\n` +
        `Retorne SOMENTE o valor extraído, sem explicação.\n` +
        `Se não conseguir extrair um valor válido, retorne exatamente: null\n\n` +
        `Mensagem: "${inputText}"\n\n` +
        `Exemplos para "name": "pode chamar de João" → João | "campeche" → null | "meu nome é Ana" → Ana\n` +
        `Exemplos para "email": "meu email é joao@gmail.com" → joao@gmail.com | "joao arroba gmail" → null\n` +
        `Exemplos para "whatsapp": "48 9 9999-9999" → 48999999999 | "fala no 48 99999 9999" → 4899999 9999`

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 64,
        temperature: 0,
        messages: [{ role: 'user', content: extractionPrompt }],
      })
      const extracted = resp.choices[0].message.content?.trim() || 'null'
      return new Response(
        JSON.stringify({ extracted: extracted === 'null' ? null : extracted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build user content
    let userContent = message === '__init__' ? 'Olá, acessei a plataforma.' : message
    if (media_urls && media_urls.length > 0) {
      userContent += `\n[Usuário enviou ${media_urls.length} imagem(ns): ${media_urls.join(', ')}]`
    }

    // Call GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10).map((h) => ({
          role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: userContent },
      ],
    })

    const rawText = response.choices[0].message.content?.trim() || ''

    let parsed: {
      message: string
      quick_replies?: string[] | null
      action?: string | null
      collected?: Record<string, unknown>
    }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      parsed = { message: rawText, quick_replies: null, action: null }
    }

    // If briefing action triggered by AI
    let briefingData = null
    if (parsed.action === 'generate_briefing' && parsed.collected) {
      briefingData = await generateBriefing(parsed.collected, history, media_urls)
    }

    // Save message log (async)
    supabase.from('messages').insert({
      session_id,
      channel: 'web',
      direction: 'inbound',
      body: userContent,
      ai_intent: parsed.action || 'chat',
      metadata: { parsed_response: parsed.message, browser: metadata || {} },
    }).then(() => {}).catch(console.error)

    // Moderation (async, non-blocking)
    moderateMessage(session_id, userContent).catch(console.error)

    return new Response(
      JSON.stringify({
        message: parsed.message,
        quickReplies: parsed.quick_replies || undefined,
        briefing: briefingData,
        action: parsed.action,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-chat error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function generateBriefing(
  collected: Record<string, unknown>,
  history: { role: string; content: string }[],
  mediaUrls?: string[],
): Promise<unknown> {
  const briefingPrompt = `Você é o agente orçamentista técnico da Pintai Floripa.

Dados coletados:
${JSON.stringify(collected, null, 2)}

Histórico da conversa:
${history.map((h) => `${h.role}: ${h.content}`).join('\n')}

${mediaUrls?.length ? `Mídias enviadas: ${mediaUrls.length} imagem(ns)` : ''}

IMPORTANTE: NÃO gere "preco_min_estimado"/"preco_max_estimado"/"confianca_preco" — esses valores são calculados por um motor de regras separado a partir da área (m²) informada pelo cliente. Foque em resumo_cliente, briefing_tecnico, riscos, observacoes_para_pintor. Use "metragem_estimada_m2"/"confianca_metragem" apenas como fallback (estimativa visual pelas fotos), caso o cliente não tenha informado a metragem.

Gere um briefing técnico completo. Responda APENAS com JSON válido:
{
  "resumo_cliente": "...",
  "briefing_tecnico": "...",
  "tipo_servico": "...",
  "superficies": [],
  "estado_parede": "...",
  "metragem_estimada_m2": null,
  "confianca_metragem": "baixa|media|alta",
  "materiais_recomendados": [],
  "perguntas_faltantes": [],
  "riscos": [],
  "observacoes_para_pintor": "...",
  "profissional_preferido": "...",
  "orcamento_estimado_cliente": "...",
  "cor_atual_paredes": "...",
  "nivel_urgencia": "baixo|médio|alto",
  "complexidade": "simples|media|complexa"
}`

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [{ role: 'user', content: briefingPrompt }],
  })

  const text = resp.choices[0].message.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

async function moderateMessage(sessionId: string, message: string): Promise<void> {
  if (message === '__init__' || message.length < 5) return

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Analise esta mensagem de uma plataforma de serviços. Responda APENAS com JSON:
Mensagem: "${message}"
{"has_flag": false, "flag_type": null, "severity": null, "explanation": ""}
Tipos: "offensive" | "bypass_attempt" | "ethics_violation" | "spam"
Severidades: "low" | "medium" | "high"`,
    }],
  })

  const text = resp.choices[0].message.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return

  const result = JSON.parse(match[0])
  if (!result.has_flag) return

  await supabase.from('moderation_flags').insert({
    message_id: `session_${sessionId}_${Date.now()}`,
    flag_type: result.flag_type,
    severity: result.severity,
    ai_explanation: result.explanation,
    status: 'pending',
  })
}
