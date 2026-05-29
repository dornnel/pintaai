import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Running in demo mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  { db: { schema: 'pintae' } },
)

export async function uploadMedia(file: File, sessionId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `requests/${sessionId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('pintae-media').upload(path, file, { upsert: false })
  if (error) return null
  const { data } = supabase.storage.from('pintae-media').getPublicUrl(path)
  return data.publicUrl
}
