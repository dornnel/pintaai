import OpenAI from 'npm:openai@4'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  type FlowStepRow, buildChecklist, missingRequired, inferPropertyScope, isFilled,
} from '../_shared/flowRules.ts'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const SYSTEM_PROMPT = `Você é o Koke, assistente da Pinte Rápido Floripa. Humano, direto, simpático — nunca robótico.

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
  channel?: 'web' | 'whatsapp'
  whatsapp_number?: string
}

const OUT_OF_SCOPE_REPLY = 'Cuidamos apenas de pintura de imóveis — casas, apartamentos, prédios, salas e lojas. 😊 Posso te ajudar com isso? Me conta o que você quer pintar aí.'

const DEFAULT_DISCOVERY_PROMPT = `Você é o Koke, assistente da Pinte Rápido Floripa no chat web e WhatsApp.
Tom: prático, simpático, local e objetivo. Frases curtas. Nunca pareça um formulário.
Nunca prometa preço final ou faixa de preço — apenas um pintor avalia isso depois.`

async function loadActiveAgentConfig(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from('agent_configs').select('*').eq('active', true).limit(1).maybeSingle()
  return data as { system_prompt?: string; model?: string; max_tokens?: number; temperature?: number } | null
}

async function loadFlowSteps(sb: ReturnType<typeof createClient>): Promise<FlowStepRow[]> {
  const { data } = await sb.from('agent_flow_steps').select('*').eq('active', true).eq('enabled', true).order('order_index')
  return (data || []) as FlowStepRow[]
}

function enumFromQuickReplies(steps: FlowStepRow[], fieldKey: string): string[] | undefined {
  const step = steps.find(s => s.field_key === fieldKey && s.branch === 'client')
  return step?.quick_replies && step.quick_replies.length > 0 ? step.quick_replies : undefined
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = (await req.json()) as RequestBody
    const { session_id, message, history, media_urls, metadata, action, collected, previous_field, previous_value, next_question, collected_data, user_name, channel } = body

    // Garante que a sessão existe e registra metadata — usa merge (nunca overwrite)
    // para não apagar collected_data já persistido por uma chamada concorrente.
    supabase.rpc('merge_session_collected_data', {
      p_session_id: session_id,
      p_patch: { _metadata: metadata || {} },
    }).then(() => {}).catch(console.error)
    supabase.from('conversation_sessions').update({
      channel: channel || 'web',
      current_state: 'active',
      updated_at: new Date().toISOString(),
    }).eq('session_id', session_id).then(() => {}).catch(console.error)

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

    // Generic AI assistant mode — painter/admin context-aware chat (requires auth)
    if (action === 'assistant' || (body as Record<string, unknown>).adminMode === true) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
        questionPrompt = `Você é o Koke, assistente da Pinte Rápido Floripa. Tom: amigável, empático, PT-BR natural.

O usuário tentou preencher o campo "${realField}" com: "${value}"
Problema: ${hint}

Gere UMA mensagem curta e amigável explicando que esse valor não serve para "${realField}" e pedindo novamente de forma natural. Não seja repetitivo. Máx 1-2 linhas. Sem JSON.`
      } else {
        questionPrompt = `Você é o Koke, assistente da Pinte Rápido Floripa. Tom: amigável, direto, PT-BR natural.

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
          { role: 'system', content: 'Você é o Koke, assistente da Pinte Rápido Floripa. Tom: natural, simpático, PT-BR. Responda em texto puro, sem JSON, sem markdown de bloco de código.' },
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
  "property_scope": "Apenas interna|Apenas externa|Ambas (interna + externa) ou null",
  "neighborhood": "nome do bairro (Campeche, Rio Tavares, Armação, Morro das Pedras, Pântano do Sul, etc.) ou null",
  "surfaces": "Paredes|Teto|Portas|Janelas|Rodapés (pode ser combinação com ' + ') ou null",
  "wall_condition": "Bom estado|Manchas / sujeira|Descascando|Rachaduras|Mofo|Pós-obra / novo (pode ser combinação com ' + ') ou null",
  "extras": "Tem infiltrações|Precisa de reparos|Incluir lavagem da fachada ou null",
  "deadline": "🔴 Urgente – o quanto antes|📅 Em 2 semanas|🗓️ Próximo mês|⏳ Sem pressa ou null",
  "material": "Incluso no serviço|Vou comprar separado|Pintor que indique ou null",
  "whatsapp": "número com DDD somente dígitos ou null",
  "role": "painter (se a pessoa disser que É pintor e quer se cadastrar) ou null"
}

