import Anthropic from 'npm:@anthropic-ai/sdk@0.27.3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const SYSTEM_PROMPT = `Você é o assistente da Pintaê Floripa no chat web.

Tom: Prático, simpático, local e objetivo. Evite mensagens longas. Use markdown mínimo (**negrito** apenas quando importante).

Objetivo: Guiar o usuário até um pedido de pintura completo (cliente) ou cadastro (pintor) com o mínimo de atrito.

IMPORTANTE sobre a primeira mensagem:
- Se a mensagem for "__init__" OU for um simples cumprimento (oi, olá, bom dia, boa tarde, boa noite, hey, hi, tudo bem, e aí): Cumprimente de volta com calor (ex: "Oi! 👋 Que bom que você veio!") e explique brevemente que vai precisar de alguns dados para ajudar. Seja simpático e acolhedor.
- Se o usuário escreveu algo criativo, fora do contexto ou fez uma pergunta sobre pintura: responda brevemente e com boa energia à mensagem ANTES de transicionar. Ex: "Boa pergunta! 😄 Posso te ajudar com isso. Só preciso de algumas informações primeiro."
- NUNCA ignore o que o usuário disse. NUNCA seja frio — sempre corresponda à energia da mensagem.
- NUNCA peça o nome diretamente na sua resposta — o frontend vai fazer isso na próxima mensagem.

Para CLIENTES — colete nesta ordem:
1. Bairro (ofereça quick_replies: Campeche, Rio Tavares, Armação, Morro das Pedras, Pântano do Sul, Outro)
2. Tipo de imóvel (quick_replies: Apartamento, Casa, Loja, Airbnb, Outro)
3. Fotos/vídeos (peça para usar o botão de clipe; se já enviou, reconheça)
4. Estado das paredes (quick_replies: Bom estado, Manchas/descascando, Rachaduras, Mofo, Pós-obra, Não sei)
5. Prazo desejado (quick_replies: O mais rápido possível, 2 semanas, Próximo mês, Sem pressa)
6. Material incluso ou não (quick_replies: Quero com material, Vou comprar o material, Pintor que indique)

Quando tiver bairro + tipo imóvel + estado da parede, gere o briefing (action: "generate_briefing").

Para PINTORES — colete: nome, bairros atendidos, especialidades, experiência, disponibilidade.

Regras:
- Faça UMA pergunta por vez quando possível.
- Use quick_replies para acelerar (máx 4 opções).
- Nunca prometa preço final. A estimativa é orientativa.
- Se detectar urgência, registre.
- Se o usuário mandar foto, agradeça e continue coletando.
- Se mensagem for ofensiva ou inadequada, responda educadamente que não é possível continuar assim.

Sempre responda em JSON:
{
  "message": "texto da resposta",
  "quick_replies": ["opção 1", "opção 2"] | null,
  "action": "generate_briefing" | "register_painter" | null,
  "collected": {
    "role": "client" | "painter" | null,
    "neighborhood": "...",
    "property_type": "...",
    "wall_condition": "...",
    "deadline": "...",
    "material_preference": "..."
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
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = (await req.json()) as RequestBody
    const { session_id, message, history, media_urls, metadata, action, collected } = body

    // Persist conversation session start (async, fire-and-forget)
    supabase.from('conversation_sessions').upsert({
      session_id,
      user_identifier: session_id,
      channel: 'web',
      current_state: 'active',
      collected_data: { _metadata: metadata || {} },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' }).then(() => {}).catch(console.error)

    // Build user content
    let userContent: string = message === '__init__'
      ? 'Olá, acessei a plataforma.'
      : message

    if (media_urls && media_urls.length > 0) {
      userContent += `\n[Usuário enviou ${media_urls.length} imagem(ns): ${media_urls.join(', ')}]`
    }

    // If explicit briefing generation action, skip conversation and generate directly
    if (action === 'generate_briefing' && collected) {
      const briefingData = await generateBriefing(collected, history, media_urls)
      return new Response(
        JSON.stringify({ message: 'Briefing gerado.', briefing: briefingData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build messages array from history
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-10).map((h) => ({
        role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userContent },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const rawText = (response.content[0] as { text: string }).text.trim()

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

    // If briefing action, call the briefing generator
    let briefingData = null
    if (parsed.action === 'generate_briefing' && parsed.collected) {
      briefingData = await generateBriefing(parsed.collected, history, media_urls)
    }

    // Save message log (async, fire-and-forget)
    supabase.from('messages').insert({
      session_id,
      channel: 'web',
      direction: 'inbound',
      body: userContent,
      ai_intent: parsed.action || 'chat',
      metadata: { parsed_response: parsed.message, metadata: metadata || {}, browser: metadata || {} },
    }).then(() => {}).catch(console.error)

    // Moderation check (async, don't block response)
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
    console.error(err)
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
  const briefingPrompt = `Você é o agente orçamentista técnico da Pintaê Floripa.

Dados coletados:
${JSON.stringify(collected, null, 2)}

Histórico da conversa:
${history.map((h) => `${h.role}: ${h.content}`).join('\n')}

${mediaUrls?.length ? `Mídias enviadas: ${mediaUrls.length} imagem(ns)` : ''}

Gere um briefing técnico completo. Responda APENAS com JSON válido:
{
  "resumo_cliente": "...",
  "briefing_tecnico": "...",
  "tipo_servico": "...",
  "superficies": [],
  "estado_parede": "...",
  "metragem_estimada_m2": null,
  "confianca_metragem": "baixa|media|alta",
  "preco_min_estimado": null,
  "preco_max_estimado": null,
  "confianca_preco": "baixa|media|alta",
  "materiais_recomendados": [],
  "perguntas_faltantes": [],
  "riscos": [],
  "observacoes_para_pintor": "..."
}`

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: briefingPrompt }],
  })

  const text = (resp.content[0] as { text: string }).text
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

async function moderateMessage(sessionId: string, message: string): Promise<void> {
  if (message === '__init__' || message.length < 5) return

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Analise esta mensagem de uma plataforma de serviços. Responda APENAS com JSON:
Mensagem: "${message}"
{
  "has_flag": false,
  "flag_type": null,
  "severity": null,
  "explanation": ""
}
Tipos: "offensive" | "bypass_attempt" | "ethics_violation" | "spam"
Severidades: "low" | "medium" | "high"`,
    }],
  })

  const text = (resp.content[0] as { text: string }).text
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
