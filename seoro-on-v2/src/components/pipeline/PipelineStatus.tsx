'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { PipelinePhase } from './usePipeline'

const STEPS: { phase: PipelinePhase; label: string; hint: string }[] = [
  { phase: 'stt', label: '음성 변환', hint: '말씀을 텍스트로 바꾸고 있어요' },
  { phase: 'story', label: '이야기 생성', hint: 'AI가 이야기를 쓰고 있어요' },
  { phase: 'card', label: '그림 제작', hint: '일러스트를 그리고 있어요 (~20초)' },
]

const ORDER: PipelinePhase[] = ['idle', 'stt', 'story', 'card', 'done', 'error']

const WAITING_MESSAGES = [
  "들려주신 소중한 이야기가 따뜻한 기록으로 바뀌고 있어요 ✨",
  "이야기 속 분위기에 꼭 맞는 예쁜 일러스트를 스케치하는 중이에요 🎨",
  "세상에 단 하나뿐인 우리 가족의 동화책이 완성되고 있답니다 📖",
  "잠시 편안한 마음으로 차 한 잔 마시며 기다려 주세요 ☕",
  "도란도란 나누었던 오늘의 대화가 영원한 추억으로 저장되고 있어요 💖",
  "어떤 예쁜 그림과 글씨가 탄생할지 정말 설레네요 🌟",
  "따뜻한 추억 한 조각을 모아 예쁘게 다듬고 있어요 🧸",
]

function getStepState(
  stepPhase: PipelinePhase,
  current: PipelinePhase,
): 'waiting' | 'processing' | 'done' {
  const ci = ORDER.indexOf(current)
  const si = ORDER.indexOf(stepPhase)
  if (ci > si) return 'done'
  if (ci === si) return 'processing'
  return 'waiting'
}

export function PipelineStatus({
  phase,
  error,
}: {
  phase: PipelinePhase
  error: string | null
}) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    if (phase === 'done' || phase === 'error' || phase === 'idle') return

    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % WAITING_MESSAGES.length)
        setFade(true)
      }, 500)
    }, 4500)

    return () => clearInterval(interval)
  }, [phase])

  // 현재 phase에 맞는 큰 이모지와 애니메이션 스타일 정의
  const getPhaseAssets = () => {
    switch (phase) {
      case 'stt':
        return { emoji: '🎙️', color: 'from-amber-400 to-orange-400', pulseColor: 'rgba(245, 158, 11, 0.4)' }
      case 'story':
        return { emoji: '✍️', color: 'from-blue-400 to-indigo-500', pulseColor: 'rgba(59, 130, 246, 0.4)' }
      case 'card':
        return { emoji: '🎨', color: 'from-pink-400 to-rose-500', pulseColor: 'rgba(244, 63, 94, 0.4)' }
      default:
        return { emoji: '✨', color: 'from-brand to-brand-dark', pulseColor: 'rgba(255, 107, 107, 0.4)' }
    }
  }

  const assets = getPhaseAssets()
  const isProcessing = phase === 'stt' || phase === 'story' || phase === 'card'

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 지루함 방지용 대형 애니메이션 로더 영역 */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-b from-gray-50/50 to-white rounded-3xl border border-gray-100/80 shadow-sm relative overflow-hidden">
          {/* 아기자기한 배경용 일러스트/도형 (은은한 회전 및 반짝임 효과) */}
          <div className="absolute top-2 left-6 text-gray-200 text-xl opacity-30 select-none">⭐</div>
          <div className="absolute bottom-6 right-8 text-gray-200 text-2xl opacity-25 select-none">✨</div>
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-100/40 rounded-full blur-2xl pointer-events-none" />

          {/* 중앙 애니메이션 서클 */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-6">
            {/* 동심원 파형 효과 */}
            <div 
              className="absolute w-full h-full rounded-full animate-custom-pulse-1" 
              style={{ border: `2px solid ${assets.pulseColor}` }}
            />
            <div 
              className="absolute w-full h-full rounded-full animate-custom-pulse-2" 
              style={{ border: `2px solid ${assets.pulseColor}` }}
            />
            
            {/* 은은하게 회전하는 점선 테두리 */}
            <div className="absolute w-[88%] h-[88%] rounded-full border border-dashed border-gray-300 animate-rotate-slow" />

            {/* 실제 움직이는 메인 구체 */}
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${assets.color} flex items-center justify-center shadow-lg shadow-brand/10 animate-float z-10`}>
              <span className="text-3xl filter drop-shadow-md select-none">{assets.emoji}</span>
            </div>
          </div>

          {/* 실시간 감성 글귀 영역 */}
          <div className="min-h-[48px] flex items-center justify-center text-center px-4 max-w-[280px]">
            <p 
              className={`text-sm font-medium text-gray-600 leading-relaxed transition-all duration-500 transform ${
                fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              }`}
            >
              {WAITING_MESSAGES[msgIndex]}
            </p>
          </div>
        </div>
      )}

      {/* 상태 파이프라인 단계별 표시 */}
      <div className="flex flex-col gap-4 mt-2">
        {STEPS.map((step) => {
          const s = getStepState(step.phase, phase)
          return (
            <div key={step.phase} className="flex items-center gap-4 transition-all duration-300">
              <div className="w-8 h-8 flex items-center justify-center">
                {s === 'done' && (
                  <span className="text-green-500 text-xl font-bold">✓</span>
                )}
                {s === 'processing' && (
                  <span className="text-brand">
                    <LoadingSpinner size={22} />
                  </span>
                )}
                {s === 'waiting' && (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-200 block" />
                )}
              </div>
              <div className="flex flex-col">
                <p
                  className={`font-semibold text-sm ${
                    s === 'done'
                      ? 'text-green-600'
                      : s === 'processing'
                      ? 'text-brand'
                      : 'text-gray-300'
                  }`}
                >
                  {step.label}
                </p>
                {s === 'processing' && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.hint}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100 mt-2 animate-fade-in">
          ❌ 오류가 발생했습니다: {error}
        </div>
      )}
    </div>
  )
}
