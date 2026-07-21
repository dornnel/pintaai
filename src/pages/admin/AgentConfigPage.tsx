import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Save, Bot, Zap, FileText, TestTube, Loader2, CheckCircle,
  Plus, Trash2, Upload, MessageSquare, Copy, Check, HelpCircle,
  Calculator, RefreshCw, AlertTriangle, Route, Target, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { JourneyBuilderTab } from './JourneyBuilderTab'
import type { ConversationSession, BudgetPricingRule, BudgetComplexityRule } from '../../lib/types'

const RECOMMENDED_PROMPT = `Você é o Koke, assistente da Pinte Rápido Floripa no chat web e WhatsApp.

Tom: Prático, simpático, local e objetivo. Evite mensagens longas. Use markdown mínimo (**negrito** apenas quando importante).

Objetivo: Guiar o usuário até um pedido de pintura completo (cliente) ou cadastro (pintor) com o mínimo de atrito. Se o usuário já informou dados (nome, área, tipo de imóvel, etc.), NÃO repita as perguntas — extraia e avance.

REGRA CENTRAL: Nunca informe preço final ao cliente.

Para CLIENTES — colete nesta ordem, pulando o que já foi informado:
1. Bairro — Campeche, Rio Tavares, Armação, Morro das Pedras, Pântano do Sul, Outro
2. Tipo de imóvel — Apartamento, Casa, Loja/Comércio, Airbnb/Temporada, Outro
   → Casa / Loja / Airbnb / Outro: pergunte se prefere visita técnica ou orçamento a distância
   → Apartamento: orçamento a distância é suficiente, pule a pergunta de visita
3. Fotos/vídeo — peça gentilmente, explique que ajudam na precisão
4. Estado das paredes — Bom estado, Manchas, Descascando, Rachaduras, Mofo, Pós-obra
5. Prazo — O mais rápido possível, 2 semanas, Próximo mês, Sem pressa
6. Material — Incluso no serviço, Vou comprar separado, Pintor que indique
7. Observações finais

Regras:
- UMA pergunta por vez. Nunca prometa preço fechado.
- Se o cliente insistir em preço: "Preciso de mais informações para que o pintor faça uma análise precisa."

Para PINTORES — colete: bairros atendidos, especialidades, experiência, disponibilidade, valor mínimo, fornece material.

Formato: máx 2 frases por mensagem. Sem textão.`

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
  const [activeTab, setActiveTab] = useState<'prompt' | 'tools' | 'rag' | 'budget' | 'faq' | 'conversations' | 'jornada' | 'test'>('prompt')
  const [faqItems, setFaqItems] = useState<{ question: string; answer: string }[]>([])
  const [conversations, setConversations] = useState<ConversationSession[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  // Motor de orçamento
  const [pricingRules, setPricingRules] = useState<BudgetPricingRule[]>([])
  const [complexityRules, setComplexityRules] = useState<BudgetComplexityRule[]>([])
  const [budgetEnabled, setBudgetEnabled] = useState(false)
  const [budgetMode, setBudgetMode] = useState('internal_only')
  const [budgetWarning, setBudgetWarning] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)

  useEffect(() => { loadConfig() }, [])
  useEffect(() => {
    if (activeTab === 'conversations') loadConversations()
    if (activeTab === 'budget') loadBudgetRules()
  }, [activeTab])

  async function loadConfig() {
    const [{ data }, { data: modeSetting }] = await Promise.all([
      supabase.from('agent_configs').select('*').eq('active', true).single(),
      supabase.from('platform_settings').select('value').eq('key', 'agent_conversation_mode').maybeSingle(),
    ])
    if (data) {
      setConfig({
        ...data,
        conversation_mode: modeSetting?.value || data.conversation_mode || 'journey',
        tools_enabled: data.tools_enabled || [],
        rag_documents: data.rag_documents || [],
        skills_enabled: data.skills_enabled || [],
      })
      setBudgetEnabled(data.budget_engine_enabled ?? false)
      setBudgetMode(data.budget_mode ?? 'internal_only')
      setBudgetWarning(data.budget_warning_text ?? '')
    }
    setLoading(false)
  }

  async function loadBudgetRules() {
    const [pricingRes, complexityRes] = await Promise.all([
      supabase.from('budget_pricing_rules').select('*').order('sort_order'),
      supabase.from('budget_complexity_rules').select('*').order('sort_order'),
    ])
    if (pricingRes.data) setPricingRules(pricingRes.data as BudgetPricingRule[])
    if (complexityRes.data) setComplexityRules(complexityRes.data as BudgetComplexityRule[])
  }

  async function saveBudgetConfig() {
    if (!config) return
    setSavingBudget(true)
    try {
      // Salvar config do motor no agent_configs
      await supabase.from('agent_configs').update({
        budget_engine_enabled: budgetEnabled,
        budget_mode: budgetMode,
        budget_warning_text: budgetWarning,
      }).eq('id', config.id)

      // Upsert faixas de preço
      for (const rule of pricingRules) {
        await supabase.from('budget_pricing_rules').upsert({
          id: rule.id, service_type: rule.service_type, label: rule.label,
          min_price_m2: rule.min_price_m2, max_price_m2: rule.max_price_m2,
          active: rule.active, sort_order: rule.sort_order,
          updated_at: new Date().toISOString(),
        })
      }

      // Upsert multiplicadores
      for (const rule of complexityRules) {
        await supabase.from('budget_complexity_rules').upsert({
          id: rule.id, key: rule.key, label: rule.label,
          multiplier: rule.multiplier, active: rule.active, sort_order: rule.sort_order,
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) { console.error('Budget save error:', err) }
    setSavingBudget(false)
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
    { id: 'budget', icon: Calculator, label: 'Orçamento IA' },
    { id: 'faq', icon: HelpCircle, label: 'FAQ' },
    { id: 'conversations', icon: MessageSquare, label: 'Conversas' },
    { id: 'jornada', icon: Route, label: 'Jornada' },
    { id: 'test', icon: TestTube, label: 'Testar' },
  ] as const

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>
  if (!config) return <div className="p-6 text-sm text-gray-500">Nenhuma configuração encontrada.</div>

  const conversationMode = (config as AgentConfig & { conversation_mode?: string }).conversation_mode || 'journey'

  const MODE_CFG = {
    journey: {
      label: 'Jornada estruturada',
      desc: 'A sequência de perguntas vem da aba Jornada. O Prompt define tom e validações abertas.',
      color: 'bg-green-50 border-green-200 text-green-900',
      badge: 'bg-green-100 text-green-700',
    },
    ai_autonomous: {
      label: 'IA autônoma',
      desc: 'A IA decide quais perguntas fazer. A Jornada é ignorada. Mais flexível, menos previsível.',
      color: 'bg-violet-50 border-violet-200 text-violet-900',
      badge: 'bg-violet-100 text-violet-700',
    },
    hybrid: {
      label: 'Híbrido',
      desc: 'A Jornada define a sequência base, mas a IA pode avançar etapas se já souber a resposta.',
      color: 'bg-blue-50 border-blue-200 text-blue-900',
      badge: 'bg-blue-100 text-blue-700',
    },
  }
  const modeCfg = MODE_CFG[conversationMode as keyof typeof MODE_CFG] || MODE_CFG.journey

  async function setMode(mode: string) {
    setShowModeMenu(false)
    if (!config) return
    // Persist in platform_settings (key-value table guaranteed to exist)
    await supabase.from('platform_settings').upsert(
      { key: 'agent_conversation_mode', value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    setConfig({ ...config, conversation_mode: mode } as AgentConfig & { conversation_mode?: string })
  }

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

      {/* Mode banner */}
      <div className={`rounded-2xl border px-4 py-3 mb-5 flex items-center justify-between gap-4 ${modeCfg.color}`}>
        <div className="flex items-start gap-2.5">
          <Target className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Modo ativo:</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modeCfg.badge}`}>{modeCfg.label}</span>
            </div>
            <p className="text-xs mt-0.5 opacity-80">{modeCfg.desc}</p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setShowModeMenu(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white/70 rounded-lg hover:bg-white transition-colors cursor-pointer border border-white/50">
            Alterar modo <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showModeMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-48 overflow-hidden">
              {Object.entries(MODE_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setMode(key)}
                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors cursor-pointer ${key === conversationMode ? 'font-semibold text-brand' : 'text-gray-700'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
            {/* Sync status badges on Prompt and Jornada tabs */}
            {t.id === 'prompt' && activeTab !== 'prompt' && (
              <span className="ml-auto text-[8px] bg-green-100 text-green-700 px-1 rounded font-bold">LIVE</span>
            )}
            {t.id === 'jornada' && activeTab !== 'jornada' && (
              <span className="ml-auto text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">NEW</span>
            )}
          </button>
        ))}
      </div>

      {/* Prompt tab */}
      {activeTab === 'prompt' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Reflete imediatamente</strong> — alterações no Prompt são lidas pela edge function em tempo real em cada nova mensagem.</span>
          </div>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">System Prompt</label>
              <button
                onClick={() => setConfig({ ...config, system_prompt: RECOMMENDED_PROMPT })}
                className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark cursor-pointer transition-colors"
                title="Restaurar o prompt recomendado pela Pinte Rápido"
              >
                <RefreshCw className="w-3 h-3" /> Restaurar recomendado
              </button>
            </div>
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

      {/* Orçamento IA tab */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {/* Aviso interno */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Motor de orçamento interno</p>
              <p className="text-xs text-amber-700 mt-0.5">
                As estimativas geradas por este motor são para uso INTERNO de admins e pintores.
                O cliente nunca recebe preço automático — o pintor valida o orçamento final.
              </p>
            </div>
          </div>

          {/* Switch + Modo + Aviso */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Motor de orçamento IA</p>
                <p className="text-xs text-gray-400 mt-0.5">Calcula faixa estimada internamente ao receber solicitação</p>
              </div>
              <button
                onClick={() => setBudgetEnabled(!budgetEnabled)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${budgetEnabled ? 'bg-brand' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${budgetEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Modo de exposição</label>
              <select value={budgetMode} onChange={e => setBudgetMode(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                <option value="internal_only">Interno apenas (padrão recomendado)</option>
                <option value="show_summary">Mostrar resumo ao cliente</option>
                <option value="show_range">Mostrar faixa estimada ao cliente com aviso</option>
              </select>
            </div>

            {budgetMode !== 'internal_only' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Texto de aviso exibido ao cliente</label>
                <textarea value={budgetWarning} onChange={e => setBudgetWarning(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
              </div>
            )}
          </div>

          {/* Faixas base por m² */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Faixas base por m² (R$)</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-gray-400 px-1 pb-1">
                <span className="col-span-5">Tipo de serviço</span>
                <span className="col-span-3 text-center">Mín R$/m²</span>
                <span className="col-span-3 text-center">Máx R$/m²</span>
                <span className="col-span-1 text-center">Ativo</span>
              </div>
              {pricingRules.map((rule, i) => (
                <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-xs text-gray-700 truncate">{rule.label}</span>
                  <input type="number" value={rule.min_price_m2} step="0.5"
                    onChange={e => setPricingRules(prev => prev.map((r, idx) => idx === i ? { ...r, min_price_m2: Number(e.target.value) } : r))}
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-brand" />
                  <input type="number" value={rule.max_price_m2} step="0.5"
                    onChange={e => setPricingRules(prev => prev.map((r, idx) => idx === i ? { ...r, max_price_m2: Number(e.target.value) } : r))}
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-brand" />
                  <div className="col-span-1 flex justify-center">
                    <input type="checkbox" checked={rule.active}
                      onChange={e => setPricingRules(prev => prev.map((r, idx) => idx === i ? { ...r, active: e.target.checked } : r))}
                      className="accent-brand w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multiplicadores de complexidade */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Multiplicadores de complexidade</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-gray-400 px-1 pb-1">
                <span className="col-span-8">Fator</span>
                <span className="col-span-3 text-center">Multiplicador</span>
                <span className="col-span-1 text-center">Ativo</span>
              </div>
              {complexityRules.map((rule, i) => (
                <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-8 text-xs text-gray-700">{rule.label}</span>
                  <input type="number" value={rule.multiplier} step="0.01" min="1"
                    onChange={e => setComplexityRules(prev => prev.map((r, idx) => idx === i ? { ...r, multiplier: Number(e.target.value) } : r))}
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-brand" />
                  <div className="col-span-1 flex justify-center">
                    <input type="checkbox" checked={rule.active}
                      onChange={e => setComplexityRules(prev => prev.map((r, idx) => idx === i ? { ...r, active: e.target.checked } : r))}
                      className="accent-brand w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <motion.button onClick={saveBudgetConfig} disabled={savingBudget}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50">
            {savingBudget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar configurações de orçamento
          </motion.button>
        </div>
      )}

      {/* FAQ tab */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Base de Conhecimento — FAQ</p>
              <p className="text-xs text-gray-500 mt-0.5">Perguntas e respostas que o agente deve saber. Exemplos: ambiente ocupado, acesso, chuva, atrasos, garantias.</p>
            </div>
            <button
              onClick={() => setFaqItems(prev => [...prev, { question: '', answer: '' }])}
              className="flex items-center gap-1.5 text-sm text-brand font-medium cursor-pointer hover:text-brand-dark"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>

          {faqItems.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <HelpCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma pergunta ainda.</p>
              <p className="text-xs text-gray-300 mt-1">Adicione Q&A frequentes para o Koke responder com precisão.</p>
            </div>
          )}

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pergunta {i + 1}</span>
                  <button onClick={() => setFaqItems(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  value={item.question}
                  onChange={e => setFaqItems(prev => prev.map((it, idx) => idx === i ? { ...it, question: e.target.value } : it))}
                  placeholder="Ex: O ambiente precisa estar vazio?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand"
                />
                <textarea
                  value={item.answer}
                  onChange={e => setFaqItems(prev => prev.map((it, idx) => idx === i ? { ...it, answer: e.target.value } : it))}
                  placeholder="Ex: Não é necessário esvaziar completamente, mas móveis devem ser afastados das paredes..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
                />
              </div>
            ))}
          </div>

          {faqItems.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!config) return
                  const faqDocs = faqItems
                    .filter(f => f.question.trim() && f.answer.trim())
                    .map((f, i) => ({ name: `FAQ: ${f.question}`, url: `faq://${i}`, _content: f.answer }))
                  const nonFaq = config.rag_documents.filter(d => !d.url.startsWith('faq://'))
                  setConfig({ ...config, rag_documents: [...nonFaq, ...faqDocs] })
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-dark"
              >
                <Save className="w-4 h-4" /> Salvar FAQ no RAG
              </button>
            </div>
          )}

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-xs text-gray-600"><strong>Dica:</strong> O Koke usa estes FAQs para responder perguntas sobre: ambiente ocupado, cobertura de chuva, atrasos, revisitas, garantia de serviço, materiais, prazos, forma de pagamento, etc.</p>
          </div>
        </div>
      )}

      {/* Jornada tab */}
      {activeTab === 'jornada' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Reflete em novas conversas</strong> — mudanças na Jornada afetam apenas sessões iniciadas após salvar.
              {conversationMode === 'ai_autonomous' && (
                <span className="ml-1 text-violet-700 font-semibold">· Modo IA autônoma ativo: esta sequência está sendo ignorada.</span>
              )}
            </span>
          </div>
          <JourneyBuilderTab />
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
