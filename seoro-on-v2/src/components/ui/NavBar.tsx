'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavBar() {
  const path = usePathname()

  // 공유 페이지엔 네비 없음
  if (path.startsWith('/share')) return null

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-orange-100">
      <div className="max-w-lg mx-auto flex items-center justify-between px-5 h-14">
        <Link href="/" className="text-lg font-bold text-brand">서로ON</Link>
        <div className="flex gap-2">
          <NavLink href="/" active={path === '/'}>질문 선택</NavLink>
          <NavLink href="/library" active={path.startsWith('/library')}>이야기함</NavLink>
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        active
          ? 'bg-brand text-white'
          : 'text-gray-500 hover:text-brand hover:bg-orange-50'
      }`}
    >
      {children}
    </Link>
  )
}
