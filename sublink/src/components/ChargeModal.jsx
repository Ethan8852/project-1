import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const BANK_INFO = { bank: '부산은행', account: '217-12-015025-3', holder: '안필숙' }
const PRESETS = [10000, 30000, 50000, 100000]

export default function ChargeModal({ user, currentBalance, onClose, onCharged }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const numAmount = Number(amount) || 0
  const bonus = Math.floor(numAmount * 0.1)
  const total = numAmount + bonus

  async function handleSubmit() {
    if (!numAmount || numAmount < 1000) return
    setSaving(true)
    const ref = doc(db, 'charges', `${user.uid}_${Date.now()}`)
    await setDoc(ref, {
      userId: user.uid,
      userName: user.displayName ?? '',
      userEmail: user.email ?? '',
      amount: numAmount,
      bonusAmount: bonus,
      totalAmount: total,
      payMethod: 'transfer',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setSaving(false)
    onCharged?.()
    onClose()
  }

  function copyAccount() {
    navigator.clipboard.writeText(BANK_INFO.account).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
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
          <div style={{ fontWeight: 800, fontSize: 16 }}>구독머니 충전</div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{
          background: 'var(--color-primary-light)', borderRadius: 'var(--radius)',
          padding: '12px 14px', marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700, marginBottom: 3 }}>현재 잔액</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)' }}>₩{currentBalance.toLocaleString()}</div>
        </div>

        <div className="field">
          <label className="field-label">충전 금액</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button key={p} type="button"
                className="btn-secondary btn-sm"
                style={{}}
                onClick={() => setAmount(a => String((Number(a) || 0) + p))}>
                +{p / 10000}만
              </button>
            ))}
          </div>
          <input
            className="input-field"
            type="number"
            placeholder="직접 입력 (원, 최소 1,000원)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1000}
            step={1000}
          />
        </div>

        {numAmount > 0 && (
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius)',
            padding: '12px 14px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>충전 금액</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₩{numAmount.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--color-success)' }}>계좌이체 보너스 (+10%)</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>+₩{bonus.toLocaleString()}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid var(--color-border)', paddingTop: 8,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>충전 후 잔액</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)' }}>
                ₩{(currentBalance + total).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius)',
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10,
          }}>입금 계좌 (계좌이체)</div>
          {[['은행', BANK_INFO.bank], ['예금주', BANK_INFO.holder]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>계좌번호</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{BANK_INFO.account}</span>
              <button
                onClick={copyAccount}
                style={{
                  padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${copied ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: copied ? 'var(--color-primary-light)' : '#fff',
                  color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>
                {copied ? '복사됨 ✓' : '복사'}
              </button>
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          disabled={!numAmount || numAmount < 1000 || saving}
          onClick={handleSubmit}
        >
          {saving ? '처리 중…' : `₩${numAmount ? numAmount.toLocaleString() : '0'} 충전 신청`}
        </button>
      </div>
    </div>
  )
}
