import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Undo2, Redo2, Download, RotateCcw, Paintbrush, Eraser, Pentagon, X, Sparkles, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'paint' | 'eraser' | 'polygon' | 'lasso'
interface SelectionPoint { x: number; y: number }

interface Props {
  imageUrl: string
  selectedColor: string
  tolerance?: number
  onSave?: (dataUrl: string) => void
  onEnhancedImage?: (imageUrl: string) => void
}

export interface WallCanvasRef {
  getResult: () => string | null
  reset: () => void
}

// ─── Ray-casting polygon test ─────────────────────────────────────────────────

function isInsidePolygon(px: number, py: number, polygon: SelectionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside
  }
  return inside
}

function getPolygonBBox(polygon: SelectionPoint[]) {
  const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y)
  return { minX: Math.floor(Math.min(...xs)), maxX: Math.ceil(Math.max(...xs)), minY: Math.floor(Math.min(...ys)), maxY: Math.ceil(Math.max(...ys)) }
}

// ─── Flood fill ───────────────────────────────────────────────────────────────

function floodFill(imageData: ImageData, startX: number, startY: number, fillHex: string, tolerance: number): ImageData {
  const { data, width, height } = imageData
  const result = new ImageData(new Uint8ClampedArray(data), width, height)
  const rData = result.data
  const si = (startY * width + startX) * 4
  const targetR = data[si], targetG = data[si + 1], targetB = data[si + 2]
  const fr = parseInt(fillHex.slice(1, 3), 16)
  const fg = parseInt(fillHex.slice(3, 5), 16)
  const fb = parseInt(fillHex.slice(5, 7), 16)
  function colorDiff(i: number) { return Math.abs(data[i] - targetR) + Math.abs(data[i + 1] - targetG) + Math.abs(data[i + 2] - targetB) }
  const stackCapacity = Math.min(width * height, 1_000_000)
  const stack = new Int32Array(stackCapacity * 2)
  const visited = new Uint8Array(width * height)
  let stackSize = 0
  function push(x: number, y: number) { if (stackSize >= stackCapacity) return; stack[stackSize * 2] = x; stack[stackSize * 2 + 1] = y; stackSize++ }
  push(startX, startY)
  const blendFactor = 0.72
  while (stackSize > 0) {
    stackSize--
    const x = stack[stackSize * 2], y = stack[stackSize * 2 + 1]
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const pixelIndex = y * width + x
    if (visited[pixelIndex]) continue
    const i = pixelIndex * 4
    if (colorDiff(i) > tolerance * 3) continue
    visited[pixelIndex] = 1
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    const bFactor = blendFactor * (0.6 + lum * 0.4)
    rData[i] = Math.round(data[i] * (1 - bFactor) + fr * bFactor)
    rData[i + 1] = Math.round(data[i + 1] * (1 - bFactor) + fg * bFactor)
    rData[i + 2] = Math.round(data[i + 2] * (1 - bFactor) + fb * bFactor)
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  return result
}

function resizeImageToMax(img: HTMLImageElement, maxDim: number): [number, number] {
  const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1)
  return [Math.round(img.naturalWidth * ratio), Math.round(img.naturalHeight * ratio)]
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WallCanvas = forwardRef<WallCanvasRef, Props>(
  ({ imageUrl, selectedColor, tolerance = 40, onSave, onEnhancedImage }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const originalDataRef = useRef<ImageData | null>(null)
    const historyRef = useRef<ImageData[]>([])
    const futureRef = useRef<ImageData[]>([])
    const lassoPointsRef = useRef<SelectionPoint[]>([])
    const isLassoRef = useRef(false)

    const [tool, setTool] = useState<Tool>('paint')
    const [selectionPoints, setSelectionPoints] = useState<SelectionPoint[]>([])
    const [selectionClosed, setSelectionClosed] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [enhancing, setEnhancing] = useState(false)
    const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [clickCount, setClickCount] = useState(0)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || !imageUrl) return
      setIsProcessing(true)
      clearSelection()
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const [w, h] = resizeImageToMax(img, 900)
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        originalDataRef.current = ctx.getImageData(0, 0, w, h)
        historyRef.current = []; futureRef.current = []
        setCanUndo(false); setCanRedo(false)
        setIsProcessing(false); setClickCount(0); setEnhancedUrl(null)
        syncOverlay()
      }
      img.onerror = () => setIsProcessing(false)
      img.src = imageUrl
    }, [imageUrl])

    function syncOverlay() {
      const c = canvasRef.current, o = overlayRef.current
      if (!c || !o) return
      o.width = c.width; o.height = c.height
    }

    function clearSelection() {
      setSelectionPoints([]); setSelectionClosed(false)
      lassoPointsRef.current = []; isLassoRef.current = false
      const o = overlayRef.current
      if (o) o.getContext('2d')!.clearRect(0, 0, o.width, o.height)
    }

    function drawOverlay(points: SelectionPoint[], closed: boolean) {
      const o = overlayRef.current, c = canvasRef.current
      if (!o || !c || points.length < 2) return
      o.width = c.width; o.height = c.height
      const ctx = o.getContext('2d')!
      ctx.clearRect(0, 0, o.width, o.height)
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      if (closed) { ctx.closePath(); ctx.fillStyle = 'rgba(59,130,246,0.12)'; ctx.fill() }
      ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([])
      points.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#EF4444' : '#3B82F6'; ctx.fill()
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke()
      })
    }

    function getCP(e: React.PointerEvent | React.MouseEvent): SelectionPoint {
      const c = canvasRef.current!; const r = c.getBoundingClientRect()
      return { x: Math.round((e.clientX - r.left) * (c.width / r.width)), y: Math.round((e.clientY - r.top) * (c.height / r.height)) }
    }

    function saveToHistory() {
      const c = canvasRef.current; if (!c) return
      const ctx = c.getContext('2d')!
      historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
      futureRef.current = []
      if (historyRef.current.length > 20) historyRef.current.shift()
      setCanUndo(true); setCanRedo(false)
    }

    // ── Polygon click ─────────────────────────────────────────────────────────
    function handlePolygonClick(e: React.MouseEvent<HTMLCanvasElement>) {
      const p = getCP(e)
      setSelectionPoints(prev => {
        if (prev.length > 2) {
          const c = canvasRef.current!
          const scale = c.width / c.getBoundingClientRect().width
          if (Math.hypot(p.x - prev[0].x, p.y - prev[0].y) < 20 * scale) {
            setSelectionClosed(true)
            setTimeout(() => drawOverlay(prev, true), 0)
            return prev
          }
        }
        const next = [...prev, p]
        setTimeout(() => drawOverlay(next, false), 0)
        return next
      })
    }

    // ── Lasso pointer events ──────────────────────────────────────────────────
    function onPtrDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (tool !== 'lasso' || selectionClosed) return
      isLassoRef.current = true
      lassoPointsRef.current = [getCP(e)]
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    function onPtrMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isLassoRef.current) return
      lassoPointsRef.current.push(getCP(e))
      if (lassoPointsRef.current.length % 4 === 0) drawOverlay(lassoPointsRef.current, false)
    }
    function onPtrUp() {
      if (!isLassoRef.current) return
      isLassoRef.current = false
      const pts = lassoPointsRef.current
      if (pts.length >= 3) { setSelectionPoints([...pts]); setSelectionClosed(true); drawOverlay(pts, true) }
      else clearSelection()
    }

    // ── Main canvas click ─────────────────────────────────────────────────────
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || isProcessing) return

      if (tool === 'polygon') { handlePolygonClick(e); return }
      if (tool === 'lasso') return

      const rect = canvas.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width))
      const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height))
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return

      setIsProcessing(true); saveToHistory()
      setTimeout(() => {
        const ctx = canvas.getContext('2d')!
        const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (tool === 'eraser' && originalDataRef.current) {
          const result = floodFill(currentData, x, y, '#FFFFFF', tolerance)
          const orig = originalDataRef.current
          for (let i = 0; i < result.data.length; i += 4) {
            if (result.data[i] !== currentData.data[i] || result.data[i+1] !== currentData.data[i+1] || result.data[i+2] !== currentData.data[i+2]) {
              result.data[i] = orig.data[i]; result.data[i+1] = orig.data[i+1]; result.data[i+2] = orig.data[i+2]
            }
          }
          ctx.putImageData(result, 0, 0)
        } else {
          const raw = floodFill(currentData, x, y, selectedColor, tolerance)
          if (selectionClosed && selectionPoints.length > 2) {
            const { width, height } = canvas
            const bb = getPolygonBBox(selectionPoints)
            const masked = new ImageData(new Uint8ClampedArray(currentData.data), width, height)
            for (let py = Math.max(0, bb.minY); py <= Math.min(bb.maxY, height - 1); py++) {
              for (let px = Math.max(0, bb.minX); px <= Math.min(bb.maxX, width - 1); px++) {
                if (isInsidePolygon(px, py, selectionPoints)) {
                  const idx = (py * width + px) * 4
                  masked.data[idx] = raw.data[idx]; masked.data[idx+1] = raw.data[idx+1]; masked.data[idx+2] = raw.data[idx+2]
                }
              }
            }
            ctx.putImageData(masked, 0, 0)
          } else {
            ctx.putImageData(raw, 0, 0)
          }
        }
        setClickCount(c => c + 1); setIsProcessing(false)
      }, 10)
    }, [selectedColor, tolerance, tool, isProcessing, selectionPoints, selectionClosed])

    function undo() {
      const c = canvasRef.current; if (!c || !historyRef.current.length) return
      const ctx = c.getContext('2d')!
      futureRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
      ctx.putImageData(historyRef.current.pop()!, 0, 0)
      setCanUndo(historyRef.current.length > 0); setCanRedo(true)
    }
    function redo() {
      const c = canvasRef.current; if (!c || !futureRef.current.length) return
      const ctx = c.getContext('2d')!
      historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
      ctx.putImageData(futureRef.current.pop()!, 0, 0)
      setCanRedo(futureRef.current.length > 0); setCanUndo(true)
    }
    function reset() {
      const c = canvasRef.current; if (!c || !originalDataRef.current) return
      saveToHistory(); c.getContext('2d')!.putImageData(originalDataRef.current, 0, 0); clearSelection()
    }
    function download() {
      const c = canvasRef.current; if (!c) return
      const a = document.createElement('a'); a.download = `pintae-cor-${Date.now()}.png`; a.href = c.toDataURL('image/png'); a.click()
    }

    async function handleEnhanceWithAI() {
      const c = canvasRef.current; if (!c) return
      setEnhancing(true)
      try {
        const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1]
        const { data, error } = await supabase.functions.invoke('enhance-with-ai', { body: { imageBase64: b64 } })
        if (error) throw error
        if (data?.imageUrl) { setEnhancedUrl(data.imageUrl); onEnhancedImage?.(data.imageUrl) }
      } catch (err) { console.error('AI enhance:', err) }
      finally { setEnhancing(false) }
    }

    useImperativeHandle(ref, () => ({ getResult: () => canvasRef.current?.toDataURL('image/jpeg', 0.92) || null, reset }))

    const cursor = tool === 'polygon' || tool === 'lasso' ? 'crosshair'
      : tool === 'paint' ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='6' fill='${encodeURIComponent(selectedColor)}' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`
      : 'cell'

    return (
      <div className="flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([['paint','Pintar',Paintbrush],['eraser','Apagar',Eraser]] as [Tool,string,React.ElementType][]).map(([t,l,Icon]) => (
              <button key={t} onClick={() => { setTool(t); clearSelection() }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool===t ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-3.5 h-3.5" />{l}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-blue-50 rounded-xl p-1 border border-blue-100">
            <button onClick={() => { setTool('polygon'); clearSelection() }}
              title="Polígono — clique pontos, clique no início para fechar"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool==='polygon' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <Pentagon className="w-3.5 h-3.5" /> Polígono
            </button>
            <button onClick={() => { setTool('lasso'); clearSelection() }}
              title="Laço — arraste para delimitar área livre"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool==='lasso' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10H2"/><path d="M2 12l3-3 2 4 3-6 2 4 3-5"/></svg>
              Laço
            </button>
          </div>

          {selectionPoints.length > 0 && (
            <button onClick={clearSelection} className="flex items-center gap-1 text-xs text-blue-600 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100">
              <X className="w-3 h-3" /> Limpar seleção
            </button>
          )}

          <div className="flex gap-1">
            {[{fn:undo,d:!canUndo,I:Undo2},{fn:redo,d:!canRedo,I:Redo2},{fn:reset,d:false,I:RotateCcw}].map(({fn,d,I},i) => (
              <button key={i} onClick={fn} disabled={d}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer transition-colors">
                <I className="w-3.5 h-3.5" />
              </button>
            ))}
            <button onClick={download} className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark cursor-pointer">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {clickCount > 0 && (
            <div className="flex gap-2 ml-auto flex-wrap">
              <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => onSave?.(canvasRef.current?.toDataURL('image/jpeg', 0.92) || '')}
                className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-green-600 transition-colors">
                Salvar resultado
              </motion.button>
              <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                onClick={handleEnhanceWithAI} disabled={enhancing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-60 hover:opacity-90">
                {enhancing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><Sparkles className="w-3.5 h-3.5" /> Melhorar com IA</>}
              </motion.button>
            </div>
          )}
        </div>

        {/* Hints de seleção */}
        {tool === 'polygon' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            🔷 <strong>Polígono:</strong> Clique para adicionar pontos. Clique no primeiro ponto (vermelho) para fechar.
          </p>
        )}
        {tool === 'lasso' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            🔵 <strong>Laço:</strong> Clique e arraste para delimitar a área da parede. Solte para confirmar.
          </p>
        )}
        {selectionClosed && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ✅ Área delimitada! Selecione <strong>Pintar</strong> e clique dentro da área para aplicar a cor.
          </p>
        )}

        {/* Canvas principal + overlay de seleção */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onPointerDown={onPtrDown}
            onPointerMove={onPtrMove}
            onPointerUp={onPtrUp}
            onPointerLeave={onPtrUp}
            className="block w-full h-auto"
            style={{ cursor }}
          />
          {/* Overlay SVG — renderiza a seleção sem modificar a imagem */}
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>

        {/* Resultado da melhoria com IA */}
        {enhancedUrl && (
          <div className="rounded-2xl overflow-hidden border border-purple-200">
            <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-100">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Versão melhorada com IA
              </p>
              <button onClick={() => setEnhancedUrl(null)} className="text-purple-400 hover:text-purple-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <img src={enhancedUrl} alt="IA render" className="w-full" />
            <div className="px-3 py-2 bg-purple-50">
              <a href={enhancedUrl} download="pintae-ai.jpg" className="text-xs text-purple-700 font-medium hover:underline">⬇️ Baixar imagem gerada</a>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Clique na parede para aplicar a cor · Use Polígono/Laço para delimitar a área exata
        </p>
      </div>
    )
  }
)

WallCanvas.displayName = 'WallCanvas'
