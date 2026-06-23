import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { motion } from 'motion/react'
import {
  Pencil, CheckCircle, Loader2, MapPin, FileText, Upload,
  ShieldCheck, ShieldAlert, ShieldX, Clock, AlertCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePainterContext } from './PainterLayout'
import { useAuth } from '../../lib/auth'
import { cn, formatDate } from '../../lib/utils'
import type { Neighborhood } from '../../lib/types'

const PainterAreaMap = lazy(() =>
  import('../../components/PainterAreaMap').then(m => ({ default: m.PainterAreaMap }))
)

const SPECIALTY_OPTIONS = [
  'Residencial', 'Comercial', 'Fachada', 'Pós-obra', 'Artístico',
  'Mural', 'Textura', 'Grafiato', 'Stencil', 'Epóxi',
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
    .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
    .replace(/(\d{3})(\d{1,3})/, '$1.$2')
}

function formatTs(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function uploadKycFile(file: File, painterId: string, type: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `kyc/${painterId}/${type}.${ext}`
  const { error } = await supabase.storage.from('pintae-media').upload(path, file, { upsert: true })
  if (error) { console.error('KYC upload error:', error); return null }
  const { data } = supabase.storage.from('pintae-media').getPublicUrl(path)
  return data.publicUrl
}

const KYC_STATUS_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
  not_started: { label: 'Não iniciado', icon: ShieldAlert, color: 'text-gray-400' },
  pending:      { label: 'Em análise', icon: Clock, color: 'text-yellow-500' },
  approved:     { label: 'Aprovado', icon: ShieldCheck, color: 'text-green-600' },
  rejected:     { label: 'Rejeitado', icon: ShieldX, color: 'text-red-500' },
}

