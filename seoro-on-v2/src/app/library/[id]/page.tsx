'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getAudioUrl, getCardImageUrl } from '@/lib/storage'
import type { Recording } from '@/types/recording'
import { AudioPlayer } from '@/components/player/AudioPlayer'
import { StoryCard } from '@/components/card/StoryCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type RegenState = 'idle' | 'loading' | 'done'

export default function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [rec, setRec] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMs, setCurrentMs] = useState(0)
  const seekRef = useRef<((ms: number) => void) | null>(null)

  const [cardRegen, setCardRegen] = useState<RegenState>('idle')
  const [regenError, setRegenError] = useState<string | null>(null)

  const fetchRec = async () => {
    const { data } = await supabase.from('recordings').select('*').eq('id', id).single()
    setRec(data as Recording)
    setLoading(false)
  }

  useEffect(() => { fetchRec() }, [id])

  const handleDelete = async () => {
    if (!confirm('이 이야기를 삭제할까요?')) return
    try {
      // 1. Storage 오디오 삭제 시도 (개별 에러 방지)
      if (rec?.audio_path) {
        try {
          const { error: audioErr } = await supabase.storage.from('audio').remove([rec.audio_path])
          if (audioErr) console.warn('오디오 파일 삭제 실패:', audioErr.message)
        } catch (err) {
          console.error('오디오 파일 삭제 중 예외:', err)
        }
      }
      // 2. Storage 이미지 카드 삭제 시도 (개별 에러 방지)
      if (rec?.card_image_path) {
        try {
          const { error: imgErr } = await supabase.storage.from('card-images').remove([rec.card_image_path])
          if (imgErr) console.warn('이미지 파일 삭제 실패:', imgErr.message)
        } catch (err) {
          console.error('이미지 파일 삭제 중 예외:', err)
        }
      }
      // 3. DB recordings 테이블 레코드 삭제
      const { error: deleteErr } = await supabase.from('recordings').delete().eq('id', id)
      if (deleteErr) {
        throw new Error(`DB 삭제 실패: ${deleteErr.message}`)
      }
      alert('이야기가 삭제되었습니다.')
      router.push('/library')
    } catch (err: any) {
      console.error('삭제 과정 중 오류:', err)
      alert(`삭제를 처리하지 못했습니다: ${err?.message || err}`)
    }
  }

  const regenCard = async (forceRegen = false) => {
    setCardRegen('loading')
    setRegenError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('process-pipeline', {
        body: { recordingId: id, action: 'cardnews', forceRegen }
      })
      if (invokeErr || (data && data.error)) {
        throw new Error(invokeErr?.message || data?.error || '일러스트 카드 생성에 실패했습니다.')
      }
      setCardRegen('done')
      await fetchRec()
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : String(err))
      setCardRegen('idle')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={32} /></div>
  }

  if (!rec) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">이야기를 찾을 수 없습니다.</p>
        <Link href="/library" className="text-brand hover:underline">← 이야기함으로</Link>
      </div>
    )
  }

  const audioUrl = getAudioUrl(rec.audio_path)
  const cardImageUrl = rec.card_image_path ? getCardImageUrl(rec.card_image_path) : null

  return (
    <div className="flex flex-col px-5 py-6 gap-6 pb-16">
      {/* 질문 + 삭제 */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900 flex-1">{rec.question_text}</h1>
        <button
          onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-full px-3 py-1.5 flex-shrink-0"
        >
          삭제
        </button>
      </div>

      {regenError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3">
          {regenError}
        </div>
      )}

      {/* 오디오 플레이어 */}
      <section>
        <SectionHeader label="🎙️ 녹음" />
        <AudioPlayer
          audioUrl={audioUrl}
          fallbackDurationSec={rec.duration_sec ?? undefined}
          onCurrentMs={setCurrentMs}
          onSeekRef={seekRef}
        />
      </section>

      {/* 카드뉴스 */}
      <section>
        <SectionHeader
          label="🖼️ 일러스트 카드"
          regenState={cardRegen}
          onRegen={() => regenCard(true)}
        />
        {cardImageUrl && rec.story_text ? (
          <StoryCard
            imageUrl={cardImageUrl}
            storyText={rec.story_text}
            recordingId={rec.id}
            shareToken={rec.share_token}
          />
        ) : cardRegen === 'loading' ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
            <LoadingSpinner size={36} />
            <div className="flex flex-col gap-1">
              <p className="text-gray-700 font-semibold">일러스트를 그리고 있어요...</p>
              <p className="text-xs text-gray-400">보통 20초 정도 걸려요. 잠시만 기다려 주세요.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center gap-4 text-center animate-fade-in">
            <p className="text-gray-500 text-sm">
              {regenError ? '이미지 생성에 실패했어요. 다시 시도해 주세요.' : '아직 등록된 일러스트 카드가 없어요.'}
            </p>
            <button
              onClick={() => regenCard(false)}
              className="px-6 py-2.5 bg-brand text-white font-semibold rounded-2xl shadow-sm hover:bg-brand-dark active:scale-95 transition-all text-sm"
            >
              {regenError ? '↻ 다시 그리기' : '🎨 일러스트 카드 만들기'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function SectionHeader({
  label,
  regenState,
  onRegen,
}: {
  label: string
  regenState?: RegenState
  onRegen?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-sm font-semibold text-gray-500">{label}</span>
      {onRegen && (
        <button
          onClick={onRegen}
          disabled={regenState === 'loading'}
          className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark disabled:opacity-50"
        >
          {regenState === 'loading' ? (
            <><LoadingSpinner size={12} /> 생성 중...</>
          ) : (
            '↻ 재생성'
          )}
        </button>
      )}
    </div>
  )
}
