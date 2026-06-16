'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Recorder } from '@/components/recorder/Recorder'
import { PipelineStatus } from '@/components/pipeline/PipelineStatus'
import { usePipeline } from '@/components/pipeline/usePipeline'
import { Button } from '@/components/ui/Button'

function RecordContent() {
  const params = useSearchParams()
  const router = useRouter()
  const questionId = params.get('qid') ?? 'unknown'
  const questionText = params.get('q') ?? '오늘 하루 어떠셨나요?'
  const subStr = params.get('sub') ?? '[]'

  let subQuestions: string[] = []
  try {
    subQuestions = JSON.parse(subStr)
  } catch (e) {
    console.error('보조질문 파싱 에러:', e)
  }

  const [recordingId, setRecordingId] = useState<string | null>(null)
  const { phase, error, run } = usePipeline()

  const handleRecordingDone = (id: string, audioBlob: Blob) => {
    setRecordingId(id)
    run(id, audioBlob)
  }

  return (
    <div className="flex flex-col min-h-screen px-5 py-8 gap-6">
      {/* 헤더 (뒤로가기 + 타이틀) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1"
          aria-label="이전으로"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">녹음하기</h1>
      </div>

      {/* 질문 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border-l-4 border-brand">
        <p className="text-xs text-gray-400 mb-1">오늘의 질문</p>
        <p className="text-xl font-semibold text-gray-800 leading-snug">{questionText}</p>
      </div>

      {/* 답변 도우미 (보조 질문) */}
      {!recordingId && subQuestions.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-3xl p-6 shadow-sm animate-fade-in">
          <p className="text-xs font-bold text-brand mb-3 flex items-center gap-1">
            <span>💡</span>
            <span>답변 도우미</span>
          </p>
          <ul className="flex flex-col gap-2.5">
            {subQuestions.map((sub, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-brand/60 font-semibold">•</span>
                <span className="leading-relaxed">{sub}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 녹음 or 파이프라인 */}
      {!recordingId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 py-4">
          <Recorder
            questionId={questionId}
            questionText={questionText}
            onDone={handleRecordingDone}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-5">이야기를 만들고 있어요</p>
            <PipelineStatus phase={phase} error={error} />
          </div>

          {phase === 'done' && (
            <Button
              size="lg"
              onClick={() => router.push(`/library/${recordingId}`)}
            >
              내 이야기 보러가기 →
            </Button>
          )}

          {phase === 'error' && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push('/library')}
            >
              내 이야기함으로 가기
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function RecordPage() {
  return (
    <Suspense>
      <RecordContent />
    </Suspense>
  )
}