export function PainterPerfil() {
  const { painter, loading, reload, saveAvailability } = usePainterContext()
  const { user, updateProfile } = useAuth()

  // Profile fields
  const [bio, setBio] = useState(painter?.bio || '')
  const [years, setYears] = useState(String(painter?.years_experience || 0))
  const [specialties, setSpecialties] = useState<string[]>(painter?.specialties || [])
  const [availability, setAvailability] = useState(painter?.availability_status || 'available')
  const [basePrice, setBasePrice] = useState(String(painter?.base_price_m2 || ''))
  const [radiusKm, setRadiusKm] = useState(String(painter?.service_radius_km ?? 10))
  const [cpf, setCpf] = useState(user?.cpf || '')
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(painter?.neighborhoods_ids || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])

  // Compliance
  const [termsAccepted, setTermsAccepted] = useState(!!painter?.terms_accepted_at)
  const [privacyAccepted, setPrivacyAccepted] = useState(!!painter?.privacy_accepted_at)
  const [lgpdAccepted, setLgpdAccepted] = useState(!!painter?.lgpd_accepted_at)
  const [savingCompliance, setSavingCompliance] = useState(false)

  // Notification channels
  const [notifyEmail, setNotifyEmail] = useState(painter?.notify_by_email ?? true)
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(painter?.notify_by_whatsapp ?? false)
  const [savingNotif, setSavingNotif] = useState(false)

  // KYC
  const [kycUploading, setKycUploading] = useState<Record<string, boolean>>({})
  const [kycUrls, setKycUrls] = useState({
    profile_photo_url: painter?.profile_photo_url || '',
    document_photo_url: painter?.document_photo_url || '',
    selfie_with_doc_url: painter?.selfie_with_doc_url || '',
  })
  const profilePhotoRef = useRef<HTMLInputElement>(null)
  const docPhotoRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('neighborhoods').select('id,name,city,region,latitude,longitude,active,launch_priority')
      .eq('active', true).in('region', ['Sul da Ilha']).order('name')
      .then(({ data }) => setNeighborhoods((data as Neighborhood[]) ?? []))
  }, [])

  // Sync state when painter loads
  if (painter) {
    if (bio === '' && painter.bio) setBio(painter.bio)
    if (!termsAccepted && painter.terms_accepted_at) setTermsAccepted(true)
    if (!privacyAccepted && painter.privacy_accepted_at) setPrivacyAccepted(true)
    if (!lgpdAccepted && painter.lgpd_accepted_at) setLgpdAccepted(true)
    if (!kycUrls.profile_photo_url && painter.profile_photo_url) {
      setKycUrls(prev => ({ ...prev, profile_photo_url: painter.profile_photo_url! }))
    }
  }

  function toggleSpecialty(s: string) {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!painter) return
    setSaving(true)
    await supabase.from('painters').update({
      bio,
      years_experience: parseInt(years) || 0,
      specialties,
      neighborhoods_ids: selectedNeighborhoods,
      availability_status: availability,
      base_price_m2: parseFloat(basePrice) || null,
      service_radius_km: parseFloat(radiusKm) || 10,
    }).eq('id', painter.id)
    const cleanCpf = cpf.replace(/\D/g, '')
    if (cleanCpf.length === 11 && cpf !== (user?.cpf || '')) {
      await updateProfile({ cpf })
    }
    if (availability !== painter.availability_status) {
      await saveAvailability(availability as 'available' | 'busy' | 'paused')
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); reload() }, 1500)
  }

  async function saveNotifChannels(email: boolean, whatsapp: boolean) {
    if (!painter) return
    setSavingNotif(true)
    await supabase.from('painters').update({ notify_by_email: email, notify_by_whatsapp: whatsapp }).eq('id', painter.id)
    setSavingNotif(false)
  }

  async function saveCompliance(field: 'terms_accepted_at' | 'privacy_accepted_at' | 'lgpd_accepted_at', accept: boolean) {
    if (!painter) return
    setSavingCompliance(true)
    await supabase.from('painters').update({
      [field]: accept ? new Date().toISOString() : null,
    }).eq('id', painter.id)
    setSavingCompliance(false)
    reload()
  }

  async function handleKycUpload(file: File, type: 'profile_photo' | 'document_photo' | 'selfie_with_doc') {
    if (!painter) return
    setKycUploading(prev => ({ ...prev, [type]: true }))
    const url = await uploadKycFile(file, painter.id, type)
    if (url) {
      const field = `${type}_url` as keyof typeof kycUrls
      setKycUrls(prev => ({ ...prev, [field]: url }))
      await supabase.from('painters').update({
        [`${type}_url`]: url,
        kyc_status: painter.kyc_status === 'not_started' ? 'pending' : painter.kyc_status,
      }).eq('id', painter.id)
      reload()
    }
    setKycUploading(prev => ({ ...prev, [type]: false }))
  }

  if (loading || !painter) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const kycConfig = KYC_STATUS_CONFIG[painter.kyc_status] ?? KYC_STATUS_CONFIG.not_started
  const KycIcon = kycConfig.icon

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-0.5">Mantenha seus dados atualizados para atrair mais clientes.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <form onSubmit={save} className="space-y-4">

          {/* Availability */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Disponibilidade</label>
            <div className="flex gap-2">
              {(['available', 'busy', 'paused'] as const).map(s => (
                <button key={s} type="button" onClick={() => setAvailability(s)}
                  className={cn('flex-1 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer',
                    availability === s
                      ? s === 'available' ? 'bg-green-50 text-green-700 border-green-200'
                        : s === 'busy' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200')}>
                  {s === 'available' ? 'Disponível' : s === 'busy' ? 'Ocupado' : 'Pausado'}
                </button>
              ))}
            </div>
          </div>

          {/* Bio + experience + CPF */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none"
                placeholder="Conte sobre seu trabalho e experiência..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Anos de experiência</label>
                <input type="number" value={years} onChange={e => setYears(e.target.value)} min="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Preço base (R$/m²)</label>
                <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" placeholder="25" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> CPF <span className="text-gray-400 font-normal">(para emissão de nota e PIX)</span>
              </label>
              <input type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                    specialties.includes(s)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-brand hover:text-brand')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Area map + neighborhoods */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand" />
              <p className="text-xs font-medium text-gray-700">Área de atendimento — Sul da Ilha</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Bairros de atuação</label>
              <div className="flex flex-wrap gap-1.5">
                {neighborhoods.map(n => {
                  const active = selectedNeighborhoods.includes(n.id)
                  return (
                    <button key={n.id} type="button"
                      onClick={() => setSelectedNeighborhoods(prev => active ? prev.filter(x => x !== n.id) : [...prev, n.id])}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${active ? 'border-brand bg-orange-50 text-brand font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {n.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Raio de atendimento (km)</label>
              <input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)}
                min="1" max="50" step="1"
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand" />
            </div>
            {selectedNeighborhoods.length > 0 ? (
              <Suspense fallback={<div className="h-[280px] bg-gray-100 rounded-xl animate-pulse" />}>
                <PainterAreaMap
                  neighborhoods={neighborhoods}
                  painterNeighborhoodIds={selectedNeighborhoods}
                  radiusKm={parseFloat(radiusKm) || 10}
                />
              </Suspense>
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                Selecione ao menos um bairro para visualizar o mapa.
              </p>
            )}
          </div>

          {/* Save button */}
          <motion.button type="submit" disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-brand text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {saved ? 'Salvo!' : 'Salvar perfil'}
          </motion.button>
        </form>

        {/* ─── Compliance ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Termos e Conformidade</p>
            {savingCompliance && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>

          {[
            {
              key: 'terms_accepted_at' as const,
              label: 'Termos de Uso',
              desc: 'Aceito os Termos de Uso da plataforma Pintai Floripa.',
              state: termsAccepted,
              set: setTermsAccepted,
              acceptedAt: painter.terms_accepted_at,
            },
            {
              key: 'privacy_accepted_at' as const,
              label: 'Política de Privacidade',
              desc: 'Li e aceito a Política de Privacidade da Pintai Floripa.',
              state: privacyAccepted,
              set: setPrivacyAccepted,
              acceptedAt: painter.privacy_accepted_at,
            },
            {
              key: 'lgpd_accepted_at' as const,
              label: 'LGPD — Consentimento de Dados',
              desc: 'Consinto com o tratamento dos meus dados pessoais para fins de intermediação de serviços, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
              state: lgpdAccepted,
              set: setLgpdAccepted,
              acceptedAt: painter.lgpd_accepted_at,
            },
          ].map(item => (
            <div key={item.key} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
              <input
                type="checkbox"
                id={item.key}
                checked={item.state}
                disabled={savingCompliance || !!item.acceptedAt}
                onChange={async e => {
                  item.set(e.target.checked)
                  await saveCompliance(item.key, e.target.checked)
                }}
                className="mt-0.5 w-4 h-4 accent-brand cursor-pointer disabled:cursor-default"
              />
              <label htmlFor={item.key} className={cn('flex-1 cursor-pointer', item.acceptedAt && 'cursor-default')}>
                <span className="text-sm font-medium text-gray-800 block">{item.label}</span>
                <span className="text-xs text-gray-500 block mt-0.5">{item.desc}</span>
                {item.acceptedAt && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3" /> Aceito em {formatTs(item.acceptedAt)}
                  </span>
                )}
              </label>
            </div>
          ))}
        </div>

        {/* ─── Canais de Notificação ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Canais de Notificação</p>
            {savingNotif && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          <p className="text-xs text-gray-500">Como você quer receber avisos de novas solicitações de pintura.</p>

          {[
            {
              key: 'email' as const,
              label: 'E-mail',
              hint: 'Receba detalhes da solicitação e link para responder.',
              checked: notifyEmail,
              disabled: false,
            },
            {
              key: 'whatsapp' as const,
              label: 'WhatsApp',
              hint: 'Em breve — integração com WhatsApp Business em desenvolvimento.',
              checked: notifyWhatsapp,
              disabled: true,
            },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className={cn('text-sm font-medium', item.disabled ? 'text-gray-400' : 'text-gray-800')}>{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.hint}</p>
              </div>
              <button
                type="button"
                disabled={item.disabled || savingNotif}
                onClick={async () => {
                  if (item.key === 'email') {
                    const next = !notifyEmail
                    setNotifyEmail(next)
                    await saveNotifChannels(next, notifyWhatsapp)
                  } else {
                    const next = !notifyWhatsapp
                    setNotifyWhatsapp(next)
                    await saveNotifChannels(notifyEmail, next)
                  }
                }}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed',
                  item.disabled ? 'bg-gray-200 opacity-50' :
                    (item.key === 'email' ? notifyEmail : notifyWhatsapp) ? 'bg-brand' : 'bg-gray-200'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  (item.key === 'email' ? notifyEmail : notifyWhatsapp) && !item.disabled ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          ))}
        </div>

        {/* ─── KYC ─────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Verificação de Identidade (KYC)</p>
              <p className="text-xs text-gray-500 mt-0.5">Necessário para receber pagamentos e exibir o selo verificado.</p>
            </div>
            <div className={cn('flex items-center gap-1.5 text-xs font-medium', kycConfig.color)}>
              <KycIcon className="w-4 h-4" />
              {kycConfig.label}
            </div>
          </div>

          {painter.kyc_status === 'rejected' && painter.kyc_rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{painter.kyc_rejection_reason}</p>
            </div>
          )}

          {painter.kyc_status === 'approved' ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">Identidade verificada</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {painter.kyc_reviewed_at ? `Aprovado em ${formatDate(painter.kyc_reviewed_at)}` : 'Verificação aprovada'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  key: 'profile_photo' as const,
                  label: 'Foto de perfil',
                  hint: 'Foto clara do seu rosto, em boa iluminação.',
                  ref: profilePhotoRef,
                  url: kycUrls.profile_photo_url,
                },
                {
                  key: 'document_photo' as const,
                  label: 'Documento de identidade',
                  hint: 'RG, CNH ou passaporte — frente legível.',
                  ref: docPhotoRef,
                  url: kycUrls.document_photo_url,
                },
                {
                  key: 'selfie_with_doc' as const,
                  label: 'Selfie com o documento',
                  hint: 'Segure o documento ao lado do rosto na mesma foto.',
                  ref: selfieRef,
                  url: kycUrls.selfie_with_doc_url,
                },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  {item.url ? (
                    <img src={item.url} alt={item.label}
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.hint}</p>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      ref={item.ref}
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (file) await handleKycUpload(file, item.key)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => item.ref.current?.click()}
                      disabled={!!kycUploading[item.key]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-brand rounded-lg hover:bg-orange-50 transition-colors cursor-pointer disabled:opacity-60">
                      {kycUploading[item.key]
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Upload className="w-3 h-3" />}
                      {item.url ? 'Trocar' : 'Enviar'}
                    </button>
                  </div>
                </div>
              ))}

              {(kycUrls.profile_photo_url || kycUrls.document_photo_url || kycUrls.selfie_with_doc_url) && painter.kyc_status !== 'pending' && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-xl p-3 flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Seus documentos foram enviados e estão aguardando análise pela nossa equipe. Isso pode levar até 2 dias úteis.
                </p>
              )}

              {painter.kyc_status === 'pending' && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-xl p-3 flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Documentos em análise. Você será notificado quando a verificação for concluída.
                </p>
              )}
            </div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
