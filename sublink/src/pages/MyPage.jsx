import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import {
  collection, doc, query, where,
  getDocs, getDoc, updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import ChargeModal from '../components/ChargeModal'
import WithdrawModal from '../components/WithdrawModal'
import RetentionModal from '../components/RetentionModal'

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

function fmtDate(seconds) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function MyPage() {
  const { user, isSeller } = useAuth()
  const navigate = useNavigate()
  const [subs,          setSubs]         = useState([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading,       setLoading]      = useState(true)
  const [showCharge,    setShowCharge]   = useState(false)
  const [showWithdraw,  setShowWithdraw] = useState(false)
  const [history,       setHistory]      = useState([])
  const [histLoading,   setHistLoading]  = useState(false)
  const [pauseBanner,   setPauseBanner]  = useState('')
  const [retentionSub,  setRetentionSub] = useState(null)
  const [showHistory,   setShowHistory]  = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editProfile,   setEditProfile]  = useState({
    name: localStorage.getItem('sublink_profile_name') ?? '',
    phone: localStorage.getItem('sublink_profile_phone') ?? '',
    address: localStorage.getItem('sublink_address') ?? '',
  })

  useEffect(() => {
    const field = isSeller ? 'ownerId' : 'customerId'
    getDocs(query(collection(db, 'subscriptions'), where(field, '==', user.uid)))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setSubs(data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
        setLoading(false)
      })

    if (!isSeller) {
      getDoc(doc(db, 'wallets', user.uid)).then(ws => {
        setWalletBalance(ws.exists() ? (ws.data().balance ?? 0) : 0)
      })
      fetchHistory()
    }
  }, [user.uid, isSeller])

  async function fetchWallet() {
    const ws = await getDoc(doc(db, 'wallets', user.uid))
    setWalletBalance(ws.exists() ? (ws.data().balance ?? 0) : 0)
  }

  async function fetchHistory() {
    setHistLoading(true)
    const [chargesSnap, deductionsSnap, withdrawalsSnap] = await Promise.all([
      getDocs(query(collection(db, 'charges'),     where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'deductions'),  where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'withdrawals'), where('userId', '==', user.uid))),
    ])
    const items = [
      ...chargesSnap.docs.map(d    => ({ id: d.id, ...d.data(), _type: 'charge' })),
      ...deductionsSnap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'deduction' })),
      ...withdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'withdrawal' })),
    ]
    items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    setHistory(items)
    setHistLoading(false)
  }

  async function handlePause(sub) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'paused' })
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'paused' } : s))
      setPauseBanner(`"${sub.productName}" 구독이 일시정지 되었습니다.`)
      setTimeout(() => setPauseBanner(''), 3000)
    } catch (err) {
      console.error('일시정지 오류:', err)
      alert(`일시정지 오류: ${err.code ?? err.message}`)
    }
  }

  async function changeQty(sub, newQty) {
    if (newQty < 1) return
    const newTotal = sub.productPrice * newQty
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { qty: newQty, totalPrice: newTotal })
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, qty: newQty, totalPrice: newTotal } : s))
    } catch (err) {
      console.error('수량 변경 오류:', err)
      alert(`수량 변경 오류: ${err.code ?? err.message}`)
    }
  }

  async function handleResume(sub) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'active' })
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'active' } : s))
    } catch (err) {
      console.error('재개 오류:', err)
      alert(`재개 오류: ${err.code ?? err.message}`)
    }
  }

  async function doCancel(sub, reason) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'cancelled', cancelReason: reason })
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'cancelled' } : s))
      setRetentionSub(null)
    } catch (err) {
      console.error('해지 오류:', err)
      alert(`해지 오류: ${err.code ?? err.message}`)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  function statusBadgeClass(status) {
    if (status === 'active') return 'badge-success'
    if (status === 'cancelled') return 'badge-error'
    return 'badge-muted'
  }

  function statusLabel(status) {
    if (status === 'active') return '활성'
    if (status === 'paused') return '정지'
    if (status === 'cancelled') return '해지'
    return status
  }

  function histLabel(item) {
    if (item._type === 'charge') return {
      icon: '💰',
      text: `+₩${item.totalAmount?.toLocaleString()}`,
      color: 'var(--color-success)',
      sub: item.status === 'pending' ? '충전 신청 (입금 확인 대기)' : '충전 완료',
    }
    if (item._type === 'deduction') return {
      icon: '📦',
      text: `-₩${item.amount?.toLocaleString()}`,
      color: 'var(--color-text)',
      sub: item.productName ? `구독 차감 — ${item.productName}` : '구독 차감',
    }
    return {
      icon: '🏦',
      text: `-₩${item.amount?.toLocaleString()}`,
      color: 'var(--color-error)',
      sub: `환전 신청 (${item.status === 'pending' ? '처리 중' : '완료'})`,
    }
  }

  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="logo">Sub<em>Link</em></span>
          <button className="nav-link" onClick={() => navigate('/app')}>
            ← 홈
          </button>
        </div>
      </nav>

      {pauseBanner && <div className="pause-banner">{pauseBanner}</div>}

      <div className="page-wrap">

        {/* 프로필 카드 */}
        <section className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {user.photoURL
              ? <img
                  src={user.photoURL}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--color-border)', flexShrink: 0 }}
                />
              : <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--color-primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: 'var(--color-primary)', flexShrink: 0,
                }}>
                  {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setEditProfile({
                    name: localStorage.getItem('sublink_profile_name') ?? user.displayName ?? '',
                    phone: localStorage.getItem('sublink_profile_phone') ?? '',
                    address: localStorage.getItem('sublink_address') ?? '',
                  })
                  setShowEditProfile(true)
                }}
              >
                {localStorage.getItem('sublink_profile_name') || user.displayName || '(이름 없음)'}
                <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 500 }}>수정 ✎</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
              {isSeller && (
                <span className="badge badge-primary" style={{ marginTop: 6 }}>판매자</span>
              )}
            </div>
          </div>
        </section>

        {/* 구독머니 카드 (고객만) */}
        {!isSeller && (
          <section className="wallet-banner" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={() => setShowHistory(true)}>
            <div className="wallet-banner-left">
              <div className="wallet-banner-label">💰 구독머니 · 거래내역 보기</div>
              <div className="wallet-banner-balance">₩{walletBalance.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn-primary btn-sm" onClick={() => setShowCharge(true)}>충전</button>
              <button
                className="btn-secondary btn-sm"
                style={{ background: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }}
                onClick={() => setShowWithdraw(true)}
              >
                환전
              </button>
            </div>
          </section>
        )}

        {/* 판매자 캘린더 */}
        {isSeller && <SellerMyPageCalendar subs={subs} />}

        {/* 구독 목록 */}
        <section className="card">
          <h2 className="card-title">
            {isSeller ? `전체 구독 신청 (${subs.length})` : `내 구독 (${subs.filter(s => s.status !== 'cancelled').length})`}
          </h2>

          {loading ? (
            <p className="empty-state">불러오는 중…</p>
          ) : subs.filter(s => s.status !== 'cancelled').length === 0 && !isSeller ? (
            <p className="empty-state">아직 구독한 상품이 없어요.</p>
          ) : isSeller && subs.length === 0 ? (
            <p className="empty-state">아직 구독 신청이 없어요.</p>
          ) : (
            (isSeller ? subs : subs.filter(s => s.status !== 'cancelled')).map(sub => (
              <SubRow key={sub.id} sub={sub} isSeller={isSeller}
                onPause={handlePause} onResume={handleResume}
                onCancel={setRetentionSub} onChangeQty={changeQty}
                statusBadgeClass={statusBadgeClass} statusLabel={statusLabel} periodLabel={periodLabel} />
            ))
          )}
        </section>

        {/* 해지 내역 (고객만) */}
        {!isSeller && !loading && subs.filter(s => s.status === 'cancelled').length > 0 && (
          <section className="card" style={{ padding: 0 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}
              onClick={() => setShowCancelled(v => !v)}
            >
              <h2 className="card-title" style={{ margin: 0 }}>해지 내역 ({subs.filter(s => s.status === 'cancelled').length}건)</h2>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{showCancelled ? '▲' : '▼'}</span>
            </div>
            {showCancelled && subs.filter(s => s.status === 'cancelled').map(sub => (
              <div key={sub.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>{sub.productName}</div>
                  <span className="badge badge-error">해지</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {periodLabel(sub)} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                  {sub.cancelReason ? ` · 사유: ${sub.cancelReason}` : ''}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 로그아웃 */}
        <button className="btn-secondary" onClick={handleLogout}>
          로그아웃
        </button>

      </div>

      {showCharge && (
        <ChargeModal
          user={user}
          currentBalance={walletBalance}
          onClose={() => setShowCharge(false)}
          onCharged={async () => { await fetchWallet(); fetchHistory() }}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          user={user}
          currentBalance={walletBalance}
          onClose={() => setShowWithdraw(false)}
          onWithdrawn={(amount) => {
            setWalletBalance(prev => prev - amount)
            setShowWithdraw(false)
            fetchHistory()
          }}
        />
      )}

      {retentionSub && (
        <RetentionModal
          sub={retentionSub}
          onClose={() => setRetentionSub(null)}
          onPause={() => handlePause(retentionSub)}
          onConfirmCancel={(reason) => doCancel(retentionSub, reason)}
        />
      )}

      {showHistory && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowHistory(false)}
        >
          <div style={{ width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>거래 내역</div>
              <button onClick={() => setShowHistory(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 0 32px' }}>
              {histLoading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>불러오는 중…</div>
              ) : history.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>거래 내역이 없어요.</div>
              ) : history.map(item => {
                const { icon, text, color, sub: subText } = histLabel(item)
                return (
                  <div key={item.id} className="list-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{icon} {text}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{subText}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {fmtDate(item.createdAt?.seconds)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {/* 프로필 수정 바텀시트 */}
      {showEditProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div style={{ width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>배송 정보 수정</div>
              <button onClick={() => setShowEditProfile(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
            </div>
            <div className="field">
              <label className="field-label">이름</label>
              <input className="input-field" placeholder="이름" value={editProfile.name}
                onChange={e => setEditProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">전화번호</label>
              <input className="input-field" type="tel" placeholder="010-0000-0000" value={editProfile.phone}
                onChange={e => setEditProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">기본 배송지</label>
              <input className="input-field" placeholder="주소" value={editProfile.address}
                onChange={e => setEditProfile(p => ({ ...p, address: e.target.value }))} />
              <div className="field-hint">구독 신청 시 자동 입력됩니다.</div>
            </div>
            <button className="btn-primary" onClick={() => {
              localStorage.setItem('sublink_profile_name', editProfile.name)
              localStorage.setItem('sublink_profile_phone', editProfile.phone)
              localStorage.setItem('sublink_address', editProfile.address)
              setShowEditProfile(false)
            }}>
              저장
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────────
//  SubRow helper (고객 구독 행)
// ──────────────────────────────────────────────────────────
function SubRow({ sub, isSeller, onPause, onResume, onCancel, onChangeQty, statusBadgeClass, statusLabel, periodLabel }) {
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{sub.productName}</div>
        <span className={`badge ${statusBadgeClass(sub.status)}`}>{statusLabel(sub.status)}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        <span>{periodLabel(sub)} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}{sub.qty && sub.qty > 1 ? ` (×${sub.qty})` : ''}</span>
      </div>
      {isSeller ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {sub.recipientName ?? sub.customerName}{sub.phone ? ` · ${sub.phone}` : ''}{' · '}{sub.address}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{sub.address}</div>
      )}
      {!isSeller && sub.status !== 'cancelled' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>수량</span>
            <button className="btn-secondary btn-sm" style={{ padding: '2px 10px', fontSize: 16 }}
              onClick={() => onChangeQty(sub, (sub.qty ?? 1) - 1)} disabled={(sub.qty ?? 1) <= 1}>−</button>
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{sub.qty ?? 1}</span>
            <button className="btn-secondary btn-sm" style={{ padding: '2px 10px', fontSize: 16 }}
              onClick={() => onChangeQty(sub, (sub.qty ?? 1) + 1)}>+</button>
            <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 700 }}>
              ₩{((sub.productPrice ?? 0) * (sub.qty ?? 1)).toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {sub.status === 'active' ? (
              <button className="btn-secondary btn-sm" onClick={() => onPause(sub)}>일시정지</button>
            ) : sub.status === 'paused' ? (
              <button className="btn-primary btn-sm" onClick={() => onResume(sub)}>재개</button>
            ) : null}
            <button className="btn-secondary btn-sm"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-light)' }}
              onClick={() => onCancel(sub)}>해지</button>
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  판매자 마이페이지 캘린더
// ──────────────────────────────────────────────────────────
function SellerMyPageCalendar({ subs }) {
  const [expandedRow, setExpandedRow] = useState(null)
  const now          = new Date()
  const year         = now.getFullYear()
  const monthIdx     = now.getMonth()
  const daysInMonth  = new Date(year, monthIdx + 1, 0).getDate()
  const firstDow     = new Date(year, monthIdx, 1).getDay()

  const activeSubs = subs.filter(s => s.status !== 'cancelled')
  const wGroups = { week1: [], week2: [], week3: [], week4: [] }
  const customByDay = {}
  activeSubs.forEach(sub => {
    if (sub.period in wGroups) wGroups[sub.period].push(sub)
    else if (sub.period === 'custom' && sub.customDate) {
      const d = new Date(sub.customDate + 'T00:00:00').getDate()
      if (!customByDay[d]) customByDay[d] = []
      customByDay[d].push(sub)
    }
  })

  const weekForDay = d => d <= 7 ? 'week1' : d <= 14 ? 'week2' : d <= 21 ? 'week3' : 'week4'

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  const wkLabel = { week1: '1주차', week2: '2주차', week3: '3주차', week4: '4주차' }

  return (
    <section className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="card-head">
        <span style={{ fontSize: 13, fontWeight: 700 }}>📅 {monthIdx + 1}월 배송 캘린더</span>
      </div>
      <div style={{ padding: '0 10px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '4px 0',
              color: i === 0 ? 'var(--color-error)' : i === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        {rows.map((row, ri) => {
          const cnt = {}
          row.forEach(d => { if (d) { const w = weekForDay(d); cnt[w] = (cnt[w] || 0) + 1 } })
          const domWeek = Object.entries(cnt).sort(([,a],[,b]) => b-a)[0]?.[0]
          const rowSubs = domWeek ? wGroups[domWeek] : []
          const hasDelivery = rowSubs.length > 0
          const isExpanded  = expandedRow === ri

          return (
            <div key={ri}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2,
                cursor: hasDelivery ? 'pointer' : 'default' }}
                onClick={() => hasDelivery && setExpandedRow(isExpanded ? null : ri)}>
                {row.map((day, ci) => {
                  const isToday   = day === now.getDate()
                  const custSubs  = day ? (customByDay[day] ?? []) : []
                  const hasSub    = hasDelivery || custSubs.length > 0
                  return (
                    <div key={ci} style={{
                      textAlign: 'center', padding: '5px 1px', borderRadius: 6,
                      background: day && hasSub ? 'var(--color-primary-light)' : 'transparent',
                      border: isToday ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: isToday ? 800 : hasSub ? 600 : 400,
                            color: ci === 0 ? 'var(--color-error)' : ci === 6 ? 'var(--color-primary)' : hasSub ? 'var(--color-primary)' : 'var(--color-text)' }}>
                            {day}
                          </div>
                          {hasSub && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', margin: '1px auto 0' }} />}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {isExpanded && rowSubs.length > 0 && (
                <div style={{ margin: '0 0 8px', padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                    {wkLabel[domWeek]} 배송 ({rowSubs.length}건)
                  </div>
                  {rowSubs.map(sub => (
                    <div key={sub.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 600 }}>{sub.recipientName ?? sub.customerName}</div>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>
                        {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''}{sub.phone ? ` · ${sub.phone}` : ''}
                        {' · '}₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
