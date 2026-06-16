'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { ShareButton } from './ShareButton'

interface StoryCardProps {
  imageUrl: string
  storyText: string
  recordingId: string
  shareToken: string
}

export function StoryCard({ imageUrl, storyText, recordingId, shareToken }: StoryCardProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `seoroon-story-${recordingId}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('다운로드 중 에러:', err)
      // Fallback
      window.open(imageUrl, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-fade-in">
      {/* 카드 내용 영역 */}
      <div className="p-5 flex flex-col gap-4">
        {/* 이미지 컨테이너 (border-radius: 16px 및 shadow 적용) */}
        <div className="relative w-full aspect-video bg-amber-50 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <Image
            src={imageUrl}
            alt="AI가 그린 우리 가족 이야기"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </div>

        {/* 이야기 텍스트 영역 - 항상 노출 */}
        <div className="p-5 bg-brand/5 rounded-2xl border border-brand/10 text-gray-700 text-base leading-relaxed whitespace-pre-wrap font-sans">
          {storyText}
        </div>

        {/* 캡션 및 하단 공유/다운로드 액션 */}
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-xs text-center text-gray-400">AI가 그린 우리 가족 이야기</p>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-1.5"
            >
              {downloading ? '저장 중...' : '📥 이미지 저장'}
            </Button>
            <ShareButton shareToken={shareToken} />
          </div>
        </div>
      </div>
    </div>
  )
}
