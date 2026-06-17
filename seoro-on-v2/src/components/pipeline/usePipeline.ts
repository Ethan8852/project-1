'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

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

  const run = useCallback(async (recordingId: string) => {
    setError(null)

    try {
      // 1. STT 변환
      setPhase('stt')
      const { data: sttData, error: sttErr } = await supabase.functions.invoke('process-pipeline', {
        body: { recordingId, action: 'stt' }
      })
      if (sttErr || (sttData && sttData.error)) {
        throw new Error(sttErr?.message || sttData?.error || '음성 텍스트 변환에 실패했습니다.')
      }

      // 2. 스토리 생성
      setPhase('story')
      const { data: storyData, error: storyErr } = await supabase.functions.invoke('process-pipeline', {
        body: { recordingId, action: 'story' }
      })
      if (storyErr || (storyData && storyData.error)) {
        throw new Error(storyErr?.message || storyData?.error || '이야기 작성에 실패했습니다.')
      }

      // 3. 일러스트 카드 생성
      setPhase('card')
      const { data: cardData, error: cardErr } = await supabase.functions.invoke('process-pipeline', {
        body: { recordingId, action: 'cardnews' }
      })
      if (cardErr || (cardData && cardData.error)) {
        throw new Error(cardErr?.message || cardData?.error || '일러스트 카드 생성에 실패했습니다.')
      }

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
