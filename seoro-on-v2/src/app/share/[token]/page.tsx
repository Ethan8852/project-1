import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { getCardImageUrl } from '@/lib/storage'
import type { Recording } from '@/types/recording'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

async function getRecordingByToken(token: string): Promise<Recording | null> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data } = await sb
    .from('recordings')
    .select('*')
    .eq('share_token', token)
    .single()
  return (data as Recording) ?? null
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const rec = await getRecordingByToken(token)

  if (!rec || rec.status !== 'card_done') notFound()

  const cardImageUrl = rec.card_image_path ? getCardImageUrl(rec.card_image_path) : null

  return (
    <div className="flex flex-col min-h-screen px-5 py-8 gap-6">
      {/* 브랜드 헤더 */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-brand">서로ON</h1>
        <p className="text-xs text-gray-400 mt-0.5">우리 가족 이야기</p>
      </div>

      {/* 질문 */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border-l-4 border-brand">
        <p className="text-xs text-gray-400 mb-1">이야기의 시작</p>
        <p className="text-lg font-semibold text-gray-800">{rec.question_text}</p>
      </div>

      {/* 카드 이미지 */}
      {cardImageUrl && (
        <div className="rounded-3xl overflow-hidden shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardImageUrl}
            alt="우리 가족 이야기 일러스트"
            className="w-full"
          />
        </div>
      )}

      {/* 이야기 텍스트 */}
      {rec.story_text && (
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap">
            {rec.story_text}
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="bg-amber-50 rounded-3xl p-6 text-center flex flex-col gap-3">
        <p className="text-gray-700 font-semibold">
          나도 우리 가족의 이야기를 남기고 싶으신가요?
        </p>
        <Link
          href="/"
          className="block bg-brand text-white rounded-2xl py-3 font-semibold hover:bg-brand-dark"
        >
          서로ON 시작하기
        </Link>
      </div>
    </div>
  )
}
