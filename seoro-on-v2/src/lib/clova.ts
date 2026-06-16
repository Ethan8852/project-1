export interface ClovaWord {
  word: string
  start_ms: number
  end_ms: number
}

interface ClovaSegment {
  start: number
  end: number
  text: string
}

interface ClovaLongResponse {
  result: string
  text?: string
  segments?: ClovaSegment[]
}

export async function clovaSTT(
  audioBuffer: ArrayBuffer,
  fileName = 'audio.webm',
): Promise<{ text: string; words: ClovaWord[] }> {
  const invokeUrl = process.env.CLOVA_INVOKE_URL
  const key = process.env.CLOVA_STT_KEY
  if (!invokeUrl || !key) throw new Error('CLOVA_INVOKE_URL 또는 CLOVA_STT_KEY 미설정')

  const paramsObj = {
    language: 'ko-KR',
    completion: 'sync',
    wordAlignment: true,
    fullText: true,
    diarization: { enable: false },
  }

  const form = new FormData()
  form.append(
    'params',
    JSON.stringify(paramsObj),
  )
  form.append('media', new Blob([audioBuffer]), fileName)

  const res = await fetch(`${invokeUrl}/recognizer/upload`, {
    method: 'POST',
    headers: { 'X-CLOVASPEECH-API-KEY': key },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[clovaSTT 에러 디테일]:', {
      status: res.status,
      statusText: res.statusText,
      detail,
      params: paramsObj,
    })
    throw new Error(`Clova ${res.status}: ${detail} (params: ${JSON.stringify(paramsObj)})`)
  }

  const data: ClovaLongResponse = await res.json()

  if (data.result !== 'COMPLETED') {
    throw new Error(`Clova STT 실패: result=${data.result}`)
  }

  const text = data.text ?? ''
  const words: ClovaWord[] = (data.segments ?? []).map((seg) => ({
    word: seg.text,
    start_ms: seg.start,
    end_ms: seg.end,
  }))

  return { text, words }
}

// Short API용 fallback: 단어 타임스탬프가 없을 때 균등 분배
export function estimateWords(text: string, durationMs: number): ClovaWord[] {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  return tokens.map((word, i) => ({
    word,
    start_ms: Math.round((i / tokens.length) * durationMs),
    end_ms: Math.round(((i + 1) / tokens.length) * durationMs),
  }))
}
