import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Link } from 'react-router-dom'
import { Star, Plus, CheckCircle, XCircle, Loader2, Edit3, X, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

interface Painter {
  id: string
  user_id: string
  bio: string
  years_experience: number
  specialties: string[]
  availability_status: string
  verification_status: string
  kyc_status: string
  pro_plan_status: string
  registration_source?: string
  service_radius_km?: number
  last_seen_at?: string | null
  user: { id: string; name: string; phone: string; email: string; status: string; auth_user_id?: string | null }
  score?: { overall_score: number; completed_jobs_count: number }
}

const KYC_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  submitted: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const SPECIALTIES_OPTIONS = ['Pintura interna', 'Fachada', 'Textura / massa corrida', 'Impermeabilização', 'Arte / Mural', 'Pós-obra']

function PainterModal({ painter, onClose, onSaved }: {
  painter?: Partial<Painter>
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!painter?.id
  const [form, setForm] = useState({
    name: painter?.user?.name || '',
    phone: painter?.user?.phone || '',
    email: painter?.user?.email || '',
    cpf: '',
    bio: painter?.bio || '',
    years_experience: painter?.years_experience || 1,
    specialties: painter?.specialties || [] as string[],
    availability_status: painter?.availability_status || 'available',
    verification_status: painter?.verification_status || 'unverified',
    kyc_status: painter?.kyc_status || 'not_started',
    service_radius_km: painter?.service_radius_km ?? 10,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function formatCpf(value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
      .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
      .replace(/(\d{3})(\d{1,3})/, '$1.$2')
  }

  function toggleSpecialty(s: string) {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s],
    }))
  }

  async function save() {
    if (!form.name || !form.phone) { setError('Nome e telefone são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit && painter?.id) {
        const userId = (painter as unknown as { user_id: string }).user_id
        const cpfUpdate = form.cpf ? { cpf: form.cpf } : {}
        await supabase.from('users').update({ name: form.name, phone: form.phone, email: form.email, ...cpfUpdate }).eq('id', userId)
        await supabase.from('painters').update({
          bio: form.bio, years_experience: form.years_experience, specialties: form.specialties,
          availability_status: form.availability_status, verification_status: form.verification_status, kyc_status: form.kyc_status,
          service_radius_km: form.service_radius_km,
        }).eq('id', painter.id)
      } else {
        // Check if a user with this email already exists (prevent duplicates)
        let userId: string | null = null
        if (form.email) {
          const { data: existing } = await supabase.from('users').select('id, role, roles')
            .eq('email', form.email).limit(1).maybeSingle()
          if (existing) {
            // Link to existing user — upgrade role to painter if needed
            const newRoles = Array.from(new Set([...(existing.roles ?? [existing.role]), 'painter']))
            const cpfUpdate = form.cpf ? { cpf: form.cpf } : {}
            await supabase.from('users').update({ role: 'painter', roles: newRoles, name: form.name, phone: form.phone, ...cpfUpdate }).eq('id', existing.id)
            userId = existing.id
          }
        }
        if (!userId) {
          const cpfInsert = form.cpf ? { cpf: form.cpf } : {}
          const { data: newUser, error: userErr } = await supabase.from('users').insert({
            role: 'painter', roles: ['painter'],
            name: form.name,
            phone: form.phone.replace(/\D/g, '') ? `+55${form.phone.replace(/\D/g, '')}` : form.phone,
            email: form.email || null, status: 'active', registration_source: 'admin',
            ...cpfInsert,
          }).select('id').single()
          if (userErr) { setError(userErr.message); setSaving(false); return }
          userId = newUser!.id
        }
        await supabase.from('painters').insert({
          user_id: userId, bio: form.bio, years_experience: form.years_experience,
          specialties: form.specialties, availability_status: form.availability_status,
          verification_status: form.verification_status, kyc_status: form.kyc_status,
          service_radius_km: form.service_radius_km,
        })
      }
      onSaved()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">{isEdit ? 'Editar pintor' : 'Cadastrar pintor'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Celular (com DDD) *</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(48) 9 9999-9999"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">CPF</label>
              <input type="text" value={form.cpf} onChange={e => setForm({...form, cpf: formatCpf(e.target.value)})} placeholder="000.000.000-00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Anos de experiência</label>
              <input type="number" min={0} max={50} value={form.years_experience} onChange={e => setForm({...form, years_experience: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Raio de atendimento (km)</label>
              <input type="number" min={1} max={100} value={form.service_radius_km} onChange={e => setForm({...form, service_radius_km: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Disponibilidade</label>
              <select value={form.availability_status} onChange={e => setForm({...form, availability_status: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                <option value="available">Disponível</option>
                <option value="busy">Ocupado</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={cn('text-xs px-3 py-1.5 rounded border transition-colors cursor-pointer',
                    form.specialties.includes(s) ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bio / Apresentação</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={3} placeholder="Descreva a experiência e diferenciais do pintor..."
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Status de verificação</label>
              <select value={form.verification_status} onChange={e => setForm({...form, verification_status: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                <option value="unverified">Não verificado</option>
                <option value="pending">Pendente</option>
                <option value="verified">Verificado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Status KYC</label>
              <select value={form.kyc_status} onChange={e => setForm({...form, kyc_status: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand bg-white">
                <option value="not_started">Não iniciado</option>
                <option value="submitted">Enviado</option>
                <option value="under_review">Em análise</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Cadastrar pintor'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function PaintersPage() {
  const [painters, setPainters] = useState<Painter[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; painter?: Partial<Painter> }>({ open: false })
  const [kycAction, setKycAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Painter | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('painters')
      .select('*, user:users!painters_user_id_fkey(id,name,phone,email,status,auth_user_id), score:painter_scores(*)')
      .order('created_at', { ascending: false })
    setPainters((data as unknown as Painter[]) || [])
    setLoading(false)
  }

  async function deletePainter() {
    if (!deleteTarget) return
    setDeleting(true)
    // Always delete the painter record
    await supabase.from('painters').delete().eq('id', deleteTarget.id)
    // If admin-created (no Supabase auth account), also delete the users record
    if (!deleteTarget.user?.auth_user_id) {
      await supabase.from('users').delete().eq('id', deleteTarget.user_id)
    }
    setDeleteTarget(null)
    setDeleting(false)
    setPainters(prev => prev.filter(p => p.id !== deleteTarget.id))
  }

  async function updateKYC(painterId: string, action: 'approve' | 'reject') {
    await supabase.from('painters').update({
      kyc_status: action === 'approve' ? 'approved' : 'rejected',
      verification_status: action === 'approve' ? 'verified' : 'unverified',
      kyc_reviewed_at: new Date().toISOString(),
    }).eq('id', painterId)
    setKycAction(null)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pintores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{painters.length} profissional{painters.length !== 1 ? 'is' : ''}</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded cursor-pointer hover:bg-brand-dark transition-colors">
          <Plus className="w-4 h-4" /> Cadastrar pintor
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded animate-pulse border border-gray-100" />)}</div>
      ) : painters.length === 0 ? (
        <div className="bg-white rounded border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum pintor cadastrado.</p>
          <button onClick={() => setModal({ open: true })} className="mt-3 text-brand font-medium text-sm cursor-pointer">+ Cadastrar o primeiro pintor</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {painters.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded border border-gray-100 p-4 flex items-center gap-4">
              <Link to={`/admin/painters/${p.id}`} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                <div className="w-10 h-10 rounded bg-orange-100 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                  {p.user?.name?.[0]?.toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.user?.name}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', KYC_COLORS[p.kyc_status] || 'bg-gray-100 text-gray-500')}>
                      KYC: {p.kyc_status === 'approved' ? 'Aprovado' : p.kyc_status === 'rejected' ? 'Rejeitado' : p.kyc_status === 'submitted' ? 'Pendente' : 'N/A'}
                    </span>
                    {p.pro_plan_status === 'active' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">PRO</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span>{p.user?.phone}</span>
                    {p.specialties?.slice(0,2).map(s => <span key={s} className="bg-gray-50 px-1.5 py-0.5 rounded">{s}</span>)}
                    <span className={p.availability_status === 'available' ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {p.availability_status === 'available' ? '● Disponível' : p.availability_status === 'busy' ? '● Ocupado' : '● Pausado'}
                    </span>
                    <span className={`text-[10px] ${p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 5 * 60 * 1000 ? 'text-green-500 font-semibold' : 'text-gray-300'}`}>
                      {p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 5 * 60 * 1000 ? '🟢 Online' : '⚪ Offline'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 mr-2">
                  {p.score ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-bold text-gray-900">{(p.score as unknown as { overall_score: number }).overall_score?.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-gray-400">{(p.score as unknown as { completed_jobs_count: number }).completed_jobs_count} jobs</p>
                    </>
                  ) : <p className="text-xs text-gray-400">Sem score</p>}
                </div>
              </Link>
              <div className="flex gap-1 shrink-0">
                {p.kyc_status === 'submitted' && (
                  <>
                    <button onClick={e => { e.preventDefault(); setKycAction({ id: p.id, action: 'approve' }) }}
                      className="w-7 h-7 flex items-center justify-center rounded bg-green-50 text-green-500 hover:bg-green-100 cursor-pointer transition-colors" title="Aprovar KYC">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={e => { e.preventDefault(); setKycAction({ id: p.id, action: 'reject' }) }}
                      className="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer transition-colors" title="Rejeitar KYC">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={e => { e.preventDefault(); setModal({ open: true, painter: p }) }}
                  className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.preventDefault(); setDeleteTarget(p) }}
                  className="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer transition-colors" title="Excluir pintor">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal.open && (
          <PainterModal
            painter={modal.painter}
            onClose={() => setModal({ open: false })}
            onSaved={() => { setModal({ open: false }); load() }}
          />
        )}
        {kycAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setKycAction(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 mb-2">
                {kycAction.action === 'approve' ? 'Aprovar KYC?' : 'Rejeitar KYC?'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {kycAction.action === 'approve'
                  ? 'O pintor será marcado como verificado e poderá receber leads.'
                  : 'O pintor será notificado para reenviar a documentação.'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setKycAction(null)} className="flex-1 py-2 border border-gray-200 rounded text-sm cursor-pointer">Cancelar</button>
                <button onClick={() => updateKYC(kycAction.id, kycAction.action)}
                  className={cn('flex-1 py-2 text-white rounded text-sm font-semibold cursor-pointer',
                    kycAction.action === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                  {kycAction.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !deleting && setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <h3 className="font-bold text-gray-900">Excluir pintor?</h3>
              </div>
              <p className="text-sm text-gray-500 mb-1">
                Tem certeza que deseja excluir <strong className="text-gray-800">{deleteTarget.user?.name}</strong>?
              </p>
              <p className="text-xs text-gray-400 mb-5">
                {deleteTarget.user?.auth_user_id
                  ? 'O registro de pintor será removido. A conta de usuário será mantida.'
                  : 'O pintor e seu usuário serão removidos permanentemente. Essa ação não pode ser desfeita.'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                  className="flex-1 py-2 border border-gray-200 rounded text-sm cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={deletePainter} disabled={deleting}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