Sinônimos obrigatórios para property_type:
- "residência", "residencia", "minha casa", "imóvel residencial" → "Casa"
- "prédio", "edificio", "edifício", "condomínio", "condominio" → "Prédio / Edifício"
- "kitnet", "studio", "flat", "apt", "apto", "apartamento" → "Apartamento"
- "escritório", "sala comercial", "sala" → "Sala / Escritório"
- "loja", "comércio", "comercio" → "Loja / Comércio"

Sempre que o cliente indicar onde será a pintura, preencha property_scope (para qualquer tipo de imóvel):
- "pintura externa", "fachada", "muros", "parte de fora" → "Apenas externa"
- "pintura interna", "por dentro", "quartos/sala" → "Apenas interna"
- "por dentro e por fora", "tudo" → "Ambas (interna + externa)"

Exemplos:
- "quero pintar minha residência" → property_type:"Casa"
- "pintura externa da minha casa" → property_type:"Casa", property_scope:"Apenas externa", service_type:"Fachada / Externa"
- "residencia de 3 quartos" → property_type:"Casa"
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

    // ── Motor conversacional único (web + WhatsApp) ──────────────────────────────
    // Substitui a máquina de estados rígida da fase de "descoberta" (o que a
    // pessoa quer pintar) por uma conversa livre com extração estruturada.
    // A garantia de captação total dos campos da regra de negócio NÃO depende
    // do bom senso do modelo: um checklist determinístico (buildChecklist, a
    // partir de agent_flow_steps) decide sozinho quando a etapa está completa.
    if (action === 'chat_turn') {
      const [config, steps, sessionRow] = await Promise.all([
        loadActiveAgentConfig(supabase),
        loadFlowSteps(supabase),
        supabase.from('conversation_sessions').select('collected_data').eq('session_id', session_id).maybeSingle(),
      ])

      const existingData = ((sessionRow.data?.collected_data as Record<string, unknown>) || {})
      let data: Record<string, unknown> = { ...existingData }
      // dados vindos do cliente (ex.: nome já logado) têm prioridade sobre a sessão persistida
      if (collected_data) data = { ...data, ...collected_data }

      const turnHistory = (data._history as { role: string; content: string }[] | undefined) || []
      const userText = message === '__init__' ? '' : message.trim()

      let outOfScope = false
      let roleDetected: string | undefined

      // Passo 1 — extração estruturada (só roda se houver texto novo do usuário)
      if (userText) {
        const knownSummary = Object.entries(data)
          .filter(([k, v]) => !k.startsWith('_') && isFilled(v))
          .map(([k, v]) => `${k}=${v}`).join(', ') || 'nenhum ainda'

        const extractTools = [
          {
            type: 'function',
            function: {
              name: 'update_lead_data',
              description: 'Registra dados sobre o pedido de pintura que a mensagem revelou. Inclua SOMENTE campos mencionados agora — nunca repita nem invente valores já conhecidos.',
              parameters: {
                type: 'object',
                properties: {
                  service_type: enumFromQuickReplies(steps, 'service_type')
                    ? { type: 'string', enum: enumFromQuickReplies(steps, 'service_type') }
                    : { type: 'string' },
                  property_type: enumFromQuickReplies(steps, 'property_type')
                    ? { type: 'string', enum: enumFromQuickReplies(steps, 'property_type') }
                    : { type: 'string' },
                  property_scope: { type: 'string', enum: ['Apenas interna', 'Apenas externa', 'Ambas (interna + externa)'] },
                  neighborhood: { type: 'string', description: 'Bairro de Florianópolis mencionado' },
                  surfaces: { type: 'string' },
                  wall_condition: { type: 'string' },
                  extras: { type: 'string' },
                  deadline: enumFromQuickReplies(steps, 'deadline')
                    ? { type: 'string', enum: enumFromQuickReplies(steps, 'deadline') }
                    : { type: 'string' },
                  material: enumFromQuickReplies(steps, 'material')
                    ? { type: 'string', enum: enumFromQuickReplies(steps, 'material') }
                    : { type: 'string' },
                  site_visit_preference: { type: 'string', enum: ['Visita técnica agendada', 'Orçamento a distância'] },
                  area_m2: { type: 'number' },
                  num_rooms: { type: 'string' },
                  role: { type: 'string', enum: ['painter'], description: 'Só preencha se a pessoa disser que é pintor/prestador querendo se cadastrar' },
                },
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'flag_out_of_scope',
              description: 'Chame em vez de update_lead_data quando o pedido NÃO é sobre pintura de imóvel — ex.: carro, moto, barco, móveis, eletrônicos — ou é abusivo/impróprio.',
              parameters: {
                type: 'object',
                properties: { reason: { type: 'string' } },
                required: ['reason'],
              },
            },
          },
        ]

        const extractResp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 300,
          tools: extractTools,
          tool_choice: 'auto',
          messages: [
            {
              role: 'system',
              content: 'Você extrai dados estruturados de pedidos de pintura residencial/comercial em Florianópolis. Só chame uma função; nunca responda em texto livre.',
            },
            {
              role: 'user',
              content: `Dados já conhecidos: ${knownSummary}\n\nMensagem do usuário agora: "${userText}"`,
            },
          ],
        })

        const toolCalls = extractResp.choices[0].message.tool_calls || []
        const outOfScopeCall = toolCalls.find(c => c.function.name === 'flag_out_of_scope')
        const updateCall = toolCalls.find(c => c.function.name === 'update_lead_data')

        if (outOfScopeCall) {
          outOfScope = true
        } else if (updateCall) {
          try {
            const parsedArgs = JSON.parse(updateCall.function.arguments) as Record<string, unknown>
            for (const [k, v] of Object.entries(parsedArgs)) {
              if (v === null || v === undefined || v === '') continue
              if (k === 'role') { roleDetected = String(v); continue }
              data[k] = v
            }
          } catch { /* ignora extração malformada, segue sem novos campos */ }
        }
      }

      if (media_urls && media_urls.length > 0) {
        const existingMedia = Array.isArray(data.media_urls) ? data.media_urls as string[] : []
        data.media_urls = [...existingMedia, ...media_urls]
      }

      // Rede de segurança determinística: deriva escopo do service_type quando possível
      const inferredScope = inferPropertyScope(data)
      if (inferredScope && !isFilled(data.property_scope)) data.property_scope = inferredScope

      turnHistory.push({ role: 'user', content: userText || '[início da conversa]' })

      let replyText: string
      let readyForSummary = false

      if (roleDetected === 'painter') {
        replyText = 'Você quer receber pedidos de clientes! 🎨 Deixa eu te cadastrar como pintor parceiro.'
      } else if (outOfScope) {
        replyText = OUT_OF_SCOPE_REPLY
      } else {
        const checklist = buildChecklist(steps, data)
        const missing = missingRequired(checklist)

        if (missing.length === 0) {
          replyText = 'Perfeito! 🎉 Já tenho tudo que preciso. Deixa eu confirmar os detalhes com você:'
          readyForSummary = true
        } else {
          const filledLines = checklist.filter(i => i.filled).map(i => `- ${i.label}: ${i.value}`).join('\n') || '(nada ainda)'
          const missingLines = missing.map((i, idx) => `${idx + 1}. ${i.label}${i.options ? ` (opções: ${i.options.join(', ')})` : ''}`).join('\n')

          const respondSystemPrompt = `${config?.system_prompt || DEFAULT_DISCOVERY_PROMPT}

REGRAS INEGOCIÁVEIS DO MOTOR (sempre valem, independente do texto acima):
- Você SÓ atende pintura de imóveis (casas, apartamentos, prédios, salas, lojas). Nunca aceite nem avance pedidos fora disso.
- NUNCA pergunte de novo sobre um campo já preenchido na lista "Já sei" abaixo.
- Faça UMA pergunta por vez, sempre sobre o PRIMEIRO item da lista "Ainda falta".
- Converse naturalmente — reaja brevemente ao que a pessoa acabou de dizer antes de perguntar o próximo item. Não pareça um formulário.
- Se ainda não pediu fotos/vídeo do local nesta conversa, aproveite um momento oportuno para pedir gentilmente (não é obrigatório, pode ser pulado).
- Nunca prometa preço final ou faixa de preço.
- Máximo 2 frases por mensagem.

Já sei:
${filledLines}

Ainda falta (pergunte sobre o item 1):
${missingLines}`

          const respondResp = await openai.chat.completions.create({
            model: config?.model || 'gpt-4o',
            max_tokens: config?.max_tokens || 300,
            temperature: config?.temperature ?? 0.7,
            messages: [
              { role: 'system', content: respondSystemPrompt },
              ...turnHistory.slice(-12).map(h => ({
                role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: h.content,
              })),
            ],
          })
          replyText = respondResp.choices[0].message.content?.trim() || missingLines
        }
      }

      turnHistory.push({ role: 'assistant', content: replyText })
      data._history = turnHistory.slice(-16)

      await supabase.rpc('merge_session_collected_data', { p_session_id: session_id, p_patch: data })
      supabase.from('messages').insert({
        session_id, channel: channel || 'web', direction: 'inbound', body: userText || '[init]',
        ai_intent: outOfScope ? 'out_of_scope' : 'chat_turn', metadata: { reply: replyText },
      }).then(() => {}).catch(console.error)
      if (userText) moderateMessage(session_id, userText).catch(console.error)

      return new Response(
        JSON.stringify({
          message: replyText,
          collected_data: data,
          ready_for_summary: readyForSummary,
          out_of_scope: outOfScope,
          role: roleDetected,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build user content — vision for images, Whisper for audio, text description for video
    const textBase = message === '__init__' ? 'Olá, acessei a plataforma.' : message

    type ContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'auto' } }

    const isImageUrl = (u: string) => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)
    const isAudioUrl = (u: string) => /\.(mp3|wav|ogg|m4a|webm|aac)(\?|$)/i.test(u)
    const isVideoUrl = (u: string) => /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(u) && !isAudioUrl(u)

    // Transcribe audio files via Whisper before sending to the chat model
    let audioTranscriptions = ''
    if (media_urls && media_urls.length > 0) {
      const audioUrls = media_urls.filter(isAudioUrl)
      for (const audioUrl of audioUrls) {
        try {
          const audioResp = await fetch(audioUrl)
          const audioBlob = await audioResp.blob()
          const formData = new FormData()
          formData.append('file', audioBlob, 'audio.webm')
          formData.append('model', 'whisper-1')
          formData.append('language', 'pt')
          const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
            body: formData,
          })
          if (whisperResp.ok) {
            const wData = await whisperResp.json() as { text?: string }
            if (wData.text) audioTranscriptions += `\n[Áudio transcrito: "${wData.text}"]`
          }
        } catch { /* ignore transcription failures, still process as text */ }
      }
    }

    // Assemble multimodal content
    const imageUrls = (media_urls || []).filter(isImageUrl)
    const videoUrls = (media_urls || []).filter(isVideoUrl)

    let textContent = textBase
    if (audioTranscriptions) textContent += audioTranscriptions
    if (videoUrls.length > 0) textContent += `\n[Usuário enviou ${videoUrls.length} vídeo(s) do ambiente — analise o contexto da conversa para continuar.]`

    const userContentParts: ContentPart[] = [{ type: 'text', text: textContent }]
    for (const url of imageUrls) {
      userContentParts.push({ type: 'image_url', image_url: { url, detail: 'auto' } })
    }

    // Call GPT-4o (with vision when images are present)
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
        { role: 'user', content: imageUrls.length > 0 ? (userContentParts as Parameters<typeof openai.chat.completions.create>[0]['messages'][number]['content']) : textContent },
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
      body: textContent,
      ai_intent: parsed.action || 'chat',
      metadata: { parsed_response: parsed.message, browser: metadata || {} },
    }).then(() => {}).catch(console.error)

    // Moderation (async, non-blocking)
    moderateMessage(session_id, textContent).catch(console.error)

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
  const briefingPrompt = `Você é o agente orçamentista técnico da Pinte Rápido Floripa.

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
    temperature: 0,
    messages: [{ role: 'user', content: briefingPrompt }],
  })

  const text = resp.choices[0].message.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

async function moderateMessage(sessionId: string, message: string): Promise<void> {
  if (message === '__init__' || message.length < 5) return

  // Use free OpenAI Moderation endpoint instead of gpt-4o-mini
  const mod = await openai.moderations.create({ input: message })
  const result = mod.results[0]
  if (!result.flagged) return

  const flagType = Object.entries(result.categories)
    .find(([, v]) => v)?.[0] || 'offensive'
  const score = Math.max(...Object.values(result.category_scores))
  const severity = score > 0.9 ? 'high' : score > 0.6 ? 'medium' : 'low'

  await supabase.from('moderation_flags').insert({
    message_id: `session_${sessionId}_${Date.now()}`,
    flag_type: flagType,
    severity,
    ai_explanation: `Flagged by OpenAI Moderation API (score: ${score.toFixed(3)})`,
    status: 'pending',
  })
}
