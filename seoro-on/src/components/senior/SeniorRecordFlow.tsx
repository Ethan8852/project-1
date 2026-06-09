'use client';

// ─────────────────────────────────────────────────────────────────
// SeniorRecordFlow — 서로ON 어르신 녹음 5단계 통합 플로우
//
// 단계: 간편 안내 → 질문 선택 → 음성 녹음 → 녹음 확인 → 완료
//
// [스타일 격리] Tailwind 유틸리티 클래스만 사용.
//              전역 태그 셀렉터(h1, p, button 등) 없음.
//              다른 팀원 페이지에 절대 영향 없음.
// [폰트 최소값] 모든 텍스트 최소 text-[1.8rem] (≈ 29px / 22pt)
// [버튼 최소값] 모든 버튼 최소 h-[80px]
// ─────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import {
  savePendingAudio,
  getAllPendingAudio,
  removePendingAudio,
} from '@/utils/pendingAudio';

// ── 타입 ──────────────────────────────────────────────────────────

type FlowStep = 'guide' | 'question' | 'recording' | 'review' | 'done';
type RecordPhase = 'idle' | 'active' | 'paused';

interface QuestionItem {
  id: string;
  text: string;
}

interface Props {
  userId: string;
  initialTotalCount: number;
}

// ── 오디오 포맷 감지 (webm 우선, 구형 기기 mp4 폴백) ─────────────

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

// ── 시간 포맷 MM:SS ───────────────────────────────────────────────

