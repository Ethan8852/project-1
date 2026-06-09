'use client';

// /senior/record — 어르신 녹음 플로우 진입점
// 역할: Auth Guard + 누적 횟수 fetch → SeniorRecordFlow 렌더

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import SeniorRecordFlow from '@/components/senior/SeniorRecordFlow';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string; totalCount: number }
  | { status: 'error'; message: string };

export default function RecordPage() {
  const router = useRouter();
  const [page, setPage] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const userId = session.user.id;
      const { count } = await supabase
        .from('voice_answers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      setPage({ status: 'ready', userId, totalCount: count ?? 0 });
    }
    init();
  }, [router]);

  if (page.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FFF8F0]">
        <div className="h-14 w-14 animate-spin rounded-full border-[8px] border-stone-200 border-t-orange-500" />
        <p className="text-[1.8rem] font-semibold text-stone-600">잠깐만 기다려 주세요...</p>
      </div>
    );
  }

  if (page.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#FFF8F0] px-8">
        <span className="text-[5rem]">😢</span>
        <p className="whitespace-pre-line text-center text-[1.8rem] font-semibold text-stone-700">
          {page.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex h-[80px] w-full max-w-xs items-center justify-center rounded-2xl bg-orange-500 shadow-lg active:scale-95 transition-transform"
        >
          <span className="text-[1.8rem] font-bold text-white">다시 시도하기</span>
        </button>
      </div>
    );
  }

  return <SeniorRecordFlow userId={page.userId} initialTotalCount={page.totalCount} />;
}
