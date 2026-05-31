import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1+$/.test(clean)) return false // todos iguais

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(clean[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(clean[10])
}

function formatCPFMask(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11)
  return clean
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export { validateCPF, formatCPFMask }

export function useCPF() {
  const { user } = useAuth()
  const [hasCPF, setHasCPF] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('users').select('cpf').eq('id', user.id).single()
      .then(({ data }) => {
        setHasCPF(!!data?.cpf)
        setLoading(false)
      })
  }, [user?.id])

  async function saveCPF(cpf: string): Promise<{ ok: boolean; error?: string }> {
    if (!user) return { ok: false, error: 'Não autenticado' }
    const clean = cpf.replace(/\D/g, '')
    if (!validateCPF(clean)) return { ok: false, error: 'CPF inválido. Verifique os dígitos.' }
    const { error } = await supabase.from('users').update({ cpf: clean }).eq('id', user.id)
    if (error) return { ok: false, error: 'Erro ao salvar CPF. Tente novamente.' }
    setHasCPF(true)
    return { ok: true }
  }

  return { hasCPF, loading, saveCPF }
}
