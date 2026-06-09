'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function StoryBoxButton() {
  const pathname = usePathname();
  const router = useRouter();

  // 이야기함 페이지에선 버튼 숨김
  if (pathname === '/senior/recordings') return null;

  return (
    <button
      onClick={() => router.push('/senior/recordings')}
      aria-label="내 이야기함으로 이동"
      className="fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-full bg-[#1B6CA8] px-5 py-3 shadow-lg transition-transform active:scale-95"
    >
      <span className="text-[1.6rem]" role="img" aria-hidden>🎧</span>
      <span className="text-[1.4rem] font-bold text-white">내 이야기함</span>
    </button>
  );
}
