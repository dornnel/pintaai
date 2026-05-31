import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Save, Bot, Zap, FileText, TestTube, Loader2, CheckCircle,
  Plus, Trash2, Upload, MessageSquare, Copy, Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ConversationSession } from '../../lib/types'

interface AgentConfig {
  id: string
  name: string
  channel: string
  system_prompt: string
  model: string
  max_tokens: number
  temperature: number
  tools_enabled: string[]
  rag_documents: { name: string; url: string }[]
  skills_enabled: string[]
  active: boolean
  version: number
}

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recomendado)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido, baixo custo)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Alta qualidade)' },
]

const AVAILABLE_TOOLS = [
  { id: 'generate_briefing', label: 'Gerar briefing técnico', desc: 'Analisa fotos e dados para criar briefing' },
  { id: 'compare_quotes', label: 'Comparar propostas', desc: 'Analisa e classifica orçamentos' },
  { id: 'sentiment_analysis', label: 'Análise de sentimento', desc: 'Avalia reviews e comentários' },
  { id: 'moderation', label: 'Moderação', desc: 'Detecta conteúdo ofensivo ou bypass' },
]

const AVAILABLE_SKILLS = [
  { id: 'painting_specialist', label: 'Especialista em pintura', desc: 'Conhecimento técnico de tipos de tinta, superfícies e processos' },
  { id: 'floripa_local', label: 'Localização Floripa', desc: 'Conhecimento dos bairros e contexto local' },
  { id: 'price_estimator', label: 'Estimativa de preço', desc: 'Faixas de preço por m², tipo de serviço e bairro' },
]

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  system: 'Sistema',
  admin: 'Admin',
}

