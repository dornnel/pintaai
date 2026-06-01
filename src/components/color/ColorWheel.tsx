import { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  size?: number
  value: string
  onChange: (hex: string) => void
}

// ─── Color conversion utils ───────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

// ─── Draw clean HSL wheel ─────────────────────────────────────────────────────

function drawWheel(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displaySize = canvas.width / dpr
  const ctx = canvas.getContext('2d')!
  const cw = canvas.width, ch = canvas.height
  const cxp = cw / 2, cyp = ch / 2
  const maxR = (displaySize / 2 - 2) * dpr

  // Render smooth HSL wheel pixel-by-pixel
  const imageData = ctx.createImageData(cw, ch)
  const data = imageData.data

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const dx = x - cxp, dy = y - cyp
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > maxR) continue

      const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360
      const sat = Math.min((dist / maxR) * 100, 100)
      const [r, g, b] = hslToRgb(hue, sat, 50)

      const i = (y * cw + x) * 4
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)

  // White center glow (soft center fade)
  const glow = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, maxR * 0.22)
  glow.addColorStop(0, 'rgba(255,255,255,0.92)')
  glow.addColorStop(0.7, 'rgba(255,255,255,0.2)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cxp, cyp, maxR * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ColorWheel({ size = 240, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    drawWheel(canvas)
  }, [size])

  const getColorAt = useCallback((clientX: number, clientY: number): string => {
    const canvas = canvasRef.current
    if (!canvas) return value
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.round((clientY - rect.top) * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')!
    const pixel = ctx.getImageData(
      Math.max(0, Math.min(x, canvas.width - 1)),
      Math.max(0, Math.min(y, canvas.height - 1)),
      1, 1
    ).data
    if (pixel[3] === 0) return value
    return rgbToHex(pixel[0], pixel[1], pixel[2])
  }, [value])

  function handlePointer(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const cx = rect.width / 2, cy = rect.height / 2
    if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) > cx) return
    if (isDragging || e.type === 'pointerdown' || e.buttons === 1) {
      const color = getColorAt(e.clientX, e.clientY)
      if (color !== '#000000') onChange(color)
    }
  }

  // Compute indicator position from current hex value
  const getPointerPos = (): { x: number; y: number } | null => {
    if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) return null
    const [h, s] = hexToHsl(value)
    const rad = (h * Math.PI) / 180
    const r = (s / 100) * (size / 2 - 6)
    return { x: size / 2 + r * Math.cos(rad), y: size / 2 + r * Math.sin(rad) }
  }

  const pointer = getPointerPos()

  return (
    <div className="relative inline-block select-none" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => { setIsDragging(true); e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e) }}
        onPointerMove={handlePointer}
        onPointerUp={() => setIsDragging(false)}
        onPointerLeave={() => setIsDragging(false)}
        className="rounded-full cursor-crosshair block"
        style={{
          boxShadow: [
            '0 4px 16px rgba(0,0,0,0.15)',
            '0 12px 40px rgba(0,0,0,0.12)',
            '0 0 0 3px rgba(255,255,255,0.95)',
            '0 0 0 4px rgba(0,0,0,0.06)',
          ].join(', '),
        }}
      />

      {/* 3D sphere gloss highlight */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 36% 26%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 45%, transparent 68%)',
        }}
      />

      {/* Selected color indicator */}
      {pointer && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-10"
          style={{
            left: pointer.x, top: pointer.y,
            width: 18, height: 18,
            backgroundColor: value,
            border: '2.5px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.15)',
          }}
        />
      )}
    </div>
  )
}

// ─── Paint presets (expanded — 40 colors) ────────────────────────────────────

