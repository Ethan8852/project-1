import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const PERIOD_LABELS = {
  '1w': '1주마다',
  '2w': '2주마다',
  '4w': '4주마다',
  week1: '매월 1주차',
  week2: '매월 2주차',
  week3: '매월 3주차',
  week4: '매월 4주차',
  custom: '특정 날짜',
}

function periodLabel(sub) {
  const label = PERIOD_LABELS[sub.period] ?? sub.period
  if (sub.period === 'custom' && sub.customDate) return `${label} (${sub.customDate})`
  return label
}

export default function MyPage() {
  const { user, isSeller } = useAuth()
  const navigate = useNavigate()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const field = isSeller ? 'ownerId' : 'customerId'
    getDocs(query(collection(db, 'subscriptions'), where(field, '==', user.uid)))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setSubs(data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
        setLoading(false)
      })
  }, [user.uid, isSeller])

  async function handleLogout() {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  return (
    <>
      {/* 네비게이션 */}
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="logo">Sub<em>Link</em></span>
          <button className="nav-link" onClick={() => navigate('/app')}>
            ← 홈
          </button>
        </div>
      </nav>

      <div className="page-wrap">

        {/* 프로필 카드 */}
        <section className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {user.photoURL
              ? <img
                  src={user.photoURL}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '2px solid var(--color-border)',
                    flexShrink: 0,
                  }}
                />
              : <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--color-primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                  flexShrink: 0,
                }}>
                  {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                {user.displayName ?? '(이름 없음)'}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </div>
              {isSeller && (
                <span className="badge badge-primary" style={{ marginTop: 6 }}>
                  판매자
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 구독 목록 */}
        <section className="card">
          <h2 className="card-title">
            {isSeller ? `전체 구독 신청 (${subs.length})` : `내 구독 (${subs.length})`}
          </h2>

          {loading ? (
            <p className="empty-state">불러오는 중…</p>
          ) : subs.length === 0 ? (
            <p className="empty-state">
              {isSeller ? '아직 구독 신청이 없어요.' : '아직 구독한 상품이 없어요.'}
            </p>
          ) : (
            subs.map(sub => (
              <div key={sub.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{sub.productName}</div>
                  <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                    {sub.status === 'active' ? '활성' : sub.status}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                  <span>
                    {periodLabel(sub)} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                    {sub.qty && sub.qty > 1 ? ` (×${sub.qty})` : ''}
                  </span>
                  {sub.payMethod && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {sub.payMethod === 'transfer' ? '계좌이체' : '카드'}
                    </span>
                  )}
                </div>

                {isSeller ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {sub.recipientName ?? sub.customerName}
                    {sub.phone ? ` · ${sub.phone}` : ''}
                    {' · '}{sub.address}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {sub.address}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {/* 로그아웃 */}
        <button className="btn-secondary" onClick={handleLogout}>
          로그아웃
        </button>

      </div>
    </>
  )
}
