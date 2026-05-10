import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, doc, query, where,
  getDocs, getDoc, addDoc, serverTimestamp, runTransaction, updateDoc,
  setDoc, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import ChargeModal from '../components/ChargeModal'
import RetentionModal from '../components/RetentionModal'

const SELLER_UID = import.meta.env.VITE_SELLER_UID
const BANK_INFO  = { bank: '부산은행', account: '217-12-015025-3', holder: '안필숙' }

function fmtDate(seconds) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function histLabel(item) {
  if (item._type === 'charge') return {
    icon: '💰', text: `+₩${item.totalAmount?.toLocaleString()}`,
    color: 'var(--color-success)',
    sub: item.status === 'pending' ? '충전 신청 (입금 확인 대기)' : '충전 완료',
  }
  if (item._type === 'deduction') return {
    icon: '📦', text: `-₩${item.amount?.toLocaleString()}`,
    color: 'var(--color-text)',
    sub: item.productName ? `구독 차감 — ${item.productName}` : '구독 차감',
  }
  return {
    icon: '🏦', text: `-₩${item.amount?.toLocaleString()}`,
    color: 'var(--color-error)',
    sub: `환전 신청 (${item.status === 'pending' ? '처리 중' : '완료'})`,
  }
}

const PERIODS = [
  { value: 'week1', main: '1주차', sub: '매월 첫째 주' },
  { value: 'week2', main: '2주차', sub: '매월 둘째 주' },
  { value: 'week3', main: '3주차', sub: '매월 셋째 주' },
  { value: 'week4', main: '4주차', sub: '매월 넷째 주' },
]

const REV_FILTERS = ['오늘', '이번주차', '이번달', '전체']

function getCurrentWeekOfMonth() {
  const day = new Date().getDate()
  if (day <= 7)  return 'week1'
  if (day <= 14) return 'week2'
  if (day <= 21) return 'week3'
  return 'week4'
}

function getYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`
}

function periodLabel(value, customDate) {
  const p = PERIODS.find(p => p.value === value)
  if (p) return `매월 ${p.main}`
  if (value === 'custom') return customDate ? `특정 날짜 (${customDate})` : '특정 날짜'
  return value
}

function fmtPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function calcRevenue(subs, filter) {
  const now = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  const currentWeek = getCurrentWeekOfMonth()
  if (filter === '오늘') {
    return subs
      .filter(s => (s.createdAt?.seconds ?? 0) >= todayStart)
      .reduce((sum, s) => sum + (s.totalPrice ?? s.productPrice ?? 0), 0)
  }
  if (filter === '이번주차') {
    return subs
      .filter(s => s.period === currentWeek && s.status !== 'cancelled')
      .reduce((sum, s) => sum + (s.totalPrice ?? s.productPrice ?? 0), 0)
  }
  if (filter === '이번달') {
    return subs
      .filter(s => (s.createdAt?.seconds ?? 0) >= monthStart)
      .reduce((sum, s) => sum + (s.totalPrice ?? s.productPrice ?? 0), 0)
  }
  return subs.reduce((sum, s) => sum + (s.totalPrice ?? s.productPrice ?? 0), 0)
}

// ══════════════════════════════════════════════════════════
//  최상위
// ══════════════════════════════════════════════════════════
export default function Main() {
  const { user, isSeller } = useAuth()
  const navigate  = useNavigate()
  const resetRef  = useRef(null)

  function handleLogoClick() {
    resetRef.current?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="logo" style={{ cursor: 'pointer' }} onClick={handleLogoClick}>
            Sub<em>Link</em>
          </span>
          <button className="nav-link" onClick={() => navigate('/mypage')}>
            마이페이지 →
          </button>
        </div>
      </nav>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 var(--container-px) 88px' }}>
        {isSeller
          ? <SellerView user={user} />
          : <CustomerView user={user} resetRef={resetRef} />
        }
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════
//  판매자 뷰
// ══════════════════════════════════════════════════════════
function SellerView({ user }) {
  const yearMonth   = getYearMonth()
  const currentWeek = getCurrentWeekOfMonth()

  const [products,       setProducts]       = useState([])
  const [subs,           setSubs]           = useState([])
  const [charges,        setCharges]        = useState([])
  const [completedIds,   setCompletedIds]   = useState(new Set())
  const [tab,            setTab]            = useState(0)
  const [form,           setForm]           = useState({ name: '', price: '', description: '' })
  const [saving,         setSaving]         = useState(false)
  const [toast,          setToast]          = useState(false)
  const [expandedWeek,   setExpandedWeek]   = useState(currentWeek)
  const [revFilter,      setRevFilter]      = useState(0)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm,       setEditForm]       = useState({ name: '', price: '', description: '' })
  const [undoBanner,     setUndoBanner]     = useState(null)
  const [deliveryError,  setDeliveryError]  = useState('')
  const [subFilter,      setSubFilter]      = useState('활성')
  const [showSubscribers, setShowSubscribers] = useState(false)
  const [showDeliveryDetail, setShowDeliveryDetail] = useState(false)
  const [bonusTarget,    setBonusTarget]    = useState(null)
  const [bonusAmount,    setBonusAmount]    = useState('')
  const [bonusSaving,    setBonusSaving]    = useState(false)
  const [allDeliveries,  setAllDeliveries]  = useState([])
  const [chargeHistory,  setChargeHistory]  = useState([])
  const [showDelivHist,  setShowDelivHist]  = useState(false)
  const [delivHistFilter, setDelivHistFilter] = useState('30d')
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const undoTimerRef = useRef(null)

  useEffect(() => { fetchAll(); fetchDeliveries() }, [])
  useEffect(() => { if (tab === 4) fetchCharges() }, [tab])

  // Tab 키 단축키: 수익 필터 순환
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Tab' && document.activeElement === document.body) {
        e.preventDefault()
        setRevFilter(f => (f + 1) % REV_FILTERS.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function fetchAll() {
    const [pSnap, sSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'),      where('ownerId', '==', user.uid))),
      getDocs(query(collection(db, 'subscriptions'), where('ownerId', '==', user.uid))),
    ])
    setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setSubs(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function fetchDeliveries() {
    const ymw  = `${yearMonth}_${currentWeek}`
    const snap = await getDocs(query(
      collection(db, 'deliveries'),
      where('ymw', '==', ymw),
    ))
    setCompletedIds(new Set(snap.docs.map(d => d.data().subId)))
  }

  async function fetchCharges() {
    const [pendingSnap, histSnap] = await Promise.all([
      getDocs(query(collection(db, 'charges'), where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'charges'), where('status', '==', 'confirmed'))),
    ])
    setCharges(
      pendingSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    )
    setChargeHistory(
      histSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.confirmedAt?.seconds ?? b.createdAt?.seconds ?? 0) - (a.confirmedAt?.seconds ?? a.createdAt?.seconds ?? 0))
    )
  }

  async function fetchAllDeliveries() {
    const snap = await getDocs(query(collection(db, 'deliveries'), where('sellerId', '==', user.uid)))
    setAllDeliveries(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0))
    )
  }

  function exportCSV() {
    const bom  = '﻿'
    const hdr  = '수취인명,전화번호,주소'
    const q    = v => `"${(v ?? '').replace(/"/g, '""')}"`
    const rows = thisWeekSubs.map(s =>
      [q(s.recipientName ?? s.customerName), q(s.phone), q(s.address)].join(',')
    )
    const csv  = bom + [hdr, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `배송목록_${yearMonth}_${currentWeek.replace('week', '')}주차.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function toggleComplete(sub) {
    const ymw         = `${yearMonth}_${currentWeek}`
    const deliveryRef = doc(db, 'deliveries', `${sub.id}_${ymw}`)

    if (completedIds.has(sub.id)) {
      // 완료 취소: deductionId 있으면 환불 후 삭제
      try {
        const delivSnap = await getDoc(deliveryRef)
        if (delivSnap.exists() && delivSnap.data().deductionId) {
          const deductionId = delivSnap.data().deductionId
          const walletRef   = doc(db, 'wallets', sub.customerId)
          const deductRef   = doc(db, 'deductions', deductionId)
          const amount      = sub.totalPrice ?? sub.productPrice ?? 0
          await runTransaction(db, async (tx) => {
            const ws  = await tx.get(walletRef)
            const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
            tx.set(walletRef, { balance: bal + amount, updatedAt: serverTimestamp() }, { merge: true })
            tx.delete(deductRef)
            tx.delete(deliveryRef)
          })
        } else {
          await deleteDoc(deliveryRef)
        }
        setCompletedIds(prev => { const next = new Set(prev); next.delete(sub.id); return next })
      } catch (err) {
        alert(`되돌리기 오류: ${err.code ?? err.message}`)
      }
    } else {
      // 발송 완료: 지갑 차감
      const walletRef = doc(db, 'wallets', sub.customerId)
      const deductRef = doc(collection(db, 'deductions'))
      const amount    = sub.totalPrice ?? sub.productPrice ?? 0
      try {
        await runTransaction(db, async (tx) => {
          const ws  = await tx.get(walletRef)
          const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
          if (bal < amount) throw new Error('잔액 부족')
          tx.set(walletRef, { balance: bal - amount, updatedAt: serverTimestamp() }, { merge: true })
          tx.set(deductRef, {
            userId: sub.customerId, amount, type: 'delivery',
            productName: sub.productName, subscriptionId: sub.id,
            createdAt: serverTimestamp(),
          })
          tx.set(deliveryRef, {
            subId: sub.id, ymw, yearMonth, week: currentWeek,
            sellerId: user.uid, customerId: sub.customerId,
            deductionId: deductRef.id, completedAt: serverTimestamp(),
          })
        })
        setCompletedIds(prev => new Set([...prev, sub.id]))
      } catch (err) {
        if (err.message === '잔액 부족') {
          try {
            await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'paused' })
            setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'paused' } : s))
          } catch {}
          setDeliveryError(`"${sub.recipientName ?? sub.customerName}" — 구독머니 부족으로 처리 실패. 구독이 일시정지 되었습니다.`)
          setTimeout(() => setDeliveryError(''), 5000)
        } else {
          alert(`배송 완료 오류: ${err.code ?? err.message}`)
        }
      }
    }
  }

  async function batchComplete(subsToComplete) {
    if (!subsToComplete.length) return
    const ymw        = `${yearMonth}_${currentWeek}`
    const failNames  = []
    await Promise.all(subsToComplete.map(async (sub) => {
      const deliveryRef = doc(db, 'deliveries', `${sub.id}_${ymw}`)
      const walletRef   = doc(db, 'wallets', sub.customerId)
      const deductRef   = doc(collection(db, 'deductions'))
      const amount      = sub.totalPrice ?? sub.productPrice ?? 0
      try {
        await runTransaction(db, async (tx) => {
          const ws  = await tx.get(walletRef)
          const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
          if (bal < amount) throw new Error('잔액 부족')
          tx.set(walletRef, { balance: bal - amount, updatedAt: serverTimestamp() }, { merge: true })
          tx.set(deductRef, {
            userId: sub.customerId, amount, type: 'delivery',
            productName: sub.productName, subscriptionId: sub.id,
            createdAt: serverTimestamp(),
          })
          tx.set(deliveryRef, {
            subId: sub.id, ymw, yearMonth, week: currentWeek,
            sellerId: user.uid, customerId: sub.customerId,
            deductionId: deductRef.id, completedAt: serverTimestamp(),
          })
        })
        setCompletedIds(prev => new Set([...prev, sub.id]))
      } catch (err) {
        if (err.message === '잔액 부족') {
          try {
            await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'paused' })
            setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'paused' } : s))
          } catch {}
          failNames.push(sub.recipientName ?? sub.customerName)
        }
      }
    }))
    if (failNames.length > 0) {
      setDeliveryError(`잔액 부족 ${failNames.length}건 처리 실패: ${failNames.join(', ')}`)
      setTimeout(() => setDeliveryError(''), 5000)
    }
  }

  async function undoDelivery(delivery) {
    const deliveryRef = doc(db, 'deliveries', delivery.id)
    try {
      if (delivery.deductionId) {
        const sub     = subs.find(s => s.id === delivery.subId)
        const amount  = sub?.totalPrice ?? sub?.productPrice ?? 0
        const walletRef = doc(db, 'wallets', delivery.customerId)
        const deductRef = doc(db, 'deductions', delivery.deductionId)
        await runTransaction(db, async (tx) => {
          const ws  = await tx.get(walletRef)
          const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
          tx.set(walletRef, { balance: bal + amount, updatedAt: serverTimestamp() }, { merge: true })
          tx.delete(deductRef)
          tx.delete(deliveryRef)
        })
      } else {
        await deleteDoc(deliveryRef)
      }
      setAllDeliveries(prev => prev.filter(d => d.id !== delivery.id))
      if (delivery.ymw === `${yearMonth}_${currentWeek}`) {
        setCompletedIds(prev => { const next = new Set(prev); next.delete(delivery.subId); return next })
      }
    } catch (err) {
      alert(`되돌리기 오류: ${err.code ?? err.message}`)
    }
  }

  async function addProduct(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    setSaving(true)
    await addDoc(collection(db, 'products'), {
      ownerId: user.uid, sellerId: user.uid,
      name: form.name, price: Number(form.price),
      description: form.description, active: true,
      createdAt: serverTimestamp(),
    })
    setForm({ name: '', price: '', description: '' })
    await fetchAll()
    setSaving(false)
  }

  function startEdit(p) {
    setEditingProduct(p.id)
    setEditForm({ name: p.name, price: String(p.price), description: p.description ?? '' })
  }

  async function updateProduct(p) {
    const newName  = editForm.name.trim()
    const newPrice = Number(editForm.price)
    if (!newName || !newPrice) return

    await updateDoc(doc(db, 'products', p.id), {
      name: newName, price: newPrice, description: editForm.description,
    })

    const relatedSubs = subs.filter(s => s.productId === p.id)
    if (relatedSubs.length > 0) {
      await Promise.all(relatedSubs.map(s =>
        updateDoc(doc(db, 'subscriptions', s.id), {
          productName: newName,
          productPrice: newPrice,
          totalPrice: newPrice * (s.qty ?? 1),
        })
      ))
      setSubs(prev => prev.map(s =>
        s.productId === p.id
          ? { ...s, productName: newName, productPrice: newPrice, totalPrice: newPrice * (s.qty ?? 1) }
          : s
      ))
    }

    setProducts(prev => prev.map(pr =>
      pr.id === p.id ? { ...pr, name: newName, price: newPrice, description: editForm.description } : pr
    ))
    setEditingProduct(null)
  }

  async function deleteProduct(p) {
    const relatedSubs = subs.filter(s => s.productId === p.id)
    const msg = relatedSubs.length > 0
      ? `"${p.name}" 상품을 삭제하면 관련 구독 ${relatedSubs.length}건도 모두 삭제됩니다. 계속하시겠습니까?`
      : `"${p.name}" 상품을 삭제하시겠습니까?`
    if (!window.confirm(msg)) return

    await Promise.all([
      deleteDoc(doc(db, 'products', p.id)),
      ...relatedSubs.map(s => deleteDoc(doc(db, 'subscriptions', s.id))),
    ])

    setProducts(prev => prev.filter(pr => pr.id !== p.id))
    setSubs(prev => prev.filter(s => s.productId !== p.id))
  }

  async function sellerUpdateSubStatus(sub, status) {
    const prevStatus = sub.status
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status })
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status } : s))

      if (status === 'cancelled') {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        setUndoBanner({ sub, prevStatus })
        undoTimerRef.current = setTimeout(() => setUndoBanner(null), 5000)
      }
    } catch (err) {
      console.error('구독 상태 변경 오류:', err)
      alert('상태 변경에 실패했습니다.')
    }
  }

  async function undoCancel() {
    if (!undoBanner) return
    clearTimeout(undoTimerRef.current)
    try {
      await updateDoc(doc(db, 'subscriptions', undoBanner.sub.id), { status: undoBanner.prevStatus })
      setSubs(prev => prev.map(s => s.id === undoBanner.sub.id ? { ...s, status: undoBanner.prevStatus } : s))
    } catch (err) {
      console.error('되돌리기 오류:', err)
      alert('되돌리기에 실패했습니다.')
    }
    setUndoBanner(null)
  }

  async function giftBonus(sub, amount) {
    const num = Number(amount)
    if (!num || num < 1) return
    setBonusSaving(true)
    const walletRef = doc(db, 'wallets', sub.customerId)
    try {
      await runTransaction(db, async (tx) => {
        const ws  = await tx.get(walletRef)
        const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
        tx.set(walletRef, { balance: bal + num, updatedAt: serverTimestamp() }, { merge: true })
      })
      setBonusTarget(null)
      setBonusAmount('')
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    } catch (err) {
      alert(`보너스 지급 오류: ${err.code ?? err.message}`)
    }
    setBonusSaving(false)
  }

  async function confirmCharge(charge) {
    const walletRef = doc(db, 'wallets', charge.userId)
    const chargeRef = doc(db, 'charges', charge.id)
    try {
      await runTransaction(db, async (tx) => {
        const ws  = await tx.get(walletRef)
        const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
        tx.set(walletRef, { balance: bal + charge.totalAmount, updatedAt: serverTimestamp() }, { merge: true })
        tx.update(chargeRef, { status: 'confirmed', confirmedAt: serverTimestamp() })
      })
      fetchCharges()
    } catch (err) {
      console.error('충전 확인 오류:', err)
      alert(`충전 확인 오류: ${err.code ?? err.message}`)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.origin + '/app').then(() => {
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    })
  }

  const activeSubs        = subs.filter(s => s.status === 'active').length
  const thisWeekSubs      = subs.filter(s => s.period === currentWeek && s.status !== 'cancelled')
  const thisWeekCompleted = thisWeekSubs.filter(s => completedIds.has(s.id)).length
  const revenue           = calcRevenue(subs, REV_FILTERS[revFilter])
  const isEmpty           = products.length === 0 && subs.length === 0

  return (
    <>
      {deliveryError && (
        <div className="pause-banner" style={{ background: 'var(--color-error)' }}>
          {deliveryError}
        </div>
      )}

      {undoBanner && (
        <div className="pause-banner" style={{ background: 'var(--color-error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>"{undoBanner.sub.recipientName ?? undoBanner.sub.customerName}" 구독이 해지되었습니다.</span>
          <button
            onClick={undoCancel}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            되돌리기
          </button>
        </div>
      )}

      {isEmpty ? <SellerEmpty /> : (
        <>
          {/* 통계 */}
          <div className="stats-grid" style={{ paddingTop: 16 }}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowSubscribers(true)}>
              <div className="stat-label">활성 구독자</div>
              <div className="stat-value">{activeSubs}</div>
              <div className="stat-sub">총 {subs.length}건 →</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab(2)}>
              <div className="stat-label">등록 상품</div>
              <div className="stat-value">{products.length}</div>
              <div className="stat-sub">상품관리 →</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setShowDeliveryDetail(true); fetchAllDeliveries() }}>
              <div className="stat-label">처리완료</div>
              <div className="stat-value">
                {thisWeekCompleted}
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                  /{thisWeekSubs.length}
                </span>
              </div>
              <div className="stat-sub">이번주차 배송 →</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }}
              onClick={() => setRevFilter(f => (f + 1) % REV_FILTERS.length)}>
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                수익
                <span style={{
                  fontSize: 9, background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                  borderRadius: 3, padding: '1px 5px', fontWeight: 700,
                }}>
                  {REV_FILTERS[revFilter]}
                </span>
              </div>
              <div className="stat-value" style={{ fontSize: revenue >= 100000 ? 16 : 22 }}>
                ₩{revenue.toLocaleString()}
              </div>
              <div className="stat-sub">탭으로 기간 변경</div>
            </div>
          </div>

          {/* 이번 주차 엑셀 다운로드 */}
          {thisWeekSubs.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={exportCSV}
              >
                📥 이번 {currentWeek.replace('week', '')}주차 배송목록 엑셀 저장 ({thisWeekSubs.length}건)
              </button>
            </div>
          )}

          {/* 판매자 배송 캘린더 */}
          <SellerCalendar
            subs={subs}
            completedIds={completedIds}
            expandedWeek={expandedWeek}
            currentWeek={currentWeek}
            onToggleWeek={week => setExpandedWeek(prev => prev === week ? null : week)}
          />

          {/* 탭 카드 */}
          <div className="card" style={{ padding: 0 }}>
            <div className="dtabs">
              {['배송목록', '구독목록', '상품관리', '링크공유', '충전확인'].map((t, i) => (
                <button key={t} className={`dtab${tab === i ? ' on' : ''}`} onClick={() => setTab(i)}>
                  {t}{i === 4 && charges.length > 0 ? ` (${charges.length})` : ''}
                </button>
              ))}
            </div>

            {/* TAB 0: 배송목록 */}
            {tab === 0 && (
              <div className="card-body">
                {thisWeekSubs.length === 0 ? (
                  <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    이번 주차 배송 예정 구독이 없어요.
                  </div>
                ) : (
                  <>
                    <div style={{
                      padding: '10px 18px 6px', fontSize: 11,
                      color: 'var(--color-text-muted)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6
                    }}>
                      <span>
                        {currentWeek.replace('week', '')}주차 배송 · {thisWeekSubs.length}건
                        {thisWeekCompleted > 0 && ` · ${thisWeekCompleted}건 완료`}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-secondary btn-sm" onClick={exportCSV}>엑셀 저장</button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => batchComplete(thisWeekSubs.filter(s => !completedIds.has(s.id)))}
                        >
                          전체 완료
                        </button>
                      </div>
                    </div>
                    {thisWeekSubs.map(sub => {
                      const done = completedIds.has(sub.id)
                      return (
                        <div key={sub.id} className={`dl-row${done ? ' done' : ''}`} onClick={() => toggleComplete(sub)}>
                          <button
                            className={`chk${done ? ' on' : ''}`}
                            onClick={e => { e.stopPropagation(); toggleComplete(sub) }}
                            aria-label="완료 처리"
                          />
                          <div className="av">{(sub.recipientName ?? sub.customerName ?? '?')[0]}</div>
                          <div className="lm" style={{ flex: 1, minWidth: 0 }}>
                            <div className="ln">{sub.recipientName ?? sub.customerName}</div>
                            <div className="ld">
                              {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                            </div>
                            {sub.phone && (
                              <div className="ld">
                                <a href={`tel:${sub.phone}`} onClick={e => e.stopPropagation()}
                                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                                  {sub.phone}
                                </a>
                              </div>
                            )}
                            <div className="ld">{sub.address}</div>
                          </div>
                          {done
                            ? <button className="btn-secondary btn-sm" style={{ flexShrink: 0 }}
                                onClick={e => { e.stopPropagation(); toggleComplete(sub) }}>
                                되돌리기
                              </button>
                            : <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                                {sub.status === 'active' ? '활성' : '정지'}
                              </span>
                          }
                        </div>
                      )
                    })}
                  </>
                )}
                {/* 발송 완료 내역 */}
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '0 18px' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: 'pointer' }}
                    onClick={() => { if (!showDelivHist) fetchAllDeliveries(); setShowDelivHist(v => !v) }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>발송 완료 내역</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{showDelivHist ? '▲' : '▼'}</span>
                  </div>
                  {showDelivHist && (
                    allDeliveries.length === 0
                      ? <div style={{ padding: '8px 0 16px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>발송 내역이 없어요.</div>
                      : allDeliveries.map(d => {
                          const sub = subs.find(s => s.id === d.subId)
                          return (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{sub?.recipientName ?? sub?.customerName ?? d.subId}</div>
                                <div style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>
                                  {sub?.productName ?? ''}{sub?.qty > 1 ? ` ×${sub.qty}` : ''} · {d.ymw?.replace('_week', ' ') ?? d.ymw}
                                </div>
                              </div>
                              <div style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                                {fmtDate(d.completedAt?.seconds)}
                              </div>
                            </div>
                          )
                        })
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: 구독목록 */}
            {tab === 1 && (() => {
              const filterMap = { '모두': null, '활성': 'active', '일시정지': 'paused', '해지': 'cancelled' }
              const filteredSubs = filterMap[subFilter]
                ? subs.filter(s => s.status === filterMap[subFilter])
                : subs
              return (
                <div className="card-body">
                  {/* 필터 */}
                  <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0', flexWrap: 'wrap' }}>
                    {['모두', '활성', '일시정지', '해지'].map(f => (
                      <button key={f} className="btn-secondary btn-sm"
                        style={subFilter === f ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-light)' } : {}}
                        onClick={() => setSubFilter(f)}>
                        {f}
                        <span style={{ marginLeft: 4, fontSize: 10 }}>
                          {f === '모두' ? subs.length
                           : f === '활성' ? subs.filter(s => s.status === 'active').length
                           : f === '일시정지' ? subs.filter(s => s.status === 'paused').length
                           : subs.filter(s => s.status === 'cancelled').length}
                        </span>
                      </button>
                    ))}
                  </div>
                  {filteredSubs.length === 0 ? (
                    <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {subs.length === 0 ? '아직 구독 신청이 없어요.' : '해당 상태의 구독이 없어요.'}
                    </div>
                  ) : filteredSubs.map(sub => (
                    <div key={sub.id} className="li" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="lm" style={{ flex: 1 }}>
                          <div className="ln">{sub.recipientName ?? sub.customerName}</div>
                          <div className="ld">
                            {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''} · {periodLabel(sub.period, sub.customDate)}
                          </div>
                          {sub.phone && <div className="ld">{sub.phone}</div>}
                          <div className="ld">{sub.address}</div>
                        </div>
                        <span className={`badge ${sub.status === 'active' ? 'badge-success' : sub.status === 'cancelled' ? 'badge-error' : 'badge-muted'}`} style={{ flexShrink: 0, marginLeft: 8 }}>
                          {sub.status === 'active' ? '활성' : sub.status === 'paused' ? '정지' : '해지'}
                        </span>
                      </div>
                      {sub.status !== 'cancelled' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {sub.status === 'paused' && (
                            <button className="btn-primary btn-sm" onClick={() => sellerUpdateSubStatus(sub, 'active')}>
                              활성화
                            </button>
                          )}
                          {sub.status === 'active' && (
                            <button className="btn-secondary btn-sm" onClick={() => sellerUpdateSubStatus(sub, 'paused')}>
                              일시정지
                            </button>
                          )}
                          <button
                            className="btn-secondary btn-sm"
                            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-light)' }}
                            onClick={() => sellerUpdateSubStatus(sub, 'cancelled')}
                          >
                            해지
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* TAB 2: 상품 관리 */}
            {tab === 2 && (
              <div className="card-body" style={{ padding: '16px 18px' }}>
                <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <input className="input-field" placeholder="상품명" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <input className="input-field" type="number" placeholder="가격 (원)" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  <input className="input-field" placeholder="상품 설명 (선택)" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? '등록 중…' : '+ 상품 등록'}
                  </button>
                </form>

                {products.length === 0
                  ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>등록된 상품이 없어요.</p>
                  : products.map(p => (
                    <div key={p.id} style={{ marginBottom: 12, borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                      {editingProduct === p.id ? (
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input className="input-field" placeholder="상품명" value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <input className="input-field" type="number" placeholder="가격 (원)" value={editForm.price}
                            onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                          <input className="input-field" placeholder="상품 설명 (선택)" value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -4 }}>
                            수정 시 관련 구독자에게 자동 반영됩니다.
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-primary btn-sm" onClick={() => updateProduct(p)}>저장</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditingProduct(null)}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <div className="list-item" style={{ border: 'none', borderRadius: 0 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                            {p.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.description}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                              ₩{p.price.toLocaleString()}
                            </span>
                            <button className="btn-secondary btn-sm" onClick={() => startEdit(p)}>수정</button>
                            <button
                              className="btn-secondary btn-sm"
                              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-light)' }}
                              onClick={() => deleteProduct(p)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            )}

            {/* TAB 3: 링크 공유 */}
            {tab === 3 && (
              <div className="card-body">
                <div style={{ padding: '16px 18px 4px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>구독 신청 링크</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>단골 고객에게 이 링크를 공유하세요</div>
                </div>
                <div className="lbox">
                  <span className="lurl">{window.location.origin}/app</span>
                  <button className="btn-secondary btn-sm" onClick={copyLink}>복사</button>
                </div>
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '📦', text: '택배 박스에 링크 동봉' },
                    { icon: '💬', text: '카카오톡 단골 고객에게 직접 전달' },
                    { icon: '📸', text: '인스타그램 바이오 링크 등록' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-text-muted)', alignItems: 'center' }}>
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 충전 확인 + 내역 */}
            {tab === 4 && (
              <div className="card-body">
                {/* 대기 중 */}
                <div style={{ padding: '8px 18px 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  입금 대기 ({charges.length}건)
                </div>
                {charges.length === 0 ? (
                  <div style={{ padding: '8px 18px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    대기 중인 충전 신청이 없어요.
                  </div>
                ) : charges.map(c => (
                  <div key={c.id} className="li" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="av">{(c.userName ?? c.userEmail ?? '?')[0]?.toUpperCase()}</div>
                    <div className="lm">
                      <div className="ln">{c.userName || c.userEmail}</div>
                      <div className="ld">
                        입금 ₩{c.amount?.toLocaleString()}
                        {c.bonusAmount > 0 ? ` + 보너스 ₩${c.bonusAmount?.toLocaleString()}` : ''}
                        {' → '}충전 ₩{c.totalAmount?.toLocaleString()}
                      </div>
                    </div>
                    <button className="btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => confirmCharge(c)}>
                      확인
                    </button>
                  </div>
                ))}
                {/* 충전 내역 */}
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '8px 18px 0' }}>
                  <div style={{ padding: '10px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    충전 완료 내역 ({chargeHistory.length}건)
                  </div>
                  {chargeHistory.length === 0 ? (
                    <div style={{ padding: '8px 0 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>충전 내역이 없어요.</div>
                  ) : chargeHistory.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.userName || c.userEmail}</div>
                        <div style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>
                          ₩{c.amount?.toLocaleString()} + 보너스 ₩{(c.bonusAmount ?? 0)?.toLocaleString()} = ₩{c.totalAmount?.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {fmtDate(c.confirmedAt?.seconds ?? c.createdAt?.seconds)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 구독자 관리 바텀시트 */}
      {showSubscribers && (() => {
        const customerMap = {}
        subs.filter(s => s.status !== 'cancelled').forEach(sub => {
          if (!customerMap[sub.customerId]) {
            customerMap[sub.customerId] = {
              id: sub.customerId,
              name: sub.recipientName ?? sub.customerName ?? '(이름 없음)',
              phone: sub.phone,
              subs: [],
            }
          }
          customerMap[sub.customerId].subs.push(sub)
        })
        const customers = Object.values(customerMap)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
            onClick={e => e.target === e.currentTarget && setShowSubscribers(false)}>
            <div style={{ width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>구독자 목록 ({customers.length}명)</div>
                <button onClick={() => setShowSubscribers(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '0 0 32px' }}>
                {customers.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>활성 구독자가 없어요.</div>
                ) : customers.map(c => (
                  <div key={c.id}>
                    {/* 회원 헤더 */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', gap: 12 }}
                      onClick={() => setExpandedCustomerId(prev => prev === c.id ? null : c.id)}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--color-primary)', flexShrink: 0 }}>
                        {c.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                          구독 {c.subs.length}건 · {c.phone ?? '전화번호 없음'}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        {expandedCustomerId === c.id ? '▲' : '▼'}
                      </span>
                    </div>
                    {/* 해당 회원의 구독 목록 */}
                    {expandedCustomerId === c.id && (
                      <div style={{ background: 'var(--color-surface)' }}>
                        {c.subs.map(sub => (
                          <div key={sub.id} style={{ padding: '12px 20px 12px 72px', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                  {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                  {periodLabel(sub.period, sub.customDate)}
                                </div>
                                {sub.address && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.address}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                                  {sub.status === 'active' ? '활성' : '정지'}
                                </span>
                                <button className="btn-secondary btn-sm"
                                  style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary-light)' }}
                                  onClick={() => { setBonusTarget(bonusTarget?.id === sub.id ? null : sub); setBonusAmount('') }}>
                                  보너스
                                </button>
                                <button className="btn-secondary btn-sm"
                                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-light)' }}
                                  onClick={() => sellerUpdateSubStatus(sub, 'cancelled')}>
                                  해지
                                </button>
                              </div>
                            </div>
                            {bonusTarget?.id === sub.id && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <input className="input-field" type="number" placeholder="보너스 금액 (원)"
                                  value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
                                  style={{ flex: 1, padding: '8px 10px', fontSize: 13 }} min={1} />
                                <button className="btn-primary btn-sm" style={{ flexShrink: 0 }}
                                  disabled={bonusSaving || !bonusAmount}
                                  onClick={() => giftBonus(sub, bonusAmount)}>
                                  {bonusSaving ? '…' : '지급'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 배송 처리 상세 바텀시트 */}
      {showDeliveryDetail && (() => {
        const now30   = Date.now() / 1000 - 30 * 86400
        const months  = [...new Set(allDeliveries.map(d => d.yearMonth).filter(Boolean))].sort().reverse()
        const filtered = delivHistFilter === '30d'
          ? allDeliveries.filter(d => (d.completedAt?.seconds ?? 0) >= now30)
          : allDeliveries.filter(d => d.yearMonth === delivHistFilter)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
            onClick={e => e.target === e.currentTarget && setShowDeliveryDetail(false)}>
            <div style={{ width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>발송 완료 내역 ({filtered.length}건)</div>
                <button onClick={() => setShowDeliveryDetail(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
              </div>
              {/* 날짜 필터 */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--color-border)', scrollbarWidth: 'none' }}>
                {[{ key: '30d', label: '최근 30일' }, ...months.map(m => ({ key: m, label: `${m.replace('_', '년 ')}월` }))].map(({ key, label }) => (
                  <button key={key} className="btn-secondary btn-sm"
                    style={{ flexShrink: 0, ...(delivHistFilter === key ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-light)' } : {}) }}
                    onClick={() => setDelivHistFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ overflowY: 'auto', padding: '0 0 32px' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>발송 내역이 없어요.</div>
                ) : filtered.map(d => {
                  const sub = subs.find(s => s.id === d.subId)
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{sub?.recipientName ?? sub?.customerName ?? '(탈퇴 회원)'}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                          {sub?.productName}{sub?.qty > 1 ? ` ×${sub.qty}` : ''} · {fmtDate(d.completedAt?.seconds)}
                        </div>
                        {sub?.address && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.address}</div>}
                      </div>
                      <button className="btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => undoDelivery(d)}>
                        되돌리기
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      <div className={`toast${toast ? ' show' : ''}`}>완료 ✓</div>
    </>
  )
}

// ──────────────────────────────────────────────────────────
//  판매자 배송 캘린더
// ──────────────────────────────────────────────────────────
function SellerCalendar({ subs, completedIds, expandedWeek, currentWeek, onToggleWeek }) {
  const [expandedCustomDay, setExpandedCustomDay] = useState(null)
  const month = new Date().getMonth() + 1

  const grouped = { week1: [], week2: [], week3: [], week4: [] }
  const customByDay = {}
  subs.forEach(sub => {
    if (sub.status === 'cancelled') return
    if (sub.period in grouped) grouped[sub.period].push(sub)
    else if (sub.period === 'custom' && sub.customDate) {
      const d = new Date(sub.customDate + 'T00:00:00').getDate()
      if (!customByDay[d]) customByDay[d] = []
      customByDay[d].push(sub)
    }
  })

  const calItem = (sub) => {
    const done = completedIds.has(sub.id)
    return (
      <div key={sub.id} className="sel-cal-item">
        <div className={`sel-cal-dot${done ? ' done' : sub.status === 'active' ? ' active' : ''}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
            {sub.recipientName ?? sub.customerName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
            {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''}{sub.phone ? ` · ${sub.phone}` : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub.address}
          </div>
        </div>
        <span className={`badge ${done ? 'badge-muted' : sub.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
          {done ? '완료' : sub.status === 'active' ? '활성' : '정지'}
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="card-head">
        <span style={{ fontSize: 13, fontWeight: 700 }}>이번 달 배송 캘린더</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{month}월</span>
      </div>
      {['week1', 'week2', 'week3', 'week4'].map((week, idx) => {
        const weekSubs       = grouped[week]
        const isExpanded     = expandedWeek === week
        const isCurrent      = week === currentWeek
        const completedCount = weekSubs.filter(s => completedIds.has(s.id)).length

        return (
          <div key={week} className={`sel-cal-week${isCurrent ? ' current' : ''}`}>
            <div className="sel-cal-head" onClick={() => onToggleWeek(week)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isCurrent && <span className="sel-cal-now">이번 주</span>}
                <span className="sel-cal-label">{idx + 1}주차</span>
                <span className={`badge ${weekSubs.length > 0 ? 'badge-primary' : 'badge-muted'}`}>{weekSubs.length}건</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isCurrent && weekSubs.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{completedCount}/{weekSubs.length} 완료</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {isExpanded && weekSubs.length === 0 && (
              <div style={{ padding: '6px 18px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>이 주차 배송 없음</div>
            )}
            {isExpanded && weekSubs.map(calItem)}
          </div>
        )
      })}

      {/* 특정일 */}
      {Object.entries(customByDay).sort(([a],[b]) => Number(a)-Number(b)).map(([day, daySubs]) => {
        const isExpanded     = expandedCustomDay === day
        const completedCount = daySubs.filter(s => completedIds.has(s.id)).length
        return (
          <div key={day} className="sel-cal-week">
            <div className="sel-cal-head" onClick={() => setExpandedCustomDay(isExpanded ? null : day)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sel-cal-label">매월 {day}일</span>
                <span className={`badge ${daySubs.length > 0 ? 'badge-primary' : 'badge-muted'}`}>{daySubs.length}건</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {completedCount > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{completedCount}/{daySubs.length} 완료</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {isExpanded && daySubs.map(calItem)}
          </div>
        )
      })}
    </div>
  )
}

function SellerEmpty() {
  return (
    <div style={{ paddingTop: 16 }}>
      <div className="welcome-card">
        <div className="welcome-title">👋 SubLink에 오신 걸 환영해요</div>
        <div className="welcome-desc">단골 고객에게 정기배송 링크를 공유하면<br />자동으로 주문이 접수됩니다.</div>
        <div className="welcome-steps">
          {['상품 등록 및 구독 링크 생성', '링크를 단골 고객에게 공유', '고객 등록 후 주문 관리'].map((t, i) => (
            <div key={t} className="welcome-step">
              <div className="welcome-step-n">{i + 1}</div>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head"><span style={{ fontSize: 13, fontWeight: 700 }}>상품 관리</span></div>
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-title">등록된 상품이 없어요</div>
          <div className="empty-desc">첫 상품을 등록하고<br />구독 링크를 공유해보세요</div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  고객 뷰
// ══════════════════════════════════════════════════════════
function CustomerView({ user, resetRef }) {
  const [products,      setProducts]     = useState([])
  const [mySubs,        setMySubs]       = useState([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [selected,      setSelected]     = useState(null)
  const [step,          setStep]         = useState(1)
  const [qty,           setQty]          = useState(1)
  const [form,          setForm]         = useState({
    period: 'week2', customDate: '',
    recipientName: '',
    phone: '',
    address: '', addressDetail: '',
  })
  const [saving,        setSaving]       = useState(false)
  const [done,          setDone]         = useState(null)
  const [showCharge,    setShowCharge]   = useState(false)
  const [retentionSub,  setRetentionSub] = useState(null)
  const [pauseBanner,   setPauseBanner]  = useState('')
  const [chargeBanner,  setChargeBanner] = useState('')
  const [showLowBalance, setShowLowBalance] = useState(false)
  const [loaded,        setLoaded]       = useState({ wallet: false, subs: false })
  const [showHistory,   setShowHistory]  = useState(false)
  const [history,       setHistory]      = useState([])
  const [histLoading,   setHistLoading]  = useState(false)

  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => {
        setDone(null)
        setSelected(null)
        setStep(1)
        setQty(1)
        setForm({
          period: 'week2', customDate: '', recipientName: '',
          phone: '', address: localStorage.getItem('sublink_address') ?? '',
          addressDetail: localStorage.getItem('sublink_address_detail') ?? '',
        })
      }
    }
  }, [resetRef])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    document.body.appendChild(script)
    return () => { if (document.body.contains(script)) document.body.removeChild(script) }
  }, [])

  useEffect(() => {
    if (!SELLER_UID) return
    getDocs(query(
      collection(db, 'products'),
      where('ownerId', '==', SELLER_UID),
      where('active', '==', true)
    )).then(snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    fetchWallet()
    fetchMySubs()
  }, [])

  async function fetchWallet() {
    const snap = await getDoc(doc(db, 'wallets', user.uid))
    setWalletBalance(snap.exists() ? (snap.data().balance ?? 0) : 0)
    setLoaded(prev => ({ ...prev, wallet: true }))
  }

  async function fetchMySubs() {
    const snap = await getDocs(query(
      collection(db, 'subscriptions'),
      where('customerId', '==', user.uid)
    ))
    setMySubs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoaded(prev => ({ ...prev, subs: true }))
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

  useEffect(() => {
    if (!loaded.wallet || !loaded.subs) return
    const monthlyTotal = mySubs
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.totalPrice ?? s.productPrice ?? 0), 0)
    if (monthlyTotal > 0 && walletBalance < monthlyTotal * 2) {
      setShowLowBalance(true)
    }
  }, [loaded.wallet, loaded.subs])

  function selectProduct(p) {
    setSelected(p)
    setQty(1)
    setStep(1)
    const latest = [...mySubs]
      .filter(s => s.phone || s.recipientName)
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))[0]
    setForm(f => ({
      ...f,
      recipientName: latest?.recipientName ?? localStorage.getItem('sublink_profile_name') ?? user.displayName ?? '',
      phone: latest?.phone ?? localStorage.getItem('sublink_profile_phone') ?? '',
      address: localStorage.getItem('sublink_address') ?? '',
      addressDetail: localStorage.getItem('sublink_address_detail') ?? '',
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goStep(n) {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openAddress() {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스를 불러오는 중입니다.'); return }
    new window.daum.Postcode({
      oncomplete(data) {
        const addr = data.roadAddress || data.jibunAddress
        setForm(f => ({ ...f, address: addr, addressDetail: '' }))
        localStorage.setItem('sublink_address', addr)
      },
    }).open()
  }

  async function handleSubscribe() {
    setSaving(true)
    const fullAddr = form.addressDetail ? `${form.address} ${form.addressDetail}` : form.address
    const total    = selected.price * qty
    try {
      await addDoc(collection(db, 'subscriptions'), {
        ownerId: SELLER_UID, sellerId: SELLER_UID,
        customerId: user.uid, customerName: user.displayName, customerEmail: user.email,
        recipientName: form.recipientName, phone: form.phone,
        productId: selected.id, productName: selected.name, productPrice: selected.price,
        qty, totalPrice: total,
        address: fullAddr,
        period: form.period, customDate: form.period === 'custom' ? form.customDate : null,
        status: 'active', createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('구독 처리 오류:', err)
      setSaving(false)
      return
    }
    localStorage.setItem('sublink_address_detail', form.addressDetail)
    setSaving(false)
    setDone({ total })
    fetchMySubs()
  }

  async function handlePause(sub) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'paused' })
      setMySubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'paused' } : s))
      setPauseBanner(`"${sub.productName}" 구독이 일시정지 되었습니다.`)
      setTimeout(() => setPauseBanner(''), 3000)
    } catch (err) {
      console.error('일시정지 오류:', err)
      alert('일시정지 처리 중 오류가 발생했습니다.')
    }
  }

  async function handleResume(sub) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'active' })
      setMySubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'active' } : s))
    } catch (err) {
      console.error('재개 오류:', err)
      alert('재개 처리 중 오류가 발생했습니다.')
    }
  }

  function handleCancel(sub) {
    setRetentionSub(sub)
  }

  async function doCancel(sub, reason) {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: 'cancelled', cancelReason: reason })
      setMySubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'cancelled' } : s))
      setRetentionSub(null)
    } catch (err) {
      console.error('해지 오류:', err)
      alert('해지 처리 중 오류가 발생했습니다.')
    }
  }

  function reset() {
    setDone(null)
    setSelected(null)
    setStep(1)
    setQty(1)
    setForm({ period: 'week2', customDate: '', recipientName: '', phone: '', address: localStorage.getItem('sublink_address') ?? '', addressDetail: localStorage.getItem('sublink_address_detail') ?? '' })
  }

  if (!SELLER_UID) return (
    <div className="card" style={{ textAlign: 'center', padding: '32px 20px', marginTop: 16 }}>
      <p style={{ color: 'var(--color-error)', fontWeight: 600 }}>VITE_SELLER_UID 미설정</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        .env.local에 VITE_SELLER_UID를 입력 후 재시작하세요.
      </p>
    </div>
  )

  // ── 성공 화면 ──
  if (done) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="succ">
          <div className="succ-icon">✅</div>
          <div className="succ-title">구독 신청 완료!</div>
          <div className="succ-desc">
            판매자가 발송 처리 시 구독머니가 차감됩니다.
          </div>
          <div className="succ-info">
            <div className="succ-row"><span className="succ-k">상품</span><span className="succ-v">{selected.name} × {qty}</span></div>
            <div className="succ-row"><span className="succ-k">배송 주기</span><span className="succ-v">{periodLabel(form.period, form.customDate)}</span></div>
            <div className="succ-row"><span className="succ-k">배송지</span><span className="succ-v">{form.address}</span></div>
            <div className="succ-row"><span className="succ-k">수취인</span><span className="succ-v">{form.recipientName}</span></div>
            <div className="succ-row"><span className="succ-k">월 구독료</span><span className="succ-v">₩{done.total.toLocaleString()}</span></div>
          </div>
          <button onClick={reset} className="btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>
            처음으로
          </button>
        </div>
      </div>
    )
  }

  // ── 상품 목록 ──
  const activeMySubs = mySubs.filter(s => s.status !== 'cancelled')

  if (!selected) return (
    <div style={{ paddingTop: 16 }}>
      {pauseBanner && <div className="pause-banner">{pauseBanner}</div>}
      {chargeBanner && (
        <div className="pause-banner" style={{ background: 'var(--color-primary)' }}>{chargeBanner}</div>
      )}

      {/* 홍보 문구 */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10, letterSpacing: '.01em' }}>
        매번 주문하기 귀찮을 땐 <strong style={{ color: 'var(--color-primary)' }}>SubLink</strong>
      </div>

      {/* 구독머니 배너 */}
      <div
        className="wallet-banner"
        style={{ cursor: 'pointer' }}
        onClick={() => { setShowHistory(true); fetchHistory() }}
      >
        <div className="wallet-banner-left">
          <div className="wallet-banner-label">💰 구독머니 · 거래내역 보기</div>
          <div className="wallet-banner-balance">₩{walletBalance.toLocaleString()}</div>
        </div>
        <button className="btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setShowCharge(true) }}>충전</button>
      </div>

      {/* 상품 목록 */}
      <div className="card">
        <h2 className="card-title">상품 목록</h2>
        {products.length === 0
          ? <div className="empty-state">
              <div className="empty-icon">🛒</div>
              <div className="empty-title">등록된 상품이 없어요</div>
              <div className="empty-desc">판매자가 상품을 추가하면 여기에 표시됩니다.</div>
            </div>
          : products.map(p => (
            <div key={p.id} className="list-item list-item-click" onClick={() => selectProduct(p)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.description}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>₩{p.price.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>구독 →</div>
              </div>
            </div>
          ))
        }
      </div>

      {/* 이번 달 달력 */}
      {activeMySubs.length > 0 && <CustomerMonthCalendar subs={activeMySubs} />}

      {/* 배송 캘린더 */}
      {activeMySubs.length > 0 && (
        <DeliveryCalendar
          subs={activeMySubs}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
        />
      )}

      {showCharge && (
        <ChargeModal user={user} currentBalance={walletBalance}
          onClose={() => setShowCharge(false)}
          onCharged={() => {
            fetchWallet()
            setChargeBanner('충전 신청이 되었습니다.')
            setTimeout(() => setChargeBanner(''), 4000)
          }} />
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
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 24px 32px' }}>
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

      {showLowBalance && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowLowBalance(false)}
        >
          <div style={{ width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 20px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>구독머니가 부족해요</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                2개월치 구독료를 충당할 잔액이 없습니다.<br />지금 충전해 주세요.
              </div>
            </div>
            <button className="btn-primary" onClick={() => { setShowLowBalance(false); setShowCharge(true) }}>
              💰 지금 충전하기
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, padding: '10px 0', marginTop: 8 }}
              onClick={() => setShowLowBalance(false)}
            >
              나중에 할게요
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── 구독 플로우 (2단계) ──
  const total      = selected.price * qty
  const step1Valid = form.period !== 'custom' || form.customDate
  const step2Valid = form.address && form.recipientName && form.phone
  const hasEnough  = walletBalance >= total

  const customDay = form.period === 'custom' && form.customDate
    ? new Date(form.customDate + 'T00:00:00').getDate()
    : null

  return (
    <div style={{ paddingTop: 16 }}>
      {/* 상품 Hero */}
      <div className="hero">
        <div className="hero-img">📦</div>
        <div className="hero-body">
          <div className="hero-tag"><span className="hero-dot" />정기배송 상품</div>
          <div className="hero-name">{selected.name}</div>
          <div>
            <span className="hero-price">₩{selected.price.toLocaleString()}</span>
            <span className="hero-price-unit">/ 1개</span>
          </div>
          {selected.description && <div className="hero-desc">{selected.description}</div>}
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="steps">
        {[{ n: 1, label: '배송 설정' }, { n: 2, label: '정보 입력' }].map(({ n, label }) => (
          <div key={n} className={`step${step > n ? ' done' : step === n ? ' active' : ''}`}>
            <div className="step-num">{step > n ? '✓' : n}</div>
            <div className="step-label">{label}</div>
          </div>
        ))}
      </div>

      {/* PANEL 1: 배송 설정 */}
      {step === 1 && (
        <div className="card">
          <div className="card-head"><span style={{ fontSize: 13, fontWeight: 700 }}>배송 주기 선택</span></div>
          <div style={{ padding: '16px 18px' }}>
            <div className="field">
              <label className="field-label">수량</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: 36, height: 36, borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  −
                </button>
                <span style={{ fontSize: 17, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{qty}</span>
                <button type="button" onClick={() => setQty(q => q + 1)}
                  style={{ width: 36, height: 36, borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  +
                </button>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginLeft: 4 }}>
                  = ₩{total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="field">
              <label className="field-label">배송 주기</label>
              <div className="period-opts">
                {PERIODS.map(p => (
                  <div key={p.value}
                    className={`period-opt${form.period === p.value ? ' on' : ''}`}
                    onClick={() => setForm(f => ({ ...f, period: p.value, customDate: '' }))}
                  >
                    <div className="period-opt-main">{p.main}</div>
                    <div className="period-opt-sub">{p.sub}</div>
                  </div>
                ))}
              </div>
              <button type="button"
                className={`period-custom${form.period === 'custom' ? ' on' : ''}`}
                onClick={() => setForm(f => ({ ...f, period: 'custom' }))}>
                📅 특정 날짜 직접 선택
              </button>
              {form.period === 'custom' && (
                <>
                  <input className="input-field" type="date" value={form.customDate}
                    onChange={e => setForm(f => ({ ...f, customDate: e.target.value }))}
                    style={{ marginTop: 8 }} required />
                  {customDay && (
                    <div className="field-hint" style={{ color: 'var(--color-primary)', fontWeight: 600, marginTop: 6 }}>
                      📅 매월 {customDay}일에 배송됩니다.
                    </div>
                  )}
                </>
              )}
            </div>

            <button className="btn-primary" disabled={!step1Valid} onClick={() => goStep(2)}>
              다음 — 정보 입력
            </button>
          </div>
        </div>
      )}

      {/* PANEL 2: 정보 입력 + 구독 신청 */}
      {step === 2 && (
        <div className="card">
          <div className="card-head"><span style={{ fontSize: 13, fontWeight: 700 }}>배송 정보 입력</span></div>
          <div style={{ padding: '16px 18px' }}>
            <div className="field">
              <label className="field-label">수취인 이름</label>
              <input className="input-field" placeholder="수취인 이름" value={form.recipientName}
                onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">연락처</label>
              <input className="input-field" type="tel" placeholder="010-0000-0000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: fmtPhone(e.target.value) }))} />
              <div className="field-hint">배송 알림을 받을 번호</div>
            </div>
            <div className="field">
              <label className="field-label">배송지 주소</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="주소를 검색해주세요" value={form.address} readOnly style={{ flex: 1 }} />
                <button type="button" onClick={openAddress}
                  style={{ padding: '11px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  주소검색
                </button>
              </div>
              <input className="input-field" placeholder="상세 주소 (동/호수 등)" value={form.addressDetail}
                onChange={e => setForm(f => ({ ...f, addressDetail: e.target.value }))} />
            </div>

            <div className="sumbox" style={{ marginTop: 4 }}>
              <div className="sumrow"><span className="sumk">상품</span><span className="sumv">{selected.name} × {qty}</span></div>
              <div className="sumrow"><span className="sumk">배송 주기</span><span className="sumv">{periodLabel(form.period, form.customDate)}</span></div>
              {customDay && (
                <div className="sumrow">
                  <span className="sumk">배송일</span>
                  <span className="sumv" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>매월 {customDay}일</span>
                </div>
              )}
              <div className="sumtot">
                <span className="sumtot-k">월 구독료 (발송 시 차감)</span>
                <span className="sumtot-v">₩{total.toLocaleString()}</span>
              </div>
            </div>

            <div style={{
              background: hasEnough ? 'var(--color-success-light)' : 'var(--color-error-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 12px', fontSize: 12,
              color: hasEnough ? 'var(--color-success)' : 'var(--color-error)',
              fontWeight: 500, marginBottom: 14,
            }}>
              {hasEnough
                ? `구독머니 ₩${walletBalance.toLocaleString()} · 배송 완료 시 ₩${total.toLocaleString()} 차감`
                : `구독머니 부족 (₩${walletBalance.toLocaleString()}) — 구독 신청 후 배송 완료 전까지 충전해주세요.`
              }
            </div>

            {!hasEnough && (
              <button className="btn-secondary" style={{ marginBottom: 8 }} onClick={() => setShowCharge(true)}>
                💰 구독머니 충전하기
              </button>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => goStep(1)}>이전</button>
              <button className="btn-primary" style={{ flex: 2 }} disabled={!step2Valid || saving}
                onClick={handleSubscribe}>
                {saving ? '처리 중…' : `구독 신청 — ₩${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCharge && (
        <ChargeModal user={user} currentBalance={walletBalance}
          onClose={() => setShowCharge(false)}
          onCharged={() => {
            fetchWallet()
            setChargeBanner('충전 신청이 되었습니다.')
            setTimeout(() => setChargeBanner(''), 4000)
          }} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  고객 배송 캘린더
// ══════════════════════════════════════════════════════════
// ──────────────────────────────────────────────────────────
//  고객 이번 달 캘린더
// ──────────────────────────────────────────────────────────
function CustomerMonthCalendar({ subs }) {
  const now        = new Date()
  const year       = now.getFullYear()
  const monthIdx   = now.getMonth()
  const monthLabel = `${monthIdx + 1}월`
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const firstDow   = new Date(year, monthIdx, 1).getDay()

  const [expandedWeek, setExpandedWeek] = useState(null)
  const [expandedDay,  setExpandedDay]  = useState(null)

  const activeSubs = subs.filter(s => s.status !== 'cancelled')

  const weekGroups = { week1: [], week2: [], week3: [], week4: [] }
  const customByDay = {}
  activeSubs.forEach(sub => {
    if (sub.period in weekGroups) weekGroups[sub.period].push(sub)
    else if (sub.period === 'custom' && sub.customDate) {
      const d = new Date(sub.customDate + 'T00:00:00').getDate()
      if (!customByDay[d]) customByDay[d] = []
      customByDay[d].push(sub)
    }
  })

  function weekForDay(day) {
    if (day <= 7)  return 'week1'
    if (day <= 14) return 'week2'
    if (day <= 21) return 'week3'
    return 'week4'
  }

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  const WK_LABEL = { week1:'1주차', week2:'2주차', week3:'3주차', week4:'4주차' }

  return (
    <div className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="card-head">
        <span style={{ fontSize: 13, fontWeight: 700 }}>📅 이번 달 달력</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{monthLabel}</span>
      </div>
      <div style={{ padding: '0 10px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '4px 0',
              color: i === 0 ? 'var(--color-error)' : i === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        {rows.map((row, ri) => {
          const domWeek = (() => {
            const cnt = {}
            row.forEach(d => { if (d) { const w = weekForDay(d); cnt[w] = (cnt[w]||0)+1 } })
            return Object.entries(cnt).sort(([,a],[,b]) => b-a)[0]?.[0]
          })()
          const rowSubs = domWeek ? weekGroups[domWeek] : []
          const isExpanded = expandedWeek === domWeek && rowSubs.length > 0
          return (
            <div key={ri}>
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2,
                  cursor: rowSubs.length > 0 ? 'pointer' : 'default',
                  borderRadius: 6, outline: isExpanded ? '2px solid var(--color-primary)' : 'none' }}
                onClick={() => rowSubs.length > 0 && setExpandedWeek(v => v === domWeek ? null : domWeek)}
              >
                {row.map((day, ci) => {
                  const hasSub  = day && (rowSubs.length > 0 || (customByDay[day]?.length > 0))
                  const isToday = day === now.getDate()
                  return (
                    <div key={ci} style={{
                      textAlign: 'center', padding: '5px 1px', borderRadius: 6,
                      background: hasSub ? 'var(--color-primary-light)' : 'transparent',
                      border: isToday ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: isToday ? 800 : hasSub ? 600 : 400,
                            color: ci === 0 ? 'var(--color-error)' : ci === 6 ? 'var(--color-primary)' : hasSub ? 'var(--color-primary)' : 'var(--color-text)' }}>
                            {day}
                          </div>
                          {customByDay[day]?.length > 0 && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', margin: '1px auto 0' }} />
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {isExpanded && (
                <div style={{ background: 'var(--color-primary-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                    {WK_LABEL[domWeek]} 배송 상품
                  </div>
                  {rowSubs.map(s => (
                    <div key={s.id} style={{ fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                      <span>{s.productName}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>×{s.qty ?? 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {/* 특정일 */}
        {Object.entries(customByDay).map(([day, ds]) => (
          <div key={day}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 2px', cursor: 'pointer' }}
              onClick={() => setExpandedDay(v => v === day ? null : day)}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ color: 'var(--color-text-muted)' }}>매월 {day}일</span>
              <span>{ds.map(s => `${s.productName}${s.qty > 1 ? ` ×${s.qty}` : ''}`).join(', ')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--color-primary)' }}>{expandedDay === day ? '▲' : '▼'}</span>
            </div>
            {expandedDay === day && (
              <div style={{ background: 'var(--color-primary-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                {ds.map(s => (
                  <div key={s.id} style={{ fontSize: 12, color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                    <span>{s.productName}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>×{s.qty ?? 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* 범례 (주차 구독) */}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['week1','week2','week3','week4'].map(wk => {
            const ws = weekGroups[wk]; if (!ws.length) return null
            return (
              <div key={wk} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text-muted)' }}>{WK_LABEL[wk]}</span>
                <span>{ws.map(s => `${s.productName}${s.qty > 1 ? ` ×${s.qty}` : ''}`).join(', ')}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const WEEK_LABELS = {
  week1: '1주차 (첫째 주)',
  week2: '2주차 (둘째 주)',
  week3: '3주차 (셋째 주)',
  week4: '4주차 (넷째 주)',
}

function DeliveryCalendar({ subs, onPause, onResume, onCancel }) {
  const month = new Date().getMonth() + 1

  const grouped = { week1: [], week2: [], week3: [], week4: [], custom: [] }
  subs.forEach(sub => {
    if (sub.period in grouped) grouped[sub.period].push(sub)
    else grouped.custom.push(sub)
  })

  return (
    <div className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="card-head">
        <span style={{ fontSize: 13, fontWeight: 700 }}>이번 달 배송 일정</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{month}월</span>
      </div>
      <div>
        {Object.entries(WEEK_LABELS).map(([week, label]) => {
          const weekSubs = grouped[week]
          return (
            <div key={week} className="cal-week">
              <div className="cal-week-head">
                <span className="cal-week-label">{label}</span>
                {weekSubs.length > 0 && (
                  <span className={`badge ${weekSubs.some(s => s.status === 'active') ? 'badge-success' : 'badge-muted'}`}>
                    {weekSubs.length}건
                  </span>
                )}
              </div>
              {weekSubs.length === 0
                ? <div className="cal-week-empty">배송 없음</div>
                : weekSubs.map(sub => (
                  <div key={sub.id} className="cal-item">
                    <div className="cal-item-dot" style={{
                      background: sub.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
                    }} />
                    <div className="cal-item-body">
                      <div className="cal-item-name">{sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''}</div>
                      <div className="cal-item-price">₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}</div>
                    </div>
                    <div className="cal-item-actions">
                      {sub.status === 'active' ? (
                        <button className="cal-action-btn" onClick={() => onPause(sub)}>일시정지</button>
                      ) : (
                        <button className="cal-action-btn cal-action-resume" onClick={() => onResume(sub)}>재개</button>
                      )}
                      <button className="cal-action-btn cal-action-cancel" onClick={() => onCancel(sub)}>해지</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )
        })}

        {grouped.custom.length > 0 && (
          <div className="cal-week">
            <div className="cal-week-head">
              <span className="cal-week-label">특정 날짜</span>
              <span className={`badge ${grouped.custom.some(s => s.status === 'active') ? 'badge-success' : 'badge-muted'}`}>
                {grouped.custom.length}건
              </span>
            </div>
            {grouped.custom.map(sub => {
              const day = sub.customDate
                ? new Date(sub.customDate + 'T00:00:00').getDate()
                : null
              return (
                <div key={sub.id} className="cal-item">
                  <div className="cal-item-dot" style={{
                    background: sub.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
                  }} />
                  <div className="cal-item-body">
                    <div className="cal-item-name">{sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''}</div>
                    <div className="cal-item-price">
                      {day ? `매월 ${day}일` : sub.customDate} · ₩{(sub.totalPrice ?? sub.productPrice)?.toLocaleString()}
                    </div>
                  </div>
                  <div className="cal-item-actions">
                    {sub.status === 'active' ? (
                      <button className="cal-action-btn" onClick={() => onPause(sub)}>일시정지</button>
                    ) : (
                      <button className="cal-action-btn cal-action-resume" onClick={() => onResume(sub)}>재개</button>
                    )}
                    <button className="cal-action-btn cal-action-cancel" onClick={() => onCancel(sub)}>해지</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
