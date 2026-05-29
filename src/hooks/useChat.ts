import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, BriefingData } from '../lib/types'
import { generateSessionId } from '../lib/utils'
import { supabase, uploadMedia } from '../lib/supabase'

const SESSION_KEY = 'pintae_session_id'

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateSessionId()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// ─── Chat flow state machine ──────────────────────────────────────────────────

type ChatState =
  | 'init'
  | 'lead_name' | 'lead_email' | 'lead_whatsapp'
  | 'role_select'
  | 'neighborhood' | 'property_type' | 'service_type'
  | 'media_upload' | 'wall_condition' | 'deadline' | 'material'
  | 'generating_briefing' | 'briefing_ready' | 'waiting_quotes'
  | 'painter_neighborhoods' | 'painter_specialties' | 'painter_experience' | 'painter_done'
  | 'done'

interface StepConfig {
  question: (data: CollectedData) => string
  type: 'text' | 'quick_reply' | 'media'
  quickReplies?: string[]
  field: keyof CollectedData
  validate?: (val: string) => { ok: boolean; hint?: string }
  next: ChatState | ((val: string, data: CollectedData) => ChatState)
}

interface CollectedData {
  name?: string
  email?: string
  whatsapp?: string
  role?: 'client' | 'painter'
  neighborhood?: string
  property_type?: string
  service_type?: string
  wall_condition?: string
  deadline?: string
  material?: string
  painter_neighborhoods?: string
  painter_specialties?: string
  painter_experience?: string
  media_urls?: string[]
}

