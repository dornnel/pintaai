import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Save, Loader2, CheckCircle, Settings, Key, Bell, Store, MessageCircle, MapPin, Mail, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { useAuth } from '../../lib/auth'
import { invalidatePlatformSettingsCache } from '../../lib/usePlatformSettings'


const SETTING_DEFS = [
  { key: 'whatsapp_number', label: 'WhatsApp da plataforma', description: 'Número para contato (sem +)', type: 'text', group: 'Contato' },
  { key: 'admin_email', label: 'E-mail do admin', description: 'Recebe notificações do sistema', type: 'email', group: 'Contato' },
  { key: 'email_from_name', label: 'Nome do remetente', description: 'Nome exibido nos emails enviados (ex: Pintai Floripa)', type: 'text', group: 'Email' },
  { key: 'email_from_address', label: 'Email do remetente', description: 'Endereço do remetente (deve ser validado no Brevo)', type: 'email', group: 'Email' },
  { key: 'email_reply_to', label: 'Responder para', description: 'Email que receberá respostas dos clientes', type: 'email', group: 'Email' },
  { key: 'admin_notification_emails', label: 'Admins que recebem cópia', description: 'Emails separados por vírgula — recebem cópia interna de cada nova solicitação', type: 'text', group: 'Email' },
  { key: 'platform_fee_rate', label: 'Taxa da plataforma (%)', description: 'Percentual retido em cada serviço', type: 'number', group: 'Financeiro' },
  { key: 'minimum_job_price', label: 'Preço mínimo por job (R$)', description: 'Valor mínimo aceito para um serviço', type: 'number', group: 'Financeiro' },
  { key: 'registration_open', label: 'Registro aberto', description: 'Permitir novos cadastros na plataforma', type: 'boolean', group: 'Funcionalidades' },
  { key: 'marketplace_active', label: 'Marketplace ativo', description: 'Exibir e aceitar pedidos no marketplace', type: 'boolean', group: 'Funcionalidades' },
  { key: 'chat_public', label: 'Chat público ativo', description: 'Permitir que visitantes usem o chat sem login', type: 'boolean', group: 'Funcionalidades' },
  { key: 'budget_engine_enabled', label: 'Motor de orçamento IA', description: 'Ativar estimativas automáticas de preço', type: 'boolean', group: 'Funcionalidades' },
  { key: 'auto_assign_painters_geo', label: 'Distribuição automática por geolocalização', description: 'Novos leads são enviados automaticamente aos pintores próximos ao bairro do cliente', type: 'boolean', group: 'Distribuição de Leads' },
  { key: 'auto_assign_radius_km_default', label: 'Raio padrão (km)', description: 'Raio de busca quando o pintor não define um valor próprio', type: 'number', group: 'Distribuição de Leads' },
  { key: 'max_painters_per_lead', label: 'Max pintores por lead', description: 'Número máximo de pintores selecionados para cada lead (round-robin)', type: 'number', group: 'Distribuição de Leads' },
  { key: 'max_proposals_per_lead', label: 'Max propostas por lead', description: 'Número máximo de propostas que um lead pode receber antes de fechar', type: 'number', group: 'Distribuição de Leads' },
  { key: 'pro_early_access_hours', label: 'Acesso antecipado Pro (horas)', description: 'Horas de vantagem para pintores Pro antes de notificar pintores Free (0 = desativado)', type: 'number', group: 'Distribuição de Leads' },
  { key: 'distribution_mode', label: 'Modo de distribuição', description: 'simultaneous = envia a todos; cascade = um por vez com timeout', type: 'text', group: 'Distribuição de Leads' },
  { key: 'painter_response_window_hours', label: 'Janela de resposta (horas)', description: 'Tempo para o pintor responder antes de passar para o próximo (modo cascade)', type: 'number', group: 'Distribuição de Leads' },
  { key: 'admin_copy_proposals_email', label: 'Copiar admin nos emails de proposta', description: 'Enviar cópia das notificações de proposta para os admins', type: 'boolean', group: 'Distribuição de Leads' },
]

const GROUPS = ['Contato', 'Email', 'Financeiro', 'Funcionalidades', 'Distribuição de Leads']

