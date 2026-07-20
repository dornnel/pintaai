import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, BriefingData } from '../lib/types'
import { generateSessionId } from '../lib/utils'
import { supabase, uploadMedia } from '../lib/supabase'
import { captureTracking } from '../lib/tracking'
import { useAuth } from '../lib/auth'
import {
  type FlowStep, type CollectedData, type BudgetCalc,
  CHIP_TO_SERVICE, KNOWN_NEIGHBORHOODS, SKIP_VALUES, VALIDATORS, EXTRACTABLE_VALIDATIONS,
  FIELD_LABELS,
  branchSteps, getStep, setFieldValue, renderTemplate, computeFieldValue,
  resolveNext, autoAdvance,
} from './chatFlow'

const SESSION_KEY = 'pintae_session_id'

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateSessionId()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function getBrowserMetadata() {
  return {
    user_agent: navigator.userAgent,
    referrer: document.referrer || null,
    url: window.location.href,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform,
  }
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function generateLocalProtocol(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `PT-${datePart}-${randPart}`
}

function matchesQuickReply(step: FlowStep, text: string): boolean {
  if (!step.quick_replies || !text.trim()) return true
  const normalized = text.toLowerCase().replace(/[✅✏️🗑️]/g, '').trim()
  return step.quick_replies.some(qr =>
    normalized.includes(qr.toLowerCase().replace(/[✅✏️🗑️]/g, '').trim().slice(0, 8))
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat() {
  const { user: authUser } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [currentState, setCurrentState] = useState<string>('init')
  const [collectedData, setCollectedData] = useState<CollectedData>({})
  const sessionId = useRef(getOrCreateSessionId())
  const dataRef = useRef<CollectedData>({})
  const metadataRef = useRef(getBrowserMetadata())
  const prefilledFieldsRef = useRef<Set<string>>(new Set())
  const correctionModeRef = useRef<boolean>(false)
  const stepsPromiseRef = useRef<Promise<FlowStep[]> | null>(null)
  const loadedStepsRef = useRef<FlowStep[]>([])

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

  // Carrega e cacheia os passos da jornada (agent_flow_steps) — uma única vez por sessão
  function getSteps(): Promise<FlowStep[]> {
    if (!stepsPromiseRef.current) {
      stepsPromiseRef.current = (async () => {
        const { data, error } = await supabase
          .from('agent_flow_steps')
          .select('*')
          .eq('active', true)
          .eq('enabled', true)
          .order('order_index')
        if (error) {
          console.error('Erro ao carregar agent_flow_steps:', error)
          return []
        }
        const steps = (data || []) as FlowStep[]
        loadedStepsRef.current = steps
        return steps
      })()
    }
    return stepsPromiseRef.current
  }

  useEffect(() => {
    getSteps().catch(console.error)
    saveSessionState('init', {}).catch(console.error)
  }, [])

  // Gera mensagem de transição via IA: reage à resposta/valor anterior e emenda a próxima pergunta
  async function callTransition(params: {
    previous_field: string | null
    previous_value: string | null
    next_question: string
    collected_data: CollectedData
    user_name?: string
  }): Promise<string> {
    const { data, error } = await supabase.functions.invoke('agent-chat', {
      body: {
        session_id: sessionId.current,
        message: '',
        history: [],
        metadata: metadataRef.current,
        action: 'generate_transition',
        ...params,
      },
    })
    if (error || !data?.message) throw new Error('transition unavailable')
    return data.message as string
  }

  // Extrair dados de linguagem natural via LLM (gpt-4o-mini, barato)
  async function extractFieldWithLLM(field: string, text: string): Promise<string | null> {
    try {
      const { data } = await supabase.functions.invoke('agent-chat', {
        body: {
          session_id: sessionId.current,
          message: text,
          history: [],
          metadata: metadataRef.current,
          action: 'extract_field',
          collected: { field, text },
        },
      })
      const extracted = data?.extracted
      return extracted && extracted !== 'null' ? extracted : null
    } catch {
      return null
    }
  }

  // Salvar lead parcial quando email/WhatsApp é coletado (para follow-up de abandonados)
  async function savePartialLead(data: CollectedData, currentStep: string) {
    if (!data.email && !data.whatsapp) return
    try {
      const { data: result, error } = await supabase.functions.invoke('save-lead', {
        body: { protocol: dataRef.current._partialProtocol, partial: true, role: 'client', data, step: currentStep, custom_fields: data.custom_fields },
      })
      if (error) {
        console.warn('Partial lead save error:', JSON.stringify(error))
        return
      }
      if (result?.protocol) dataRef.current._partialProtocol = result.protocol
    } catch (err) {
      console.warn('Partial lead save error:', err)
    }
  }

  // Save session to DB (called early, updated as flow progresses)
  async function saveSessionState(state: string, collected: CollectedData) {
    try {
      await supabase.from('conversation_sessions').upsert({
        session_id: sessionId.current,
        user_identifier: collected.whatsapp || collected.email || collected.name || sessionId.current,
        channel: 'web',
        current_state: state,
        collected_data: { ...collected, _metadata: metadataRef.current },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
    } catch (err) {
      console.error('Session save error:', err)
    }
  }

  function buildCorrectionOptions(data: CollectedData): string[] {
    return Object.entries(FIELD_LABELS)
      .filter(([key]) => {
        if (key === 'role' || key === 'confirmed') return false
        const val = (data as unknown as Record<string, unknown>)[key]
        return val !== undefined && val !== null && val !== ''
      })
      .map(([, label]) => label)
      .slice(0, 6)
  }

  // ── Avança para o próximo step (aplica auto-skip e transição via IA) ────────
  async function advanceToState(nextKey: string, data: CollectedData, opts?: { fromStep?: FlowStep; fromValue?: string }) {
    if (nextKey === 'correction_select') {
      setCurrentState('correction_select')
      saveSessionState(nextKey, data).catch(console.error)
      const options = buildCorrectionOptions(data)
      agentMessage('Qual dado você quer corrigir? Escolha abaixo 👇', options.length > 0 ? options : undefined)
      return
    }
    if (nextKey === 'generating_briefing') {
      setCurrentState('generating_briefing')
      saveSessionState(nextKey, data).catch(console.error)
      await generateBriefing(data)
      return
    }
    if (nextKey === 'painter_done') {
      setCurrentState('painter_done')
      saveSessionState(nextKey, data).catch(console.error)
      await saveToDatabase(data, 'painter')
      agentMessage(
        `Perfeito, **${data.name}**! 🎉 Coletei suas informações.\n\nAgora clique abaixo para finalizar seu cadastro e começar a receber pedidos nos seus bairros e especialidades.`,
        undefined,
        { cta: { label: '🖌️ Finalizar cadastro de pintor', href: '/seja-pintor' } },
      )
      return
    }

    const steps = await getSteps()
    const resolvedStep = autoAdvance(steps, nextKey, data, prefilledFieldsRef.current)
    if (!resolvedStep) {
      const branch = getStep(steps, nextKey)?.branch
      await advanceToState(branch === 'painter' ? 'painter_done' : 'generating_briefing', data)
      return
    }

    setCurrentState(resolvedStep.step_key)
    saveSessionState(resolvedStep.step_key, data).catch(console.error)

    let message = renderTemplate(resolvedStep, steps, data, authUser?.name)

    if (opts?.fromStep?.use_ai_transition) {
      setLoading(true)
      try {
        message = await callTransition({
          previous_field: opts.fromStep.field_key,
          previous_value: opts.fromValue ?? null,
          next_question: message,
          collected_data: data,
          user_name: authUser?.name,
        })
      } catch {
        // fallback: mantém a pergunta padrão (já em `message`)
      } finally {
        setLoading(false)
      }
    }

    agentMessage(
      message,
      resolvedStep.step_type === 'quick_reply' || resolvedStep.step_type === 'media' ? resolvedStep.quick_replies ?? undefined : undefined,
    )
  }

  // ── Inicialização da conversa ───────────────────────────────────────────────
  async function handleInit(text: string) {
    const steps = await getSteps()
    const data: CollectedData = { ...dataRef.current }
    const prefilled = new Set<string>()

    if (authUser) {
      if (authUser.name) { data.name = authUser.name; prefilled.add('name') }
      if (authUser.email) { data.email = authUser.email; prefilled.add('email') }
      if (authUser.phone) { data.whatsapp = authUser.phone; prefilled.add('whatsapp') }
      if (authUser.activeRole === 'painter') {
        data.role = 'painter'
        prefilled.add('role')
      }
      // Clientes não têm role preenchido automaticamente → role_select step aparece
      // para que possam opcionalmente se cadastrar como pintores
    }

    let transitionField: string | null = null
    let transitionValue: string | null = null

    if (text !== '__init__') {
      const lower = text.toLowerCase()
      const matchedChip = Object.entries(CHIP_TO_SERVICE).find(([k]) => lower.includes(k))
      if (matchedChip) {
        data.service_type = matchedChip[1]
        data.role = 'client'
        prefilled.add('service_type')
        prefilled.add('role')
        transitionField = 'service_type'
        transitionValue = matchedChip[1]
      } else if (text.trim().length > 20) {
        // Mensagem substancial — extrai todos os campos via LLM antes de prosseguir
        setLoading(true)
        try {
          const { data: ctxResult } = await supabase.functions.invoke('agent-chat', {
            body: {
              session_id: sessionId.current,
              message: text,
              history: [],
              metadata: metadataRef.current,
              action: 'extract_initial_context',
            },
          })
          const extracted = ctxResult?.extracted as Record<string, unknown> | undefined
          if (extracted) {
            const CORE_FIELDS = ['name', 'service_type', 'area_m2', 'property_type', 'neighborhood', 'wall_condition', 'deadline', 'material', 'whatsapp'] as const
            for (const key of CORE_FIELDS) {
              const val = extracted[key]
              if (val !== undefined && val !== null) {
                (data as unknown as Record<string, unknown>)[key] = val
                prefilled.add(key)
              }
            }
            if (extracted.role === 'painter') {
              data.role = 'painter'; prefilled.add('role')
            } else if (!data.role) {
              data.role = 'client'; prefilled.add('role')
            }
            transitionField = extracted.service_type ? 'service_type' : null
            transitionValue = extracted.service_type ? String(extracted.service_type) : text
          } else {
            transitionValue = text
          }
        } catch {
          transitionValue = text
        } finally {
          setLoading(false)
        }
      } else {
        transitionValue = text
      }
    }

    dataRef.current = data
    setCollectedData(data)
    prefilledFieldsRef.current = prefilled

    const firstKey = branchSteps(steps, 'client')[0]?.step_key ?? 'role_select'
    const resolvedStep = autoAdvance(steps, firstKey, data, prefilled)
    if (!resolvedStep) {
      await advanceToState(data.role === 'painter' ? 'painter_done' : 'generating_briefing', data)
      return
    }

    setCurrentState(resolvedStep.step_key)
    saveSessionState(resolvedStep.step_key, data).catch(console.error)

    let message = renderTemplate(resolvedStep, steps, data, authUser?.name)

    if (transitionValue !== null) {
      setLoading(true)
      try {
        message = await callTransition({
          previous_field: transitionField,
          previous_value: transitionValue,
          next_question: message,
          collected_data: data,
          user_name: authUser?.name,
        })
      } catch {
        if (!transitionField) message = `Entendido! ${message}`
      } finally {
        setLoading(false)
      }
    } else {
      const firstName = authUser?.name?.split(' ')[0]
      if (firstName && prefilled.has('role') && !resolvedStep.question_template.includes('{{name}}')) {
        message = `Oi ${firstName}! 👋 ${message}`
      }
    }

    agentMessage(
      message,
      resolvedStep.step_type === 'quick_reply' || resolvedStep.step_type === 'media' ? resolvedStep.quick_replies ?? undefined : undefined,
    )
  }

  // ── Steps de mídia (media_upload, final_notes, custom) ──────────────────────
  async function handleMediaStep(steps: FlowStep[], step: FlowStep, text: string, mediaUrls: string[]) {
    let newData: CollectedData = { ...dataRef.current }

    if (mediaUrls.length > 0) {
      if (step.field_key === 'media_urls') {
        newData = setFieldValue(newData, step, [...(newData.media_urls || []), ...mediaUrls])
      } else {
        newData = { ...newData, notes_media_urls: [...(newData.notes_media_urls || []), ...mediaUrls] }
      }
    }

    const normalized = text.trim().toLowerCase()
    const isSkip = !text.trim() || SKIP_VALUES.has(normalized)
    if (!isSkip && step.field_key !== 'media_urls') {
      newData = setFieldValue(newData, step, text.trim())
    }

    dataRef.current = newData
    setCollectedData(newData)

    if (mediaUrls.length > 0 && !isSkip) {
      agentMessage(`Recebido! 📸 ${mediaUrls.length} ${mediaUrls.length === 1 ? 'arquivo recebido' : 'arquivos recebidos'}. Anotado também! ✍️`)
    } else if (mediaUrls.length > 0) {
      agentMessage(`Recebido! 📸 ${mediaUrls.length} ${mediaUrls.length === 1 ? 'imagem recebida' : 'imagens recebidas'}.`)
    } else if (!isSkip) {
      agentMessage('Anotado! ✍️')
    } else {
      agentMessage('Ok, vou prosseguir.')
    }

    const nextKey = resolveNext(steps, step, text, newData)
    await delay(600)
    await advanceToState(nextKey, newData, { fromStep: step, fromValue: text })
  }

  // ── Valida texto livre; em campos críticos, tenta extrair via LLM antes de rejeitar ──
  async function validateStep(step: FlowStep, text: string): Promise<{ ok: boolean; value?: string; hint?: string }> {
    const validator = VALIDATORS[step.validation_type]
    const result = validator(text)
    if (result.ok) return { ok: true, value: text }

    if (EXTRACTABLE_VALIDATIONS.has(step.validation_type)) {
      setLoading(true)
      const extracted = await extractFieldWithLLM(step.field_key, text)
      setLoading(false)
      if (extracted) {
        const revalidation = validator(extracted)
        if (revalidation.ok) return { ok: true, value: extracted }
      }
    }

    return { ok: false, hint: result.hint || 'Não entendi, pode tentar de novo? 😊' }
  }

  // ── Salva o campo respondido e avança para o próximo step ───────────────────
  async function commitFieldAndAdvance(steps: FlowStep[], step: FlowStep, rawText: string) {
    const fieldValue = computeFieldValue(step, rawText)
    let newData = setFieldValue(dataRef.current, step, fieldValue) as CollectedData

    // Quando o usuário responde role_select com uma opção de serviço (role='client'),
    // extrai e prefila o service_type para pular o step seguinte de tipo de serviço.
    if (step.field_key === 'role' && fieldValue === 'client') {
      const SERVICE_MAP: Record<string, string> = {
        'pintura interna': 'Pintura interna',
        'fachada': 'Fachada externa',
        'pós-obra': 'Pós-obra',
        'pos-obra': 'Pós-obra',
        'textura': 'Textura / massa corrida',
        'impermeabiliz': 'Impermeabilização',
        'arte': 'Arte / mural',
        'mural': 'Arte / mural',
      }
      const lower = rawText.toLowerCase()
      for (const [key, val] of Object.entries(SERVICE_MAP)) {
        if (lower.includes(key)) {
          newData = setFieldValue(newData, { ...step, field_key: 'service_type', is_core_field: true }, val) as CollectedData
          prefilledFieldsRef.current.add('service_type')
          break
        }
      }
    }

    dataRef.current = newData
    setCollectedData(newData)

    const inCorrection = correctionModeRef.current
    correctionModeRef.current = false
    const nextKey = inCorrection ? 'confirmation' : resolveNext(steps, step, rawText, newData)

    if (step.branch === 'client' && step.field_key === 'whatsapp') {
      savePartialLead(newData, nextKey).catch(console.warn)
    }

    setLoading(true)
    await delay(400)
    setLoading(false)

    // Verifica se o email já está cadastrado e informa o usuário
    if (step.field_key === 'email' && fieldValue) {
      try {
        const { data: userCheck } = await supabase.functions.invoke('agent-chat', {
          body: { session_id: sessionId.current, message: '', history: [], action: 'check_email', email: fieldValue },
        })
        if (userCheck?.exists) {
          const firstName = ((userCheck.name as string) || newData.name || '').split(' ')[0]
          agentMessage(
            userCheck.has_account
              ? `Reconheci seu e-mail${firstName ? `, ${firstName}` : ''}! 😊 Você já tem uma conta na Pintai — ao final, é só fazer login para acompanhar as propostas diretamente.`
              : `Ótimo! Encontrei um cadastro com este e-mail. 😊`
          )
          await delay(500)
        }
      } catch { /* silencioso — fluxo continua normalmente */ }
    }

    await advanceToState(nextKey, newData, { fromStep: step, fromValue: rawText })
  }

  async function generateBriefing(data: CollectedData) {
    agentMessage('Processando seu pedido...', undefined)
    setLoading(true)

    // SALVA NO DB PRIMEIRO — independente de a AI funcionar
    const { protocol, calc } = await saveToDatabase(data, 'client')

    let briefingData: BriefingData | null = null
    try {
      const { data: fnData } = await supabase.functions.invoke('agent-chat', {
        body: {
          session_id: sessionId.current,
          message: `Gere um briefing técnico para: bairro=${data.neighborhood}, imóvel=${data.property_type}, serviço=${data.service_type}, paredes=${data.wall_condition}, prazo=${data.deadline}, material=${data.material}, mídias=${data.media_urls?.length || 0}`,
          history: [],
          media_urls: data.media_urls,
          action: 'generate_briefing',
          collected: data,
          metadata: metadataRef.current,
        },
      })
      if (fnData?.briefing) briefingData = fnData.briefing as BriefingData
    } catch (err) {
      console.warn('Briefing AI indisponível, usando fallback local:', err)
    }

    // Fallback local se AI falhou
    if (!briefingData) {
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

    // Estimativa REAL calculada pelo motor de regras (sobrepõe valores da IA/fallback)
    if (calc) {
      briefingData.preco_min_estimado = calc.estimated_min
      briefingData.preco_max_estimado = calc.estimated_max
      briefingData.confianca_preco = calc.confidence_label === 'média' ? 'media' : calc.confidence_label
    }
    if (data.area_m2) {
      briefingData.metragem_estimada_m2 = data.area_m2
      briefingData.confianca_metragem = 'alta'
    }

    setCurrentState('briefing_ready')
    agentMessage(
      `✅ **Pedido enviado com sucesso!**\n\nProtocolo: **${protocol}**\n\nSeu pedido foi encaminhado para pintores próximos ao ${data.neighborhood}. Quando um pintor enviar uma proposta, você será notificado pelo e-mail **${data.email}**.`,
      undefined,
      { briefing: briefingData },
    )
    setLoading(false)
  }

  async function saveToDatabase(data: CollectedData, role: 'client' | 'painter'): Promise<{ protocol: string; calc: BudgetCalc | null }> {
    let protocol = dataRef.current._partialProtocol || generateLocalProtocol()
    let calc: BudgetCalc | null = null

    try {
      if (role === 'client') {
        const trackingData = await captureTracking()
        const { data: result, error } = await supabase.functions.invoke('save-lead', {
          body: { protocol: dataRef.current._partialProtocol, partial: false, role: 'client', data: { ...data, tracking_data: trackingData }, custom_fields: data.custom_fields },
        })
        if (error) {
          console.error('save-lead error:', JSON.stringify(error))
        } else if (result?.protocol) {
          protocol = result.protocol
          calc = result.calc ?? null
        }
      }

      // Final session upsert with full collected data
      await supabase.from('conversation_sessions').upsert({
        session_id: sessionId.current,
        user_identifier: data.whatsapp || data.email || sessionId.current,
        channel: 'web',
        role_detected: role,
        current_state: role === 'client' ? 'briefing_ready' : 'painter_registered',
        collected_data: { ...data, _metadata: metadataRef.current, protocol },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })

      if (role === 'client' && data.email) {
        const emailPayload = {
          to: data.email,
          name: data.name || 'Cliente',
          protocol,
          neighborhood: data.neighborhood || '',
          service_type: data.service_type || '',
          summary: `Nome: ${data.name}\nEmail: ${data.email}\nWhatsApp: ${data.whatsapp}\nBairro: ${data.neighborhood} · ${data.property_type}\nServiço: ${data.service_type}\nParedes: ${data.wall_condition}\nPrazo: ${data.deadline} · Material: ${data.material}${data.final_notes ? `\nObservações: ${data.final_notes}` : ''}`,
          calc_price_min: calc?.estimated_min,
          calc_price_max: calc?.estimated_max,
          area_m2: data.area_m2,
          num_rooms: data.num_rooms,
        }
        console.log('[Email] sending to:', data.email, 'protocol:', protocol)

        try {
          const { data: resp, error: emailErr } = await supabase.functions.invoke('send-notification-email', { body: emailPayload })
          if (emailErr) {
            console.error('[Email] supabase invoke error:', emailErr)
            // Fallback: fetch direto
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-email`
            const fallback = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify(emailPayload),
            })
            const fallbackData = await fallback.json()
            console.log('[Email] fallback result:', fallbackData)
          } else {
            console.log('[Email] sent ok:', resp)
          }
          await supabase.from('leads').update({ email_confirmation_sent: true }).eq('protocol', protocol)
        } catch (emailCatchErr) {
          console.error('[Email] catch error:', emailCatchErr)
        }
      }

      await supabase.from('messages').insert({
        session_id: sessionId.current,
        channel: 'web',
        direction: 'inbound',
        body: JSON.stringify({ ...data, protocol }),
        ai_intent: `lead_captured:${role}`,
        metadata: { collected: data, protocol, browser: metadataRef.current },
      })
    } catch (err) {
      console.error('DB save error:', err)
    }

    return { protocol, calc }
  }

  // ── Função principal: processa a resposta do usuário ────────────────────────
  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    let mediaUrls: string[] = []
    if (files && files.length > 0) {
      setLoading(true)
      const urls = await Promise.all(files.map((f) => uploadMedia(f, sessionId.current)))
      mediaUrls = urls.filter(Boolean) as string[]
      setLoading(false)
    }

    if (text !== '__init__') {
      userMessage(text, mediaUrls.length > 0 ? mediaUrls : undefined)
    }

    if (text === '__init__' || currentState === 'init') {
      await handleInit(text)
      return
    }

    // Correção de campo específico: usuário escolhe qual dado quer corrigir
    if (currentState === 'correction_select') {
      const steps = await getSteps()
      const selected = Object.entries(FIELD_LABELS).find(([, label]) =>
        text.trim() === label || text.includes(label.replace(/^.\s/, ''))
      )
      if (selected) {
        const [fieldKey] = selected
        const targetStep = branchSteps(steps, 'client').find(s => s.field_key === fieldKey)
        if (targetStep) {
          correctionModeRef.current = true
          setCurrentState(targetStep.step_key)
          const msg = renderTemplate(targetStep, steps, dataRef.current, authUser?.name)
          agentMessage(msg, targetStep.step_type === 'quick_reply' ? targetStep.quick_replies ?? undefined : undefined)
          return
        }
      }
      const options = buildCorrectionOptions(dataRef.current)
      agentMessage('Qual dado você quer corrigir? 👆', options.length > 0 ? options : undefined)
      return
    }

    // Terminal state: briefing was already sent — guide to account and don't stall
    if (currentState === 'briefing_ready') {
      setLoading(true)
      await delay(600)
      setLoading(false)
      agentMessage(
        `Seu pedido já foi registrado com sucesso! 🎉\n\n` +
        `Para acompanhar as propostas dos pintores, crie sua conta grátis ou faça login — ` +
        `as propostas ficam disponíveis na sua área do cliente.\n\n` +
        `Você receberá um e-mail quando um pintor enviar uma proposta para você avaliar. ` +
        `Para iniciar um novo pedido, clique em "Nova solicitação" abaixo. 👇`
      )
      return
    }

    const steps = await getSteps()
    const step = getStep(steps, currentState)
    if (!step) return

    // ── STEPS DE MÍDIA ────────────────────────────────────────────────────────
    if (step.step_type === 'media') {
      await handleMediaStep(steps, step, text, mediaUrls)
      return
    }

    // ── VALIDAÇÃO DE TEXTO LIVRE ─────────────────────────────────────────────
    if (step.step_type === 'text' && step.validation_type !== 'none') {
      const validation = await validateStep(step, text)
      if (!validation.ok) {
        agentMessage(validation.hint || 'Não entendi, pode tentar de novo? 😊')
        return
      }
      text = validation.value ?? text
    }

    // ── VALIDAÇÃO DE QUICK REPLY ─────────────────────────────────────────────
    if (step.step_type === 'quick_reply' && !matchesQuickReply(step, text)) {
      if (step.field_key === 'neighborhood') {
        const normalized = text.toLowerCase()
        const match = KNOWN_NEIGHBORHOODS.find(b => normalized.includes(b.toLowerCase()))
        const free = match || (text.trim().length > 2 && !text.includes('?') ? text.trim() : null)
        if (free) {
          await commitFieldAndAdvance(steps, step, free)
          return
        }
      }
      setLoading(true)
      setTimeout(() => {
        agentMessage('Por favor, escolha uma das opções acima. 👆', step.quick_replies ?? undefined)
        setLoading(false)
      }, 300)
      return
    }

    // ── SALVAR CAMPO E AVANÇAR ───────────────────────────────────────────────
    await commitFieldAndAdvance(steps, step, text)
  }, [currentState]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    sessionId.current = generateSessionId()
    localStorage.setItem(SESSION_KEY, sessionId.current)
    metadataRef.current = getBrowserMetadata()
    dataRef.current = {}
    prefilledFieldsRef.current = new Set()
    correctionModeRef.current = false
    setCollectedData({})
    setMessages([])
    setCurrentState('init')
  }, [])

  const currentInputType = currentState !== 'init'
    ? (getStep(loadedStepsRef.current, currentState)?.step_type || 'text')
    : 'text'

  return {
    messages,
    loading,
    sendMessage,
    reset,
    sessionId: sessionId.current,
    collectedData,
    currentState,
    currentInputType,
  }
}
