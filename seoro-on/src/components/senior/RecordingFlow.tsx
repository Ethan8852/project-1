'use client';

// ─────────────────────────────────────────────────────────────
// RecordingFlow — 어르신용 녹음 → 클로바 STT → 확인 → 저장 컴포넌트
//
// 상태 머신:
//   idle → recording → paused
//     → stt_loading  (클로바 STT 호출, ~1~2초)
//     → preview      (텍스트 확인 + 저장하기 버튼)
//     → saving       (Storage 업로드 → DB insert)
//     → done         (컨페티 + 완료 화면)
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { supabase } from '@/utils/supabase';
import {
  savePendingAudio,
  getAllPendingAudio,
  removePendingAudio,
} from '@/utils/pendingAudio';
import type { Question } from '@/types/question';

// ── 타입 ──────────────────────────────────────────────────────

type FlowState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stt_loading'
  | 'preview'
  | 'saving'
  | 'done';

type Props = {
  question: Question;
  userId: string;
  initialTotalCount: number;
};

// ── 유틸 ──────────────────────────────────────────────────────

const CLOVA_STT_ENDPOINT = '/api/clova-stt';

function detectMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function RecordingFlow({ question, userId, initialTotalCount }: Props) {
  const router = useRouter();

  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [errorMsg, setErrorMsg] = useState('');

  // STT / 저장 결과
  const [sttText, setSttText] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadedOk, setUploadedOk] = useState(false);

  // 저장 단계 진행 표시
  const [uploadDone, setUploadDone] = useState(false);
  const [saveDone, setSaveDone] = useState(false);

  // Refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 앱 재진입 시 미완료 업로드 자동 재시도
  useEffect(() => { retrySavedUploads(); }, []); // eslint-disable-line

  // 언마운트 정리
  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  // ── 타이머 ──────────────────────────────────────────────────

  function startTimer() {
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // ── 녹음 제어 ───────────────────────────────────────────────

  async function handleStart() {
    setErrorMsg('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('마이크를 사용할 수 없어요.\n설정에서 마이크 권한을 허락해 주세요.');
      return;
    }
    streamRef.current = stream;
    mimeTypeRef.current = detectMimeType();
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeTypeRef.current || undefined,
    });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = recorder;
    recorder.start(1000);
    startTimer();
    setFlowState('recording');
  }

  function handlePause() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause(); clearTimer(); setFlowState('paused');
  }

  function handleResume() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume(); startTimer(); setFlowState('recording');
  }

  function handleRestart() {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearTimer();
    chunksRef.current = [];
    blobRef.current = null;
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = ''; }
    audioRef.current?.pause();
    audioRef.current = null;
    setElapsedSec(0);
    setUploadDone(false); setSaveDone(false); setUploadedOk(false);
    setHasAudio(false); setSttText(''); setIsPlaying(false); setErrorMsg('');
    setFlowState('idle');
  }

  // 녹음 완료 → 즉시 클로바 STT 호출
  async function handleComplete() {
    const rec = recorderRef.current;
    if (!rec) return;
    clearTimer();
    setFlowState('stt_loading');

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      if (rec.state !== 'inactive') rec.stop(); else resolve();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const mimeType = mimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size === 0) {
      setErrorMsg('녹음된 내용이 없어요. 다시 시도해 주세요.');
      setFlowState('idle'); return;
    }

    blobRef.current = blob;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = URL.createObjectURL(blob);
    setHasAudio(true);

    // 클로바 STT — 1~2초 내 응답
    const text = await callClovaSTT(blob, mimeType);
    setSttText(text);
    setFlowState('preview');
  }

  // ── 클로바 STT 호출 ──────────────────────────────────────────

  async function callClovaSTT(blob: Blob, _mimeType: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(CLOVA_STT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.error) console.error('[seoro-on] Clova STT 오류:', data.error);
      return data.text ?? '';
    } catch (err) {
      console.error('[seoro-on] Clova STT fetch 오류:', err);
      return '';
    }
  }

  // ── 저장하기: Storage 업로드 → DB insert ─────────────────────

  async function handleSave() {
    const blob = blobRef.current;
    if (!blob) return;

    setUploadDone(false); setSaveDone(false); setUploadedOk(false);
    setFlowState('saving');

    const mimeType = mimeTypeRef.current || 'audio/webm';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${userId}/${question.id}_${ts}.${ext}`;

    // 1. Supabase Storage 업로드
    const { error: storageErr } = await supabase.storage
      .from('voice-records')
      .upload(storagePath, blob, { contentType: mimeType });

    if (storageErr) {
      console.error('[seoro-on] storage error:', storageErr);
      await fallbackSave(blob, mimeType);
      setFlowState('done');
      return;
    }

    setUploadDone(true);

    // 2. voice_answers DB insert
    const { error: dbErr } = await supabase.from('voice_answers').insert({
      user_id: userId,
      question_id: question.id,
      audio_url: storagePath,
      stt_text: sttText || null,
      stt_words: null,
    });

    if (!dbErr) {
      setSaveDone(true);
      setUploadedOk(true);
      setTotalCount((c) => c + 1);
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#1B6CA8', '#f59e0b', '#10b981', '#f43f5e', '#a855f7'],
      });
    } else {
      console.error('[seoro-on] db error:', dbErr);
      await fallbackSave(blob, mimeType);
    }

    setFlowState('done');
  }

  // ── 네트워크 실패 대책: IndexedDB 임시 저장 ─────────────────

  async function fallbackSave(blob: Blob, mimeType: string) {
    await savePendingAudio({
      id: `${userId}_${question.id}_${Date.now()}`,
      userId,
      questionId: question.id,
      blob,
      mimeType,
      createdAt: new Date().toISOString(),
    });
    setTotalCount((c) => c + 1);
  }

  // ── 미완료 업로드 재시도 ─────────────────────────────────────

  const retrySavedUploads = useCallback(async () => {
    try {
      const items = await getAllPendingAudio();
      for (const item of items) {
        const ext = item.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const path = `${item.userId}/${item.questionId}_${item.createdAt.replace(/[:.]/g, '-')}.${ext}`;
        const { error } = await supabase.storage
          .from('voice-records')
          .upload(path, item.blob, { contentType: item.mimeType });
        if (!error) {
          await supabase.from('voice_answers').insert({
            user_id: item.userId,
            question_id: item.questionId,
            audio_url: path,
            stt_text: null,
            stt_words: null,
          });
          await removePendingAudio(item.id);
        }
      }
    } catch { /* 조용히 넘김 */ }
  }, []);

  // ── 오디오 플레이어 ──────────────────────────────────────────

  function initAudioPlayer() {
    if (audioRef.current || !audioUrlRef.current) return;
    const audio = new Audio(audioUrlRef.current);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
  }

  function togglePlay() {
    initAudioPlayer();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  }

  // ────────────────────────────────────────────────────────────
  // 렌더: STT 로딩 화면 (클로바 호출 중, ~1~2초)
  // ────────────────────────────────────────────────────────────

  if (flowState === 'stt_loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#FFFDF5] px-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute h-28 w-28 animate-ping rounded-full bg-[#1B6CA8] opacity-20" />
          <div className="h-20 w-20 animate-spin rounded-full border-[10px] border-stone-200 border-t-[#1B6CA8]" />
        </div>
        <div className="text-center">
          <p className="text-[2rem] font-bold text-stone-800">받아적고 있어요</p>
          <p className="mt-2 text-[1.4rem] text-stone-400">잠깐만요, 거의 다 됐어요 ✍️</p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 렌더: 저장 진행 화면
  // ────────────────────────────────────────────────────────────

  if (flowState === 'saving') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#FFFDF5] px-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute h-28 w-28 animate-ping rounded-full bg-green-400 opacity-20" />
          <div className="h-20 w-20 animate-spin rounded-full border-[10px] border-stone-200 border-t-green-500" />
        </div>
        <div className="text-center">
          <p className="text-[2rem] font-bold text-stone-800">이야기를 저장하고 있어요</p>
          <p className="mt-2 text-[1.4rem] text-stone-400">잠시만 기다려 주세요</p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <ProcessStep label="음성 파일 저장" done={uploadDone} />
          <ProcessStep label="이야기 등록" done={saveDone} />
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 렌더: 미리보기 화면 (텍스트 확인 + 저장하기)
  // ────────────────────────────────────────────────────────────

  if (flowState === 'preview') {
    return (
      <div className="flex min-h-screen flex-col bg-[#FFFDF5] px-6 py-10 pb-36">

        <div className="mb-6 text-center">
          <span className="text-[4rem]" role="img" aria-label="메모">📝</span>
          <p className="mt-3 text-[2.2rem] font-extrabold text-stone-800 leading-snug">
            이렇게 받아적었어요
          </p>
          <p className="mt-2 text-[1.5rem] text-stone-400">
            내용을 확인하고 저장해 주세요
          </p>
        </div>

        {/* 미니 오디오 플레이어 */}
        {hasAudio && (
          <div className="mb-5 rounded-2xl bg-white px-6 py-4 shadow-md">
            <button
              onClick={togglePlay}
              className={`flex w-full items-center justify-center gap-3 rounded-xl py-3 transition-colors ${
                isPlaying ? 'bg-red-50 text-red-600' : 'bg-[#EBF4FB] text-[#1B6CA8]'
              }`}
            >
              <span className="text-[2rem]" role="img" aria-hidden>
                {isPlaying ? '⏸' : '▶'}
              </span>
              <span className="text-[1.6rem] font-bold">
                {isPlaying ? '재생 중...' : '🎙 내 이야기 들어보기'}
              </span>
            </button>
          </div>
        )}

        {/* STT 텍스트 */}
        <div className="mb-6 rounded-2xl bg-white px-6 py-6 shadow-md">
          {sttText ? (
            <p
              className="text-[1.6rem] leading-relaxed text-stone-800"
              style={{ wordBreak: 'keep-all' }}
            >
              {sttText}
            </p>
          ) : (
            <p className="text-center text-[1.4rem] text-stone-400">
              텍스트 변환 결과가 없어요.<br />
              음성이 작거나 녹음이 짧을 수 있어요.
            </p>
          )}
        </div>

        {/* 하단 고정 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 flex flex-col gap-3 bg-[#FFFDF5] px-6 pb-8 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            onClick={handleSave}
            className="flex h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-[#1B6CA8] shadow-md transition-transform active:scale-95"
          >
            <span className="text-[2rem]" role="img" aria-hidden>💾</span>
            <span className="text-[1.9rem] font-bold text-white">저장하기</span>
          </button>
          <button
            onClick={handleRestart}
            className="flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-stone-100 transition-transform active:scale-95"
          >
            <span className="text-[1.6rem]" role="img" aria-hidden>🔄</span>
            <span className="text-[1.6rem] font-semibold text-stone-600">다시 녹음하기</span>
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 렌더: Done 화면
  // ────────────────────────────────────────────────────────────

  if (flowState === 'done') {
    return (
      <div className="flex min-h-screen flex-col bg-[#FFFDF5] px-6 py-10 pb-32">

        <div className="mb-6 text-center">
          <span className="text-[5rem]" role="img" aria-label="꽃">🌸</span>
          <p className="mt-3 text-[2.2rem] font-extrabold text-stone-800 leading-snug">
            참 잘하셨어요!
          </p>
          <p className="mt-2 text-[1.6rem] text-stone-500 leading-snug">
            어르신 이야기가 따뜻하게 모였습니다.
          </p>
        </div>

        {/* 업로드 실패 경고 */}
        {!uploadedOk && (
          <div className="mb-5 rounded-2xl bg-amber-50 px-5 py-4">
            <p className="whitespace-pre-line text-center text-[1.3rem] text-amber-700">
              {'⚠️ 저장이 완전히 되지 않았어요.\n인터넷 연결 후 다시 열면 자동으로 저장됩니다.'}
            </p>
          </div>
        )}

        {/* 미니 오디오 플레이어 */}
        {hasAudio && (
          <div className="mb-5 rounded-2xl bg-white px-6 py-5 shadow-md">
            <p className="mb-3 text-center text-[1.4rem] font-semibold text-stone-500">
              🎙 방금 이야기 다시 듣기
            </p>
            <button
              onClick={togglePlay}
              className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 transition-colors ${
                isPlaying ? 'bg-red-50 text-red-600' : 'bg-[#EBF4FB] text-[#1B6CA8]'
              }`}
            >
              <span className="text-[2.4rem]" role="img" aria-hidden>
                {isPlaying ? '⏸' : '▶'}
              </span>
              <span className="text-[1.8rem] font-bold">
                {isPlaying ? '재생 중...' : '재생'}
              </span>
            </button>
          </div>
        )}

        {/* STT 텍스트 */}
        {sttText ? (
          <div className="mb-5 rounded-2xl bg-white px-6 py-5 shadow-md">
            <p className="mb-3 text-[1.4rem] font-semibold text-stone-500">📝 이야기 내용</p>
            <p
              className="text-[1.55rem] leading-relaxed text-stone-800"
              style={{ wordBreak: 'keep-all' }}
            >
              {sttText}
            </p>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl bg-white px-6 py-5 shadow-md">
            <p className="text-center text-[1.4rem] text-stone-400">
              텍스트 변환 결과가 없어요
            </p>
          </div>
        )}

        {/* 누적 횟수 */}
        <div className="mb-5 rounded-2xl bg-white px-8 py-6 shadow-md text-center">
          <p className="text-[1.5rem] text-stone-500">지금까지</p>
          <p className="text-[3rem] font-extrabold text-[#1B6CA8] leading-tight">
            {totalCount}번
          </p>
          <p className="text-[1.5rem] text-stone-500">이야기 나눴어요</p>
        </div>

        <button
          onClick={() => router.push('/senior/recordings')}
          className="flex h-[70px] w-full items-center justify-center gap-3 rounded-2xl bg-stone-100 shadow transition-transform active:scale-95"
        >
          <span className="text-[1.8rem]" role="img" aria-hidden>🎧</span>
          <span className="text-[1.8rem] font-bold text-stone-700">내 녹음 모두 듣기</span>
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 렌더: 녹음 화면 (idle / recording / paused)
  // ────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF5] px-6 py-10">

      {flowState === 'idle' && (
        <button
          onClick={() => router.push('/senior/question-select')}
          className="mb-4 flex items-center gap-2 text-[1.6rem] font-semibold text-stone-500"
          aria-label="질문 다시 고르기"
        >
          ← 질문 다시 고르기
        </button>
      )}

      {/* 질문 카드 */}
      <div className="w-full rounded-2xl bg-white px-6 py-8 shadow-md">
        <p className="mb-3 text-center text-[1.4rem] font-semibold text-amber-600">
          오늘의 질문
        </p>
        <p className="text-center text-[2rem] font-bold leading-snug text-stone-800">
          {question.question}
        </p>
      </div>

      {/* 녹음 시간 */}
      <div className="mt-8 text-center">
        {(flowState === 'recording' || (flowState === 'paused' && elapsedSec > 0)) && (
          <p className="text-[1.8rem] font-semibold text-stone-600">
            {flowState === 'recording' && (
              <span className="mr-2 inline-block h-4 w-4 animate-pulse rounded-full bg-red-500 align-middle" />
            )}
            {fmtTime(elapsedSec)}
          </p>
        )}
      </div>

      {errorMsg && (
        <p className="mt-4 whitespace-pre-line text-center text-[1.5rem] text-red-600">
          {errorMsg}
        </p>
      )}

      {/* ── 대기 상태 ── */}
      {flowState === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <button
            onClick={handleStart}
            aria-label="녹음 시작"
            className="flex h-[180px] w-[180px] flex-col items-center justify-center rounded-full bg-[#1B6CA8] shadow-xl transition-transform active:scale-95"
          >
            <span className="text-[3rem]" role="img" aria-hidden>🎙</span>
            <span className="mt-1 text-[1.8rem] font-bold text-white">녹음 시작</span>
          </button>
          <p className="text-[1.4rem] text-stone-400">버튼을 누르면 녹음이 시작됩니다</p>
        </div>
      )}

      {/* ── 녹음 중 ── */}
      {flowState === 'recording' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <button
            onClick={handlePause}
            aria-label="잠깐 멈추기"
            className="flex h-[180px] w-[180px] flex-col items-center justify-center rounded-full bg-red-600 shadow-xl transition-transform active:scale-95"
          >
            <span className="text-[3rem]" role="img" aria-hidden>⏸</span>
            <span className="mt-1 text-[1.8rem] font-bold text-white">잠깐 멈추기</span>
          </button>
          <div className="flex gap-4">
            <SecondaryButton onClick={handleRestart} emoji="🔄" label="다시하기" />
            <SecondaryButton onClick={handleRestart} emoji="🗑" label="삭제" />
          </div>
        </div>
      )}

      {/* ── 일시정지 ── */}
      {flowState === 'paused' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <button
            onClick={handleResume}
            aria-label="이어하기"
            className="flex h-[180px] w-[180px] flex-col items-center justify-center rounded-full bg-[#1B6CA8] shadow-xl transition-transform active:scale-95"
          >
            <span className="text-[3rem]" role="img" aria-hidden>▶</span>
            <span className="mt-1 text-[1.8rem] font-bold text-white">이어하기</span>
          </button>
          <button
            onClick={handleComplete}
            aria-label="녹음 완료"
            className="flex h-[80px] w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-green-600 shadow-md transition-transform active:scale-95"
          >
            <span className="text-[2rem]" role="img" aria-hidden>✅</span>
            <span className="text-[1.8rem] font-bold text-white">완료</span>
          </button>
          <div className="flex gap-4">
            <SecondaryButton onClick={handleRestart} emoji="🔄" label="다시하기" />
            <SecondaryButton onClick={handleRestart} emoji="🗑" label="삭제" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────

function ProcessStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white px-5 py-4 shadow-sm">
      {done ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-[1.4rem]">
          ✅
        </span>
      ) : (
        <div className="h-10 w-10 shrink-0 animate-spin rounded-full border-[5px] border-stone-200 border-t-[#1B6CA8]" />
      )}
      <span className={`text-[1.6rem] font-semibold ${done ? 'text-stone-500' : 'text-stone-800'}`}>
        {label}
      </span>
    </div>
  );
}

function SecondaryButton({
  onClick,
  emoji,
  label,
}: {
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-[90px] w-[120px] flex-col items-center justify-center rounded-2xl bg-stone-100 shadow transition-transform active:scale-95"
    >
      <span className="text-[1.8rem]" role="img" aria-hidden>{emoji}</span>
      <span className="mt-1 text-[1.4rem] font-semibold text-stone-700">{label}</span>
    </button>
  );
}
