import type { Metadata, Viewport } from 'next'
import { NavBar } from '@/components/ui/NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: '서로ON',
  description: '어르신의 목소리를 이야기로, 이야기를 카드뉴스로',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-surface min-h-screen">
        <NavBar />
        <div className="max-w-lg mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  )
}
