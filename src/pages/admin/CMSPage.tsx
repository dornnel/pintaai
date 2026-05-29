import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Save, Loader2, CheckCircle, Eye, Image as ImageIcon, Type, List } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

interface CMSBlock {
  id: string
  block_key: string
  block_type: 'text' | 'image_pair' | 'image' | 'json_array'
  content: unknown
  label: string
  updated_at: string
}

interface ImagePairContent { before: string; after: string; label: string }

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  text: <Type className="w-4 h-4 text-blue-500" />,
  image_pair: <ImageIcon className="w-4 h-4 text-purple-500" />,
  image: <ImageIcon className="w-4 h-4 text-teal-500" />,
  json_array: <List className="w-4 h-4 text-orange-500" />,
}

export function CMSPage() {
  const [blocks, setBlocks] = useState<CMSBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => { loadBlocks() }, [])

  async function loadBlocks() {
    const { data } = await supabase.from('cms_blocks').select('*').order('label')
    setBlocks((data as CMSBlock[]) || [])
    setLoading(false)
  }

  function getContent(block: CMSBlock): unknown {
    return edits[block.block_key] !== undefined ? edits[block.block_key] : block.content
  }

  async function saveBlock(block: CMSBlock) {
    const content = getContent(block)
    setSaving(block.block_key)
    await supabase.from('cms_blocks').update({ content, updated_at: new Date().toISOString() }).eq('block_key', block.block_key)
    setBlocks(prev => prev.map(b => b.block_key === block.block_key ? { ...b, content, updated_at: new Date().toISOString() } : b))
    setSaved(prev => new Set([...prev, block.block_key]))
    setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(block.block_key); return s }), 2000)
    setSaving(null)
  }

  async function uploadImage(blockKey: string, field: 'before' | 'after' | 'src', file: File) {
    setUploading(`${blockKey}_${field}`)
    const path = `cms/${blockKey}_${field}_${Date.now()}.${file.name.split('.').pop()}`
    const { data } = await supabase.storage.from('pintae-media').upload(path, file, { upsert: true })
    if (data) {
      const { data: pubData } = supabase.storage.from('pintae-media').getPublicUrl(path)
      const url = pubData.publicUrl
      const block = blocks.find(b => b.block_key === blockKey)
      if (block?.block_type === 'image_pair') {
        const current = (getContent(block) as ImagePairContent) || {}
        setEdits(prev => ({ ...prev, [blockKey]: { ...current, [field]: url } }))
      } else {
        setEdits(prev => ({ ...prev, [blockKey]: url }))
      }
    }
    setUploading(null)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conteúdo da Landing Page</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edite textos e fotos sem precisar de deploy.</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:text-teal-600 cursor-pointer">
          <Eye className="w-4 h-4" /> Ver página
        </a>
      </div>

      <div className="space-y-4">
        {blocks.map(block => {
          const content = getContent(block)
          const isSaving = saving === block.block_key
          const isSaved = saved.has(block.block_key)

          return (
            <div key={block.block_key} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {BLOCK_ICONS[block.block_type]}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{block.label}</p>
                    <p className="text-xs text-gray-400">
                      {block.block_type === 'text' ? 'Texto' :
                       block.block_type === 'image_pair' ? 'Par de imagens' :
                       block.block_type === 'image' ? 'Imagem' : 'Lista JSON'} ·
                      Atualizado {formatDate(block.updated_at)}
                    </p>
                  </div>
                </div>
                <motion.button onClick={() => saveBlock(block)} disabled={isSaving}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#FF7A30] to-brand text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-60">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   isSaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaved ? 'Salvo!' : 'Salvar'}
                </motion.button>
              </div>

              {/* Text editor */}
              {block.block_type === 'text' && (
                <textarea
                  value={String(content || '').replace(/^"|"$/g, '')}
                  onChange={e => setEdits(prev => ({ ...prev, [block.block_key]: `"${e.target.value}"` }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none"
                />
              )}

              {/* Image pair editor */}
              {block.block_type === 'image_pair' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(['before', 'after'] as const).map(field => {
                    const url = (content as ImagePairContent)?.[field]
                    return (
                      <div key={field}>
                        <p className="text-xs font-medium text-gray-600 mb-1 capitalize">{field === 'before' ? 'Antes' : 'Depois'}</p>
                        {url && <img src={url} alt={field} className="w-full h-28 object-cover rounded-xl border border-gray-100 mb-2" />}
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand hover:bg-orange-50 transition-colors text-xs text-gray-500">
                          {uploading === `${block.block_key}_${field}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          {url ? 'Trocar imagem' : 'Fazer upload'}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(block.block_key, field, f) }} />
                        </label>
                      </div>
                    )
                  })}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Label</p>
                    <input
                      value={(content as ImagePairContent)?.label || ''}
                      onChange={e => setEdits(prev => ({ ...prev, [block.block_key]: { ...(content as ImagePairContent), label: e.target.value } }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
                      placeholder="Sala · Campeche"
                    />
                  </div>
                </div>
              )}

              {/* JSON array editor */}
              {block.block_type === 'json_array' && (
                <div>
                  <textarea
                    value={JSON.stringify(content, null, 2)}
                    onChange={e => {
                      try { setEdits(prev => ({ ...prev, [block.block_key]: JSON.parse(e.target.value) })) } catch { /* ignore */ }
                    }}
                    rows={6}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-brand resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Edite o JSON diretamente. O campo será validado ao salvar.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
