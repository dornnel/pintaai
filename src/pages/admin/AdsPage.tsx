import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'

interface AdSlot { id: string; name: string; placement: string; price_monthly: number; max_ads: number; active: boolean }
interface PartnerAd {
  id: string; title: string; description?: string; image_url?: string; click_url?: string
  impressions: number; clicks: number; status: string; valid_from?: string; valid_until?: string
  partner?: { trade_name: string }; slot?: { name: string; placement: string }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
}

export function AdsPage() {
  const [ads, setAds] = useState<PartnerAd[]>([])
  const [slots, setSlots] = useState<AdSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const [adsRes, slotsRes] = await Promise.all([
      supabase.from('partner_ads').select('*, partner:partners(trade_name), slot:partner_ad_slots(name, placement)').order('created_at', { ascending: false }),
      supabase.from('partner_ad_slots').select('*').order('price_monthly', { ascending: false }),
    ])
    setAds((adsRes.data || []) as unknown as PartnerAd[])
    setSlots((slotsRes.data || []) as AdSlot[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('partner_ads').update({
      status,
      ...(status === 'approved' ? { approved_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    setAds(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0)
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0)
  const pendingCount = ads.filter(a => a.status === 'pending').length

  const filtered = ads.filter(a => filterStatus === 'all' || a.status === filterStatus)

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Anúncios de Parceiros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ads.length} anúncio{ads.length !== 1 ? 's' : ''}
            {pendingCount > 0 && <span className="ml-2 text-yellow-600 font-medium">· {pendingCount} aguardando aprovação</span>}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{totalImpressions.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Impressões totais</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Cliques totais</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0'}%
          </p>
          <p className="text-xs text-gray-500 mt-0.5">CTR médio</p>
        </div>
      </div>

      {/* Slots disponíveis */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Slots de anúncio</h3>
        <div className="space-y-2">
          {slots.map(slot => (
            <div key={slot.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm text-gray-800">{slot.name}</p>
                <p className="text-xs text-gray-400">Posição: {slot.placement} · Max: {slot.max_ads} anúncio{slot.max_ads !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-sm font-semibold text-brand">{formatCurrency(slot.price_monthly)}/mês</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'pending', 'approved', 'active', 'paused', 'expired'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${filterStatus === s ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendente' : s === 'approved' ? 'Aprovado' : s === 'active' ? 'Ativo' : s === 'paused' ? 'Pausado' : 'Expirado'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum anúncio encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ad => (
            <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{ad.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ad.status] || 'bg-gray-100 text-gray-600'}`}>
                      {ad.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {ad.partner && <span>🏪 {ad.partner.trade_name}</span>}
                    {ad.slot && <span>📍 {ad.slot.name}</span>}
                    <span>👁️ {ad.impressions} impressões · 🖱️ {ad.clicks} cliques</span>
                    {ad.valid_until && <span>Até {formatDate(ad.valid_until)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ad.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(ad.id, 'approved')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => updateStatus(ad.id, 'paused')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {ad.status === 'approved' && (
                    <button onClick={() => updateStatus(ad.id, 'active')}
                      className="text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg hover:bg-green-100 cursor-pointer transition-colors">
                      Ativar
                    </button>
                  )}
                  {ad.status === 'active' && (
                    <button onClick={() => updateStatus(ad.id, 'paused')}
                      className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
                      Pausar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
