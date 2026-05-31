import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Undo2, Redo2, Download, RotateCcw, Paintbrush, Eraser, Pentagon, X, Sparkles, Loader2, RectangleHorizontal, Circle } from 'lucide-react'
import { motion } from 'motion/react'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'paint' | 'eraser' | 'polygon' | 'lasso' | 'rectangle' | 'circle' | 'brush'
interface Pt { x: number; y: number }
interface Ellipse { cx: number; cy: number; rx: number; ry: number }

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

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function isInsidePolygon(px: number, py: number, polygon: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside
  }
  return inside
}

function isInsideEllipse(px: number, py: number, e: Ellipse): boolean {
  if (e.rx === 0 || e.ry === 0) return false
  return ((px - e.cx) ** 2 / e.rx ** 2 + (py - e.cy) ** 2 / e.ry ** 2) <= 1
}

function getBBox(polygon: Pt[]) {
  const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y)
  return { minX: Math.floor(Math.min(...xs)), maxX: Math.ceil(Math.max(...xs)), minY: Math.floor(Math.min(...ys)), maxY: Math.ceil(Math.max(...ys)) }
}

// ─── Flood fill ───────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function floodFill(imageData: ImageData, startX: number, startY: number, fillHex: string, tolerance: number): ImageData {
  const { data, width, height } = imageData
  const result = new ImageData(new Uint8ClampedArray(data), width, height)
  const rData = result.data
  const si = (startY * width + startX) * 4
  const targetR = data[si], targetG = data[si + 1], targetB = data[si + 2]
  const [fr, fg, fb] = parseHex(fillHex)
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

// ─── Brush paint ──────────────────────────────────────────────────────────────

