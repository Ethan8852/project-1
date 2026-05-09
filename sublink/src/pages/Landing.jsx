import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const FEATURES = [
  { icon: '🔗', text: '링크 하나로 구독 신청 접수' },
  { icon: '📦', text: '배송 주기·수량 자동 관리' },
  { icon: '💸', text: '오픈마켓 수수료 0%' },
]

export default function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/app', { replace: true })
  }, [user, loading, navigate])

  async function handleLogin() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') alert(e.message)
    }
  }

  if (loading) return null

  return (
    <>
      {/* 상단 네비게이션 */}
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="logo">Sub<em>Link</em></span>
        </div>
      </nav>

      {/* 히어로 */}
      <main style={{
        minHeight: `calc(100vh - 52px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px 64px',
      }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

          {/* 아이콘 */}
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '16px',
            background: 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 28,
          }}>
            📦
          </div>

          {/* 헤드라인 */}
          <h1 style={{
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.5px',
            marginBottom: 10,
            lineHeight: 1.2,
          }}>
            단골 고객과<br />직접 연결하세요
          </h1>

          <p style={{
            fontSize: 15,
            color: 'var(--color-text-muted)',
            lineHeight: 1.7,
            marginBottom: 32,
          }}>
            수수료 없이 자동 정기배송.<br />링크 하나로 구독 신청부터 발송까지.
          </p>

          {/* 기능 리스트 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 32,
            textAlign: 'left',
          }}>
            {FEATURES.map(({ icon, text }) => (
              <div key={text} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                background: '#fff',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleLogin}
            className="btn-primary"
            style={{ fontSize: 15, padding: '13px 20px', marginBottom: 14 }}
          >
            <GoogleIcon />
            Google로 시작하기
          </button>

          <p style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
          }}>
            결제·알림은 앱 외부에서 처리됩니다 · MVP 버전
          </p>
        </div>
      </main>
    </>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
