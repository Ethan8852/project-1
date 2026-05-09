import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, addDoc, query, where,
  getDocs, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const SELLER_UID = import.meta.env.VITE_SELLER_UID
const PERIODS = [
  { value: 'week1', label: '매월 1주차' },
  { value: 'week2', label: '매월 2주차' },
  { value: 'week3', label: '매월 3주차' },
  { value: 'week4', label: '매월 4주차' },
  { value: 'custom', label: '특정 날짜' },
]

const BANK_INFO = { bank: '부산은행', account: '217-12-015025-3', holder: '안필숙' }

function periodLabel(value, customDate) {
  const p = PERIODS.find(p => p.value === value)
  const base = p?.label ?? value
  if (value === 'custom' && customDate) return `${base} (${customDate})`
  return base
}

export default function Main() {
  const { user, isSeller } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="logo">Sub<em>Link</em></span>
          <button className="nav-link" onClick={() => navigate('/mypage')}>
            마이페이지 →
          </button>
        </div>
      </nav>

      <div className="page-wrap">
        <h1 style={{ fontSize: 17, fontWeight: 800, marginBottom: 20, color: 'var(--color-text)' }}>
          {isSeller ? '판매자 대시보드' : '상품 구독'}
        </h1>
        {isSeller ? <SellerView user={user} /> : <CustomerView user={user} />}
      </div>
    </>
  )
}