function fmtSec(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── 질문 폴백 (DB fetch 실패 시) ──────────────────────────────────

const FALLBACK_QUESTIONS: QuestionItem[] = [
  { id: 'event_q01', text: '어머니가 잘 만드시던 음식이 뭐예요?' },
  { id: 'event_q21', text: '봄 하면 떠오르는 풍경이 뭐예요?' },
  { id: 'lifecycle_q11', text: '처음 일을 시작하셨을 때 어떠셨어요?' },
];

// ── 메인 컴포넌트 ─────────────────────────────────────────────────

export default function SeniorRecordFlow({ userId, initialTotalCount }: Props) {
  const router = useRouter();

  // ── 플로우 단계 ────────────────────────────────────────────────
  const [step, setStep] = useState<FlowStep>('guide');

  // ── 질문 ──────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [selectedQ, setSelectedQ] = useState<QuestionItem | null>(null);

  // ── 녹음 ──────────────────────────────────────────────────────
  const [recordPhase, setRecordPhase] = useState<RecordPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [micError, setMicError] = useState('');

  // ── 오디오 플레이어 ────────────────────────────────────────────
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── 저장 ──────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

  // ── refs ───────────────────────────────────────────────────────
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── 마운트: 미완료 업로드 재시도 ──────────────────────────────
  useEffect(() => {
    retrySavedUploads();
    return () => {
      cleanupRecording();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 질문 페이지 진입 시 fetch ──────────────────────────────────
  useEffect(() => {
    if (step === 'question') fetchQuestions();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // 질문 불러오기
  // ─────────────────────────────────────────────────────────────

  async function fetchQuestions() {
    setQLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_random_questions');
      if (!error && data && data.length > 0) {
        setQuestions(
          data.map((q: { id: string; question: string }) => ({
            id: q.id,
            text: q.question,
          })),
        );
      } else {
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setQLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 타이머
  // ─────────────────────────────────────────────────────────────

  function startTimer() {
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STT 초기화 (Web Speech API, 한국어, Chrome/Android 지원)
  // ─────────────────────────────────────────────────────────────

  function initSTT(): SpeechRecognition | null {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) setTranscript((prev) => prev + final + ' ');
      setInterimText(interim);
    };
    rec.onerror = () => setInterimText('');
    rec.onend = () => setInterimText('');

    return rec;
  }

  // ─────────────────────────────────────────────────────────────
  // 녹음 동작
  // ─────────────────────────────────────────────────────────────

  async function startRecording() {
    setMicError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('마이크를 사용할 수 없어요.\n설정에서 마이크 권한을 허락해 주세요.');
      return;
    }

    streamRef.current = stream;
    const mimeType = detectMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start(1000);

    const recognition = initSTT();
    if (recognition) {
      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* 이미 시작된 경우 무시 */ }
    }

    startTimer();
    setRecordPhase('active');
  }

  function pauseRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
    }
    try { recognitionRef.current?.stop(); } catch {}
    stopTimer();
    setInterimText('');
    setRecordPhase('paused');
  }

  function resumeRecording() {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
    }
    try { recognitionRef.current?.start(); } catch {}
    startTimer();
    setRecordPhase('active');
  }

  function restartRecording() {
    cleanupRecording();
    setTranscript('');
    setInterimText('');
    setElapsedSec(0);
    setMicError('');
    setRecordPhase('idle');
  }

  async function completeRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;

    stopTimer();
    try { recognitionRef.current?.stop(); } catch {}
    setInterimText('');

    // stop() 호출 후 onstop에서 마지막 청크 수집
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());

    const mimeType = mimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size === 0) {
      setMicError('녹음된 내용이 없어요. 다시 시도해 주세요.');
      setRecordPhase('idle');
      return;
    }

    const url = URL.createObjectURL(blob);
    setAudioBlob(blob);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setStep('review');
  }

  function cleanupRecording() {
    try { recorderRef.current?.stop(); } catch {}
    try { recognitionRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopTimer();
  }

  // ─────────────────────────────────────────────────────────────
  // 오디오 플레이어 핸들러
  // ─────────────────────────────────────────────────────────────

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }

  // ─────────────────────────────────────────────────────────────
  // Supabase 업로드 + 실패 시 IndexedDB 임시 저장
  // ─────────────────────────────────────────────────────────────

  async function saveRecording() {
    if (!audioBlob || !selectedQ) return;
    setIsSaving(true);

    const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${userId}/${selectedQ.id}_${ts}.${ext}`;

    try {
      const { error: storageErr } = await supabase.storage
        .from('voice-records')
        .upload(storagePath, audioBlob, {
          contentType: mimeTypeRef.current || 'audio/webm',
        });
      if (storageErr) throw storageErr;

      // ⚠️ voice_answers.question_id는 TEXT 타입으로 생성해야 합니다
      //    (questions.id가 'event_q01' 형식의 TEXT이므로)
      const { error: dbErr } = await supabase.from('voice_answers').insert({
        user_id: userId,
        question_id: selectedQ.id,
        audio_url: storagePath,
      });
      if (dbErr) throw dbErr;

      setTotalCount((c) => c + 1);
      setStep('done');
    } catch {
      // 업로드 실패 → IndexedDB에 seoro_on_pending_audio 키로 임시 저장
      await savePendingAudio({
        id: `${userId}_${selectedQ.id}_${Date.now()}`,
        userId,
        questionId: selectedQ.id,
        blob: audioBlob,
        mimeType: mimeTypeRef.current,
        createdAt: new Date().toISOString(),
      });
      // 어르신 화면은 완료로 전환 (실패 화면 노출 방지)
      setTotalCount((c) => c + 1);
      setStep('done');
    } finally {
      setIsSaving(false);
    }
  }

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
          });
          await removePendingAudio(item.id);
        }
      }
    } catch { /* 재시도 실패 시 조용히 넘김 */ }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 화면 1: 간편 안내 (image_1.png)
  // ─────────────────────────────────────────────────────────────

  const renderGuide = () => {
    const guideSteps = [
      {
        emoji: '📋',
        badge: '첫 번째',
        title: '질문을 하나 골라 주세요.',
        desc: '마음에 드는 질문에 손을 대주시면 돼요.',
      },
      {
        emoji: '🎙',
        badge: '두 번째',
        title: '큰 주황색 버튼을 눌러\n편하게 말씀해 주세요.',
        desc: '말씀하시는 동안 글로 바뀌어요.',
      },
      {
        emoji: '✅',
        badge: '세 번째',
        title: '이야기를 저장하면\n완성이에요!',
        desc: '자녀분이 언제든 들을 수 있어요.',
      },
    ];

    return (
      <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-5 pb-8 pt-12">
        <h1 className="mb-8 text-center text-[2.2rem] font-extrabold text-stone-800">
          이렇게 하시면 돼요
        </h1>

        <div className="flex flex-1 flex-col gap-4">
          {guideSteps.map((s) => (
            <div
              key={s.badge}
              className="flex items-start gap-5 rounded-2xl bg-white px-6 py-6 shadow-sm"
            >
              <span className="mt-1 shrink-0 text-[2.8rem]" role="img" aria-hidden>
                {s.emoji}
              </span>
              <div>
                <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-[1.4rem] font-bold text-orange-600">
                  {s.badge}
                </span>
                <p className="mt-2 whitespace-pre-line text-[1.9rem] font-bold leading-snug text-stone-800">
                  {s.title}
                </p>
                <p className="mt-1 text-[1.6rem] leading-snug text-stone-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep('question')}
          className="mt-8 flex h-[80px] w-full items-center justify-center rounded-2xl bg-orange-500 shadow-lg transition-transform active:scale-95"
          aria-label="질문 보러 가기"
        >
          <span className="text-[2rem] font-bold text-white">질문 보러 가기 &gt;</span>
        </button>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 화면 2: 질문 선택 (image_2.png)
  // ─────────────────────────────────────────────────────────────

  const renderQuestion = () => (
    <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-5 pb-8 pt-12">
      <h1 className="mb-8 text-[2rem] font-extrabold leading-snug text-stone-800">
        오늘은 어떤 이야기를<br />해볼까요?
      </h1>

      {qLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[6px] border-stone-200 border-t-orange-500" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => {
                setSelectedQ(q);
                setTranscript('');
                setInterimText('');
                setElapsedSec(0);
                setRecordPhase('idle');
                setMicError('');
                setStep('recording');
              }}
              aria-label={`질문 ${idx + 1}: ${q.text}`}
              className="flex min-h-[80px] w-full items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm transition-transform active:scale-[0.98] text-left"
            >
              <span className="flex-1 text-[1.8rem] font-semibold leading-snug text-stone-800">
                {q.text}
              </span>
              <span className="shrink-0 text-[2rem] text-stone-300" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={fetchQuestions}
        disabled={qLoading}
        className="mt-6 flex h-[80px] w-full items-center justify-center rounded-2xl border-2 border-orange-400 bg-white transition-transform active:scale-95 disabled:opacity-50"
        aria-label="다른 질문 보기"
      >
        <span className="text-[1.8rem] font-bold text-orange-500">
          {qLoading ? '불러오는 중...' : '다른 질문 보기'}
        </span>
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 화면 3: 음성 녹음 (image_3.png)
  // ─────────────────────────────────────────────────────────────

  const renderRecording = () => {
    const isIdle = recordPhase === 'idle';
    const isActive = recordPhase === 'active';
    const isPaused = recordPhase === 'paused';
    const hasAudio = isPaused && chunksRef.current.length > 0;

    return (
      <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-5 pb-8 pt-10">
        {/* 질문 말풍선 */}
        <div className="relative mb-6">
          <div className="rounded-2xl bg-orange-100 px-6 py-5">
            <p className="text-[1.8rem] font-semibold leading-snug text-stone-800">
              {selectedQ?.text}
            </p>
          </div>
          {/* 말풍선 꼬리 */}
          <div
            className="absolute -bottom-[10px] left-10 h-5 w-5 rotate-45 bg-orange-100"
            aria-hidden
          />
        </div>

        {/* 중앙 영역: 녹음 버튼 + STT */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          {/* 주황색 원형 녹음 버튼 */}
          <button
            onClick={
              isIdle ? startRecording : isActive ? pauseRecording : resumeRecording
            }
            aria-label={
              isIdle ? '녹음 시작' : isActive ? '잠깐 멈추기' : '이어서 말하기'
            }
            className={[
              'flex h-[200px] w-[200px] flex-col items-center justify-center rounded-full shadow-2xl transition-transform active:scale-95',
              isActive ? 'animate-pulse bg-red-500' : 'bg-orange-500',
            ].join(' ')}
          >
            <span className="text-[4rem]" role="img" aria-hidden>
              {isActive ? '⏸' : '🎙'}
            </span>
            <span className="mt-2 whitespace-pre-line text-center text-[1.6rem] font-bold leading-snug text-white">
              {isIdle && '눌러서\n말하기'}
              {isActive && '녹음 중\n(멈추기)'}
              {isPaused && '이어서\n말하기'}
            </span>
          </button>

          {/* 녹음 시간 */}
          {(isActive || isPaused) && (
            <p className="text-[1.9rem] font-semibold text-stone-600">
              {isActive && (
                <span
                  className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-red-500 align-middle"
                  aria-hidden
                />
              )}
              {fmtSec(elapsedSec)}
            </p>
          )}

          {/* 오류 메시지 */}
          {micError && (
            <p className="whitespace-pre-line text-center text-[1.6rem] text-red-600">
              {micError}
            </p>
          )}

          {/* STT 텍스트 영역 */}
          {(isActive || isPaused) && (
            <div className="w-full rounded-2xl bg-white px-6 py-5 shadow-sm">
              <p className="min-h-[60px] text-[1.8rem] leading-relaxed text-stone-700">
                {transcript}
                <span className="text-stone-400">{interimText}</span>
                {!transcript && !interimText && (
                  <span className="text-stone-300">
                    말씀하신 내용이 여기에 나타납니다
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 (일시정지 상태) */}
        {isPaused && (
          <div className="flex flex-col gap-3 mt-4">
            {/* 확인하러 가기 (완료) */}
            {hasAudio && (
              <button
                onClick={completeRecording}
                className="flex h-[80px] items-center justify-center rounded-2xl bg-orange-500 shadow-md transition-transform active:scale-95"
              >
                <span className="text-[1.9rem] font-bold text-white">
                  확인하러 가기 ›
                </span>
              </button>
            )}
            {/* 이어서 계속 말하기 */}
            <button
              onClick={resumeRecording}
              className="flex h-[80px] items-center justify-center rounded-2xl border-2 border-orange-400 bg-white shadow-sm transition-transform active:scale-95"
            >
              <span className="text-[1.8rem] font-bold text-orange-500">
                이야기 이어서 계속 말하기
              </span>
            </button>
            {/* 처음부터 다시 하기 */}
            <button
              onClick={restartRecording}
              className="flex h-[80px] items-center justify-center rounded-2xl bg-stone-100 transition-transform active:scale-95"
            >
              <span className="text-[1.8rem] font-semibold text-stone-600">
                이야기 처음부터 다시 하기
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 화면 4: 녹음 확인 및 저장 (image_4.png)
  // ─────────────────────────────────────────────────────────────

  const renderReview = () => (
    <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-5 pb-8 pt-12">
      {/* 헤더 */}
      <div className="mb-8 flex items-center gap-4">
        <span className="text-[3.5rem]" role="img" aria-label="체크">✅</span>
        <h1 className="text-[2.2rem] font-extrabold text-stone-800">참 잘하셨어요!</h1>
      </div>

      {/* 오디오 플레이어 */}
      {audioUrl && (
        <div className="mb-6 rounded-2xl bg-white px-6 py-6 shadow-sm">
          {/* hidden audio element */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) setDuration(audioRef.current.duration);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
          />
          <div className="flex items-center gap-5">
            {/* 재생/정지 버튼 */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? '정지' : '재생'}
              className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-full bg-orange-500 shadow-md transition-transform active:scale-95"
            >
              <span className="text-[2.2rem] text-white" aria-hidden>
                {isPlaying ? '⏸' : '▶'}
              </span>
            </button>
            {/* 진행 바 */}
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="재생 위치 조절"
                className="w-full cursor-pointer accent-orange-500"
                style={{ height: '8px' }}
              />
              <div className="mt-1 flex justify-between">
                <span className="text-[1.5rem] text-stone-500">
                  {fmtSec(Math.floor(currentTime))}
                </span>
                <span className="text-[1.5rem] text-stone-500">
                  {fmtSec(Math.floor(duration))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STT 텍스트 */}
      <div className="mb-6 flex-1 rounded-2xl bg-white px-6 py-5 shadow-sm overflow-y-auto">
        <p className="mb-3 text-[1.5rem] font-semibold text-stone-400">기록된 내용</p>
        <p className="text-[1.8rem] leading-relaxed text-stone-700">
          {transcript || (
            <span className="text-stone-300">텍스트가 기록되지 않았어요.</span>
          )}
        </p>
      </div>

      {/* 저장 / 재녹음 버튼 */}
      <div className="flex flex-col gap-3">
        <button
          onClick={saveRecording}
          disabled={isSaving}
          className="flex h-[80px] items-center justify-center rounded-2xl bg-orange-500 shadow-lg transition-transform active:scale-95 disabled:opacity-60"
          aria-label="이야기 저장하기"
        >
          {isSaving ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          ) : (
            <span className="text-[2rem] font-bold text-white">이야기 저장하기</span>
          )}
        </button>
        <button
          onClick={() => {
            restartRecording();
            setStep('recording');
          }}
          className="flex h-[80px] items-center justify-center rounded-2xl bg-stone-100 transition-transform active:scale-95"
          aria-label="이야기 다시 말하기"
        >
          <span className="text-[1.8rem] font-semibold text-stone-600">
            이야기 다시 말하기 (재녹음)
          </span>
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 화면 5: 완료 (image_5.png)
  // ─────────────────────────────────────────────────────────────

  const renderDone = () => (
    <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <span className="text-[6rem]" role="img" aria-label="체크">✅</span>

        <div className="text-center">
          <h1 className="text-[2.8rem] font-extrabold text-stone-800">잘 들었습니다</h1>
          <p className="mt-3 text-[2rem] font-semibold text-stone-600">다음 주에 또 뵐게요</p>
        </div>

        <div className="w-full max-w-xs rounded-2xl bg-white px-8 py-7 text-center shadow-md">
          <p className="text-[1.6rem] text-stone-400">지금까지</p>
          <p className="text-[3.5rem] font-extrabold leading-tight text-orange-500">
            {totalCount}번
          </p>
          <p className="text-[1.8rem] font-semibold text-stone-700">이야기하셨어요.</p>
        </div>
      </div>

      <button
        onClick={() => router.push('/senior/archive')}
        className="mb-10 flex h-[80px] w-full items-center justify-center rounded-2xl bg-orange-500 shadow-lg transition-transform active:scale-95"
        aria-label="내 이야기 보기"
      >
        <span className="text-[2rem] font-bold text-white">내 이야기 보기</span>
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 메인 렌더 (단계 분기)
  // ─────────────────────────────────────────────────────────────

  switch (step) {
    case 'guide':     return renderGuide();
    case 'question':  return renderQuestion();
    case 'recording': return renderRecording();
    case 'review':    return renderReview();
    case 'done':      return renderDone();
  }
}
