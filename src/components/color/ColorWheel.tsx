import { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  size?: number
  value: string
  onChange: (hex: string) => void
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

// Convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// Parse hex to rgb

// Draw the HSL color wheel on a canvas
function drawWheel(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const cx = width / 2, cy = height / 2
  const outerR = Math.min(cx, cy) - 2

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > outerR) continue

      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
      // saturation derived from normalizedDist below (center=white) to 1 (edge=pure color)

      // Multiple rings: outer ring is pure saturated, inner rings blend to white/dark
      let r: number, g: number, b: number

      const normalizedDist = dist / outerR

      if (normalizedDist > 0.85) {
        // Outermost thin dark ring
        const darkness = (normalizedDist - 0.85) / 0.15
        const [pr, pg, pb] = hslToRgb(hue, 100, 40)
        r = Math.round(pr * (1 - darkness))
        g = Math.round(pg * (1 - darkness))
        b = Math.round(pb * (1 - darkness))
      } else if (normalizedDist > 0.6) {
        // Pure saturated ring
        const t = (normalizedDist - 0.6) / 0.25
        const [pr, pg, pb] = hslToRgb(hue, 100, 50)
        r = pr; g = pg; b = pb
        // Slight variation at exact boundary
        r = Math.round(r * (0.9 + t * 0.1))
        g = Math.round(g * (0.9 + t * 0.1))
        b = Math.round(b * (0.9 + t * 0.1))
      } else if (normalizedDist > 0.3) {
        // Blend from pure to light
        const t = (normalizedDist - 0.3) / 0.3
        const [pr, pg, pb] = hslToRgb(hue, 100 * t, 50 + (1 - t) * 30)
        r = pr; g = pg; b = pb
      } else {
        // Center: white fading to pastel
        const t = normalizedDist / 0.3
        const [pr, pg, pb] = hslToRgb(hue, t * 50, 95 - t * 30)
        r = pr; g = pg; b = pb
      }

      const i = (y * width + x) * 4
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // Draw concentric ring borders (subtle)
  ctx.globalAlpha = 0.1
  for (const ratio of [0.3, 0.6, 0.85]) {
    ctx.beginPath()
    ctx.arc(cx, cy, outerR * ratio, 0, Math.PI * 2)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export function ColorWheel({ size = 240, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawWheel(canvas)
  }, [size])

  const getColorAt = useCallback((clientX: number, clientY: number): string => {
    const canvas = canvasRef.current
    if (!canvas) return '#ffffff'
    const rect = canvas.getBoundingClientRect()
    const scaleX = size / rect.width
    const scaleY = size / rect.height
    const x = Math.round((clientX - rect.left) * scaleX)
    const y = Math.round((clientY - rect.top) * scaleY)
    const ctx = canvas.getContext('2d')!
    const pixel = ctx.getImageData(Math.max(0, Math.min(x, size - 1)), Math.max(0, Math.min(y, size - 1)), 1, 1).data
    if (pixel[3] === 0) return value
    return rgbToHex(pixel[0], pixel[1], pixel[2])
  }, [size, value])

  function handlePointerMove(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleClick(e: React.MouseEvent) {
    const color = getColorAt(e.clientX, e.clientY)
    if (color !== '#000000') onChange(color)
  }

  function handleLeave() { setCursorPos(null) }

  // Position of current selection indicator

  return (
    <div className="relative inline-block select-none" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onPointerMove={handlePointerMove}
        onPointerLeave={handleLeave}
        onClick={handleClick}
        className="rounded-full cursor-crosshair block shadow-lg"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Cursor preview */}
      {cursorPos && (
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        />
      )}
    </div>
  )
}

// Preset color swatches for common paint colors
export const PAINT_PRESETS = [
  // Whites & off-whites
  { hex: '#FFFFFF', name: 'Branco puro' },
  { hex: '#FFF8F0', name: 'Branco gelo' },
  { hex: '#F5F0E8', name: 'Off-white' },
  { hex: '#EDE8DC', name: 'Areia' },
  // Warm neutrals
  { hex: '#D4B896', name: 'Bege' },
  { hex: '#C4A882', name: 'Caramelo' },
  { hex: '#8B6914', name: 'Terracota' },
  { hex: '#E35A1A', name: 'Laranja Pintai' },
  // Blues & greens
  { hex: '#4A90D9', name: 'Azul céu' },
  { hex: '#2E6DA4', name: 'Azul profundo' },
  { hex: '#5BA664', name: 'Verde sálvia' },
  { hex: '#2D5016', name: 'Verde escuro' },
  // Grays
  { hex: '#B0B0B0', name: 'Cinza claro' },
  { hex: '#6B6B6B', name: 'Cinza médio' },
  { hex: '#2C2C2C', name: 'Grafite' },
  // Special
  { hex: '#8B4B8B', name: 'Lilás' },
  { hex: '#F4C842', name: 'Amarelo' },
  { hex: '#C84B4B', name: 'Vermelho' },
]
