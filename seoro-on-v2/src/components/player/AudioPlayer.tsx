'use client'

import { useState } from 'react'
import { useAudioSync } from './useAudioSync'

interface AudioPlayerProps {
  audioUrl: string
  fallbackDurationSec?: number   // DB의 duration_sec (메타데이터 로드 전 fallback)
  onCurrentMs?: (ms: number) => void
  onSeekRef?: React.MutableRefObject<((ms: number) => void) | null>
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const RATES = [0.75, 1, 1.25, 1.5]

export function AudioPlayer({ audioUrl, fallbackDurationSec, onCurrentMs, onSeekRef }: AudioPlayerProps) {
  const { audioRef, currentMs, isPlaying, duration, onTimeUpdate, onLoadedMetadata, onEnded, togglePlay, seek, setRate } =
    useAudioSync()

  // webm은 Infinity로 잡히는 경우 있음 → isFinite 체크 후 fallback 사용
  const displayDuration = (isFinite(duration) && duration > 0) ? duration : (fallbackDurationSec ?? 0)
  const [rate, setRateState] = useState(1)

  // 외부(TranscriptSync)에서 seek 호출할 수 있도록 ref 등록
  if (onSeekRef) onSeekRef.current = seek

  const handleTimeUpdate = () => {
    onTimeUpdate()
    onCurrentMs?.(Math.round((audioRef.current?.currentTime ?? 0) * 1000))
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value) * 1000)
  }

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRateState(next)
    setRate(next)
  }

  const currentSec = currentMs / 1000

  return (
    <div className="w-full bg-white rounded-3xl p-5 shadow-sm flex flex-col gap-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />

      {/* 프로그레스 바 */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 tabular-nums w-8">{fmt(currentSec)}</span>
        <input
          type="range"
          min={0}
          max={displayDuration || 1}
          step={0.1}
          value={currentSec}
          onChange={handleScrub}
          className="flex-1 accent-brand h-1.5 rounded-full cursor-pointer"
        />
        <span className="text-xs text-gray-400 tabular-nums w-8">{fmt(displayDuration)}</span>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-between">
        <button
          onClick={cycleRate}
          className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-3 py-1 hover:bg-gray-200"
        >
          {rate}×
        </button>

        <button
          onClick={togglePlay}
          className="w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center shadow hover:bg-brand-dark active:scale-95"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="w-16" />
      </div>
    </div>
  )
}
