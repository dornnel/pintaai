import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { db: { schema: 'pintae' } },
)
const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Admin config: AI_PROVIDER = 'replicate' | 'fal' | 'mock'
const AI_PROVIDER = Deno.env.get('AI_PROVIDER') ?? 'mock'
const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')
const FAL_API_KEY = Deno.env.get('FAL_API_KEY')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callReplicate(imageBase64: string, prompt: string): Promise<string> {
  // Stable Diffusion img2img via Replicate
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 'a9758cbfbd5f3c2094457d996681af52552901e5b2f08fc2b6f746fc36e09d56', // stable-diffusion img2img
      input: {
        prompt: `${prompt}, professional interior painting, photorealistic, high quality`,
        image: `data:image/jpeg;base64,${imageBase64}`,
        strength: 0.55,
        num_inference_steps: 30,
      },
    }),
  })
  const pred = await res.json()
  if (!pred.id) throw new Error('Replicate prediction failed')

  // Poll for result (up to 60s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
    })
    const result = await poll.json()
    if (result.status === 'succeeded') return result.output[0]
    if (result.status === 'failed') throw new Error('Replicate prediction failed')
  }
  throw new Error('Timeout')
}

async function callFal(imageBase64: string, prompt: string): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/fast-sdxl/image-to-image', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${prompt}, professional interior painting, photorealistic`,
      image_url: `data:image/jpeg;base64,${imageBase64}`,
      strength: 0.55,
    }),
  })
  const data = await res.json()
  if (!data.images?.[0]?.url) throw new Error('fal.ai returned no image')
  return data.images[0].url
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const { data: { user: caller } } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!caller) throw new Error('Unauthorized')

    const { data: profile } = await sb.from('users').select('id, is_club_member, club_credits').eq('auth_user_id', caller.id).maybeSingle()
    if (!profile) throw new Error('User not found')
    if (!profile.is_club_member) throw new Error('Clube membership required')
    if (profile.club_credits < 1) throw new Error('Sem créditos disponíveis')

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const prompt = formData.get('prompt') as string | null
    if (!imageFile || !prompt) throw new Error('image and prompt are required')

    // Deduct credit first to prevent double-spend
    await sb.from('users').update({ club_credits: profile.club_credits - 1 }).eq('id', profile.id)

    let resultUrl: string

    if (AI_PROVIDER === 'replicate' && REPLICATE_API_TOKEN) {
      const arrayBuf = await imageFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))
      resultUrl = await callReplicate(base64, prompt)
    } else if (AI_PROVIDER === 'fal' && FAL_API_KEY) {
      const arrayBuf = await imageFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))
      resultUrl = await callFal(base64, prompt)
    } else {
      // Mock: return a placeholder Unsplash image after 2s delay
      await new Promise(r => setTimeout(r, 2000))
      resultUrl = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'
    }

    return new Response(JSON.stringify({ ok: true, image_url: resultUrl, credits_remaining: profile.club_credits - 1 }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg === 'Unauthorized' ? 401 : msg.includes('required') ? 403 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
