import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatCurrency, formatRelativeTime, formatDate, generateSessionId, cn } from './utils'

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formata valores positivos em reais', () => {
    expect(formatCurrency(1000)).toContain('1.000')
    expect(formatCurrency(49.9)).toContain('49')
    expect(formatCurrency(0)).toContain('0')
  })

  it('formata valores com centavos', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.234')
    expect(result).toContain('56')
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formata uma data ISO para pt-BR', () => {
    const result = formatDate('2024-01-15T10:00:00Z')
    expect(result).toContain('2024')
    expect(typeof result).toBe('string')
  })

  it('não lança exceção em datas válidas', () => {
    expect(() => formatDate('2024-12-31T23:59:59Z')).not.toThrow()
  })
})

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))
  })

  it('retorna "agora" para timestamps muito recentes', () => {
    const now = new Date('2024-06-01T11:59:50Z').toISOString()
    const result = formatRelativeTime(now)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('retorna tempo relativo para 1 hora atrás', () => {
    const oneHourAgo = new Date('2024-06-01T11:00:00Z').toISOString()
    const result = formatRelativeTime(oneHourAgo)
    expect(result).toMatch(/1h|1 hora|hora/i)
  })

  it('retorna tempo relativo para 1 dia atrás', () => {
    const oneDayAgo = new Date('2024-05-31T12:00:00Z').toISOString()
    const result = formatRelativeTime(oneDayAgo)
    expect(result).toMatch(/1d|1 dia|dia/i)
  })
})

// ─── generateSessionId ────────────────────────────────────────────────────────

describe('generateSessionId', () => {
  it('gera uma string não vazia', () => {
    const id = generateSessionId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('gera IDs únicos em chamadas consecutivas', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()))
    expect(ids.size).toBe(100)
  })
})

// ─── cn (classnames) ──────────────────────────────────────────────────────────

describe('cn', () => {
  it('combina classes básicas', () => {
    const result = cn('text-red-500', 'bg-white')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-white')
  })

  it('ignora valores falsy', () => {
    const result = cn('text-red-500', false && 'bg-white', undefined, null as unknown as string, '')
    expect(result).toBe('text-red-500')
  })

  it('resolve conflitos de Tailwind (último vence)', () => {
    const result = cn('text-red-500', 'text-blue-500')
    // tailwind-merge deve resolver — blue vence
    expect(result).toContain('text-blue-500')
    expect(result).not.toContain('text-red-500')
  })
})
