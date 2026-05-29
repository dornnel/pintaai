import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Upload, Paintbrush, ArrowLeft, Sliders, History,
  Sparkles, Check, ArrowRight, LogIn, Image as ImageIcon,
} from 'lucide-react'
import { ColorWheel, PAINT_PRESETS } from '../components/color/ColorWheel'
import { WallCanvas, type WallCanvasRef } from '../components/color/WallCanvas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/utils'

interface SavedViz {
  id: string
  original_image_url: string
  result_image_url: string | null
  selected_colors: { hex: string; name?: string }[]
  created_at: string
}

export function ColorVisualizerPage() {
  const { user } = useAuth()
  const canvasRef = useRef<WallCanvasRef>(null)

  const [imageUrl, setImageUrl] = useState<string>('')
  const [_imageName, setImageName] = useState<string>('')
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState('#E8DCC8')
  const [colorName, setColorName] = useState('Areia')
  const [tolerance, setTolerance] = useState(40)
  const [saved, setSaved] = useState(false)
  const [_saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'wheel' | 'presets'>('presets')
  const [history, setHistory] = useState<SavedViz[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [appliedColors, setAppliedColors] = useState<{ hex: string; name: string }[]>([])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    setImageName(file.name)
    setSaved(false)
    setAppliedColors([])

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setImageUrl(localUrl)

    // Upload to Supabase Storage
    const path = `color-viz/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
    const { data, error } = await supabase.storage.from('pintae-media').upload(path, file)
    if (!error && data) {
      const { data: pubData } = supabase.storage.from('pintae-media').getPublicUrl(path)
      setUploadedStoragePath(path)
      // Update image URL to the stored one (for CORS on canvas)
      setImageUrl(pubData.publicUrl)
    }
    setUploading(false)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  function handleColorChange(hex: string) {
    setSelectedColor(hex)
    // Find matching preset name
    const preset = PAINT_PRESETS.find(p => p.hex.toLowerCase() === hex.toLowerCase())
    setColorName(preset?.name || hex.toUpperCase())
  }

  function handlePresetSelect(preset: { hex: string; name: string }) {
    setSelectedColor(preset.hex)
    setColorName(preset.name)
  }

  function trackAppliedColor() {
    setAppliedColors(prev => {
      const exists = prev.find(c => c.hex === selectedColor)
      if (exists) return prev
      return [...prev, { hex: selectedColor, name: colorName }].slice(-6)
    })
  }

  async function handleSave(dataUrl: string) {
    setSaving(true)
    try {
      // Convert dataUrl to blob and upload
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const resultPath = `color-viz/result-${Date.now()}.jpg`
      const { data: uploadData } = await supabase.storage.from('pintae-media').upload(resultPath, blob, { contentType: 'image/jpeg' })

      let resultUrl = dataUrl
      if (uploadData) {
        const { data: pubData } = supabase.storage.from('pintae-media').getPublicUrl(resultPath)
        resultUrl = pubData.publicUrl
      }

      // Save to DB
      await supabase.from('color_visualizations').insert({
        user_id: user?.id || null,
        session_id: localStorage.getItem('pintae_session_id'),
        original_image_url: imageUrl,
        original_storage_path: uploadedStoragePath,
        result_image_url: resultUrl,
        result_storage_path: uploadData?.path,
        selected_colors: appliedColors.length > 0 ? appliedColors : [{ hex: selectedColor, name: colorName }],
        status: 'completed',
      })

      setSaved(true)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function loadHistory() {
    if (!user) return
    const { data } = await supabase.from('color_visualizations')
      .select('id, original_image_url, result_image_url, selected_colors, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12)
    setHistory((data as SavedViz[]) || [])
    setShowHistory(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-brand transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
                <Paintbrush className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-gray-900 text-sm">Visualizador de Cores</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button onClick={loadHistory}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand cursor-pointer transition-colors">
                <History className="w-3.5 h-3.5" /> Histórico
              </button>
            )}
            {!user && (
              <Link to="/login" className="flex items-center gap-1.5 text-xs text-brand font-medium">
                <LogIn className="w-3.5 h-3.5" /> Entrar para salvar
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Intro */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Experimente cores nas suas paredes</h1>
          <p className="text-gray-500 text-sm">Faça upload de uma foto do cômodo, escolha uma cor no círculo cromático e clique na parede. Veja o resultado antes de contratar o pintor.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Upload + Canvas */}
          <div className="lg:col-span-2 space-y-4">

            {/* Upload area */}
            {!imageUrl ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                onDragOver={e => e.preventDefault()} onDrop={handleDrop}
                className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center bg-white hover:border-brand hover:bg-orange-50/30 transition-colors cursor-pointer"
                onClick={() => document.getElementById('color-viz-upload')?.click()}
              >
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7 text-brand" />
                  )}
                </div>
                <p className="font-semibold text-gray-800 mb-1">
                  {uploading ? 'Carregando...' : 'Faça upload de uma foto'}
                </p>
                <p className="text-sm text-gray-400">Clique aqui ou arraste uma foto do cômodo</p>
                <p className="text-xs text-gray-300 mt-2">JPG, PNG · Máximo 10MB</p>
                <input id="color-viz-upload" type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <WallCanvas
                  ref={canvasRef}
                  imageUrl={imageUrl}
                  selectedColor={selectedColor}
                  tolerance={tolerance}
                  onSave={handleSave}
                />
              </motion.div>
            )}

            {/* Tolerance slider */}
            {imageUrl && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-brand shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">Tolerância da seleção</span>
                      <span className="text-xs text-gray-400">{tolerance}</span>
                    </div>
                    <input type="range" min="10" max="100" value={tolerance}
                      onChange={e => setTolerance(Number(e.target.value))}
                      className="w-full accent-brand" />
                    <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                      <span>Preciso</span><span>Amplo</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Baixa tolerância = seleciona apenas pixels muito similares. Alta = preenche área maior.
                </p>
              </motion.div>
            )}

            {/* Applied colors */}
            {appliedColors.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Cores usadas:</span>
                {appliedColors.map(c => (
                  <button key={c.hex} onClick={() => { setSelectedColor(c.hex); setColorName(c.name) }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs cursor-pointer hover:border-brand transition-colors">
                    <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* CTA after saved */}
            {saved && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Visualização salva!</p>
                    <p className="text-xs text-gray-500">Quer que pintores de Floripa façam isso na sua parede?</p>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link to={`/chat?q=${encodeURIComponent(`Quero pintar com a cor ${colorName} (${selectedColor})`)}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-semibold rounded-xl whitespace-nowrap">
                    Pedir orçamento <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Right: Color picker */}
          <div className="space-y-4">

            {/* Selected color preview */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow-sm shrink-0"
                  style={{ backgroundColor: selectedColor }} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{colorName}</p>
                  <p className="text-xs text-gray-400 font-mono">{selectedColor.toUpperCase()}</p>
                </div>
              </div>

              {/* Hex input */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded border border-gray-200 shrink-0" style={{ backgroundColor: selectedColor }} />
                <input
                  type="text"
                  value={selectedColor}
                  onChange={e => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) handleColorChange(v)
                    else setSelectedColor(v)
                  }}
                  className="flex-1 text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand"
                  placeholder="#E8DCC8"
                />
                <input type="color" value={selectedColor} onChange={e => handleColorChange(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              </div>

              {imageUrl && (
                <motion.button
                  onClick={trackAppliedColor}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
                >
                  <Paintbrush className="w-4 h-4" />
                  Clique na parede para aplicar
                </motion.button>
              )}
            </motion.div>

            {/* Color picker tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                {(['presets', 'wheel'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${tab === t ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'presets' ? 'Cores prontas' : 'Círculo cromático'}
                  </button>
                ))}
              </div>

              <div className="p-4">
                <AnimatePresence mode="wait">
                  {tab === 'presets' ? (
                    <motion.div key="presets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="grid grid-cols-4 gap-2">
                        {PAINT_PRESETS.map(preset => (
                          <button key={preset.hex} onClick={() => handlePresetSelect(preset)} title={preset.name}
                            className={`relative aspect-square rounded-xl border-2 transition-all cursor-pointer hover:scale-105 ${
                              selectedColor === preset.hex ? 'border-brand scale-105 shadow-md' : 'border-gray-200 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: preset.hex }}>
                            {selectedColor === preset.hex && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-3">
                        {PAINT_PRESETS.find(p => p.hex === selectedColor)?.name || 'Selecione uma cor'}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div key="wheel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-3">
                      <ColorWheel
                        size={200}
                        value={selectedColor}
                        onChange={handleColorChange}
                      />
                      <p className="text-xs text-gray-400 text-center">Clique em qualquer ponto para selecionar a cor</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">Dicas de uso</p>
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    <li>• Clique numa parede para aplicar a cor</li>
                    <li>• Ajuste a tolerância se a seleção for pequena ou grande demais</li>
                    <li>• Use o botão apagar para remover uma área</li>
                    <li>• Ctrl+Z ou botão desfazer para voltar</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Login prompt */}
            {!user && imageUrl && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-3">Entre para salvar suas visualizações e usá-las nos pedidos de orçamento</p>
                <Link to="/login" className="text-sm text-brand font-semibold hover:text-brand-dark">
                  Criar conta grátis →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowHistory(false)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-brand" /> Suas visualizações salvas
              </h3>
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Nenhuma visualização salva ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {history.map(v => (
                    <div key={v.id} className="rounded-xl overflow-hidden border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setImageUrl(v.result_image_url || v.original_image_url); setShowHistory(false) }}>
                      <img src={v.result_image_url || v.original_image_url} alt="" className="w-full h-28 object-cover" />
                      <div className="p-2">
                        <div className="flex gap-1 mb-1">
                          {(v.selected_colors || []).slice(0, 4).map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400">{formatDate(v.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
