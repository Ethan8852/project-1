'use client'

const MAX_SEC = 600

interface RecorderTimerProps {
  sec: number
}

export function RecorderTimer({ sec }: RecorderTimerProps) {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const progress = sec / MAX_SEC

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-4xl font-mono font-bold text-gray-800 tabular-nums">
        {mm}:{ss}
      </span>
      <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">
        최대 {MAX_SEC >= 60 ? `${MAX_SEC / 60}분` : `${MAX_SEC}초`}
      </span>
    </div>
  )
}
