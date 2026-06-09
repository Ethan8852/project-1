import type { Metadata, Viewport } from 'next';
import './globals.css';
import StoryBoxButton from '@/components/StoryBoxButton';

export const metadata: Metadata = {
  title: '서로ON — 어르신의 1년을 한 권의 책으로',
  description: '매주 질문 하나로 어르신의 이야기를 기록합니다.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // 어르신 앱 — 확대 방지
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <StoryBoxButton />
      </body>
    </html>
  );
}
