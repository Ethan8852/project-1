'use client';

// /test-connection — Supabase 연결 확인 페이지 (개발 전용)
// 연결 확인 후 삭제하거나 /admin 으로 이동

import { useEffect, useState } from 'react';
import { supabase, testConnection } from '@/utils/supabase';

type Status = 'checking' | 'ok' | 'fail';

export default function TestConnectionPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [detail, setDetail] = useState('');
  const [questions, setQuestions] = useState<{ id: string; question: string }[]>([]);

  useEffect(() => {
    async function run() {
      const ok = await testConnection();
      if (!ok) {
        setStatus('fail');
        setDetail('questions 테이블에 접근할 수 없어요. RLS 정책 또는 anon key를 확인하세요.');
        return;
      }

      // RPC 테스트
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_random_questions');
      if (rpcErr) {
        setStatus('fail');
        setDetail(`RPC 오류: ${rpcErr.message}`);
        return;
      }

      setQuestions(rpcData ?? []);
      setStatus('ok');
      setDetail('DB 연결, RPC 호출 모두 정상입니다.');
    }
    run();
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F0] p-8 flex flex-col gap-6">
      <h1 className="text-[2rem] font-bold text-stone-800">Supabase 연결 테스트</h1>

      {/* 상태 */}
      <div
        className={[
          'rounded-2xl px-6 py-5 text-[1.8rem] font-semibold',
          status === 'checking' && 'bg-stone-100 text-stone-600',
          status === 'ok' && 'bg-green-100 text-green-700',
          status === 'fail' && 'bg-red-100 text-red-700',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {status === 'checking' && '⏳ 연결 확인 중...'}
        {status === 'ok' && '✅ 연결 성공'}
        {status === 'fail' && '❌ 연결 실패'}
        {detail && <p className="mt-2 text-[1.5rem] font-normal">{detail}</p>}
      </div>

      {/* RPC 결과 */}
      {questions.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-3 text-[1.5rem] font-bold text-stone-500">
            get_random_questions() 결과 ({questions.length}개)
          </p>
          {questions.map((q) => (
            <div key={q.id} className="border-b border-stone-100 py-3 last:border-0">
              <p className="text-[1.3rem] text-stone-400">{q.id}</p>
              <p className="text-[1.6rem] text-stone-700">{q.question}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