// ── 판매자 뷰 ─────────────────────────────────────────────
function SellerView({ user }) {
  const [products, setProducts] = useState([])
  const [subs, setSubs] = useState([])
  const [form, setForm] = useState({ name: '', price: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [pSnap, sSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('ownerId', '==', user.uid))),
      getDocs(query(collection(db, 'subscriptions'), where('ownerId', '==', user.uid))),
    ])
    setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setSubs(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function addProduct(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    setSaving(true)
    await addDoc(collection(db, 'products'), {
      ownerId: user.uid,
      sellerId: user.uid,
      name: form.name,
      price: Number(form.price),
      description: form.description,
      active: true,
      createdAt: serverTimestamp(),
    })
    setForm({ name: '', price: '', description: '' })
    await fetchAll()
    setSaving(false)
  }

  return (
    <>
      {/* 상품 등록 */}
      <section className="card">
        <h2 className="card-title">상품 등록</h2>
        <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input-field"
            placeholder="상품명"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input-field"
            type="number"
            placeholder="가격 (원)"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="상품 설명 (선택)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 4 }}>
            {saving ? '등록 중…' : '+ 상품 등록'}
          </button>
        </form>
      </section>

      {/* 내 상품 */}
      <section className="card">
        <h2 className="card-title">내 상품 ({products.length})</h2>
        {products.length === 0
          ? <p className="empty-state">아직 등록한 상품이 없어요.</p>
          : products.map(p => (
            <div key={p.id} className="list-item">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                {p.description && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {p.description}
                  </div>
                )}
              </div>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                ₩{p.price.toLocaleString()}
              </span>
            </div>
          ))
        }
      </section>

      {/* 구독 신청 목록 */}
      <section className="card">
        <h2 className="card-title">들어온 구독 신청 ({subs.length})</h2>
        {subs.length === 0
          ? <p className="empty-state">아직 구독 신청이 없어요.</p>
          : subs.map(sub => (
            <div key={sub.id} className="list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {sub.recipientName ?? sub.customerName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {sub.productName}
                  {sub.qty && sub.qty > 1 ? ` × ${sub.qty}` : ''}
                  {' · '}{periodLabel(sub.period, sub.customDate)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {sub.address}
                  {sub.phone ? ` · ${sub.phone}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {sub.payMethod === 'transfer' ? '계좌이체' : sub.payMethod === 'card' ? '카드' : ''}
                  {sub.totalPrice ? ` · ₩${sub.totalPrice.toLocaleString()}` : ''}
                </div>
              </div>
              <span className="badge badge-success" style={{ flexShrink: 0, marginLeft: 12 }}>활성</span>
            </div>
          ))
        }
      </section>
    </>
  )
}

// ── 고객 뷰 ───────────────────────────────────────────────
function CustomerView({ user }) {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)
  const [form, setForm] = useState({
    recipientName: '',
    phone: '',
    address: '',
    addressDetail: '',
    period: 'week2',
    customDate: '',
  })
  const [showPayment, setShowPayment] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  // Daum 우편번호 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    document.body.appendChild(script)
    return () => { if (document.body.contains(script)) document.body.removeChild(script) }
  }, [])

  // 상품 목록 로드
  useEffect(() => {
    if (!SELLER_UID) return
    getDocs(
      query(
        collection(db, 'products'),
        where('ownerId', '==', SELLER_UID),
        where('active', '==', true)
      )
    ).then(snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  function selectProduct(p) {
    setSelected(p)
    setQty(1)
    setForm(f => ({ ...f, recipientName: user.displayName ?? '' }))
  }

  function openAddressSearch() {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete(data) {
        setForm(f => ({ ...f, address: data.roadAddress || data.jibunAddress, addressDetail: '' }))
      },
    }).open()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.address || !selected) return
    if (form.period === 'custom' && !form.customDate) return
    setShowPayment(true)
  }

  async function confirmPayment(payMethod) {
    setSaving(true)
    const fullAddress = form.addressDetail
      ? `${form.address} ${form.addressDetail}`
      : form.address
    await addDoc(collection(db, 'subscriptions'), {
      ownerId: SELLER_UID,
      sellerId: SELLER_UID,
      customerId: user.uid,
      customerName: user.displayName,
      customerEmail: user.email,
      recipientName: form.recipientName,
      phone: form.phone,
      productId: selected.id,
      productName: selected.name,
      productPrice: selected.price,
      qty,
      totalPrice: selected.price * qty,
      address: fullAddress,
      period: form.period,
      customDate: form.period === 'custom' ? form.customDate : null,
      payMethod,
      status: 'active',
      createdAt: serverTimestamp(),
    })
    setSaving(false)
    setShowPayment(false)
    setDone(true)
  }

  function reset() {
    setDone(false)
    setSelected(null)
    setQty(1)
    setForm({ recipientName: '', phone: '', address: '', addressDetail: '', period: 'week2', customDate: '' })
  }

  if (!SELLER_UID) return (
    <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
      <p style={{ color: 'var(--color-error)', fontWeight: 600 }}>VITE_SELLER_UID 미설정</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
        .env.local에 VITE_SELLER_UID를 입력 후 재시작하세요.
      </p>
    </div>
  )

  if (done) return (
    <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--color-success-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: 24,
      }}>
        ✅
      </div>
      <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>구독 신청 완료!</h2>
      <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8, marginBottom: 24, fontSize: 14 }}>
        <strong style={{ color: 'var(--color-text)' }}>{selected?.name}</strong> × {qty}<br />
        {periodLabel(form.period, form.period === 'custom' ? form.customDate : null)}<br />
        {form.address}{form.addressDetail ? ` ${form.addressDetail}` : ''}
      </p>
      <button onClick={reset} className="btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>
        다른 상품 구독하기
      </button>
    </div>
  )

  // ── 구독 폼 ──
  if (selected) return (
    <>
      <section className="card">
        <button
          onClick={() => setSelected(null)}
          className="btn-ghost"
          style={{ marginBottom: 16 }}
        >
          ← 상품 목록으로
        </button>

        <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, color: 'var(--color-text)' }}>
          {selected.name}
        </h2>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 20 }}>
            ₩{selected.price.toLocaleString()}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 4 }}>/ 1개</span>
        </div>
        {selected.description && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            {selected.description}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 수량 */}
          <div className="field">
            <label className="field-label">수량</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text)',
                  transition: 'background 0.12s',
                }}
              >−</button>
              <span style={{ fontSize: 17, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty(q => q + 1)}
                style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text)',
                }}
              >+</button>
              <span style={{ marginLeft: 4, fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                = ₩{(selected.price * qty).toLocaleString()}
              </span>
            </div>
          </div>

          {/* 배송 주기 */}
          <div className="field">
            <label className="field-label">배송 주기</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PERIODS.map(p => {
                const active = form.period === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, period: p.value, customDate: '' }))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-primary-light)' : '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.12s',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            {form.period === 'custom' && (
              <input
                className="input-field"
                type="date"
                value={form.customDate}
                onChange={e => setForm(f => ({ ...f, customDate: e.target.value }))}
                required={form.period === 'custom'}
                style={{ marginTop: 8 }}
              />
            )}
          </div>

          {/* 배송지 주소 */}
          <div className="field">
            <label className="field-label">배송지 주소</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="input-field"
                placeholder="주소를 검색해주세요"
                value={form.address}
                readOnly
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={openAddressSearch}
                style={{
                  padding: '11px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--color-primary)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }}
              >
                주소검색
              </button>
            </div>
            <input
              className="input-field"
              placeholder="상세 주소 (동/호수 등)"
              value={form.addressDetail}
              onChange={e => setForm(f => ({ ...f, addressDetail: e.target.value }))}
            />
          </div>

          {/* 수취인 이름 */}
          <div className="field">
            <label className="field-label">수취인 이름</label>
            <input
              className="input-field"
              placeholder="수취인 이름"
              value={form.recipientName}
              onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
              required
            />
          </div>

          {/* 연락처 */}
          <div className="field">
            <label className="field-label">연락처</label>
            <input
              className="input-field"
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
            />
          </div>

          {/* 주문 요약 */}
          <div className="summary-box">
            <div className="summary-row">
              <span className="summary-key">상품</span>
              <span className="summary-val">{selected.name} × {qty}</span>
            </div>
            <div className="summary-row">
              <span className="summary-key">배송 주기</span>
              <span className="summary-val">
                {periodLabel(form.period, form.period === 'custom' ? form.customDate : null)}
              </span>
            </div>
            <div className="summary-total">
              <span className="summary-total-key">1회 결제 금액</span>
              <span className="summary-total-val">₩{(selected.price * qty).toLocaleString()}</span>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            구독 신청 — ₩{(selected.price * qty).toLocaleString()}
          </button>
        </form>
      </section>

      {showPayment && (
        <PaymentModal
          total={selected.price * qty}
          saving={saving}
          onConfirm={confirmPayment}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  )

  // ── 상품 목록 ──
  return (
    <section className="card">
      <h2 className="card-title">상품 목록</h2>
      {products.length === 0
        ? <p className="empty-state">등록된 상품이 없어요. 판매자가 상품을 추가하면 표시됩니다.</p>
        : products.map(p => (
          <div
            key={p.id}
            className="list-item list-item-clickable"
            onClick={() => selectProduct(p)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              {p.description && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {p.description}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 14 }}>
                ₩{p.price.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                구독 →
              </div>
            </div>
          </div>
        ))
      }
    </section>
  )
}

// ── 결제 모달 ─────────────────────────────────────────────
function PaymentModal({ total, saving, onConfirm, onClose }) {
  const [method, setMethod] = useState(null)
  const [copied, setCopied] = useState(false)
  const overlayRef = useRef(null)

  function copyAccount() {
    navigator.clipboard.writeText(BANK_INFO.account).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 999,
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px 40px',
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        boxShadow: '0 -4px 24px rgba(0,0,0,.1)',
      }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-text)', marginBottom: 4 }}>
            결제 방법 선택
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            결제 금액:{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              ₩{total.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* 카드결제 (준비중) */}
        <button
          type="button"
          disabled
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'not-allowed',
            marginBottom: 10,
            opacity: 0.55,
          }}
        >
          <span style={{ fontSize: 22 }}>💳</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>카드결제</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>준비중</div>
          </div>
        </button>

        {/* 계좌이체 */}
        <button
          type="button"
          onClick={() => setMethod('transfer')}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            border: `2px solid ${method === 'transfer' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: method === 'transfer' ? 'var(--color-primary-light)' : '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'all 0.12s',
          }}
        >
          <span style={{ fontSize: 22 }}>🏦</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontWeight: 700,
              fontSize: 14,
              color: method === 'transfer' ? 'var(--color-primary)' : 'var(--color-text)',
            }}>
              계좌이체
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              무통장 입금
            </div>
          </div>
        </button>

        {/* 계좌 정보 */}
        {method === 'transfer' && (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '.03em',
            }}>
              입금 계좌 정보
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>은행</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                {BANK_INFO.bank}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>계좌번호</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.5px', color: 'var(--color-text)' }}>
                  {BANK_INFO.account}
                </span>
                <button
                  type="button"
                  onClick={copyAccount}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${copied ? 'var(--color-primary-border)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: copied ? 'var(--color-primary-light)' : '#fff',
                    color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {copied ? '복사됨 ✓' : '복사'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>예금주</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                {BANK_INFO.holder}
              </span>
            </div>
            <div style={{
              marginTop: 12,
              padding: '8px 10px',
              background: 'var(--color-warning-light)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              color: 'var(--color-warning)',
              fontWeight: 500,
            }}>
              입금 확인 후 판매자가 구독을 활성화합니다.
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => method && onConfirm(method)}
            disabled={!method || saving}
            className="btn-primary"
            style={{ flex: 2 }}
          >
            {saving ? '처리 중…' : '신청 완료'}
          </button>
        </div>
      </div>
    </div>
  )
}
