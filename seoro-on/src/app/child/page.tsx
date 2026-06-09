'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';

// ─── Types ────────────────────────────────────────────────────

type StoryCard = {
  id: string;
  audio_url: string;
  signed_url: string;
  created_at: string;
  stt_text: string | null;
  child_memo: string | null;
  question_text: string;
  question_mode: string;
  question_mode_ko: string;
};

type TabType = '시간순' | '주제별';

// ─── Tag color map ────────────────────────────────────────────

const TAG: Record<string, { bg: string; text: string }> = {
  lifecycle:    { bg: '#FFF0E0', text: '#C85A00' },
  nonnarrative: { bg: '#FDECEA', text: '#B71C1C' },
  event:        { bg: '#E8F5E9', text: '#2E7D32' },
  mixed:        { bg: '#E3F2FD', text: '#1565C0' },
};
const TAG_DEFAULT = { bg: '#F3F4F6', text: '#6B7280' };

// ─── Toast ────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-800/90 px-5 py-3 text-sm font-medium text-white shadow-xl">
      ✅ {message}
    </div>
  );
}

// ─── Mini Progress Bar ────────────────────────────────────────

function MiniProgress({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek: (t: number) => void;
}) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }

  return (
    <div
      className="relative h-5 w-full cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Track */}
      <div className="absolute top-1/2 left-0 h-[5px] w-full -translate-y-1/2 rounded-full bg-orange-100" />
      {/* Fill */}
      <div
        className="absolute top-1/2 left-0 h-[5px] -translate-y-1/2 rounded-full bg-orange-400 transition-[width]"
        style={{ width: `${progress}%` }}
      />
      {/* Thumb */}
      <div
        className="absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 -translate-x-1/2 rounded-full bg-orange-500 shadow-md"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}

// ─── Story Card ───────────────────────────────────────────────

function StoryCard({
  card,
  isPlaying,
  onPlay,
  onPause,
  onMemoSaved,
}: {
  card: StoryCard;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onMemoSaved: (id: string, memo: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [memo, setMemo] = useState(card.child_memo ?? '');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  function handleSeek(t: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = t;
    if (!isPlaying) onPlay();
  }

  async function handleSave() {
    if (!memo.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('voice_answers')
        .update({ child_memo: memo })
        .eq('id', card.id);
      if (!error) onMemoSaved(card.id, memo);
    } finally {
      setSaving(false);
    }
  }

  function fmt(sec: number) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const tag = TAG[card.question_mode] ?? TAG_DEFAULT;
  const longStt = (card.stt_text?.length ?? 0) > 70;

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-sm border border-stone-100/80">
      {card.signed_url && (
        <audio
          ref={audioRef}
          src={card.signed_url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => { onPause(); setCurrentTime(0); }}
        />
      )}

      {/* ── Top: tag + date ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-[6px]">
        <span
          className="rounded-full px-2 py-[3px] text-[10px] font-bold leading-none"
          style={{ background: tag.bg, color: tag.text }}
        >
          {card.question_mode_ko}
        </span>
        <span className="text-[10px] text-stone-400">{fmtDate(card.created_at)}</span>
      </div>

      {/* ── Question title ── */}
      <p className="px-3 pb-2 text-[13px] font-extrabold leading-snug text-stone-800 line-clamp-3">
        {card.question_text}
      </p>

      {/* ── Audio player ── */}
      <div className="mx-3 mb-2 rounded-xl bg-orange-50 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? '정지' : '재생'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8C00] text-white shadow-md active:scale-90 transition-transform"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="3.5" height="12" rx="1.5" />
                <rect x="8.5" y="1" width="3.5" height="12" rx="1.5" />
              </svg>
            ) : (
              <svg width="13" height="14" viewBox="0 0 13 14" fill="currentColor">
                <path d="M1.5 1.5L11.5 7L1.5 12.5V1.5Z" />
              </svg>
            )}
          </button>
          <MiniProgress progress={progress} duration={duration} onSeek={handleSeek} />
        </div>
        <div className="flex justify-between px-[2px] text-[10px] text-stone-400 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* ── STT text ── */}
      {card.stt_text && (
        <div className="mx-3 mb-2">
          <p
            className={`text-[11.5px] leading-relaxed text-stone-500 ${expanded ? '' : 'line-clamp-3'}`}
            style={{ wordBreak: 'keep-all' }}
          >
            {card.stt_text}
          </p>
          {longStt && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-[10.5px] font-semibold text-orange-400"
            >
              {expanded ? '접기 ▲' : '더보기 ▼'}
            </button>
          )}
        </div>
      )}

      {/* ── Child memo ── */}
      <div className="mt-auto border-t border-stone-100 bg-[#FFFAF5] px-3 pt-2.5 pb-3">
        <p className="mb-1.5 text-[10.5px] font-bold text-stone-500">🧡 자녀의 메모</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="이야기를 듣고 메모를 남겨보세요"
          rows={2}
          className="w-full resize-none rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-[11.5px] leading-relaxed text-stone-700 placeholder-stone-300 focus:border-orange-300 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !memo.trim()}
          className="mt-2 w-full rounded-xl bg-[#FF8C00] py-[9px] text-[12px] font-extrabold text-white shadow-sm disabled:opacity-40 active:scale-[0.97] transition-transform"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ─── Section Header (주제별) ──────────────────────────────────

