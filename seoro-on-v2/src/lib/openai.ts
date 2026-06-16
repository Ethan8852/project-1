import OpenAI, { toFile } from 'openai'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
  return _client
}

export async function whisperSTT(
  audioBuffer: ArrayBuffer,
  fileName = 'audio.webm',
): Promise<{ text: string; words: { word: string; start_ms: number; end_ms: number }[] }> {
  const file = await toFile(Buffer.from(audioBuffer), fileName, { type: 'audio/webm' })
  const res = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  })

  const text = res.text ?? ''
  const words = (res.words ?? []).map((w: any) => ({
    word: w.word,
    start_ms: Math.round(w.start * 1000),
    end_ms: Math.round(w.end * 1000),
  }))

  return { text, words }
}

export async function generateStory(
  questionText: string,
  sttText: string,
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          '어르신의 구술 내용을 바탕으로 따뜻하고 문학적인 단편 이야기로 만들어 주세요. 원문 내용을 충실히 반영하고, 3~5문단, 경어체로 작성합니다. 제목은 넣지 마세요.',
      },
      {
        role: 'user',
        content: `질문: ${questionText}\n\n구술 내용:\n${sttText}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 800,
  })
  return res.choices[0].message.content ?? ''
}

export async function extractScene(storyText: string): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a visual scene extractor for a Korean family memoir illustration service. Extract one vivid, paintable scene from the given Korean story text. Output exactly ONE English sentence describing: who (1-2 people), where (Korean setting with era hint if possible), what they are doing, and the lighting/season. Do NOT include any text, letters, numbers, or words to be shown in the illustration. Do NOT include any explanation — output the scene sentence only.',
      },
      { role: 'user', content: storyText },
    ],
    temperature: 0.5,
    max_tokens: 120,
  })
  return res.choices[0].message.content?.trim() ?? ''
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const res = await getClient().images.generate({
      model: 'gpt-image-2',
      prompt: prompt,
      size: '1792x1024',
      n: 1,
    })
    const b64 = res.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI 이미지 Base64 데이터 없음')
    return b64
  } catch (err: any) {
    console.error('[openai generateImage 에러 디테일]:', err)
    const status = err.status ?? err.statusCode ?? 'unknown'
    const code = err.code ?? 'none'
    const type = err.type ?? 'none'
    const message = err.message ?? String(err)
    throw new Error(`[GPT-Image-2 에러] status:${status}, code:${code}, type:${type}, msg:${message}`)
  }
}
