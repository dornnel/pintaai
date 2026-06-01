import Anthropic from 'npm:@anthropic-ai/sdk@0.27.3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)

const SYSTEM_PROMPT = `Você é o assistente de inteligência operacional da Pintai Floripa.

Você tem acesso em tempo real a: leads, conversas, pedidos, pintores, reviews e métricas.

Tom: Objetivo, analítico, direto. Responda com dados concretos quando disponível.

Antes de responder qualquer pergunta sobre dados, USE as tools disponíveis para consultar informações atualizadas.
Nunca invente dados — se não tiver informação, diga que vai buscar e use uma tool.

Exemplos do que você pode responder:
- "Quantos leads novos esta semana?" → use get_leads_summary
- "O que o cliente da sessão X falou?" → use get_conversation
- "Quais bairros têm mais pedidos?" → use get_metrics
- "Busca pelo cliente João" → use search_leads`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_leads_summary',
    description: 'Retorna contagem de leads por estágio e os N leads mais recentes com detalhes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Quantos leads recentes retornar (padrão: 10)' },
        stage: { type: 'string', description: 'Filtrar por estágio específico (opcional)' },
        days: { type: 'number', description: 'Últimos N dias (opcional, padrão: 7)' },
      },
    },
  },
  {
    name: 'get_conversation',
    description: 'Retorna o histórico completo de mensagens de uma sessão de conversa específica.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string', description: 'ID da sessão de conversa' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'get_metrics',
    description: 'Retorna métricas gerais: total de leads, conversão, bairros mais ativos, serviços mais pedidos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period_days: { type: 'number', description: 'Período em dias para as métricas (padrão: 30)' },
      },
    },
  },
  {
    name: 'search_leads',
    description: 'Busca leads por nome, bairro, telefone, e-mail ou tipo de serviço.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Texto de busca' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_recent_conversations',
    description: 'Lista as conversas mais recentes com estado atual e canal de origem.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Quantidade de conversas (padrão: 20)' },
        channel: { type: 'string', description: 'Filtrar por canal: web, whatsapp, instagram (opcional)' },
      },
    },
  },
]

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'get_leads_summary': {
        const limit = Number(input.limit) || 10
        const days = Number(input.days) || 7
        const since = new Date(Date.now() - days * 86400000).toISOString()

        // Count by stage
        const { data: allLeads } = await supabase.from('leads').select('stage')
        const stageCounts: Record<string, number> = {}
        for (const l of allLeads || []) {
          stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1
        }

        // Recent leads
        let query = supabase.from('leads')
          .select('protocol, name, phone, email, neighborhood, service_interest, stage, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (input.stage) query = query.eq('stage', String(input.stage))

        const { data: recent } = await query

        return JSON.stringify({
          stage_counts: stageCounts,
          total: allLeads?.length || 0,
          recent_leads: recent || [],
          period_days: days,
        })
      }

      case 'get_conversation': {
        const sessionId = String(input.session_id)
        const { data: session } = await supabase
          .from('conversation_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single()

        const { data: msgs } = await supabase
          .from('messages')
          .select('direction, body, ai_intent, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })

        return JSON.stringify({ session, messages: msgs || [] })
      }

      case 'get_metrics': {
        const days = Number(input.period_days) || 30
        const since = new Date(Date.now() - days * 86400000).toISOString()

        const { data: leads } = await supabase
          .from('leads')
          .select('neighborhood, service_interest, stage, created_at')
          .gte('created_at', since)

        const neighborhoodCount: Record<string, number> = {}
        const serviceCount: Record<string, number> = {}
        let won = 0, total = 0

        for (const l of leads || []) {
          total++
          if (l.neighborhood) neighborhoodCount[l.neighborhood] = (neighborhoodCount[l.neighborhood] || 0) + 1
          if (l.service_interest) serviceCount[l.service_interest] = (serviceCount[l.service_interest] || 0) + 1
          if (l.stage === 'won') won++
        }

        const topNeighborhoods = Object.entries(neighborhoodCount)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
        const topServices = Object.entries(serviceCount)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)

        return JSON.stringify({
          period_days: days,
          total_leads: total,
          conversion_rate: total ? `${((won / total) * 100).toFixed(1)}%` : '0%',
          top_neighborhoods: topNeighborhoods,
          top_services: topServices,
        })
      }

      case 'search_leads': {
        const q = String(input.query).toLowerCase()
        const { data } = await supabase
          .from('leads')
          .select('protocol, name, phone, email, neighborhood, service_interest, stage, created_at')
          .or(`name.ilike.%${q}%,neighborhood.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,service_interest.ilike.%${q}%`)
          .limit(10)

        return JSON.stringify({ results: data || [], query: q })
      }

      case 'get_recent_conversations': {
        const limit = Number(input.limit) || 20
        let query = supabase
          .from('conversation_sessions')
          .select('session_id, user_identifier, channel, current_state, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(limit)

        if (input.channel) query = query.eq('channel', String(input.channel))

        const { data } = await query
        return JSON.stringify({ conversations: data || [] })
      }

      default:
        return JSON.stringify({ error: `Tool desconhecida: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) })
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { message, history = [] } = await req.json() as {
      message: string
      history?: { role: string; content: string }[]
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-10).map((h) => ({
        role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    // Agentic loop with tool_use
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tool of toolUseBlocks) {
        const result = await handleTool(tool.name, tool.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result,
        })
      }

      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      )

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      })
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const responseText = textBlock?.text || 'Não consegui processar a pergunta.'

    return new Response(
      JSON.stringify({ message: responseText }),
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