export function AgentConfigPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState('')
  const [testing, setTesting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'prompt' | 'tools' | 'rag' | 'conversations' | 'test'>('prompt')
  const [conversations, setConversations] = useState<ConversationSession[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  useEffect(() => { loadConfig() }, [])
  useEffect(() => {
    if (activeTab === 'conversations') loadConversations()
  }, [activeTab])

  async function loadConfig() {
    const { data } = await supabase.from('agent_configs').select('*').eq('active', true).single()
    if (data) {
      setConfig({
        ...data,
        tools_enabled: data.tools_enabled || [],
        rag_documents: data.rag_documents || [],
        skills_enabled: data.skills_enabled || [],
      })
    }
    setLoading(false)
  }

  async function loadConversations() {
    setConvLoading(true)
    const { data } = await supabase
      .from('conversation_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setConversations((data as ConversationSession[]) || [])
    setConvLoading(false)
  }

  async function save() {
    if (!config) return
    setSaving(true)
    await supabase.from('agent_configs').update({
      system_prompt: config.system_prompt,
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      tools_enabled: config.tools_enabled,
      rag_documents: config.rag_documents,
      skills_enabled: config.skills_enabled,
      version: config.version + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', config.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testAgent() {
    if (!testInput.trim()) return
    setTesting(true)
    setTestOutput('')
    try {
      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: { session_id: `test_${Date.now()}`, message: testInput, history: [], media_urls: [] },
      })
      if (error) throw error
      setTestOutput(data?.message || JSON.stringify(data, null, 2))
    } catch (err) {
      setTestOutput(`Erro: ${String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  async function uploadRagFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!config) return
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const path = `agent-docs/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('agent-docs').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('agent-docs').getPublicUrl(path)
      setConfig({
        ...config,
        rag_documents: [...config.rag_documents, { name: file.name, url: urlData.publicUrl }],
      })
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  function toggleTool(id: string) {
    if (!config) return
    const has = config.tools_enabled.includes(id)
    setConfig({ ...config, tools_enabled: has ? config.tools_enabled.filter(t => t !== id) : [...config.tools_enabled, id] })
  }

  function toggleSkill(id: string) {
    if (!config) return
    const has = config.skills_enabled.includes(id)
    setConfig({ ...config, skills_enabled: has ? config.skills_enabled.filter(s => s !== id) : [...config.skills_enabled, id] })
  }

  function addRagDoc() {
    if (!config) return
    setConfig({ ...config, rag_documents: [...config.rag_documents, { name: 'Novo documento', url: '' }] })
  }

  function removeRagDoc(i: number) {
    if (!config) return
    setConfig({ ...config, rag_documents: config.rag_documents.filter((_, idx) => idx !== i) })
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const TABS = [
    { id: 'prompt', icon: Bot, label: 'Prompt' },
    { id: 'tools', icon: Zap, label: 'Tools & Skills' },
    { id: 'rag', icon: FileText, label: 'RAG / Docs' },
    { id: 'conversations', icon: MessageSquare, label: 'Conversas' },
    { id: 'test', icon: TestTube, label: 'Testar' },
  ] as const

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!config) return <div className="p-6 text-sm text-gray-500">Nenhuma configuração encontrada.</div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configuração do Agente</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.name} · versão {config.version} · usado no web e WhatsApp
          </p>
        </div>
        <motion.button
          onClick={save}
          disabled={saving}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl shadow-md shadow-brand/20 cursor-pointer disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar'}
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Prompt tab */}
      {activeTab === 'prompt' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Modelo</label>
              <select value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Max tokens</label>
              <input type="number" value={config.max_tokens} onChange={e => setConfig({ ...config, max_tokens: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Temperatura ({config.temperature})</label>
              <input type="range" min="0" max="1" step="0.1" value={config.temperature}
                onChange={e => setConfig({ ...config, temperature: Number(e.target.value) })}
                className="w-full accent-brand" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">System Prompt</label>
            <textarea
              value={config.system_prompt}
              onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
              rows={18}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand font-mono resize-none leading-relaxed"
            />
            <p className="text-xs text-gray-400 mt-1">{config.system_prompt.length} caracteres</p>
          </div>
        </div>
      )}

      {/* Tools & Skills tab */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tools disponíveis</h3>
            <div className="space-y-2">
              {AVAILABLE_TOOLS.map(tool => (
                <label key={tool.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  config.tools_enabled.includes(tool.id) ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={config.tools_enabled.includes(tool.id)} onChange={() => toggleTool(tool.id)} className="accent-brand" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{tool.label}</p>
                    <p className="text-xs text-gray-400">{tool.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Skills / Conhecimento especializado</h3>
            <div className="space-y-2">
              {AVAILABLE_SKILLS.map(skill => (
                <label key={skill.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  config.skills_enabled.includes(skill.id) ? 'border-brand bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={config.skills_enabled.includes(skill.id)} onChange={() => toggleSkill(skill.id)} className="accent-brand" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{skill.label}</p>
                    <p className="text-xs text-gray-400">{skill.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RAG tab */}
      {activeTab === 'rag' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Documentos de referência para o agente (preços, bairros, processos técnicos)</p>
            <div className="flex items-center gap-2">
              {/* Upload de arquivo */}
              <label className={`flex items-center gap-1.5 text-sm font-medium cursor-pointer px-3 py-1.5 rounded-xl border transition-colors ${
                uploading ? 'text-gray-400 border-gray-200 pointer-events-none' : 'text-brand border-brand/30 hover:bg-orange-50'
              }`}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Enviando...' : 'Upload'}
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,.md"
                  className="hidden"
                  onChange={uploadRagFile}
                  disabled={uploading}
                />
              </label>
              {/* Adicionar URL manual */}
              <button onClick={addRagDoc} className="flex items-center gap-1.5 text-sm text-gray-500 font-medium cursor-pointer hover:text-gray-700">
                <Plus className="w-4 h-4" /> URL
              </button>
            </div>
          </div>

          {config.rag_documents.length === 0 && !uploading && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum documento ainda.</p>
              <p className="text-xs text-gray-300 mt-1">Faça upload de PDFs, TXT ou adicione URLs de referência.</p>
            </div>
          )}

          <div className="space-y-2">
            {config.rag_documents.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <input
                    value={doc.name}
                    onChange={e => {
                      const docs = [...config.rag_documents]
                      docs[i] = { ...docs[i], name: e.target.value }
                      setConfig({ ...config, rag_documents: docs })
                    }}
                    placeholder="Nome do documento"
                    className="w-full text-sm font-medium outline-none border-0 p-0 text-gray-800 bg-transparent"
                  />
                  <input
                    value={doc.url}
                    onChange={e => {
                      const docs = [...config.rag_documents]
                      docs[i] = { ...docs[i], url: e.target.value }
                      setConfig({ ...config, rag_documents: docs })
                    }}
                    placeholder="URL ou caminho"
                    className="w-full text-xs outline-none border-0 p-0 text-gray-400 bg-transparent truncate"
                  />
                </div>
                {doc.url && (
                  <button
                    onClick={() => copyUrl(doc.url)}
                    className="text-gray-300 hover:text-gray-500 cursor-pointer shrink-0"
                    title="Copiar URL"
                  >
                    {copiedUrl === doc.url ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button onClick={() => removeRagDoc(i)} className="text-red-400 hover:text-red-600 cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Histórico de sessões de conversa</p>
            <button onClick={loadConversations} className="text-xs text-brand font-medium cursor-pointer hover:text-brand-dark">
              Atualizar
            </button>
          </div>

          {convLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma conversa registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        s.channel === 'whatsapp' ? 'bg-green-100 text-green-700' :
                        s.channel === 'web' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {CHANNEL_LABELS[s.channel] ?? s.channel}
                      </span>
                      <span className="text-xs text-gray-500 font-mono truncate">{s.user_identifier}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="truncate">Estado: <span className="text-gray-600 font-medium">{s.current_state}</span></span>
                      <span className="shrink-0">{new Date(s.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {s.service_request_id && (
                    <span className="text-xs bg-orange-50 text-brand px-2 py-0.5 rounded-full font-medium shrink-0">
                      tem pedido
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test tab */}
      {activeTab === 'test' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Teste o agente com a configuração atual antes de salvar.</p>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Mensagem de teste</label>
            <textarea
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              rows={3}
              placeholder="Ex: Preciso pintar minha sala no Campeche"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand resize-none"
            />
          </div>
          <motion.button
            onClick={testAgent}
            disabled={testing || !testInput.trim()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            Executar teste
          </motion.button>
          {testOutput && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Resposta do agente:</p>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{testOutput}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
