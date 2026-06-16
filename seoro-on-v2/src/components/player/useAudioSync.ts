'use client'

import { useCallback, useRef, useState } from 'react'

export function useAudioSync() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    setCurrentMs(Math.round(el.currentTime * 1000))
  }, [])

  const onLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration ?? 0)
  }, [])

  const onEnded = useCallback(() => setIsPlaying(false), [])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setIsPlaying(true)
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }, [])

  const seek = useCallback((ms: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = ms / 1000
    setCurrentMs(ms)
  }, [])

  const setRate = useCallback((rate: number) => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [])

  return {
    audioRef,
    currentMs,
    isPlaying,
    duration,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
    togglePlay,
    seek,
    setRate,
  }
}
