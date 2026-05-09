import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, addDoc, query, where,
  getDocs, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const SELLER_UID = import.meta.env.VITE_SELLER_UID
const BANK_INFO  = { bank: '부산은행', account: '217-12-015025-3', holder: '안필숙' }

const PERIODS = [
  { value: 'week1', main: '1주차', sub: '매월 첫째 주' },
  { value: 'week2', main: '2주차', sub: '매월 둘째 주' },
  { value: 'week3', main: '3주차', sub: '매월 셋째 주' },
  { value: 'week4', main: '4주차', sub: '매월 넷째 주' },
]

function periodLabel(value, customDate) {
  const p = PERIODS.find(p => p.value === value)
  if (p) return `매월 ${p.main}`
  if (value === 'custom') return customDate ? `특정 날짜 (${customDate})` : '특정 날짜'
  return value
}

// ── 최상위 ────────────────────────────────────────────────
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
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 var(--container-px) 88px' }}>
        {isSeller ? <SellerView user={user} /> : <CustomerView user={user} />}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════
//  판매자 뷰
// ══════════════════════════════════════════════════════════
function SellerView({ user }) {
  const [products, setProducts] = useState([])
  const [subs,     setSubs]     = useState([])
  const [tab,      setTab]      = useState(0)
  const [form,     setForm]     = useState({ name: '', price: '', description: '' })
  const [saving,   setSaving]   = useState(false)
  const [checked,  setChecked]  = useState(new Set())
  const [toast,    setToast]    = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [pSnap, sSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'),      where('ownerId', '==', user.uid))),
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
      ownerId: user.uid, sellerId: user.uid,
      name: form.name, price: Number(form.price),
      description: form.description, active: true,
      createdAt: serverTimestamp(),
    })
    setForm({ name: '', price: '', description: '' })
    await fetchAll()
    setSaving(false)
  }

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.origin + '/app').then(() => {
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    })
  }

  const activeSubs = subs.filter(s => s.status === 'active').length
  const revenue    = subs.reduce((s, sub) => s + (sub.totalPrice ?? sub.productPrice ?? 0), 0)

  const isEmpty = products.length === 0 && subs.length === 0

  return (
    <>
      {isEmpty ? <SellerEmpty /> : (
        <>
          {/* 통계 */}
          <div className="stats-grid" style={{ paddingTop: 16 }}>
            <div className="stat-card">
              <div className="stat-label">활성 구독자</div>
              <div className="stat-value">{activeSubs}</div>
              <div className="stat-sub">총 {subs.length}건</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">등록 상품</div>
              <div className="stat-value">{products.length}</div>
              <div className="stat-sub">활성 상품</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">누적 수익</div>
              <div className="stat-value" style={{ fontSize: revenue >= 100000 ? 16 : 22 }}>
                ₩{revenue.toLocaleString()}
              </div>
              <div className="stat-sub">전체 구독 합산</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">처리 완료</div>
              <div className="stat-value">{checked.size}</div>
              <div className="stat-sub">발송 체크됨</div>
            </div>
          </div>

          {/* 탭 카드 */}
          <div className="card" style={{ padding: 0 }}>
            <div className="dtabs">
              {['구독 목록', '상품 관리', '링크 공유'].map((t, i) => (
                <button key={t} className={`dtab${tab === i ? ' on' : ''}`} onClick={() => setTab(i)}>
                  {t}
                </button>
              ))}
            </div>

            {/* TAB 0: 구독 목록 */}
            {tab === 0 && (
              <div className="card-body">
                {subs.length === 0
                  ? <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>아직 구독 신청이 없어요.</div>
                  : subs.map(sub => (
                    <div key={sub.id} className="li">
                      <button
                        className={`chk${checked.has(sub.id) ? ' on' : ''}`}
                        onClick={() => toggleCheck(sub.id)}
                        aria-label="발송 완료 체크"
                      />
                      <div className="av">{(sub.recipientName ?? sub.customerName ?? '?')[0]}</div>
                      <div className="lm">
                        <div className="ln">{sub.recipientName ?? sub.customerName}</div>
                        <div className="ld">
                          {sub.productName}{sub.qty > 1 ? ` ×${sub.qty}` : ''} · {periodLabel(sub.period, sub.customDate)}
                          {sub.phone ? ` · ${sub.phone}` : ''}
                        </div>
                        <div className="ld">{sub.address}</div>
                      </div>
                      <span className={`badge ${checked.has(sub.id) ? 'badge-muted' : 'badge-success'}`}>
                        {checked.has(sub.id) ? '완료' : '활성'}
                      </span>
                    </div>
                  ))
                }
                {subs.length > 0 && (
                  <div style={{ padding: '12px 18px' }}>
                    <button className="btn-secondary btn-sm" style={{ width: '100%' }}
                      onClick={() => setChecked(new Set(subs.map(s => s.id)))}>
                      전체 완료 처리
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: 상품 관리 */}
            {tab === 1 && (
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
                    <div key={p.id} className="list-item">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.description}</div>}
                      </div>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                        ₩{p.price.toLocaleString()}
                      </span>
                    </div>
                  ))
                }
              </div>
            )}

            {/* TAB 2: 링크 공유 */}
            {tab === 2 && (
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
          </div>
        </>
      )}

      {/* 토스트 */}
      <div className={`toast${toast ? ' show' : ''}`}>링크가 복사됐어요 ✓</div>
    </>
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
function CustomerView({ user }) {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [step,     setStep]     = useState(1)
  const [qty,      setQty]      = useState(1)
  const [form,     setForm]     = useState({
    period: 'week2', customDate: '',
    recipientName: '', phone: '',
    address: '', addressDetail: '',
  })
  const [payMethod, setPayMethod] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState(false)

  // Daum 우편번호 로드
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    document.body.appendChild(script)
    return () => { if (document.body.contains(script)) document.body.removeChild(script) }
  }, [])

  // 상품 목록 로드
  useEffect(() => {
    if (!SELLER_UID) return
    getDocs(query(
      collection(db, 'products'),
      where('ownerId', '==', SELLER_UID),
      where('active', '==', true)
    )).then(snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  function selectProduct(p) {
    setSelected(p)
    setQty(1)
    setStep(1)
    setPayMethod(null)
    setForm(f => ({ ...f, recipientName: user.displayName ?? '' }))
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
        setForm(f => ({ ...f, address: data.roadAddress || data.jibunAddress, addressDetail: '' }))
      },
    }).open()
  }

  async function handleConfirm() {
    if (!payMethod) return
    setSaving(true)
    const fullAddr = form.addressDetail ? `${form.address} ${form.addressDetail}` : form.address
    await addDoc(collection(db, 'subscriptions'), {
      ownerId: SELLER_UID, sellerId: SELLER_UID,
      customerId: user.uid, customerName: user.displayName, customerEmail: user.email,
      recipientName: form.recipientName, phone: form.phone,
      productId: selected.id, productName: selected.name, productPrice: selected.price,
      qty, totalPrice: selected.price * qty,
      address: fullAddr,
      period: form.period, customDate: form.period === 'custom' ? form.customDate : null,
      payMethod, status: 'active', createdAt: serverTimestamp(),
    })
    setSaving(false)
    setDone(true)
  }

  function reset() {
    setDone(false); setSelected(null); setStep(1); setQty(1); setPayMethod(null)
    setForm({ period: 'week2', customDate: '', recipientName: '', phone: '', address: '', addressDetail: '' })
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
  if (done) return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="succ">
        <div className="succ-icon">✅</div>
        <div className="succ-title">구독 신청 완료!</div>
        <div className="succ-desc">
          첫 배송 전날 연락드릴게요.<br />
          매 배송마다 자동 주문이 접수됩니다.
        </div>
        <div className="succ-info">
          <div className="succ-row"><span className="succ-k">상품</span><span className="succ-v">{selected.name} × {qty}</span></div>
          <div className="succ-row"><span className="succ-k">배송 주기</span><span className="succ-v">{periodLabel(form.period, form.customDate)}</span></div>
          <div className="succ-row"><span className="succ-k">배송지</span><span className="succ-v">{form.address}</span></div>
          <div className="succ-row"><span className="succ-k">수취인</span><span className="succ-v">{form.recipientName}</span></div>
          <div className="succ-row"><span className="succ-k">결제</span><span className="succ-v">{payMethod === 'transfer' ? '계좌이체' : '카드'} · ₩{(selected.price * qty).toLocaleString()}</span></div>
        </div>
        <button onClick={reset} className="btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>
          처음으로
        </button>
      </div>
    </div>
  )

  // ── 상품 목록 ──
  if (!selected) return (
    <div style={{ paddingTop: 16 }}>
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
    </div>
  )

  // ── 구독 플로우 ──
  const total = selected.price * qty
  const step1Valid = form.period !== 'custom' || form.customDate
  const step2Valid = form.address && form.recipientName && form.phone

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
        {[{ n: 1, label: '배송 설정' }, { n: 2, label: '정보 입력' }, { n: 3, label: '결제' }].map(({ n, label }) => (
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
            {/* 수량 */}
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

            {/* 배송 주기 */}
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
                onClick={() => setForm(f => ({ ...f, period: 'custom' }))}
              >
                📅 특정 날짜 직접 선택
              </button>
              {form.period === 'custom' && (
                <input className="input-field" type="date" value={form.customDate}
                  onChange={e => setForm(f => ({ ...f, customDate: e.target.value }))}
                  style={{ marginTop: 8 }} required />
              )}
            </div>

            <button className="btn-primary" disabled={!step1Valid} onClick={() => goStep(2)}>
              다음 — 정보 입력
            </button>
          </div>
        </div>
      )}

      {/* PANEL 2: 정보 입력 */}
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
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => goStep(1)}>이전</button>
              <button className="btn-primary" style={{ flex: 2 }} disabled={!step2Valid} onClick={() => goStep(3)}>
                다음 — 결제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 3: 결제 */}
      {step === 3 && (
        <div className="card">
          <div className="card-head"><span style={{ fontSize: 13, fontWeight: 700 }}>결제 등록</span></div>
          <div style={{ padding: '16px 18px' }}>
            {/* 주문 요약 */}
            <div className="sumbox">
              <div className="sumrow"><span className="sumk">상품</span><span className="sumv">{selected.name} × {qty}</span></div>
              <div className="sumrow"><span className="sumk">배송 주기</span><span className="sumv">{periodLabel(form.period, form.customDate)}</span></div>
              <div className="sumrow"><span className="sumk">배송지</span><span className="sumv" style={{ maxWidth: '60%', textAlign: 'right', fontSize: 12 }}>{form.address}{form.addressDetail ? ` ${form.addressDetail}` : ''}</span></div>
              <div className="sumrow"><span className="sumk">수취인</span><span className="sumv">{form.recipientName} · {form.phone}</span></div>
              <div className="sumtot"><span className="sumtot-k">1회 결제 금액</span><span className="sumtot-v">₩{total.toLocaleString()}</span></div>
            </div>

            {/* 결제 수단 */}
            <div style={{ marginBottom: 16 }}>
              {/* 카드결제 (준비중) */}
              <button type="button" disabled style={{
                width: '100%', padding: '13px 16px', borderRadius: 'var(--radius)',
                border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'not-allowed',
                opacity: 0.55, marginBottom: 8,
              }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>카드결제</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>준비중</div>
                </div>
              </button>

              {/* 계좌이체 */}
              <button type="button" onClick={() => setPayMethod(m => m === 'transfer' ? null : 'transfer')}
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 'var(--radius)',
                  border: `2px solid ${payMethod === 'transfer' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: payMethod === 'transfer' ? 'var(--color-primary-light)' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all .12s',
                }}>
                <span style={{ fontSize: 20 }}>🏦</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: payMethod === 'transfer' ? 'var(--color-primary)' : 'var(--color-text)' }}>
                    계좌이체
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>무통장 입금</div>
                </div>
              </button>
            </div>

            {/* 계좌 정보 */}
            {payMethod === 'transfer' && (
              <BankInfo />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => goStep(2)}>이전</button>
              <button className="btn-primary" style={{ flex: 2 }} disabled={!payMethod || saving}
                onClick={handleConfirm}>
                {saving ? '처리 중…' : `구독 신청 — ₩${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 계좌 정보 박스 ─────────────────────────────────────────
function BankInfo() {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(BANK_INFO.account).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
        입금 계좌 정보
      </div>
      {[['은행', BANK_INFO.bank], ['예금주', BANK_INFO.holder]].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{k}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>계좌번호</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.5px' }}>{BANK_INFO.account}</span>
          <button onClick={copy}
            style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${copied ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', background: copied ? 'var(--color-primary-light)' : '#fff', color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer' }}>
            {copied ? '복사됨 ✓' : '복사'}
          </button>
        </div>
      </div>
      <div style={{ background: 'var(--color-warning-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 11, color: 'var(--color-warning)', fontWeight: 500 }}>
        입금 확인 후 판매자가 구독을 활성화합니다.
      </div>
    </div>
  )
}