function brushPaint(
  imageData: ImageData, cx: number, cy: number, radius: number, fillHex: string,
  selPoly: Pt[] | null, selEllipse: Ellipse | null, selClosed: boolean,
): ImageData {
  const { data, width, height } = imageData
  const result = new ImageData(new Uint8ClampedArray(data), width, height)
  const rData = result.data
  const [fr, fg, fb] = parseHex(fillHex)
  const r2 = radius * radius
  const blendFactor = 0.72
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius))
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const dist2 = (px - cx) ** 2 + (py - cy) ** 2
      if (dist2 > r2) continue
      if (selClosed) {
        if (selEllipse && !isInsideEllipse(px, py, selEllipse)) continue
        if (selPoly && selPoly.length > 2 && !isInsidePolygon(px, py, selPoly)) continue
      }
      const i = (py * width + px) * 4
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
      const bFactor = blendFactor * (0.6 + lum * 0.4)
      rData[i] = Math.round(data[i] * (1 - bFactor) + fr * bFactor)
      rData[i + 1] = Math.round(data[i + 1] * (1 - bFactor) + fg * bFactor)
      rData[i + 2] = Math.round(data[i + 2] * (1 - bFactor) + fb * bFactor)
    }
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

    // Polygon / lasso state
    const lassoPointsRef = useRef<Pt[]>([])
    const isLassoRef = useRef(false)
    // Rectangle / circle drag state
    const dragStartRef = useRef<Pt | null>(null)
    const isDraggingRef = useRef(false)
    // Ellipse selection
    const ellipseRef = useRef<Ellipse | null>(null)
    // Brush
    const isBrushingRef = useRef(false)

    const [tool, setTool] = useState<Tool>('paint')
    const [brushSize, setBrushSize] = useState(20)
    const [selectionPoints, setSelectionPoints] = useState<Pt[]>([])
    const [selectionClosed, setSelectionClosed] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [enhancing, setEnhancing] = useState(false)
    const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null)
    const [enhanceError, setEnhanceError] = useState<string | null>(null)
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
        setIsProcessing(false); setClickCount(0); setEnhancedUrl(null); setEnhanceError(null)
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
      ellipseRef.current = null
      dragStartRef.current = null; isDraggingRef.current = false
      const o = overlayRef.current
      if (o) o.getContext('2d')!.clearRect(0, 0, o.width, o.height)
    }

    // ── Overlay drawing ───────────────────────────────────────────────────────

    function drawPolyOverlay(points: Pt[], closed: boolean) {
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

    function drawRectOverlay(start: Pt, end: Pt, closed: boolean) {
      const o = overlayRef.current, c = canvasRef.current
      if (!o || !c) return
      o.width = c.width; o.height = c.height
      const ctx = o.getContext('2d')!
      ctx.clearRect(0, 0, o.width, o.height)
      const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y)
      const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y)
      if (closed) { ctx.fillStyle = 'rgba(59,130,246,0.12)'; ctx.fillRect(x, y, w, h) }
      ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([])
    }

    function drawEllipseOverlay(e: Ellipse, closed: boolean) {
      const o = overlayRef.current, c = canvasRef.current
      if (!o || !c) return
      o.width = c.width; o.height = c.height
      const ctx = o.getContext('2d')!
      ctx.clearRect(0, 0, o.width, o.height)
      ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2)
      if (closed) { ctx.fillStyle = 'rgba(59,130,246,0.12)'; ctx.fill() }
      ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([])
    }

    // ── Canvas coordinates ────────────────────────────────────────────────────

    function getCP(e: React.PointerEvent | React.MouseEvent): Pt {
      const c = canvasRef.current!; const r = c.getBoundingClientRect()
      return { x: Math.round((e.clientX - r.left) * (c.width / r.width)), y: Math.round((e.clientY - r.top) * (c.height / r.height)) }
    }

    // ── History ───────────────────────────────────────────────────────────────

    function saveToHistory() {
      const c = canvasRef.current; if (!c) return
      const ctx = c.getContext('2d')!
      historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height))
      futureRef.current = []
      if (historyRef.current.length > 20) historyRef.current.shift()
      setCanUndo(true); setCanRedo(false)
    }

    // ── Flood fill apply ──────────────────────────────────────────────────────

    function applyFloodFill(x: number, y: number, activeTool: 'paint' | 'eraser') {
      const canvas = canvasRef.current; if (!canvas) return
      setIsProcessing(true); saveToHistory()
      setTimeout(() => {
        const ctx = canvas.getContext('2d')!
        const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        if (activeTool === 'eraser' && originalDataRef.current) {
          const result = floodFill(currentData, x, y, '#FFFFFF', tolerance)
          const orig = originalDataRef.current
          for (let i = 0; i < result.data.length; i += 4) {
            if (result.data[i] !== currentData.data[i] || result.data[i + 1] !== currentData.data[i + 1] || result.data[i + 2] !== currentData.data[i + 2]) {
              result.data[i] = orig.data[i]; result.data[i + 1] = orig.data[i + 1]; result.data[i + 2] = orig.data[i + 2]
            }
          }
          ctx.putImageData(result, 0, 0)
        } else {
          const raw = floodFill(currentData, x, y, selectedColor, tolerance)
          const selPoly = selectionPoints.length > 2 ? selectionPoints : null
          const selEl = ellipseRef.current
          if (selectionClosed && (selPoly || selEl)) {
            const { width, height } = canvas
            const masked = new ImageData(new Uint8ClampedArray(currentData.data), width, height)
            const bb = selPoly
              ? getBBox(selPoly)
              : { minX: Math.floor(selEl!.cx - selEl!.rx), maxX: Math.ceil(selEl!.cx + selEl!.rx), minY: Math.floor(selEl!.cy - selEl!.ry), maxY: Math.ceil(selEl!.cy + selEl!.ry) }
            for (let py = Math.max(0, bb.minY); py <= Math.min(bb.maxY, height - 1); py++) {
              for (let px = Math.max(0, bb.minX); px <= Math.min(bb.maxX, width - 1); px++) {
                const inside = selEl ? isInsideEllipse(px, py, selEl) : isInsidePolygon(px, py, selPoly!)
                if (inside) {
                  const idx = (py * width + px) * 4
                  masked.data[idx] = raw.data[idx]; masked.data[idx + 1] = raw.data[idx + 1]; masked.data[idx + 2] = raw.data[idx + 2]
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
    }

    // ── Brush apply ───────────────────────────────────────────────────────────

    function applyBrushAt(x: number, y: number) {
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const selPoly = selectionPoints.length > 2 ? selectionPoints : null
      const result = brushPaint(currentData, x, y, brushSize / 2, selectedColor, selPoly, ellipseRef.current, selectionClosed)
      ctx.putImageData(result, 0, 0)
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
            setTimeout(() => drawPolyOverlay(prev, true), 0)
            return prev
          }
        }
        const next = [...prev, p]
        setTimeout(() => drawPolyOverlay(next, false), 0)
        return next
      })
    }

    // ── Pointer events ────────────────────────────────────────────────────────

    const onPtrDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isProcessing) return
      const p = getCP(e)
      e.currentTarget.setPointerCapture(e.pointerId)

      if (tool === 'lasso' && !selectionClosed) {
        clearSelection()
        isLassoRef.current = true
        lassoPointsRef.current = [p]
        return
      }
      if (tool === 'rectangle') {
        clearSelection()
        dragStartRef.current = p; isDraggingRef.current = true
        return
      }
      if (tool === 'circle') {
        clearSelection()
        dragStartRef.current = p; isDraggingRef.current = true
        return
      }
      if (tool === 'brush') {
        if (!isBrushingRef.current) {
          saveToHistory()
          isBrushingRef.current = true
          setClickCount(c => c + 1)
        }
        applyBrushAt(p.x, p.y)
        return
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool, selectionClosed, isProcessing, brushSize, selectedColor, selectionPoints, selectionClosed])

    const onPtrMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getCP(e)
      if (tool === 'lasso' && isLassoRef.current) {
        lassoPointsRef.current.push(p)
        if (lassoPointsRef.current.length % 4 === 0) drawPolyOverlay(lassoPointsRef.current, false)
        return
      }
      if (tool === 'rectangle' && isDraggingRef.current && dragStartRef.current) {
        drawRectOverlay(dragStartRef.current, p, false)
        return
      }
      if (tool === 'circle' && isDraggingRef.current && dragStartRef.current) {
        const s = dragStartRef.current
        const rx = Math.abs(p.x - s.x) / 2, ry = Math.abs(p.y - s.y) / 2
        const cx = (s.x + p.x) / 2, cy = (s.y + p.y) / 2
        drawEllipseOverlay({ cx, cy, rx, ry }, false)
        return
      }
      if (tool === 'brush' && isBrushingRef.current) {
        applyBrushAt(p.x, p.y)
        return
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool, brushSize, selectedColor, selectionPoints, selectionClosed])

    const onPtrUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getCP(e)
      if (tool === 'lasso' && isLassoRef.current) {
        isLassoRef.current = false
        const pts = lassoPointsRef.current
        if (pts.length >= 3) {
          setSelectionPoints([...pts]); setSelectionClosed(true); ellipseRef.current = null
          drawPolyOverlay(pts, true)
        } else clearSelection()
        return
      }
      if (tool === 'rectangle' && isDraggingRef.current && dragStartRef.current) {
        isDraggingRef.current = false
        const s = dragStartRef.current
        if (Math.abs(p.x - s.x) > 5 && Math.abs(p.y - s.y) > 5) {
          const corners: Pt[] = [
            { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y) },
            { x: Math.max(s.x, p.x), y: Math.min(s.y, p.y) },
            { x: Math.max(s.x, p.x), y: Math.max(s.y, p.y) },
            { x: Math.min(s.x, p.x), y: Math.max(s.y, p.y) },
          ]
          setSelectionPoints(corners); setSelectionClosed(true); ellipseRef.current = null
          drawRectOverlay(s, p, true)
        } else clearSelection()
        return
      }
      if (tool === 'circle' && isDraggingRef.current && dragStartRef.current) {
        isDraggingRef.current = false
        const s = dragStartRef.current
        const rx = Math.abs(p.x - s.x) / 2, ry = Math.abs(p.y - s.y) / 2
        const cx = (s.x + p.x) / 2, cy = (s.y + p.y) / 2
        if (rx > 5 && ry > 5) {
          const el: Ellipse = { cx, cy, rx, ry }
          ellipseRef.current = el; setSelectionPoints([]); setSelectionClosed(true)
          drawEllipseOverlay(el, true)
        } else clearSelection()
        return
      }
      if (tool === 'brush') {
        isBrushingRef.current = false
        return
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool])

    // ── Main canvas click (paint / eraser / polygon) ──────────────────────────

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || isProcessing) return
      if (tool === 'polygon') { handlePolygonClick(e); return }
      if (tool === 'lasso' || tool === 'rectangle' || tool === 'circle' || tool === 'brush') return
      const rect = canvas.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width))
      const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height))
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return
      applyFloodFill(x, y, tool as 'paint' | 'eraser')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedColor, tolerance, tool, isProcessing, selectionPoints, selectionClosed])

    // ── Undo / Redo / Reset / Download ────────────────────────────────────────

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

    // ── AI enhance ────────────────────────────────────────────────────────────

    async function handleEnhanceWithAI() {
      const c = canvasRef.current; if (!c) return
      setEnhancing(true); setEnhanceError(null)
      try {
        const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1]
        const { data, error } = await supabase.functions.invoke('enhance-with-ai', { body: { imageBase64: b64 } })
        if (error) throw new Error(error.message || 'Erro na função Edge')
        if (!data?.imageUrl) throw new Error('Nenhuma imagem retornada pela IA')
        // Fetch and convert to local blob URL so DALL-E temp URL doesn't expire
        const resp = await fetch(data.imageUrl)
        if (!resp.ok) throw new Error('Falha ao baixar imagem gerada')
        const blob = await resp.blob()
        const localUrl = URL.createObjectURL(blob)
        setEnhancedUrl(localUrl)
        onEnhancedImage?.(localUrl)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        setEnhanceError(msg)
        console.error('AI enhance:', err)
      } finally {
        setEnhancing(false)
      }
    }

    useImperativeHandle(ref, () => ({ getResult: () => canvasRef.current?.toDataURL('image/jpeg', 0.92) || null, reset }))

    // ── Cursor ────────────────────────────────────────────────────────────────

    const cursor = (() => {
      if (tool === 'polygon' || tool === 'lasso' || tool === 'rectangle' || tool === 'circle') return 'crosshair'
      if (tool === 'brush') {
        const d = Math.max(brushSize, 8)
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${d + 4}' height='${d + 4}'%3E%3Ccircle cx='${(d + 4) / 2}' cy='${(d + 4) / 2}' r='${d / 2}' fill='none' stroke='%23333' stroke-width='1.5' stroke-dasharray='3 2'/%3E%3C/svg%3E") ${(d + 4) / 2} ${(d + 4) / 2}, crosshair`
      }
      if (tool === 'paint') {
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='6' fill='${encodeURIComponent(selectedColor)}' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`
      }
      return 'cell'
    })()

    const BRUSH_LABELS = ['S', 'M', 'G', 'GG']
    const BRUSH_SIZES = [10, 20, 35, 55]

    return (
      <div className="flex flex-col gap-3">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Paint / eraser / brush */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              ['paint', 'Pintar', Paintbrush],
              ['eraser', 'Apagar', Eraser],
              ['brush', 'Pincel', Paintbrush],
            ] as [Tool, string, React.ElementType][]).map(([t, l, Icon]) => (
              <button key={t}
                onClick={() => setTool(t)}
                title={t === 'brush' ? 'Clique e arraste para pintar livremente' : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === t ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-3.5 h-3.5" />{l}
              </button>
            ))}
          </div>

          {/* Brush size selector */}
          {tool === 'brush' && (
            <div className="flex gap-0.5 bg-gray-50 border border-gray-200 rounded-xl p-1">
              {BRUSH_SIZES.map((sz, i) => (
                <button key={sz} onClick={() => setBrushSize(sz)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors cursor-pointer ${brushSize === sz ? 'bg-white text-brand shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {BRUSH_LABELS[i]}
                </button>
              ))}
            </div>
          )}

          {/* Selection tools */}
          <div className="flex gap-1 bg-blue-50 rounded-xl p-1 border border-blue-100">
            <button onClick={() => { setTool('polygon'); clearSelection() }}
              title="Polígono — clique pontos, clique no início para fechar"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'polygon' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <Pentagon className="w-3.5 h-3.5" /> Polígono
            </button>
            <button onClick={() => { setTool('lasso'); clearSelection() }}
              title="Laço livre — arraste para delimitar"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'lasso' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10H2" /><path d="M2 12l3-3 2 4 3-6 2 4 3-5" /></svg>
              Laço
            </button>
            <button onClick={() => { setTool('rectangle'); clearSelection() }}
              title="Retângulo — arraste para selecionar"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'rectangle' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <RectangleHorizontal className="w-3.5 h-3.5" /> Retângulo
            </button>
            <button onClick={() => { setTool('circle'); clearSelection() }}
              title="Círculo — arraste para selecionar área oval"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'circle' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-500 hover:text-blue-700'}`}>
              <Circle className="w-3.5 h-3.5" /> Círculo
            </button>
          </div>

          {selectionClosed && (
            <button onClick={clearSelection}
              className="flex items-center gap-1 text-xs text-blue-600 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100">
              <X className="w-3 h-3" /> Limpar seleção
            </button>
          )}

          {/* Undo / redo / reset / download */}
          <div className="flex gap-1 ml-auto">
            {[{ fn: undo, d: !canUndo, I: Undo2 }, { fn: redo, d: !canRedo, I: Redo2 }, { fn: reset, d: false, I: RotateCcw }].map(({ fn, d, I }, i) => (
              <button key={i} onClick={fn} disabled={d}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer transition-colors">
                <I className="w-3.5 h-3.5" />
              </button>
            ))}
            <button onClick={download}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark cursor-pointer">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Hints ── */}
        {tool === 'polygon' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            🔷 <strong>Polígono:</strong> Clique para adicionar pontos. Clique no ponto vermelho para fechar.
          </p>
        )}
        {tool === 'lasso' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            🔵 <strong>Laço:</strong> Clique e arraste para traçar a área livremente. Solte para confirmar.
          </p>
        )}
        {tool === 'rectangle' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ▭ <strong>Retângulo:</strong> Clique e arraste para selecionar a área retangular.
          </p>
        )}
        {tool === 'circle' && !selectionClosed && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ⭕ <strong>Círculo:</strong> Clique e arraste para selecionar a área oval.
          </p>
        )}
        {tool === 'brush' && (
          <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
            🖌️ <strong>Pincel {BRUSH_LABELS[BRUSH_SIZES.indexOf(brushSize)] ?? 'M'}:</strong> Clique e arraste para pintar livremente.
            {selectionClosed ? ' Limitado à seleção ativa.' : ''}
          </p>
        )}
        {selectionClosed && tool !== 'brush' && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ✅ Área delimitada! Use <strong>Pintar</strong> (clique) ou <strong>Pincel</strong> (arraste) dentro da área para aplicar a cor.
          </p>
        )}

        {/* ── Canvas ── */}
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
            style={{ cursor, touchAction: 'none' }}
          />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>

        {/* ── Action buttons ── */}
        {clickCount > 0 && (
          <div className="flex gap-2 flex-wrap">
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => onSave?.(canvasRef.current?.toDataURL('image/jpeg', 0.92) || '')}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-green-600 transition-colors">
              Salvar resultado
            </motion.button>
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={handleEnhanceWithAI} disabled={enhancing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-60 hover:opacity-90">
              {enhancing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando render IA...</>
                : <><Sparkles className="w-3.5 h-3.5" /> Melhorar com IA</>}
            </motion.button>
          </div>
        )}

        {/* ── AI error ── */}
        {enhanceError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700 flex-1">Erro ao gerar render: {enhanceError}</p>
            <button onClick={() => setEnhanceError(null)} className="text-red-400 hover:text-red-600 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── AI result ── */}
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
          Pintar/Apagar: clique · Pincel: arraste · Polígono/Laço/Retângulo/Círculo: delimite a área
        </p>
      </div>
    )
  }
)

WallCanvas.displayName = 'WallCanvas'
