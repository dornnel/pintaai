import OpenAI from 'npm:openai@4'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  type FlowStepRow, buildChecklist, missingRequired, inferPropertyScope, isFilled, matchesOption,
  canonicalizeEnumValue, findStepForField, interpolateQuestion, isSelectAllPhrase,
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

// Usado só como fallback se a chamada de IA pra gerar a recusa falhar — o
// texto normal vem do prompt do admin (ver out-of-scope dentro de chat_turn).
const OUT_OF_SCOPE_FALLBACK = 'Cuidamos de pintura de imóveis em geral. 😊 Posso te ajudar com isso? Me conta o que você quer pintar aí.'

// Sinônimos PT-BR que a extração precisa reconhecer sem depender só do
// julgamento do modelo — portado do antigo prompt extract_initial_context.
// Nunca inclui a regra de "tudo" aqui: ela só é segura para campos de
// múltipla escolha (ver buildExtractionSynonyms) — aplicada cegamente a um
// campo de escolha única, "Tudo" respondendo "que tipo de serviço?" virava
// literalmente os 6 serviços concatenados, um valor sem sentido de negócio.
const PROPERTY_TYPE_SYNONYMS = `Sinônimos obrigatórios para property_type:
- "residência", "residencia", "minha casa", "imóvel residencial", "moradia" → "Casa"
- "prédio", "edificio", "edifício", "condomínio", "condominio" → "Prédio / Edifício"
- "kitnet", "studio", "flat", "apt", "apto", "apartamento" → "Apartamento"
- "escritório", "escritorio", "sala comercial", "sala" → "Sala / Escritório"
- "loja", "comércio", "comercio" → "Loja / Comércio"

Para property_scope, pistas de localização da pintura:
- "pintura externa", "fachada", "muros", "parte de fora" → "Apenas externa"
- "pintura interna", "por dentro", "quartos/sala" → "Apenas interna"
- "por dentro e por fora" → "Ambas (interna + externa)"`

// A regra de "tudo"/"todas" só se aplica quando a pergunta atual é de
// múltipla escolha (ex.: superfícies) — nunca para campos de escolha única
// (tipo de serviço, tipo de imóvel, prazo, material), onde "tudo" não tem
// significado de negócio e deve ficar sem preencher.
// Respostas tipo "tudo"/"todas" pra um campo de múltipla escolha já são
// resolvidas de forma 100% determinística ANTES de chegar aqui (ver
// isSelectAllPhrase mais abaixo) — este prompt não precisa mais instruir o
// modelo a preencher "todas as opções" sozinho. Pelo contrário: um bug real
// (achado por revisão independente) mostrou o modelo aplicando essa lógica
// por conta própria a uma palavra que só ecoava uma resposta anterior
// ("Interna" preenchendo TODAS as superfícies, porque "interna" lembrava
// "Pintura interna" dita antes) — por isso a instrução agora é só cautelar,
// na direção oposta.
function buildTudoInstruction(currentField: { multiSelect?: boolean; options?: string[] | null } | undefined): string {
  if (currentField?.multiSelect && currentField.options?.length) {
    return `\n\nA pergunta atual aceita MÚLTIPLAS respostas (opções: ${currentField.options.join(', ')}). Preencha SOMENTE os itens que a pessoa citar explicitamente. NUNCA preencha com todos os itens a menos que ela diga literalmente "tudo"/"todas"/"geral" (isso já é tratado antes de você ser chamado) — se a resposta for vaga ou parecer só confirmar algo dito antes (ex.: repetir uma palavra da pergunta anterior), não chame update_lead_data pra esse campo.`
  }
  return `\n\nA pergunta atual é de escolha ÚNICA. Se a pessoa responder algo vago como "tudo"/"qualquer um"/"não importa" sem indicar uma opção específica, NÃO chame update_lead_data pra esse campo — é melhor deixar sem preencher do que inventar um valor.`
}

const DEFAULT_DISCOVERY_PROMPT = `Você é o Koke, assistente da Pinte Rápido Floripa no chat web e WhatsApp.
Tom: prático, simpático, local e objetivo. Frases curtas. Nunca pareça um formulário.
Nunca prometa preço final ou faixa de preço — apenas um pintor avalia isso depois.`

async function loadActiveAgentConfig(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from('agent_configs').select('*').eq('active', true).limit(1).maybeSingle()
  const config = data as { system_prompt?: string; model?: string; max_tokens?: number; temperature?: number } | null
  // O campo model é editável no admin e pode conter um valor obsoleto/inválido
  // para a API da OpenAI (ex.: um nome de modelo de outro provedor) — nunca
  // repassa isso cru para o SDK, só aceita nomes de modelo GPT reconhecidos.
  if (config?.model && !/^gpt-/.test(config.model)) config.model = undefined
  return config
}