function SectionHeader({ mode_ko, mode, count }: { mode_ko: string; mode: string; count: number }) {
  const tag = TAG[mode] ?? TAG_DEFAULT;
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="rounded-full px-3 py-1 text-[13px] font-bold"
        style={{ background: tag.bg, color: tag.text }}
      >
        {mode_ko}
      </span>
      <span className="text-[12px] text-stone-400">{count}개의 이야기</span>
    </div>
  );
}

// ─── Book Banner ──────────────────────────────────────────────

function BookBanner() {
  return (
    <div className="mt-8 rounded-[24px] bg-[#0D1B2A] px-5 pt-7 pb-6 text-center">
      <div className="mb-3 text-[42px] leading-none">📒</div>
      <p className="mb-1.5 text-[17px] font-extrabold text-amber-400 tracking-tight">
        우리 가족 이야기책 만들기
      </p>
      <p className="mb-5 text-[12.5px] leading-relaxed text-stone-400">
        쌓인 이야기들을 세상에 하나뿐인
        <br />
        가족 책으로 만들어 드려요
      </p>
      <button className="w-full rounded-2xl bg-[#FF8C00] py-[15px] text-[14px] font-extrabold tracking-tight text-white shadow-lg active:scale-[0.97] transition-transform">
        제작 및 구독 상품 보기
      </button>
    </div>
  );
}

// TODO: 자녀 계정 연동 완료 후 제거
const TEST_USER_ID = '78406665-0141-4ca9-9e71-ceb635815661';

// ─── Main Page ────────────────────────────────────────────────

export default function ChildArchivePage() {
  const [tab, setTab] = useState<TabType>('시간순');
  const [cards, setCards] = useState<StoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('voice_answers')
        .select(
          'id, audio_url, created_at, stt_text, child_memo, questions(question, mode, mode_ko)',
        )
        .eq('user_id', TEST_USER_ID)
        .order('created_at', { ascending: false });

      if (error || !data) return;

      const items: StoryCard[] = await Promise.all(
        data.map(async (row) => {
          const q = row.questions as unknown as {
            question: string;
            mode: string;
            mode_ko: string;
          } | null;

          const { data: urlData } = await supabase.storage
            .from('voice-records')
            .createSignedUrl(row.audio_url, 3600);

          return {
            id: row.id,
            audio_url: row.audio_url,
            signed_url: urlData?.signedUrl ?? '',
            created_at: row.created_at,
            stt_text: row.stt_text as string | null,
            child_memo: row.child_memo as string | null,
            question_text: q?.question ?? '(질문 없음)',
            question_mode: q?.mode ?? '',
            question_mode_ko: q?.mode_ko ?? '기타',
          };
        }),
      );

      setCards(items);
    } finally {
      setLoading(false);
    }
  }

  function handleMemoSaved(id: string, memo: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, child_memo: memo } : c)));
    setToast('메모가 저장되었습니다');
  }

  // 주제별 grouping — order preserved by first occurrence
  const groupOrder: string[] = [];
  const grouped: Record<string, StoryCard[]> = {};
  for (const card of cards) {
    if (!grouped[card.question_mode_ko]) {
      grouped[card.question_mode_ko] = [];
      groupOrder.push(card.question_mode_ko);
    }
    grouped[card.question_mode_ko].push(card);
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#FFF8F0]/95 px-4 pt-6 pb-3 backdrop-blur-sm">
        <h1 className="mb-4 text-[22px] font-extrabold text-stone-800 tracking-tight">
          📚 이야기 보관함
        </h1>

        {/* Tab toggle */}
        <div className="flex gap-1 rounded-2xl bg-stone-100 p-[5px]">
          {(['시간순', '주제별'] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-[14px] py-[10px] text-[13px] font-bold transition-all duration-200 ${
                tab === t
                  ? 'bg-white text-[#FF8C00] shadow-sm'
                  : 'text-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pb-12">
        {loading ? (
          /* Loading */
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF8C00]" />
            <p className="text-sm text-stone-400">이야기를 불러오는 중...</p>
          </div>
        ) : cards.length === 0 ? (
          /* Empty */
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <span className="text-[50px]">📭</span>
            <p className="text-[15px] font-semibold text-stone-400">아직 녹음된 이야기가 없어요</p>
          </div>
        ) : tab === '시간순' ? (
          /* 시간순 — 2-col grid */
          <div className="grid grid-cols-2 gap-3 pt-1">
            {cards.map((card) => (
              <StoryCard
                key={card.id}
                card={card}
                isPlaying={playingId === card.id}
                onPlay={() => setPlayingId(card.id)}
                onPause={() => setPlayingId(null)}
                onMemoSaved={handleMemoSaved}
              />
            ))}
          </div>
        ) : (
          /* 주제별 — grouped sections */
          <div className="space-y-7 pt-1">
            {groupOrder.map((mode_ko) => {
              const group = grouped[mode_ko];
              return (
                <section key={mode_ko}>
                  <SectionHeader
                    mode_ko={mode_ko}
                    mode={group[0].question_mode}
                    count={group.length}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {group.map((card) => (
                      <StoryCard
                        key={card.id}
                        card={card}
                        isPlaying={playingId === card.id}
                        onPlay={() => setPlayingId(card.id)}
                        onPause={() => setPlayingId(null)}
                        onMemoSaved={handleMemoSaved}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ── Book banner ── */}
        {!loading && cards.length > 0 && <BookBanner />}
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
