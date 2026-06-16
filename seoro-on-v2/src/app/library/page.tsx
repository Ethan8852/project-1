import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import type { Recording } from '@/types/recording'
import { getCardImageUrl } from '@/lib/storage'

const TEST_USER_ID = process.env.NEXT_PUBLIC_TEST_USER_ID!

async function getRecordings(): Promise<Recording[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data } = await sb
    .from('recordings')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false })

  return (data ?? []) as Recording[]
}

const STATUS_LABEL: Record<string, string> = {
  recorded: '음성 변환 대기',
  stt_processing: '음성 변환 중',
  stt_done: '이야기 생성 대기',
  story_done: '그림 생성 대기',
  card_done: '완료',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const revalidate = 0

export default async function LibraryPage() {
  const recordings = await getRecordings()

  return (
    <div className="flex flex-col min-h-screen px-5 py-8 gap-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">내 이야기함</h2>
        <p className="text-sm text-gray-500 mt-0.5">{recordings.length}개의 이야기</p>
      </div>

      {recordings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <span className="text-5xl">🎙️</span>
          <p className="text-gray-500">아직 녹음한 이야기가 없어요.</p>
          <Link href="/" className="text-brand font-semibold hover:underline">
            첫 이야기 남기기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {recordings.map((rec) => {
            const isDone = rec.status === 'card_done'
            const thumbUrl = rec.card_image_path
              ? getCardImageUrl(rec.card_image_path)
              : null

            return (
              <Link key={rec.id} href={`/library/${rec.id}`}>
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden hover:shadow-md transition-shadow flex gap-4 p-4">
                  {/* 썸네일 */}
                  <div className="w-20 h-20 rounded-2xl bg-amber-50 flex-shrink-0 overflow-hidden">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt="카드 이미지"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {isDone ? '🖼️' : '⏳'}
                      </div>
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                      {rec.question_text}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(rec.created_at)}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                        isDone
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {STATUS_LABEL[rec.status] ?? rec.status}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
