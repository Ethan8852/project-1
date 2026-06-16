'use client'

import { useEffect, useRef } from 'react'

interface RecorderWaveformProps {
  stream: MediaStream | null
}

export function RecorderWaveform({ stream }: RecorderWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) return
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const gfx = canvas.getContext('2d')!
      analyser.getByteFrequencyData(data)

      gfx.clearRect(0, 0, canvas.width, canvas.height)
      const barW = 4
      const gap = 3
      const n = Math.floor(canvas.width / (barW + gap))

      for (let i = 0; i < n; i++) {
        const v = data[Math.floor((i / n) * data.length)] / 255
        const h = Math.max(4, v * canvas.height)
        const x = i * (barW + gap)
        const y = (canvas.height - h) / 2
        gfx.fillStyle = `rgba(224, 144, 60, ${0.4 + v * 0.6})`
        gfx.beginPath()
        gfx.roundRect(x, y, barW, h, 2)
        gfx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.close()
    }
  }, [stream])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={60}
      className="opacity-80"
    />
  )
}
