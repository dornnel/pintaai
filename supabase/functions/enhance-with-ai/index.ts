import OpenAI from 'npm:openai@4'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { imageBase64 } = await req.json()

    // 1. GPT-4o vision: descrever a cena e cores aplicadas
    const visionResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: 'Describe this interior design scene in English for DALL-E 3. Focus on: room type, furniture style, wall colors applied, lighting, overall aesthetic. Be concise (max 100 words). Start with "Interior design photorealistic render of".',
          },
        ],
      }],
    })

    const description = visionResp.choices[0].message.content?.trim() || 'Interior design photorealistic render of a modern living room with painted walls'

    // 2. DALL-E 3: gerar render fotorrealista
    const imageResp = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `${description}. Professional interior photography, high resolution, natural lighting, photorealistic, architectural visualization, no people, clean composition.`,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })

    const imageUrl = imageResp.data[0]?.url || null

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('enhance-with-ai error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
