'use client'

import type { SttWord } from '@/types/recording'

interface TranscriptSyncProps {
  text: string
  words: SttWord[] | null
  currentMs: number
  onSeek: (ms: number) => void
}

export function TranscriptSync({ text, words, currentMs, onSeek }: TranscriptSyncProps) {
  if (!text) {
    return (
      <div className="text-sm text-gray-400 text-center py-4">
        음성 변환 텍스트가 없습니다.
      </div>
    )
  }

  // 단어 타임스탬프 없으면 단순 텍스트 표시
  if (!words?.length) {
    return (
      <div className="leading-relaxed text-gray-700 text-base whitespace-pre-wrap bg-white rounded-3xl p-5 shadow-sm">
        {text}
      </div>
    )
  }

  return (
    <div className="leading-relaxed bg-white rounded-3xl p-5 shadow-sm">
      <p className="text-xs text-gray-400 mb-3">단어를 누르면 해당 위치에서 재생됩니다</p>
      <div className="flex flex-wrap gap-x-1 gap-y-2">
        {words.map((w, i) => {
          const isActive = currentMs >= w.start_ms && currentMs < w.end_ms
          return (
            <button
              key={i}
              onClick={() => onSeek(w.start_ms)}
              className={`
                text-base rounded px-0.5 transition-colors
                ${isActive
                  ? 'bg-yellow-200 text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {w.word}
            </button>
          )
        })}
      </div>
    </div>
  )
}
