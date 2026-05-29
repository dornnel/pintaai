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

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const sessionId = useRef(getOrCreateSessionId())
  const historyRef = useRef<{ role: string; content: string }[]>([])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text || (files ? `[${files.length} imagem(ns) enviada(s)]` : ''),
      mediaUrls: [],
      timestamp: new Date(),
    }

    // Upload files if present
    if (files && files.length > 0) {
      const urls = await Promise.all(files.map((f) => uploadMedia(f, sessionId.current)))
      userMsg.mediaUrls = urls.filter(Boolean) as string[]
    }

    addMessage(userMsg)
    historyRef.current.push({ role: 'user', content: userMsg.content })
    setLoading(true)

    try {
      const body = {
        session_id: sessionId.current,
        message: text,
        history: historyRef.current.slice(-12), // keep last 12 turns
        media_urls: userMsg.mediaUrls,
      }

      let agentResponse: {
        message: string
        quickReplies?: string[]
        briefing?: BriefingData
        action?: string
      }

      // Try Edge Function, gracefully fall back to demo if not deployed
      try {
        const { data, error } = await supabase.functions.invoke('agent-chat', { body })
        if (error || !data?.message) throw new Error('function not available')
        agentResponse = data
      } catch {
        agentResponse = getDemoResponse(historyRef.current.length, text)
      }

      const agentMsg: ChatMessage = {
        id: `agent_${Date.now()}`,
        role: 'agent',
        content: agentResponse.message,
        quickReplies: agentResponse.quickReplies,
        briefing: agentResponse.briefing,
        timestamp: new Date(),
      }

      addMessage(agentMsg)
      historyRef.current.push({ role: 'assistant', content: agentResponse.message })

      // Save to Supabase messages table
      await supabase.from('messages').insert({
        session_id: sessionId.current,
        channel: 'web',
        direction: 'inbound',
        body: text,
        media_url: userMsg.mediaUrls?.[0],
        metadata: { session_id: sessionId.current },
      })
    } catch (err) {
      console.error('Agent error:', err)
      addMessage({
        id: `err_${Date.now()}`,
        role: 'agent',
        content: 'Ops, tive um problema técnico. Tenta de novo ou me fala pelo WhatsApp 😊',
        quickReplies: ['Tentar novamente'],
        timestamp: new Date(),
      })
    } finally {
      setLoading(false)
    }
  }, [addMessage])

  const reset = useCallback(() => {
    sessionId.current = generateSessionId()
    localStorage.setItem(SESSION_KEY, sessionId.current)
    historyRef.current = []
    setMessages([])
  }, [])

  return { messages, loading, sendMessage, reset, sessionId: sessionId.current }
}

// Demo responses for development without Supabase configured
function getDemoResponse(turn: number, _text: string): { message: string; quickReplies?: string[] } {
  const responses = [
    {
      message: 'Oi! Sou o assistente da **Pintaê Floripa** 🎨\n\nVou te ajudar a receber até **3 orçamentos comparáveis** de pintores próximos ao seu bairro.\n\nVocê é **cliente** buscando pintura ou **pintor** querendo receber pedidos?',
      quickReplies: ['Sou cliente', 'Sou pintor'],
    },
    {
      message: 'Ótimo! Em qual **bairro** o serviço vai ser feito?',
      quickReplies: ['Campeche', 'Rio Tavares', 'Armação', 'Outro bairro'],
    },
    {
      message: 'Perfeito! Que tipo de **imóvel** é?',
      quickReplies: ['Apartamento', 'Casa', 'Loja / Comércio', 'Airbnb'],
    },
    {
      message: 'Entendi! Me manda algumas **fotos** do que precisa pintar — com elas consigo estimar a metragem e gerar um briefing técnico para os pintores. 📸\n\nPode usar o botão de clipe aqui em baixo.',
      quickReplies: [],
    },
    {
      message: 'Recebido! Mais uma pergunta: qual o **estado atual das paredes**?',
      quickReplies: ['Bom estado', 'Manchas / descascando', 'Rachaduras', 'Mofo', 'Pós-obra'],
    },
    {
      message: 'Quase pronto! Tem **prazo** em mente para o serviço?',
      quickReplies: ['O mais rápido possível', 'Próximas 2 semanas', 'Próximo mês', 'Sem prazo definido'],
    },
    {
      message: '✅ **Briefing gerado!**\n\nEstou enviando para pintores próximos ao seu bairro. Você deve receber até **3 propostas comparáveis** em até 4 horas.\n\nAssim que chegar, te mostro aqui mesmo para você comparar e escolher. 🎨',
      quickReplies: [],
    },
  ]
  const idx = Math.min(Math.floor(turn / 2), responses.length - 1)
  return responses[idx]
}
