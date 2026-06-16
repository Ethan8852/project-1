export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { QuestionCard } from '@/components/ui/QuestionCard'

interface Question {
  id: number
  part_name: string
  main_question: string
  sub_questions: string[]
}

async function getQuestions() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { error: `환경 변수가 정의되지 않았습니다. URL=${url ? '존재' : '누락'}, KEY=${key ? '존재' : '누락'}` }
  }

  try {
    const sb = createClient(url, key)
    const { data, error } = await sb.from('questions').select('*')
    if (error) {
      return { error: `Supabase 조회 실패: ${error.message} (코드: ${error.code})` }
    }
    const shuffled = [...(data ?? [])].sort(() => 0.5 - Math.random())
    return { data: shuffled.slice(0, 4) as Question[] }
  } catch (err: any) {
    return { error: `예외 발생: ${err?.message || String(err)}` }
  }
}

const getPartColor = (partName: string) => {
  if (partName.includes('1부')) return '#10B981' // Green
  if (partName.includes('2부')) return '#3B82F6' // Blue
  if (partName.includes('3부')) return '#F59E0B' // Amber
  if (partName.includes('4부')) return '#EF4444' // Red
  return '#E0903C' // Brand
}

export default async function HomePage() {
  const result = await getQuestions()

  return (
    <div className="flex flex-col min-h-screen px-5 py-8 gap-8">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">오늘 어떤 이야기를 들려주실까요?</h2>
      </div>

      {/* 질문 목록 */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-700">질문을 선택하세요</h2>
        
        {'error' in result ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-sm text-red-600 font-mono whitespace-pre-wrap leading-relaxed">
            <p className="font-bold mb-1">⚠️ 오류가 발생했습니다:</p>
            {result.error}
          </div>
        ) : result.data.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            질문 데이터가 없습니다.
          </p>
        ) : (
          result.data.map((q) => {
            const color = getPartColor(q.part_name || '')
            const subStr = q.sub_questions ? JSON.stringify(q.sub_questions) : '[]'
            return (
              <Link
                key={q.id}
                href={`/record?qid=${q.id}&q=${encodeURIComponent(q.main_question)}&sub=${encodeURIComponent(subStr)}`}
              >
                <QuestionCard
                  partName={q.part_name}
                  question={q.main_question}
                  color={color}
                />
              </Link>
            )
          })
        )}
      </div>

      {/* 새로고침 */}
      <a
        href="/"
        className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2 block"
      >
        ↻ 다른 질문 보기
      </a>
    </div>
  )
}
