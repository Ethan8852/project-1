'use client';

// ─────────────────────────────────────────────────────────────
// /senior/question — 어르신 질문/녹음 페이지
//
// 역할:
//   1. ?id= 쿼리가 있으면 해당 질문 로드, 없으면 RPC 랜덤 질문
//   2. ?uid= 쿼리로 테스트 userId 수신 (로그인 없는 시험 버전)
//   3. 누적 녹음 횟수 조회
//   4. RecordingFlow 렌더
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import RecordingFlow from '@/components/senior/RecordingFlow';
import type { Question } from '@/types/question';

// ★ question-select/page.tsx 의 TEST_USER_ID 와 동일한 값으로 맞춰놓기
const FALLBACK_USER_ID = '78406665-0141-4ca9-9e71-ceb635815661';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; question: Question; userId: string; totalCount: number }
  | { status: 'error'; message: string };

export default function QuestionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FFFDF5]">
        <div className="h-16 w-16 animate-spin rounded-full border-[8px] border-stone-200 border-t-[#1B6CA8]" />
        <p className="text-[1.8rem] font-semibold text-stone-600">잠깐만 기다려 주세요...</p>
      </div>
    }>
      <QuestionPageInner />
    </Suspense>
  );
}

function QuestionPageInner() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    async function init() {
      const userId = searchParams.get('uid') ?? FALLBACK_USER_ID;
      const questionId = searchParams.get('id');

      // ── 질문 로드 (?id= 있으면 해당 질문, 없으면 랜덤) ──
      let question: Question;

      if (questionId) {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (error || !data) {
          setPage({ status: 'error', message: '질문을 불러오지 못했어요.\n다시 눌러 주세요.' });
          return;
        }
        question = data as Question;
      } else {
        const { data: questions, error: qErr } = await supabase.rpc('get_random_questions');

        if (qErr || !questions || questions.length === 0) {
          setPage({ status: 'error', message: '질문을 불러오지 못했어요.\n다시 눌러 주세요.' });
          return;
        }
        question = questions[0] as Question;
      }

      // ── 누적 녹음 횟수 ───────────────────────────────────────
      const { count } = await supabase
        .from('voice_answers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      setPage({ status: 'ready', question, userId, totalCount: count ?? 0 });
    }

    init();
  }, [searchParams]);

  // ── 로딩 화면 ─────────────────────────────────────────────

  if (page.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FFFDF5]">
        <div className="h-16 w-16 animate-spin rounded-full border-[8px] border-stone-200 border-t-[#1B6CA8]" />
        <p className="text-[1.8rem] font-semibold text-stone-600">
          잠깐만 기다려 주세요...
        </p>
      </div>
    );
  }

  // ── 오류 화면 ─────────────────────────────────────────────

  if (page.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#FFFDF5] px-8">
        <span className="text-[5rem]" role="img" aria-label="오류">😢</span>
        <p className="whitespace-pre-line text-center text-[1.8rem] font-semibold text-stone-700">
          {page.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex h-[80px] w-full max-w-xs items-center justify-center rounded-2xl bg-[#1B6CA8] shadow-md transition-transform active:scale-95"
        >
          <span className="text-[1.8rem] font-bold text-white">다시 시도하기</span>
        </button>
      </div>
    );
  }

  // ── 정상: 녹음 플로우 렌더 ────────────────────────────────

  return (
    <RecordingFlow
      question={page.question}
      userId={page.userId}
      initialTotalCount={page.totalCount}
    />
  );
}
