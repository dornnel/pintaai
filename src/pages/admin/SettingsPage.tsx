import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Save, Loader2, CheckCircle, Settings, Key, Bell, Store, MessageCircle, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'


const SETTING_DEFS = [
  { key: 'whatsapp_number', label: 'WhatsApp da plataforma', description: 'Número para contato (sem +)', type: 'text', group: 'Contato' },
  { key: 'admin_email', label: 'E-mail do admin', description: 'Recebe notificações do sistema', type: 'email', group: 'Contato' },
  { key: 'platform_fee_rate', label: 'Taxa da plataforma (%)', description: 'Percentual retido em cada serviço', type: 'number', group: 'Financeiro' },
  { key: 'minimum_job_price', label: 'Preço mínimo por job (R$)', description: 'Valor mínimo aceito para um serviço', type: 'number', group: 'Financeiro' },
  { key: 'registration_open', label: 'Registro aberto', description: 'Permitir novos cadastros na plataforma', type: 'boolean', group: 'Funcionalidades' },
  { key: 'marketplace_active', label: 'Marketplace ativo', description: 'Exibir e aceitar pedidos no marketplace', type: 'boolean', group: 'Funcionalidades' },
  { key: 'chat_public', label: 'Chat público ativo', description: 'Permitir que visitantes usem o chat sem login', type: 'boolean', group: 'Funcionalidades' },
  { key: 'budget_engine_enabled', label: 'Motor de orçamento IA', description: 'Ativar estimativas automáticas de preço', type: 'boolean', group: 'Funcionalidades' },
  { key: 'auto_assign_painters_geo', label: 'Distribuição automática por geolocalização', description: 'Novos leads são enviados automaticamente aos pintores próximos ao bairro do cliente', type: 'boolean', group: 'Distribuição de Leads' },
  { key: 'auto_assign_radius_km_default', label: 'Raio padrão (km)', description: 'Raio de busca quando o pintor não define um valor próprio', type: 'number', group: 'Distribuição de Leads' },
]

const GROUPS = ['Contato', 'Financeiro', 'Funcionalidades', 'Distribuição de Leads']

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('platform_settings').select('key, value')
    const map: Record<string, unknown> = {}
    for (const row of data || []) map[row.key] = row.value
    setSettings(map)
    setLoading(false)
  }

  async function saveAll() {
    setSaving(true)
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('platform_settings').upsert({
        key,
        value: typeof value === 'string' ? JSON.stringify(value) : value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
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
                            onClick={() => updateSetting(def.key, !currentValue)}
                            className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${currentValue ? 'bg-brand' : 'bg-gray-200'}`}
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

        {/* Seção de APIs (read-only) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" /> Integrações e APIs
          </h2>
          <div className="space-y-3">
            {[
              { name: 'OpenAI (GPT-4o)', key: 'OPENAI_API_KEY', status: 'Configurado via Supabase Secrets' },
              { name: 'Asaas Payments', key: 'ASAAS_API_KEY', status: 'Configurado via Supabase Secrets' },
              { name: 'Resend Email', key: 'RESEND_API_KEY', status: 'Configurado via Supabase Secrets' },
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