async function loadFlowSteps(sb: ReturnType<typeof createClient>): Promise<FlowStepRow[]> {
  const { data } = await sb.from('agent_flow_steps').select('*').eq('active', true).eq('enabled', true).order('order_index')
  return (data || []) as FlowStepRow[]
}

function enumFromQuickReplies(steps: FlowStepRow[], fieldKey: string): string[] | undefined {
  const step = steps.find(s => s.field_key === fieldKey && s.branch === 'client')
  return step?.quick_replies && step.quick_replies.length > 0 ? step.quick_replies : undefined
}

// Reage brevemente ao que o usuário disse e emenda o `fixedText` (pergunta
// determinística do próximo campo, ou a frase de fechamento) EXATAMENTE como
// está — espelha a action generate_transition, já comprovada confiável na
// cauda do fluxo (auth/contato). A IA nunca decide O QUE perguntar aqui, só
// COMO introduzir — garante que o texto e os botões (que vêm separadamente
// da mesma linha de agent_flow_steps) nunca fiquem fora de sincronia.
async function generateReactionWrap(
  config: { system_prompt?: string; model?: string; temperature?: number } | null,
  userText: string,
  fixedText: string,
  extraHint: string | null,
): Promise<string> {
  try {
    const prompt = `O usuário acabou de dizer: "${userText}"

Gere UMA mensagem curta (1 frase, no máximo duas) que primeiro reaja de forma breve e natural ao que a pessoa disse, e depois emende, PALAVRA POR PALAVRA, o texto a seguir (delimitado por ---):
---
${fixedText}
---
${extraHint || ''}

Não reescreva, resuma, parafraseie nem substitua esse texto por outra pergunta — copie-o exatamente como está, incluindo **negrito**, quebras de linha e emojis. Não envolva esse texto em aspas no resultado final. Responda só a mensagem final (reação + texto colado), texto puro, sem JSON, sem aspas ao redor de tudo.`

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 220,
      temperature: 0.6,
      messages: [
        { role: 'system', content: `${config?.system_prompt || DEFAULT_DISCOVERY_PROMPT}\n\nTom: natural, simpático, PT-BR. Responda em texto puro, sem JSON.` },
        { role: 'user', content: prompt },
      ],
    })
    const result = resp.choices[0].message.content?.trim() || fixedText
    // Rede de segurança: se o modelo colar aspas ao redor do texto emendado
    // mesmo com a instrução contra isso, remove — nunca confia 100% em
    // compliance de prompt pra algo puramente cosmético.
    return result.replace(/^"([\s\S]*)"$/, '$1').replace(/\n"([\s\S]*?)"$/, '\n$1')
  } catch {
    return fixedText
  }
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

    // Garante que a linha da sessão existe — conversation_sessions.user_identifier
    // é NOT NULL sem default. Não inclui collected_data aqui: upsert só toca as
    // colunas passadas, então não há risco de sobrescrever dados já salvos.
    supabase.from('conversation_sessions').upsert({
      session_id,
      user_identifier: session_id,
      channel: channel || 'web',
      current_state: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id', ignoreDuplicates: false }).then(() => {}).catch(console.error)

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
      const lastQuestion = [...turnHistory].reverse().find(h => h.role === 'assistant')?.content

      let outOfScope = false
      let roleDetected: string | undefined

      // Campo que a última pergunta se referia (se houver) — usado tanto pro
      // curto-circuito determinístico quanto pra dar contexto à extração.
      const checklistBeforeTurn = buildChecklist(steps, data)
      const currentField = missingRequired(checklistBeforeTurn)[0]

      // Passo 0 — curto-circuitos determinísticos, nunca passam pelo modelo:
      //
      // a) "tudo"/"todas" num campo de múltipla escolha → marca TODAS as
      //    opções sugeridas. Resolvido aqui, não pelo modelo — um bug real
      //    mostrou a IA aplicando essa lógica sozinha a uma palavra que só
      //    ecoava uma resposta anterior ("Interna" preenchendo TODAS as
      //    superfícies, por lembrar "Pintura interna" dita antes).
      // b) a resposta bate com uma das opções sugeridas pro campo (clique de
      //    botão, ou o texto digitado à mão) → grava direto — elimina de vez
      //    o risco de "Urgente"/"Mofadas"/"Escritorio" virarem falso-positivo
      //    de fora-de-escopo por falta de contexto.
      let shortCircuited = false
      if (userText && currentField?.multiSelect && currentField.options?.length && isSelectAllPhrase(userText)) {
        data[currentField.field] = currentField.options.join(' + ')
        shortCircuited = true
      } else if (userText && currentField && matchesOption(currentField.options, userText)) {
        shortCircuited = true
        // Múltipla escolha: preserva a frase composta como digitada (ex.:
        // "paredes e portas") — canonicalizar colapsaria pra um único item.
        data[currentField.field] = (currentField.options && !currentField.multiSelect)
          ? canonicalizeEnumValue(currentField.options, userText)
          : userText
      }

      // Rede de segurança determinística: pros casos mais óbvios de fora de
      // escopo (veículos, móveis, eletrônicos), nem depende do juízo do
      // modelo — só roda se o curto-circuito acima não já resolveu a mensagem.
      const OUT_OF_SCOPE_PATTERN = /\b(carro|moto(cicleta)?|caminh[aã]o|bicicleta|barco|lancha|jet\s?ski|avi[aã]o|geladeira|fog[aã]o|sof[aá]|guarda[\s-]?roupa|celular|notebook|computador|televis[aã]o|\btv\b|cachorro|gato|pet)\b/i
      if (!shortCircuited && OUT_OF_SCOPE_PATTERN.test(userText)) outOfScope = true

      // Passo 1 — extração estruturada (só roda se sobrou texto livre novo
      // pra interpretar, isto é, não foi resolvido pelo curto-circuito nem
      // já sinalizado fora de escopo pelo regex)
      if (userText && !shortCircuited && !outOfScope) {
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
                  property_type: {
                    ...(enumFromQuickReplies(steps, 'property_type')
                      ? { type: 'string', enum: enumFromQuickReplies(steps, 'property_type') }
                      : { type: 'string' }),
                    description: 'Tipo de imóvel. Atenção a sinônimos em PT-BR (residência/moradia → Casa, prédio/edifício → Prédio / Edifício, etc. — ver instruções do sistema).',
                  },
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
              content: `Você extrai dados estruturados de pedidos de pintura residencial/comercial em Florianópolis.

IMPORTANTE: extraia QUALQUER campo que a mensagem mencionar claramente — bairro, tipo de imóvel, prazo, etc. — mesmo que não seja sobre "a pergunta atual" informada abaixo. A pergunta atual é só contexto pra interpretar respostas curtas/ambíguas (tipo "Urgente" sozinho); ela NUNCA deve te impedir de registrar outro dado óbvio que apareça na mesma mensagem (ex.: a pergunta atual pode ser sobre tipo de serviço, mas se a pessoa disser "Rio Tavares", isso É um bairro e deve ser extraído mesmo assim).

${PROPERTY_TYPE_SYNONYMS}${buildTudoInstruction(currentField)}

Se a mensagem não contiver nenhum dado novo reconhecível (ex.: só uma saudação, ou algo vago sem relação com pintura), não chame função nenhuma — é melhor não extrair nada do que inventar ou adivinhar um valor.`,
            },
            {
              role: 'user',
              content: `Pergunta atual em aberto (contexto só pra respostas curtas/ambíguas — não limita o que pode ser extraído): "${lastQuestion || '(início da conversa)'}"
${currentField?.options ? `Opções sugeridas para essa pergunta específica: ${currentField.options.join(', ')}` : ''}

Dados já conhecidos: ${knownSummary}

Mensagem do usuário agora: "${userText}"`,
            },
          ],
        })

        const toolCalls = extractResp.choices[0].message.tool_calls || []
        const updateCall = toolCalls.find(c => c.function.name === 'update_lead_data')

        if (updateCall) {
          try {
            const parsedArgs = JSON.parse(updateCall.function.arguments) as Record<string, unknown>
            // A API da OpenAI não impõe o enum do schema de forma estrita — o
            // modelo pode devolver "Escritorio" quando a opção real é "Sala /
            // Escritório". Canonicaliza contra as opções reais antes de gravar.
            const ENUM_FIELDS: Record<string, string[] | undefined> = {
              service_type: enumFromQuickReplies(steps, 'service_type'),
              property_type: enumFromQuickReplies(steps, 'property_type'),
              deadline: enumFromQuickReplies(steps, 'deadline'),
              material: enumFromQuickReplies(steps, 'material'),
              property_scope: ['Apenas interna', 'Apenas externa', 'Ambas (interna + externa)'],
              site_visit_preference: ['Visita técnica agendada', 'Orçamento a distância'],
            }
            for (const [k, v] of Object.entries(parsedArgs)) {
              if (v === null || v === undefined || v === '') continue
              if (k === 'role') { roleDetected = String(v); continue }
              data[k] = typeof v === 'string' && ENUM_FIELDS[k] ? canonicalizeEnumValue(ENUM_FIELDS[k], v) : v
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
      let quickReplies: string[] | undefined
      let multiSelectNext = false

      if (roleDetected === 'painter') {
        replyText = 'Você quer receber pedidos de clientes! 🎨 Deixa eu te cadastrar como pintor parceiro.'
      } else if (outOfScope) {
        // Gera a recusa via IA (com o prompt do admin + histórico) em vez de uma
        // string fixa, pra refletir o tom/texto que o admin já configurou —
        // sem listar tipos de imóvel de forma fechada.
        try {
          const outOfScopeSystemPrompt = `${config?.system_prompt || DEFAULT_DISCOVERY_PROMPT}

A pessoa acabou de pedir algo que não é pintura de imóvel (ex.: veículo, móvel, eletrônico, ou é abusivo/impróprio). Recuse com simpatia, seguindo o tom do texto acima, SEM listar tipos de imóvel de forma fechada (prefira algo como "pintura de imóveis em geral"), e pergunte o que a pessoa realmente quer pintar. Máximo 2 frases.`
          const outOfScopeResp = await openai.chat.completions.create({
            model: config?.model || 'gpt-4o',
            max_tokens: 200,
            temperature: config?.temperature ?? 0.7,
            messages: [
              { role: 'system', content: outOfScopeSystemPrompt },
              ...turnHistory.slice(-6).map(h => ({
                role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: h.content,
              })),
            ],
          })
          replyText = outOfScopeResp.choices[0].message.content?.trim() || OUT_OF_SCOPE_FALLBACK
        } catch {
          replyText = OUT_OF_SCOPE_FALLBACK
        }
      } else {
        const checklist = buildChecklist(steps, data)
        const missing = missingRequired(checklist)

        if (missing.length === 0) {
          const closingLine = 'Perfeito! 🎉 Já tenho tudo que preciso. Deixa eu confirmar os detalhes com você:'
          replyText = userText
            ? await generateReactionWrap(config, userText, closingLine, null)
            : closingLine
          readyForSummary = true
        } else {
          // A pergunta e as quick_replies SEMPRE vêm da MESMA linha de
          // agent_flow_steps — nunca podem ficar fora de sincronia (bug
          // relatado: texto pergunta "tipo de imóvel", botões mostram
          // "superfícies"). A IA só adiciona uma reação curta por cima,
          // exatamente como já funciona pra o resto da jornada
          // (generate_transition) — ela NUNCA decide qual pergunta fazer.
          const nextStep = findStepForField(steps, missing[0].field)
          const deterministicQuestion = nextStep
            ? interpolateQuestion(nextStep.question_template, data)
            : missing[0].label
          quickReplies = nextStep?.quick_replies ?? missing[0].options ?? undefined
          multiSelectNext = nextStep?.multi_select ?? missing[0].multiSelect ?? false

          const visitHint = missing[0].field === 'site_visit_preference'
            ? ' Antes da pergunta, você pode mencionar rapidamente que isso ajuda a detalhar melhor o orçamento.'
            : ''

          replyText = userText
            ? await generateReactionWrap(config, userText, deterministicQuestion, visitHint || null)
            : deterministicQuestion
        }
      }

      // Reconhece mídia recebida nesta rodada — hoje é só armazenada, nunca
      // mencionada, já que os steps step_type:'media' (media_upload/
      // final_notes) ficaram inalcançáveis pro cliente após o motor único.
      if (media_urls && media_urls.length > 0) {
        replyText = `📸 Recebi sua(s) foto(s)/vídeo(s), obrigado! ${replyText}`
      }

      turnHistory.push({ role: 'assistant', content: replyText })
      data._history = turnHistory.slice(-16)

      // Upsert direto (não uma RPC) — já temos existingData + a extração desta
      // rodada mescladas em memória em `data`, então não há necessidade de uma
      // função de merge atômica no servidor: isto já É o merge.
      const { error: persistErr } = await supabase.from('conversation_sessions').upsert({
        session_id,
        user_identifier: session_id,
        channel: channel || 'web',
        current_state: 'active',
        collected_data: data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
      if (persistErr) console.error('chat_turn persist failed:', JSON.stringify(persistErr))
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
          quick_replies: quickReplies,
          multi_select: multiSelectNext,
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
