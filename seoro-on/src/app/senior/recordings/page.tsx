'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

const TEST_USER_ID = '78406665-0141-4ca9-9e71-ceb635815661';

type STTWord = { word: string; start: number; end: number };

type Recording = {
  id: string;
  question_id: string;
  audio_url: string;
  created_at: string;
  stt_text: string | null;
  stt_words: STTWord[] | null;
  question_text: string;
  signed_url: string;
};

// ── 커스텀 진행 바 ────────────────────────────────────────────

function ProgressBar({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  function calcTime(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX =
      'changedTouches' in e
        ? e.changedTouches[0].clientX
        : (e as React.MouseEvent).clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }

  return (
    <div
      className="relative h-5 w-full cursor-pointer select-none"
      onClick={calcTime}
      onTouchEnd={calcTime}
    >
      <div className="absolute top-1/2 left-0 h-3 w-full -translate-y-1/2 rounded-full bg-stone-200" />
      <div
        className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-full bg-[#1B6CA8]"
        style={{ width: `${progress}%` }}
      />
      <div
        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-[#1B6CA8] shadow-md"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}

// ── 오디오 카드 ───────────────────────────────────────────────

function AudioCard({
  rec,
  isActive,
  onActivate,
  onDeactivate,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  isDeleting,
  onRetranscribe,
}: {
  rec: Recording;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onRetranscribe: (recId: string, audioPath: string) => Promise<void>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [showStt, setShowStt] = useState(false);
  const [retranscribing, setRetranscribing] = useState(false);

  const sttWords = rec.stt_words ?? [];

  // isActive 변경 → 재생 / 정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isActive) {
      audio.play().catch(() => {});
      if (!duration || !isFinite(duration)) {
        const check = setInterval(() => {
          if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
            clearInterval(check);
          }
        }, 200);
        setTimeout(() => clearInterval(check), 5000);
      }
    } else {
      audio.pause();
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 단어 강조 → 자동 스크롤
  useEffect(() => {
    if (currentWordIdx >= 0) {
      wordRefs.current[currentWordIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentWordIdx]);

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLAudioElement>) {
    const t = e.currentTarget.currentTime;
    setCurrentTime(t);
    if (sttWords.length > 0) {
      const idx = sttWords.findIndex((w) => t >= w.start && t < w.end);
      setCurrentWordIdx(idx);
    }
  }

  function handleSeek(time: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    if (!isActive) { audio.play().catch(() => {}); onActivate(); }
  }

  function seekToWord(start: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start;
    if (!isActive) onActivate();
    audio.play().catch(() => {});
  }

  async function handleRetranscribe() {
    setRetranscribing(true);
    try {
      await onRetranscribe(rec.id, rec.audio_url);
    } finally {
      setRetranscribing(false);
    }
  }

  function fmtTime(sec: number) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  function formatHHMM(iso: string) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full rounded-2xl bg-white shadow-md overflow-hidden">
      {rec.signed_url && (
        <audio
          ref={audioRef}
          src={rec.signed_url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => { onDeactivate(); setCurrentTime(0); setCurrentWordIdx(-1); }}
        />
      )}

      <div className="px-5 pt-4 pb-3">
        {/* 날짜 + 삭제 */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[1.2rem] text-stone-400">
            {formatDate(rec.created_at)} {formatHHMM(rec.created_at)}
          </p>
          <button
            onClick={onConfirmDelete}
            aria-label="삭제"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[1.3rem] text-stone-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          >
            🗑
          </button>
        </div>

        {/* 질문 */}
        <p className="mb-4 text-[1.6rem] font-semibold leading-snug text-stone-800">
          {rec.question_text}
        </p>

        {/* 삭제 확인 */}
        {confirmingDelete ? (
          <div className="rounded-xl bg-red-50 px-4 py-4 mb-1">
            <p className="mb-3 text-center text-[1.5rem] font-semibold text-red-700">정말 삭제할까요?</p>
            <div className="flex gap-3">
              <button onClick={onCancelDelete} className="flex-1 rounded-xl bg-stone-100 py-3 text-[1.5rem] font-bold text-stone-600">취소</button>
              <button onClick={onDelete} disabled={isDeleting} className="flex-1 rounded-xl bg-red-500 py-3 text-[1.5rem] font-bold text-white disabled:opacity-60">
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        ) : rec.signed_url ? (
          <div className={`rounded-2xl px-4 py-4 ${isActive ? 'bg-[#EBF4FB]' : 'bg-stone-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={isActive ? onDeactivate : onActivate}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[1.8rem] shadow transition-transform active:scale-90 ${
                  isActive ? 'bg-[#1B6CA8] text-white' : 'bg-white text-[#1B6CA8] border border-[#c8dff5]'
                }`}
                aria-label={isActive ? '정지' : '재생'}
              >
                {isActive ? '⏸' : '▶'}
              </button>
              <div className="flex-1 min-w-0">
                <ProgressBar progress={progress} duration={duration} onSeek={handleSeek} />
              </div>
            </div>
            <div className="flex justify-between text-[1.2rem] text-stone-400 tabular-nums px-1">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
        ) : (
          <p className="text-center text-[1.3rem] text-stone-400 py-2">재생 불가</p>
        )}
      </div>

      {/* STT 텍스트 + 다시 변환 */}
      <div className="border-t border-stone-100 px-5 py-3 space-y-2">
        {(rec.stt_text || sttWords.length > 0) ? (
          <>
            <button
              onClick={() => setShowStt((v) => !v)}
              className="flex w-full items-center justify-between text-[1.35rem] font-semibold text-[#1B6CA8]"
            >
              <span>📝 이야기 내용</span>
              <span className="text-stone-400 text-[1.2rem]">{showStt ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>

            {showStt && (
              sttWords.length > 0 ? (
                /* 카라오케: 단어 탭 → 해당 위치 재생 */
                <div
                  className="max-h-[200px] overflow-y-auto rounded-xl bg-[#F0F7FF] px-4 py-3 text-[1.4rem] leading-relaxed text-stone-800"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {sttWords.map((w, i) => (
                    <span
                      key={i}
                      ref={(el) => { wordRefs.current[i] = el; }}
                      onClick={() => seekToWord(w.start)}
                      className={`cursor-pointer rounded px-0.5 transition-colors duration-100 ${
                        i === currentWordIdx
                          ? 'bg-amber-300 font-bold text-amber-900'
                          : 'hover:bg-blue-100'
                      }`}
                    >
                      {w.word}{' '}
                    </span>
                  ))}
                  {isActive && (
                    <p className="mt-2 text-center text-[1.1rem] text-stone-400">
                      단어를 탭하면 그 위치부터 재생돼요
                    </p>
                  )}
                </div>
              ) : (
                /* 단어 타임스탬프 없을 때 — 일반 텍스트 */
                <div
                  className="rounded-xl bg-[#F0F7FF] px-4 py-3 text-[1.4rem] leading-relaxed text-stone-700"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {rec.stt_text}
                </div>
              )
            )}

            {showStt && sttWords.length === 0 && (
              <p className="text-center text-[1.2rem] text-stone-400">
                아래 버튼으로 다시 변환하면 단어 탭 기능이 활성화돼요
              </p>
            )}
          </>
        ) : (
          <p className="text-[1.3rem] text-stone-400 text-center">텍스트 변환 결과 없음</p>
        )}

        <button
          onClick={handleRetranscribe}
          disabled={retranscribing || !rec.signed_url}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-3 text-[1.35rem] font-semibold text-stone-600 disabled:opacity-50 active:bg-stone-100 transition-colors"
        >
          {retranscribing ? (
            <>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-stone-300 border-t-[#1B6CA8]" />
              <span>텍스트 변환 중...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>{rec.stt_text ? '텍스트 다시 변환' : '텍스트로 변환하기'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function RecordingsPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadRecordings(); }, []);

  async function loadRecordings() {
    setLoading(true);
    try {
      const { data: answers } = await supabase
        .from('voice_answers')
        .select('id, question_id, audio_url, created_at, stt_text, stt_words, questions(question)')
        .eq('user_id', TEST_USER_ID)
        .order('created_at', { ascending: false });

      if (!answers) return;

      const items = await Promise.all(
        answers.map(async (a) => {
          const { data: urlData } = await supabase.storage
            .from('voice-records')
            .createSignedUrl(a.audio_url, 3600);

          return {
            id: a.id,
            question_id: a.question_id,
            audio_url: a.audio_url,
            created_at: a.created_at,
            stt_text: a.stt_text as string | null,
            stt_words: Array.isArray(a.stt_words) ? (a.stt_words as STTWord[]) : null,
            question_text:
              (a.questions as unknown as { question: string } | null)?.question ?? a.question_id,
            signed_url: urlData?.signedUrl ?? '',
          };
        }),
      );

      setRecordings(items);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(rec: Recording) {
    setDeletingId(rec.id);
    try {
      if (playingId === rec.id) setPlayingId(null);
      await supabase.storage.from('voice-records').remove([rec.audio_url]);
      await supabase.from('voice_answers').delete().eq('id', rec.id);
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (err) {
      console.error('[seoro-on] delete error:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const handleRetranscribe = useCallback(async (recId: string, audioPath: string) => {
    const res = await fetch('/api/retranscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recId, audioPath }),
    });
    const data = await res.json();

    if (data.error) {
      alert(`텍스트 변환 실패: ${data.error}`);
      return;
    }

    setRecordings((prev) =>
      prev.map((r) =>
        r.id === recId
          ? {
              ...r,
              stt_text: data.text || null,
              stt_words: Array.isArray(data.words) && data.words.length > 0 ? data.words : null,
            }
          : r,
      ),
    );
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF5] px-6 py-10 pb-28">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow"
          aria-label="뒤로가기"
        >
          <span className="text-[1.6rem]">←</span>
        </button>
        <h1 className="text-[2rem] font-bold text-stone-800">내 이야기 모음</h1>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-[6px] border-stone-200 border-t-[#1B6CA8]" />
          <p className="text-[1.6rem] text-stone-500">불러오는 중...</p>
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="text-[4rem]">🎙</span>
          <p className="text-[1.8rem] font-semibold text-stone-500">아직 녹음이 없어요</p>
          <button
            onClick={() => router.push('/senior/question-select')}
            className="mt-4 flex h-[70px] w-full max-w-xs items-center justify-center rounded-2xl bg-[#1B6CA8] shadow-md"
          >
            <span className="text-[1.8rem] font-bold text-white">첫 이야기 남기기</span>
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[1.4rem] text-stone-400">
            총 <span className="font-bold text-[#1B6CA8]">{recordings.length}개</span>의 이야기
          </p>
          <div className="space-y-4">
            {recordings.map((rec) => (
              <AudioCard
                key={rec.id}
                rec={rec}
                isActive={playingId === rec.id}
                onActivate={() => setPlayingId(rec.id)}
                onDeactivate={() => setPlayingId(null)}
                confirmingDelete={confirmDeleteId === rec.id}
                onConfirmDelete={() => setConfirmDeleteId(rec.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onDelete={() => handleDelete(rec)}
                isDeleting={deletingId === rec.id}
                onRetranscribe={handleRetranscribe}
              />
            ))}
          </div>
          <button
            onClick={() => router.push('/senior/question-select')}
            className="mt-8 flex h-[70px] w-full items-center justify-center gap-3 rounded-2xl bg-[#1B6CA8] shadow-md transition-transform active:scale-95"
          >
            <span className="text-[1.8rem]" role="img" aria-hidden>🎙</span>
            <span className="text-[1.8rem] font-bold text-white">새 이야기 남기기</span>
          </button>
        </>
      )}
    </div>
  );
}
