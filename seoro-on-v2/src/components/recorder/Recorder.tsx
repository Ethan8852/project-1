'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { uploadAudio } from '@/lib/storage'
import { RecorderButton } from './RecorderButton'
import { RecorderTimer } from './RecorderTimer'
import { RecorderWaveform } from './RecorderWaveform'

const TEST_USER_ID = process.env.NEXT_PUBLIC_TEST_USER_ID!
const MAX_SEC = 600

interface RecorderProps {
  questionId: string
  questionText: string
  onDone: (recordingId: string, audioBlob: Blob) => void
}

type RecorderState = 'idle' | 'recording' | 'paused' | 'uploading'

export function Recorder({ questionId, questionText, onDone }: RecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [durationSec, setDurationSec] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const durationSecRef = useRef<number>(0)

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  // 녹음 타이머 구동
  useEffect(() => {
    if (state !== 'recording') return
    const timer = setInterval(() => {
      durationSecRef.current += 1
      setDurationSec(durationSecRef.current)

      if (durationSecRef.current >= MAX_SEC) {
        stopRecording()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [state, stopRecording])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true })
      setStream(ms)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

      const mr = new MediaRecorder(ms, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = mr
      chunksRef.current = []
      durationSecRef.current = 0
      setDurationSec(0)

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        ms.getTracks().forEach((t) => t.stop())
        setStream(null)
        setState('uploading')

        const finalDuration = durationSecRef.current
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        const ext = mr.mimeType.includes('mp4') ? 'mp4' : 'webm'
        const recordingId = crypto.randomUUID()
        const audioPath = `${TEST_USER_ID}/${recordingId}.${ext}`

        const { error: uploadErr } = await uploadAudio(audioPath, blob)
        if (uploadErr) {
          setError('업로드 실패: ' + uploadErr.message)
          setState('idle')
          return
        }

        const { error: dbErr } = await supabase.from('recordings').insert({
          id: recordingId,
          user_id: TEST_USER_ID,
          question_id: questionId,
          question_text: questionText,
          audio_path: audioPath,
          duration_sec: finalDuration,
          status: 'recorded',
        })

        if (dbErr) {
          setError('저장 실패: ' + dbErr.message)
          setState('idle')
          return
        }

        onDone(recordingId, blob)
      }

      mr.start(1000)
      setState('recording')
    } catch (err) {
      setError('마이크 권한이 필요합니다.')
      console.error(err)
    }
  }, [questionId, questionText, onDone])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setState('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setState('recording')
    }
  }, [])

  const handleClick = () => {
    if (state === 'idle') {
      startRecording()
    } else if (state === 'recording') {
      pauseRecording()
    } else if (state === 'paused') {
      resumeRecording()
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full relative">
      <RecorderWaveform stream={stream} />

      <RecorderTimer sec={durationSec} />

      <RecorderButton state={state} onClick={handleClick} />

      <p className="text-sm text-gray-500">
        {state === 'idle' && '버튼을 눌러 녹음을 시작하세요'}
        {state === 'recording' && '버튼을 누르면 일시정지됩니다'}
        {state === 'paused' && '버튼을 누르면 다시 녹음됩니다'}
        {state === 'uploading' && '저장 중...'}
      </p>

      {/* 우측 하단 완료 버튼 */}
      {(state === 'recording' || state === 'paused') && (
        <button
          onClick={stopRecording}
          className="fixed bottom-10 right-6 z-50 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 px-6 rounded-full shadow-xl active:scale-95 transition-all text-sm flex items-center gap-1.5 animate-fade-in"
        >
          <span>완료</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
