import { useState } from 'react'
import { doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'

const PRESETS = [10000, 30000, 50000, 100000]

export default function WithdrawModal({ user, currentBalance, onClose, onWithdrawn }) {
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const numAmount = Number(amount) || 0
  const fee = Math.floor(numAmount * 0.1)
  const netAmount = numAmount - fee
  const canSubmit = numAmount >= 1000 && numAmount <= currentBalance && bankName.trim() && accountNumber.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError('')

    const walletRef = doc(db, 'wallets', user.uid)
    const withdrawRef = doc(db, 'withdrawals', `${user.uid}_${Date.now()}`)

    try {
      await runTransaction(db, async (tx) => {
        const ws = await tx.get(walletRef)
        const bal = ws.exists() ? (ws.data().balance ?? 0) : 0
        if (bal < numAmount) throw new Error('잔액 부족')
        tx.set(walletRef, { balance: bal - numAmount, updatedAt: serverTimestamp() }, { merge: true })
        tx.set(withdrawRef, {
          userId: user.uid,
          userName: user.displayName ?? '',
          userEmail: user.email ?? '',
          amount: numAmount,
          fee,
          netAmount,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          status: 'pending',
          createdAt: serverTimestamp(),
        })
      })
      onWithdrawn?.(numAmount)
      setSaving(false)
      setDone(true)
    } catch (e) {
      setError(e.message === '잔액 부족' ? '잔액이 부족합니다.' : '처리 중 오류가 발생했습니다.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: 'var(--container-max)', margin: '0 auto',
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '20px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>구독머니 환전</div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {!done ? (
          <>
            {/* 현재 잔액 */}
            <div style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius)',
              padding: '12px 14px', marginBottom: 18,
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 3 }}>현재 잔액</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>₩{currentBalance.toLocaleString()}</div>
            </div>

            {/* 환전 금액 */}
            <div className="field">
              <label className="field-label">환전 금액</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {PRESETS.filter(p => p <= currentBalance).map(p => (
                  <button key={p} type="button"
                    className="btn-secondary btn-sm"
                    style={Number(amount) === p ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-light)' } : {}}
                    onClick={() => setAmount(String(p))}>
                    {p / 10000}만
                  </button>
                ))}
              </div>
              <input
                className="input-field"
                type="number"
                placeholder={`최대 ₩${currentBalance.toLocaleString()}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={1000}
                max={currentBalance}
                step={1000}
              />
            </div>

            {/* 수수료 안내 */}
            {numAmount > 0 && (
              <div style={{
                background: 'var(--color-warning-light)', borderRadius: 'var(--radius-sm)',
                padding: '10px 12px', marginBottom: 14,
                fontSize: 12, color: 'var(--color-warning)', fontWeight: 500,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>환전 금액</span><span>₩{numAmount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>수수료 (10%)</span><span>-₩{fee.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid rgba(245,158,11,.2)', paddingTop: 6 }}>
                  <span>실제 입금액</span><span>₩{netAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* 입금 계좌 */}
            <div className="field">
              <label className="field-label">입금 은행</label>
              <input
                className="input-field"
                placeholder="예: 부산은행, 국민은행"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">계좌번호</label>
              <input
                className="input-field"
                placeholder="숫자만 입력"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 10 }}>{error}</div>
            )}

            <button
              className="btn-primary"
              disabled={!canSubmit || saving}
              onClick={handleSubmit}
            >
              {saving ? '처리 중…' : `₩${numAmount ? numAmount.toLocaleString() : '0'} 환전 신청`}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>환전 신청 완료!</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.8, marginBottom: 20 }}>
              <strong style={{ color: 'var(--color-text)' }}>₩{netAmount.toLocaleString()}</strong>이<br />
              {bankName} {accountNumber}로<br />
              <strong style={{ color: 'var(--color-primary)' }}>영업일 기준 5일 이내 입금 예정</strong>입니다.
            </div>
            <div style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
              padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)',
              marginBottom: 20, lineHeight: 1.6,
            }}>
              환전 금액 ₩{numAmount.toLocaleString()} 중 수수료 ₩{fee.toLocaleString()}을 제외한<br />
              실입금액은 ₩{netAmount.toLocaleString()}입니다.
            </div>
            <button className="btn-secondary" onClick={onClose}>확인</button>
          </div>
        )}
      </div>
    </div>
  )
}
