'use client'

import { useCallback, useState } from 'react'

export type PipelinePhase =
  | 'idle'
  | 'stt'
  | 'story'
  | 'card'
  | 'done'
  | 'error'

export function usePipeline() {
  const [phase, setPhase] = useState<PipelinePhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (recordingId: string, audioBlob: Blob) => {
    setError(null)

    const postJson = async (path: string) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `${path} 실패 (${res.status})`)
      return body
    }

    try {
      // STT: 오디오 blob 직접 전송
      setPhase('stt')
      const form = new FormData()
      form.append('audio', audioBlob, 'recording.webm')
      form.append('recordingId', recordingId)

      const sttRes = await fetch('/api/stt', { method: 'POST', body: form })
      const sttBody = await sttRes.json().catch(() => ({}))
      if (!sttRes.ok) throw new Error(sttBody.error ?? `STT 실패 (${sttRes.status})`)
      // warning이 있으면 (STT 실패했지만 다음 단계 진행)
      if (sttBody.warning) console.warn('[pipeline] STT warning:', sttBody.warning)

      setPhase('story')
      await postJson('/api/story')

      setPhase('card')
      await postJson('/api/cardnews')

      setPhase('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[pipeline] FAIL:', msg)
      setError(msg)
      setPhase('error')
    }
  }, [])

  return { phase, error, run }
}
