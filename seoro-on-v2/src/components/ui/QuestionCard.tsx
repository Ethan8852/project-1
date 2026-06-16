'use client'

interface QuestionCardProps {
  partName?: string
  question: string
  color?: string
  onClick?: () => void
}

export function QuestionCard({ partName, question, color = '#F97316', onClick }: QuestionCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-3xl p-6 bg-white shadow-md hover:shadow-lg active:scale-98 transition-all border-l-4 min-h-[100px] flex flex-col justify-center gap-1.5"
      style={{ borderColor: color }}
    >
      {partName && (
        <span className="text-xs font-semibold text-gray-400">
          {partName}
        </span>
      )}
      <span className="text-base font-bold text-gray-800 leading-snug">
        {question}
      </span>
    </button>
  )
}