const FLOW: Partial<Record<ChatState, StepConfig>> = {
  lead_name: {
    question: () => 'Olá! Sou o assistente da **Pintaê Floripa**. Para começar, qual é o seu nome?',
    type: 'text',
    field: 'name',
    validate: (v) => ({
      ok: v.trim().length >= 2,
      hint: 'Por favor, informe seu nome completo (mínimo 2 letras).',
    }),
    next: 'lead_email',
  },
  lead_email: {
    question: (d) => `Prazer, ${d.name}! Qual é o seu **e-mail**?`,
    type: 'text',
    field: 'email',
    validate: (v) => ({
      ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      hint: 'Hmm, esse não parece um e-mail válido. Ex: joao@gmail.com',
    }),
    next: 'lead_whatsapp',
  },
  lead_whatsapp: {
    question: () => 'E o seu **WhatsApp** com DDD? Ex: (48) 9 9999-9999',
    type: 'text',
    field: 'whatsapp',
    validate: (v) => ({
      ok: v.replace(/\D/g, '').length >= 10,
      hint: 'Informe um número com DDD. Ex: 48 9 9999-9999',
    }),
    next: 'role_select',
  },
  role_select: {
    question: () => 'Você é **cliente** buscando pintura ou **pintor** querendo receber pedidos?',
    type: 'quick_reply',
    quickReplies: ['Sou cliente', 'Sou pintor'],
    field: 'role',
    next: (v) => (v === 'Sou pintor' ? 'painter_neighborhoods' : 'neighborhood'),
  },
  // ── CLIENT FLOW ──────────────────────────────────────────────────────────────
  neighborhood: {
    question: () => 'Em qual **bairro** fica o local a ser pintado?',
    type: 'quick_reply',
    quickReplies: ['Campeche', 'Rio Tavares', 'Armação', 'Morro das Pedras', 'Pântano do Sul', 'Outro bairro'],
    field: 'neighborhood',
    next: 'property_type',
  },
  property_type: {
    question: () => 'Que tipo de **imóvel** é?',
    type: 'quick_reply',
    quickReplies: ['Apartamento', 'Casa', 'Loja / Comércio', 'Airbnb / Temporada', 'Outro'],
    field: 'property_type',
    next: 'service_type',
  },
  service_type: {
    question: () => 'Que tipo de serviço você precisa?',
    type: 'quick_reply',
    quickReplies: ['Pintura interna', 'Fachada externa', 'Pós-obra', 'Textura / massa corrida', 'Impermeabilização', 'Arte / mural'],
    field: 'service_type',
    next: 'media_upload',
  },
  media_upload: {
    question: () => 'Agora me manda **fotos ou um vídeo** do local (até 1 minuto). Isso me ajuda a estimar a metragem com mais precisão.\n\nUse o clipe aqui embaixo ou clique em "Pular por agora".',
    type: 'media',
    quickReplies: ['Pular por agora'],
    field: 'media_urls',
    next: 'wall_condition',
  },
  wall_condition: {
    question: () => 'Como está o **estado atual das paredes**?',
    type: 'quick_reply',
    quickReplies: ['Bom estado', 'Manchas / sujeira', 'Descascando', 'Rachaduras', 'Mofo', 'Pós-obra (reboco novo)'],
    field: 'wall_condition',
    next: 'deadline',
  },
  deadline: {
    question: () => 'Qual o **prazo** que você tem em mente?',
    type: 'quick_reply',
    quickReplies: ['O mais rápido possível', 'Próximas 2 semanas', 'Próximo mês', 'Sem prazo definido'],
    field: 'deadline',
    next: 'material',
  },
  material: {
    question: () => 'O **material** (tinta, primer) vai ser incluso no serviço?',
    type: 'quick_reply',
    quickReplies: ['Incluso no serviço', 'Vou comprar separado', 'O pintor que indique'],
    field: 'material',
    next: 'generating_briefing',
  },
  // ── PAINTER FLOW ─────────────────────────────────────────────────────────────
  painter_neighborhoods: {
    question: (d) => `Legal, ${d.name}! Em quais **bairros** você atua? (ex: Campeche, Rio Tavares)`,
    type: 'text',
    field: 'painter_neighborhoods',
    validate: (v) => ({ ok: v.trim().length >= 3, hint: 'Informe pelo menos um bairro onde você atua.' }),
    next: 'painter_specialties',
  },
  painter_specialties: {
    question: () => 'Quais são suas **especialidades**?',
    type: 'quick_reply',
    quickReplies: ['Pintura interna', 'Fachada', 'Textura / massa corrida', 'Impermeabilização', 'Arte / mural', 'Geral (todos)'],
    field: 'painter_specialties',
    next: 'painter_experience',
  },
  painter_experience: {
    question: () => 'Quantos **anos de experiência** você tem?',
    type: 'quick_reply',
    quickReplies: ['Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'],
    field: 'painter_experience',
    next: 'painter_done',
  },
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [currentState, setCurrentState] = useState<ChatState>('init')
  const [collectedData, setCollectedData] = useState<CollectedData>({})
  const sessionId = useRef(getOrCreateSessionId())
  const dataRef = useRef<CollectedData>({})

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  function agentMessage(content: string, quickReplies?: string[], extra?: Partial<ChatMessage>) {
    const msg: ChatMessage = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      role: 'agent',
      content,
      quickReplies,
      timestamp: new Date(),
      ...extra,
    }
    addMessage(msg)
    return msg
  }

  function userMessage(content: string, mediaUrls?: string[]) {
    const msg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content || (mediaUrls?.length ? `[${mediaUrls.length} arquivo(s) enviado(s)]` : ''),
      mediaUrls,
      timestamp: new Date(),
    }
    addMessage(msg)
    return msg
  }

  // Advance to next state and ask next question
  function advanceToState(nextState: ChatState, data: CollectedData) {
    const step = FLOW[nextState]
    if (!step) {
      // Terminal states
      if (nextState === 'generating_briefing') {
        setCurrentState('generating_briefing')
        generateBriefing(data)
      } else if (nextState === 'painter_done') {
        setCurrentState('painter_done')
        agentMessage(
          `Ótimo, **${data.name}**! Cadastro recebido.\n\nNossa equipe vai analisar e te contatar pelo WhatsApp ${data.whatsapp} em breve. Você receberá pedidos alinhados com seus bairros e especialidades. 🎨`,
        )
        saveToDatabase(data, 'painter')
      }
      return
    }

    setCurrentState(nextState)
    agentMessage(
      step.question(data),
      step.type === 'quick_reply' || step.type === 'media' ? step.quickReplies : undefined,
    )
  }

  async function generateBriefing(data: CollectedData) {
    agentMessage('Gerando seu **briefing técnico**...', undefined)
    setLoading(true)

    try {
      let briefingData: BriefingData | null = null

      const { data: fnData } = await supabase.functions.invoke('agent-chat', {
        body: {
          session_id: sessionId.current,
          message: `Gere um briefing técnico para: bairro=${data.neighborhood}, imóvel=${data.property_type}, serviço=${data.service_type}, paredes=${data.wall_condition}, prazo=${data.deadline}, material=${data.material}, mídias=${data.media_urls?.length || 0}`,
          history: [],
          media_urls: data.media_urls,
          action: 'generate_briefing',
          collected: data,
        },
      })

      if (fnData?.briefing) {
        briefingData = fnData.briefing as BriefingData
      } else {
        // Fallback briefing
        briefingData = {
          resumo_cliente: `Pintura ${data.service_type?.toLowerCase()} em ${data.property_type?.toLowerCase()} no ${data.neighborhood}.`,
          briefing_tecnico: `Serviço: ${data.service_type}. Local: ${data.property_type} no ${data.neighborhood}. Estado das paredes: ${data.wall_condition}. Prazo: ${data.deadline}. Material: ${data.material}.`,
          tipo_servico: data.service_type || 'residential',
          superficies: ['paredes internas'],
          estado_parede: data.wall_condition || 'unknown',
          metragem_estimada_m2: undefined,
          confianca_metragem: 'baixa',
          preco_min_estimado: undefined,
          preco_max_estimado: undefined,
          confianca_preco: 'baixa',
          materiais_recomendados: [],
          perguntas_faltantes: [],
          riscos: [],
          observacoes_para_pintor: `Prazo: ${data.deadline}. Material ${data.material?.toLowerCase()}.`,
        }
      }

      // Save to DB
      await saveToDatabase(data, 'client')

      setCurrentState('briefing_ready')
      agentMessage(
        `✅ **Briefing pronto!** Seu pedido foi enviado para pintores próximos ao ${data.neighborhood}.\n\nEles têm até 4 horas para enviar propostas. Vou te notificar no WhatsApp ${data.whatsapp} quando chegar! 🎨`,
        undefined,
        { briefing: briefingData ?? undefined },
      )
    } catch (err) {
      console.error(err)
      agentMessage('Houve um problema ao gerar o briefing. Tente novamente em instantes.', ['Tentar novamente'])
    } finally {
      setLoading(false)
    }
  }

  async function saveToDatabase(data: CollectedData, role: 'client' | 'painter') {
    try {
      // Save conversation session
      await supabase.from('conversation_sessions').upsert({
        session_id: sessionId.current,
        user_identifier: data.whatsapp || data.email || sessionId.current,
        channel: 'web',
        role_detected: role,
        current_state: role === 'client' ? 'briefing_ready' : 'painter_registered',
        collected_data: data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })

      // Save messages in bulk
      const systemMsg = {
        session_id: sessionId.current,
        channel: 'web' as const,
        direction: 'inbound' as const,
        body: JSON.stringify(data),
        ai_intent: `lead_captured:${role}`,
        metadata: { collected: data },
      }
      await supabase.from('messages').insert(systemMsg)
    } catch (err) {
      console.error('DB save error:', err)
    }
  }

  // Validate text input (simple, no AI for basic fields)
  function validateInput(state: ChatState, value: string): { ok: boolean; hint?: string } {
    const step = FLOW[state]
    if (!step?.validate) return { ok: true }
    return step.validate(value)
  }

  // Main send function
  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    // Upload files
    let mediaUrls: string[] = []
    if (files && files.length > 0) {
      setLoading(true)
      const urls = await Promise.all(files.map((f) => uploadMedia(f, sessionId.current)))
      mediaUrls = urls.filter(Boolean) as string[]
      setLoading(false)
    }

    // Skip __init__ from user bubble
    if (text !== '__init__') {
      userMessage(text, mediaUrls.length > 0 ? mediaUrls : undefined)
    }

    // Handle init
    if (text === '__init__' || currentState === 'init') {
      const initState: ChatState = 'lead_name'
      const step = FLOW[initState]!
      setCurrentState(initState)
      agentMessage(step.question({}), undefined)
      return
    }

    const step = FLOW[currentState]
    if (!step) return

    // Handle media upload state
    if (currentState === 'media_upload') {
      const newData = {
        ...dataRef.current,
        media_urls: [...(dataRef.current.media_urls || []), ...mediaUrls],
      }
      dataRef.current = newData
      setCollectedData(newData)

      const nextState = typeof step.next === 'function' ? step.next(text, newData) : step.next
      agentMessage('Recebido! 📎', undefined)
      setTimeout(() => advanceToState(nextState, newData), 600)
      return
    }

    // Validate text input
    if (step.type === 'text') {
      const validation = validateInput(currentState, text)
      if (!validation.ok) {
        setLoading(true)
        setTimeout(() => {
          agentMessage(
            `${validation.hint || 'Não entendi.'} Pode tentar de novo?`,
            undefined,
          )
          setLoading(false)
        }, 500)
        return
      }
    }

    // Save field
    const newData: CollectedData = {
      ...dataRef.current,
      [step.field]: step.field === 'role'
        ? (text === 'Sou pintor' ? 'painter' : 'client')
        : text,
    }
    dataRef.current = newData
    setCollectedData(newData)

    // Determine next state
    const nextState = typeof step.next === 'function' ? step.next(text, newData) : step.next

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      advanceToState(nextState, newData)
    }, 400)
  }, [currentState, addMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    sessionId.current = generateSessionId()
    localStorage.setItem(SESSION_KEY, sessionId.current)
    dataRef.current = {}
    setCollectedData({})
    setMessages([])
    setCurrentState('init')
  }, [])

  // Current step's quick replies for the input area
  const currentQuickReplies = currentState !== 'init'
    ? FLOW[currentState]?.quickReplies
    : undefined

  const currentInputType = currentState !== 'init'
    ? (FLOW[currentState]?.type || 'text')
    : 'text'

  return {
    messages,
    loading,
    sendMessage,
    reset,
    sessionId: sessionId.current,
    collectedData,
    currentState,
    currentQuickReplies,
    currentInputType,
  }
}
