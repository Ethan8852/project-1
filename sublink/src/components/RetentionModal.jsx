import { useState } from 'react'

const BENEFITS = [
  { icon: '🔄', text: '주문 없이 매월 자동 배송' },
  { icon: '💰', text: '구독 단골 할인 혜택' },
  { icon: '📦', text: '판매자 직거래 — 신선하고 빠른 배송' },
]

const REASONS = [
  '더 이상 필요하지 않아요',
  '가격이 부담스러워요',
  '배송이 마음에 들지 않아요',
  '다른 곳을 이용할게요',
  '기타',
]

export default function RetentionModal({ sub, onClose, onPause, onConfirmCancel }) {
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')

  const finalReason = reason === '기타' ? customReason.trim() : reason
  const canConfirm = reason !== '' && (reason !== '기타' || customReason.trim() !== '')

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
        padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
      }}>

        {step === 1 ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💙</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
                잠깐만요!
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--color-text)' }}>{sub?.productName}</strong> 구독을 해지하면<br />
                이런 점을 놓치게 됩니다.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {BENEFITS.map(b => (
                <div key={b.text} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--color-primary-light)',
                  borderRadius: 'var(--radius)', padding: '11px 14px',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>{b.text}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'var(--color-success-light)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              marginBottom: 16, border: '1px solid #A7F3D0',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-success)', marginBottom: 4 }}>
                ⏸ 잠깐 쉬어가는 건 어떨까요?
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                해지 대신 일시정지를 선택하면 언제든 재개할 수 있습니다.
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ marginBottom: 10 }}
              onClick={() => { onPause(); onClose() }}
            >
              ⏸ 일시정지로 잠깐 쉬어가기
            </button>

            <button
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, padding: '8px 0' }}
              onClick={() => setStep(2)}
            >
              그래도 해지할게요
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>해지 이유를 알려주세요</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                더 나은 서비스를 위해 소중한 의견을 남겨주세요.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {REASONS.map(r => (
                <label key={r} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  border: `2px solid ${reason === r ? 'var(--color-error)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius)',
                  background: reason === r ? '#FFF5F5' : '#fff',
                  cursor: 'pointer', transition: 'all .12s',
                }}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => { setReason(r); setCustomReason('') }}
                    style={{ accentColor: 'var(--color-error)', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: reason === r ? 600 : 400 }}>{r}</span>
                </label>
              ))}
            </div>

            {reason === '기타' && (
              <textarea
                className="input-field"
                placeholder="해지 이유를 직접 입력해주세요 (필수)"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                rows={3}
                style={{ resize: 'none', marginBottom: 12 }}
              />
            )}

            <button
              className="btn-secondary"
              style={{ marginBottom: 8, borderColor: 'var(--color-error-light)', color: 'var(--color-error)' }}
              disabled={!canConfirm}
              onClick={() => onConfirmCancel(finalReason)}
            >
              해지 확인
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12, padding: '8px 0' }}
              onClick={() => setStep(1)}
            >
              ← 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
