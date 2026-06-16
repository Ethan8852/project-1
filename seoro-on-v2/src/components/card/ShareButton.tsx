'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ShareButtonProps {
  shareToken: string
}

export function ShareButton({ shareToken }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareToken}`

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: '서로ON — 우리 가족 이야기', url })
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="secondary" size="md" onClick={handleShare} className="w-full">
      {copied ? '✓ 링크 복사됨!' : '🔗 카드뉴스 공유하기'}
    </Button>
  )
}
