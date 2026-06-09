'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

// ★ Supabase → Authentication → Users 에서 테스트 계정 UUID 복사 후 여기에 붙여넣기
const TEST_USER_ID = '78406665-0141-4ca9-9e71-ceb635815661';

interface Question {
  id: string;
  mode: string;
  mode_ko: string;
  section: string;
  question: string;
}

export default function QuestionSelectionPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_random_questions');
      if (error) throw error;
      if (data) setQuestions(data);
    } catch (error) {
      console.error('질문 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto bg-white min-h-screen">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.push('/')}
        className="mb-6 flex items-center gap-2 text-[1.6rem] font-semibold text-stone-500"
        aria-label="처음으로"
      >
        ← 처음으로
      </button>

      <h1 className="text-[29px] font-bold text-gray-900 mb-8 leading-snug">
        오늘은 어떤 이야기를<br />해볼까요?
      </h1>

      {loading ? (
        <p className="text-xl text-gray-500">이야기 보따리 준비 중...</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => router.push(`/senior/question?id=${q.id}&uid=${TEST_USER_ID}`)}
              className="w-full text-left p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-500 transition-colors min-h-[80px]"
            >
              <p className="text-[22px] text-gray-800 font-medium leading-relaxed">
                {q.question}
              </p>
              <span className="text-[14px] text-orange-500 block mt-2 font-semibold">
                #{q.mode_ko} · {q.section}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={fetchQuestions}
        className="w-full mt-8 bg-gray-100 text-gray-700 text-[22px] font-bold py-4 rounded-xl min-h-[80px]"
      >
        다른 질문 보기
      </button>
    </div>
  );
}