export function SettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_settings').select('key, value')
    const map: Record<string, unknown> = {}
    for (const row of data || []) map[row.key] = row.value
    setSettings(map)
    setLoading(false)
  }

  async function saveToggle(key: string, newValue: boolean) {
    setTogglingKey(key)
    const old = getValue(key)
    setSettings(prev => ({ ...prev, [key]: newValue }))
    await supabase.from('platform_settings').upsert(
      { key, value: newValue, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    invalidatePlatformSettingsCache()
    if (user) {
      await logAudit({
        actor_user_id: user.id,
        entity_type: 'settings',
        entity_id: user.id,
        action: 'settings_updated',
        old_values: { [key]: old },
        new_values: { [key]: newValue },
      })
    }
    setTogglingKey(null)
  }

  async function saveAll() {
    setSaving(true)
    const old: Record<string, unknown> = {}
    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(settings)) {
      const def = SETTING_DEFS.find(d => d.key === key)
      if (def?.type === 'boolean') continue  // toggles save instantly
      old[key] = settings[key]
      next[key] = value
      await supabase.from('platform_settings').upsert(
        { key, value: typeof value === 'string' ? JSON.stringify(value) : value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    }
    invalidatePlatformSettingsCache()
    if (user) {
      await logAudit({
        actor_user_id: user.id,
        entity_type: 'settings',
        entity_id: user.id,
        action: 'settings_updated',
        old_values: old,
        new_values: next,
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateSetting(key: string, value: unknown) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function getValue(key: string): unknown {
    const v = settings[key]
    if (typeof v === 'string' && (v.startsWith('"') || v === 'true' || v === 'false')) {
      try { return JSON.parse(v) } catch { return v }
    }
    return v
  }

  async function sendTestEmailFn() {
    if (!testEmail) return
    setSendingTest(true)
    setTestResult(null)
    try {
      const { data: resp, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to: testEmail,
          name: 'Teste',
          protocol: 'PT-TESTE-0000',
          neighborhood: 'Centro',
          service_type: 'Pintura interna (teste)',
          summary: 'Nome: Teste\nEmail: ' + testEmail + '\nServiço: Pintura interna\nBairro: Centro\n\nEste é um email de teste enviado pelo painel admin.',
        },
      })
      if (error) {
        setTestResult({ ok: false, msg: `Erro: ${JSON.stringify(error)}` })
      } else {
        setTestResult({ ok: true, msg: `Email enviado! Status: ${resp?.client || 'ok'}` })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: `Erro: ${String(err)}` })
    }
    setSendingTest(false)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações da Plataforma</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajuste parâmetros operacionais da plataforma</p>
        </div>
        <motion.button onClick={saveAll} disabled={saving}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar'}
        </motion.button>
      </div>

      <div className="space-y-6">
        {GROUPS.map(group => {
          const defs = SETTING_DEFS.filter(d => d.group === group)
          return (
            <div key={group} className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                {group === 'Contato' && <MessageCircle className="w-4 h-4 text-blue-500" />}
                {group === 'Email' && <Mail className="w-4 h-4 text-indigo-500" />}
                {group === 'Financeiro' && <Store className="w-4 h-4 text-green-500" />}
                {group === 'Funcionalidades' && <Settings className="w-4 h-4 text-brand" />}
                {group === 'Distribuição de Leads' && <MapPin className="w-4 h-4 text-purple-500" />}
                {group}
              </h2>
              <div className="space-y-4">
                {defs.map(def => {
                  const currentValue = getValue(def.key)
                  return (
                    <div key={def.key} className={def.type === 'boolean' ? 'flex items-center justify-between' : ''}>
                      {def.type === 'boolean' ? (
                        <>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{def.label}</p>
                            {def.description && <p className="text-xs text-gray-400 mt-0.5">{def.description}</p>}
                          </div>
                          <button
                            onClick={() => saveToggle(def.key, !currentValue)}
                            disabled={togglingKey === def.key}
                            className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative disabled:opacity-60 ${currentValue ? 'bg-brand' : 'bg-gray-200'}`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${currentValue ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                          </button>
                        </>
                      ) : (
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                            {def.label}
                            {def.description && <span className="ml-1 text-gray-400 font-normal">— {def.description}</span>}
                          </label>
                          <input
                            type={def.type}
                            value={String(currentValue ?? '')}
                            onChange={e => updateSetting(def.key, def.type === 'number' ? Number(e.target.value) : e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
                            step={def.type === 'number' ? '0.01' : undefined}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Envio de email de teste */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-500" /> Enviar Email de Teste
          </h2>
          <p className="text-xs text-gray-500 mb-3">Envie um email de teste para verificar se as configurações do provedor de email estão corretas.</p>
          <div className="flex gap-2">
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            <button onClick={sendTestEmailFn} disabled={sendingTest || !testEmail}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors">
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar teste
            </button>
          </div>
          {testResult && (
            <div className={`mt-3 px-3 py-2 rounded-xl text-xs ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.msg}
            </div>
          )}
        </div>

        {/* Seção de APIs (read-only) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" /> Integrações e APIs
          </h2>
          <div className="space-y-3">
            {[
              { name: 'OpenAI (GPT-4o)', key: 'OPENAI_API_KEY', status: 'Configurado via Supabase Secrets' },
              { name: 'Brevo (Email SMTP)', key: 'BREVO_API_KEY', status: 'Configurado via Supabase Secrets' },
              { name: 'Asaas Payments', key: 'ASAAS_API_KEY', status: 'Configurado via Supabase Secrets' },
              { name: 'Resend (Fallback)', key: 'RESEND_API_KEY', status: 'Configurado via Supabase Secrets' },
            ].map(integration => (
              <div key={integration.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{integration.name}</p>
                  <p className="text-xs text-gray-400">{integration.key}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {integration.status}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Para atualizar chaves de API, use o painel do Supabase → Edge Functions → Secrets.
          </p>
        </div>

        {/* Notificações */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" /> Notificações automáticas
          </h2>
          <div className="space-y-2 text-xs text-gray-500">
            <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Novo lead recebido → email ao admin</p>
            <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Pedido confirmado → email ao cliente + pintor</p>
            <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Pagamento recebido → email ao admin e pintor</p>
            <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" /> Novo pintor cadastrado → email ao admin (pendente de revisão)</p>
            <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" /> Flag de moderação HIGH → email ao admin</p>
            <p className="text-[10px] text-gray-400 mt-2">
              Todas as notificações usam o e-mail do admin configurado acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