export const PAINT_PRESETS = [
  // Whites & off-whites
  { hex: '#FFFFFF', name: 'Branco puro' },
  { hex: '#FFF8F0', name: 'Branco gelo' },
  { hex: '#F5F0E8', name: 'Off-white' },
  { hex: '#EDE8DC', name: 'Areia clara' },
  { hex: '#E5DDD0', name: 'Linho' },
  { hex: '#D9D0C4', name: 'Palha' },
  // Warm neutrals
  { hex: '#D4B896', name: 'Bege' },
  { hex: '#C4A882', name: 'Caramelo' },
  { hex: '#B08060', name: 'Canela' },
  { hex: '#C07040', name: 'Terracota' },
  { hex: '#E35A1A', name: 'Laranja Pintai' },
  { hex: '#E8A020', name: 'Mostarda' },
  // Blues
  { hex: '#B8D4E8', name: 'Azul bebê' },
  { hex: '#7BA7C7', name: 'Azul claro' },
  { hex: '#4A90D9', name: 'Azul céu' },
  { hex: '#2E6DA4', name: 'Azul profundo' },
  { hex: '#1A4480', name: 'Azul naval' },
  { hex: '#0D2B55', name: 'Azul marinho' },
  // Greens
  { hex: '#C8DCC0', name: 'Verde menta' },
  { hex: '#8CB88C', name: 'Verde sálvia' },
  { hex: '#5BA664', name: 'Verde médio' },
  { hex: '#3D7A44', name: 'Verde floresta' },
  { hex: '#4A6741', name: 'Verde musgo' },
  { hex: '#2D5016', name: 'Verde escuro' },
  // Grays
  { hex: '#E8E8E8', name: 'Cinza clarinho' },
  { hex: '#C8C8C8', name: 'Cinza claro' },
  { hex: '#A0A0A0', name: 'Cinza prata' },
  { hex: '#6B6B6B', name: 'Cinza médio' },
  { hex: '#404040', name: 'Cinza escuro' },
  { hex: '#2C2C2C', name: 'Grafite' },
  // Purples & pinks
  { hex: '#D4B8D0', name: 'Lavanda' },
  { hex: '#B08CB0', name: 'Lilás' },
  { hex: '#8B4B8B', name: 'Roxo' },
  { hex: '#F4C8C8', name: 'Rosa bebê' },
  { hex: '#E89090', name: 'Rosa' },
  { hex: '#C84B4B', name: 'Vermelho' },
  // Special
  { hex: '#F0E080', name: 'Amarelo palha' },
  { hex: '#F4C842', name: 'Amarelo' },
  { hex: '#4A6741', name: 'Caqui' },
  { hex: '#8B6914', name: 'Bronze' },
]

// ─── Pantone colors (interior design) ────────────────────────────────────────

export const PANTONE_COLORS = [
  // Color of the Year
  { hex: '#0F4C81', name: 'Classic Blue', code: '19-4052', year: '2020' },
  { hex: '#939597', name: 'Ultimate Gray', code: '17-5104', year: '2021' },
  { hex: '#F5DF4D', name: 'Illuminating', code: '13-0647', year: '2021' },
  { hex: '#6667AB', name: 'Very Peri', code: '17-3938', year: '2022' },
  { hex: '#BE3455', name: 'Viva Magenta', code: '18-1750', year: '2023' },
  { hex: '#FFBE98', name: 'Peach Fuzz', code: '13-1023', year: '2024' },
  // Interior classics
  { hex: '#009B77', name: 'Emerald', code: '17-0145', year: '2013' },
  { hex: '#B163A3', name: 'Radiant Orchid', code: '18-3224', year: '2014' },
  { hex: '#955251', name: 'Marsala', code: '18-1438', year: '2015' },
  { hex: '#92A8D1', name: 'Serenity', code: '15-3817', year: '2016' },
  { hex: '#F7CAC9', name: 'Rose Quartz', code: '13-1520', year: '2016' },
  { hex: '#88B04B', name: 'Greenery', code: '15-0343', year: '2017' },
  { hex: '#5F4B8B', name: 'Ultra Violet', code: '18-3838', year: '2018' },
  { hex: '#FF6F61', name: 'Living Coral', code: '16-1546', year: '2019' },
  // Popular interior Pantones
  { hex: '#45B5AA', name: 'Turquoise', code: '15-5519' },
  { hex: '#D94F70', name: 'Honeysuckle', code: '18-2120' },
  { hex: '#DECDBE', name: 'Sand Dollar', code: '13-1106' },
  { hex: '#EDADA8', name: 'Pale Dogwood', code: '13-1510' },
  { hex: '#4E82AA', name: 'Marina', code: '17-4041' },
  { hex: '#A097A3', name: 'Lilac Gray', code: '17-3911' },
  { hex: '#7BB5A0', name: 'Aqua Haze', code: '15-5210' },
  { hex: '#C9A96E', name: 'Warm Sand', code: '14-1118' },
  { hex: '#8DB5C8', name: 'Cerulean', code: '15-4020' },
  { hex: '#A3B18A', name: 'Sage', code: '16-0430' },
  { hex: '#D4856A', name: 'Dusty Coral', code: '16-1546' },
  { hex: '#C8A77D', name: 'Caramelized', code: '17-1430' },
  { hex: '#6B8F71', name: 'Artichoke', code: '18-0430' },
  { hex: '#3D6B84', name: 'Niagara', code: '18-4528' },
  { hex: '#E8D5B7', name: 'Bleached Sand', code: '13-0905' },
  { hex: '#B07D62', name: 'Adobe', code: '17-1430' },
  { hex: '#8F7BB5', name: 'Violet Tulip', code: '15-3817' },
  { hex: '#E8C4A0', name: 'Apricot Cream', code: '13-1020' },
]
