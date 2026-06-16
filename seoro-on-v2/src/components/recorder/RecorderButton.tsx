'use client'

interface RecorderButtonProps {
  state: 'idle' | 'recording' | 'paused' | 'uploading'
  onClick: () => void
}

export function RecorderButton({ state, onClick }: RecorderButtonProps) {
  const isDisabled = state === 'uploading'

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-label={
        state === 'recording'
          ? '일시 정지'
          : state === 'paused'
          ? '다시 녹음'
          : '녹음 시작'
      }
      className={`
        w-24 h-24 rounded-full flex items-center justify-center
        shadow-lg active:scale-95 transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${state === 'recording'
          ? 'bg-amber-500 hover:bg-amber-600'
          : state === 'paused'
          ? 'bg-brand hover:bg-brand-dark animate-pulse'
          : 'bg-brand hover:bg-brand-dark'
        }
      `}
    >
      {state === 'uploading' ? (
        <svg className="animate-spin w-10 h-10 text-white" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : state === 'recording' ? (
        <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      ) : state === 'paused' ? (
        <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
          <path d="M8 5v14l11-7z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
          <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 1 0 4 0V5a2 2 0 0 0-2-2zm-7 8h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V20h3v2H9v-2h3v-2.08A7 7 0 0 1 5 11z" />
        </svg>
      )}
    </button>
  )
}
