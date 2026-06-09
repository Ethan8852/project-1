'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

type Step = 'input' | 'sent';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── 문자 인증번호 발송 ──────────────────────────────────────
  async function sendOtp() {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('전화번호를 다시 확인해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    // 한국 번호: 010-XXXX-XXXX → +8210XXXXXXXX
    const e164 = '+82' + cleaned.replace(/^0/, '');

    const { error: err } = await supabase.auth.signInWithOtp({
      phone: e164,
    });

    setLoading(false);
    if (err) {
      setError('문자 발송에 실패했어요. 잠시 후 다시 눌러 주세요.');
      return;
    }
    setStep('sent');
  }

  // ── 인증번호 확인 ───────────────────────────────────────────
  async function verifyOtp() {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const e164 = '+82' + cleaned.replace(/^0/, '');

    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: 'sms',
    });

    setLoading(false);
    if (err) {
      setError('인증번호가 맞지 않아요. 다시 확인해 주세요.');
      return;
    }

    router.replace('/senior/record');
  }

  // ── 공통 스타일 ────────────────────────────────────────────
  const btnBase =
    'flex h-[80px] w-full items-center justify-center rounded-2xl text-[2rem] font-bold transition-transform active:scale-95 disabled:opacity-50';

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8F0] px-6 pt-16">
      {/* 헤더 */}
      <div className="mb-10 text-center">
        <p className="text-[1.6rem] font-semibold text-orange-500">서로ON</p>
        <h1 className="mt-2 text-[2.4rem] font-extrabold text-stone-800">
          어서 오세요!
        </h1>
        <p className="mt-3 text-[1.8rem] text-stone-500">
          전화번호로 로그인하세요
        </p>
      </div>

      {step === 'input' && (
        <div className="flex flex-col gap-5">
          {/* 전화번호 입력 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="phone"
              className="text-[1.6rem] font-semibold text-stone-600"
            >
              전화번호
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-[80px] w-full rounded-2xl border-2 border-stone-200 bg-white px-5 text-[2rem] font-semibold text-stone-800 outline-none focus:border-orange-400"
            />
          </div>

          {error && (
            <p className="text-[1.6rem] text-red-500">{error}</p>
          )}

          <button
            onClick={sendOtp}
            disabled={loading}
            className={`${btnBase} bg-orange-500 text-white shadow-lg`}
          >
            {loading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
            ) : (
              '인증번호 받기'
            )}
          </button>
        </div>
      )}

      {step === 'sent' && (
        <div className="flex flex-col gap-5">
          <p className="rounded-2xl bg-orange-50 px-5 py-4 text-[1.7rem] text-orange-700">
            📱 {phone} 으로<br />
            인증번호를 보냈어요.
          </p>

          {/* 인증번호 입력 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="otp"
              className="text-[1.6rem] font-semibold text-stone-600"
            >
              인증번호 6자리
            </label>
            <input
              id="otp"
              type="tel"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-[80px] w-full rounded-2xl border-2 border-stone-200 bg-white px-5 text-center text-[2.4rem] font-bold tracking-widest text-stone-800 outline-none focus:border-orange-400"
            />
          </div>

          {error && (
            <p className="text-[1.6rem] text-red-500">{error}</p>
          )}

          <button
            onClick={verifyOtp}
            disabled={loading || otp.length !== 6}
            className={`${btnBase} bg-orange-500 text-white shadow-lg`}
          >
            {loading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
            ) : (
              '확인'
            )}
          </button>

          <button
            onClick={() => { setStep('input'); setOtp(''); setError(''); }}
            className={`${btnBase} bg-stone-100 text-stone-600`}
          >
            전화번호 다시 입력하기
          </button>
        </div>
      )}
    </div>
  );
}
