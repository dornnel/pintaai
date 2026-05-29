import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Undo2, Redo2, Download, RotateCcw, Paintbrush, Eraser } from 'lucide-react'
import { motion } from 'motion/react'

interface Props {
  imageUrl: string
  selectedColor: string
  tolerance?: number
  onSave?: (dataUrl: string) => void
}

export interface WallCanvasRef {
  getResult: () => string | null
  reset: () => void
}


// Fast flood fill using BFS with typed arrays
function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance: number,
): ImageData {
  const { data, width, height } = imageData
  const result = new ImageData(new Uint8ClampedArray(data), width, height)
  const rData = result.data

  const si = (startY * width + startX) * 4
  const targetR = data[si], targetG = data[si + 1], targetB = data[si + 2]

  // Parse fill color
  const fr = parseInt(fillHex.slice(1, 3), 16)
  const fg = parseInt(fillHex.slice(3, 5), 16)
  const fb = parseInt(fillHex.slice(5, 7), 16)

  function colorDiff(i: number) {
    return Math.abs(data[i] - targetR) + Math.abs(data[i + 1] - targetG) + Math.abs(data[i + 2] - targetB)
  }

  // BFS using Int32Array stack for performance
  const stackCapacity = Math.min(width * height, 1_000_000)
  const stack = new Int32Array(stackCapacity * 2)
  const visited = new Uint8Array(width * height)
  let stackSize = 0

  function push(x: number, y: number) {
    if (stackSize >= stackCapacity) return
    stack[stackSize * 2] = x
    stack[stackSize * 2 + 1] = y
    stackSize++
  }

  push(startX, startY)

  const blendFactor = 0.72 // How much of the new color to apply

  while (stackSize > 0) {
    stackSize--
    const x = stack[stackSize * 2]
    const y = stack[stackSize * 2 + 1]

    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const pixelIndex = y * width + x
    if (visited[pixelIndex]) continue
    const i = pixelIndex * 4
    if (colorDiff(i) > tolerance * 3) continue

    visited[pixelIndex] = 1

    // Blend: mix original with fill color, preserve luminance somewhat
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    const bFactor = blendFactor * (0.6 + lum * 0.4)

    rData[i] = Math.round(data[i] * (1 - bFactor) + fr * bFactor)
    rData[i + 1] = Math.round(data[i + 1] * (1 - bFactor) + fg * bFactor)
    rData[i + 2] = Math.round(data[i + 2] * (1 - bFactor) + fb * bFactor)

    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }

  return result
}

// Resize image to max dimension maintaining aspect ratio
function resizeImageToMax(img: HTMLImageElement, maxDim: number): [number, number] {
  const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1)
  return [Math.round(img.naturalWidth * ratio), Math.round(img.naturalHeight * ratio)]
}

export const WallCanvas = forwardRef<WallCanvasRef, Props>(
  ({ imageUrl, selectedColor, tolerance = 40, onSave }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const originalDataRef = useRef<ImageData | null>(null)
    const historyRef = useRef<ImageData[]>([])
    const futureRef = useRef<ImageData[]>([])
    const [tool, setTool] = useState<'paint' | 'eraser'>('paint')
    const [isProcessing, setIsProcessing] = useState(false)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [clickCount, setClickCount] = useState(0)

    // Load image onto canvas
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || !imageUrl) return
      setIsProcessing(true)

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const [w, h] = resizeImageToMax(img, 900)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        originalDataRef.current = ctx.getImageData(0, 0, w, h)
        historyRef.current = []
        futureRef.current = []
        setCanUndo(false); setCanRedo(false)
        setIsProcessing(false)
      }
      img.onerror = () => setIsProcessing(false)
      img.src = imageUrl
    }, [imageUrl])

    function saveToHistory() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      futureRef.current = []
      if (historyRef.current.length > 20) historyRef.current.shift()
      setCanUndo(true); setCanRedo(false)
    }

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || isProcessing) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)

      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return

      setIsProcessing(true)
      saveToHistory()

      // Run flood fill in a microtask to allow UI update
      setTimeout(() => {
        const ctx = canvas.getContext('2d')!
        const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        let fillColor = selectedColor
        if (tool === 'eraser' && originalDataRef.current) {
          // Eraser: restore original image in clicked region
          const result = floodFill(currentData, x, y, '#RESET__', tolerance)
          // For eraser, we restore original pixels in the flood-filled region
          const origData = originalDataRef.current
          for (let i = 0; i < result.data.length; i += 4) {
            if (result.data[i] !== currentData.data[i] ||
                result.data[i+1] !== currentData.data[i+1] ||
                result.data[i+2] !== currentData.data[i+2]) {
              result.data[i] = origData.data[i]
              result.data[i+1] = origData.data[i+1]
              result.data[i+2] = origData.data[i+2]
            }
          }
          ctx.putImageData(result, 0, 0)
        } else {
          const result = floodFill(currentData, x, y, fillColor, tolerance)
          ctx.putImageData(result, 0, 0)
        }

        setClickCount(c => c + 1)
        setIsProcessing(false)
      }, 10)
    }, [selectedColor, tolerance, tool, isProcessing])

    function undo() {
      const canvas = canvasRef.current
      if (!canvas || !historyRef.current.length) return
      const ctx = canvas.getContext('2d')!
      futureRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      const prev = historyRef.current.pop()!
      ctx.putImageData(prev, 0, 0)
      setCanUndo(historyRef.current.length > 0)
      setCanRedo(true)
    }

    function redo() {
      const canvas = canvasRef.current
      if (!canvas || !futureRef.current.length) return
      const ctx = canvas.getContext('2d')!
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      const next = futureRef.current.pop()!
      ctx.putImageData(next, 0, 0)
      setCanRedo(futureRef.current.length > 0)
      setCanUndo(true)
    }

    function reset() {
      const canvas = canvasRef.current
      if (!canvas || !originalDataRef.current) return
      saveToHistory()
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(originalDataRef.current, 0, 0)
    }

    function download() {
      const canvas = canvasRef.current
      if (!canvas) return
      const link = document.createElement('a')
      link.download = `pintae-cor-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    useImperativeHandle(ref, () => ({
      getResult: () => canvasRef.current?.toDataURL('image/jpeg', 0.92) || null,
      reset,
    }))

    return (
      <div className="flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTool('paint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'paint' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Paintbrush className="w-3.5 h-3.5" /> Pintar
            </button>
            <button onClick={() => setTool('eraser')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tool === 'eraser' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Eraser className="w-3.5 h-3.5" /> Apagar
            </button>
          </div>

          <div className="flex gap-1">
            <button onClick={undo} disabled={!canUndo}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer transition-colors">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={redo} disabled={!canRedo}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer transition-colors">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={reset}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-red-500 cursor-pointer transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={download}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark cursor-pointer transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {clickCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => onSave?.(canvasRef.current?.toDataURL('image/jpeg', 0.92) || '')}
              className="ml-auto px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-green-600 transition-colors"
            >
              Salvar resultado
            </motion.button>
          )}
        </div>

        {/* Canvas */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="block w-full h-auto"
            style={{
              cursor: tool === 'paint'
                ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='6' fill='${encodeURIComponent(selectedColor)}' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`
                : 'cell',
            }}
          />
          {!imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Faça upload de uma foto para começar
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Clique em qualquer parede para aplicar a cor selecionada · Use o controle deslizante de tolerância para ajustar
        </p>
      </div>
    )
  }
)

WallCanvas.displayName = 'WallCanvas'
