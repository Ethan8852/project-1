import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Radar, ArrowLeft } from "lucide-react";
import { login, register, getMe } from "@/api/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — StudyCafe Radar" },
      { name: "description", content: "스터디카페 마케팅 모니터링 서비스에 로그인하세요." },
    ],
  }),
  loader: async () => {
    const me = await getMe().catch(() => null);
    if (me) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPw, setShowPw] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState<null | "email" | "social">(null);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ storeName: "", email: "", password: "", passwordConfirm: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "signup") {
      if (!agreed) return;
      if (form.password !== form.passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    setLoading("email");
    try {
      if (tab === "login") {
        await login({ data: { email: form.email, password: form.password } });
      } else {
        await register({ data: { email: form.email, password: form.password, storeName: form.storeName } });
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex justify-center bg-muted/30">
      <div className="relative w-full max-w-md min-h-screen bg-background flex flex-col">
        {/* Hero */}
        <div className="bg-hero-gradient text-white px-6 pt-12 pb-10 rounded-b-[2rem] text-center relative">
          <Link to="/intro" className="absolute top-5 left-5 p-2 rounded-full bg-white/15 hover:bg-white/25 transition" aria-label="뒤로">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/15 backdrop-blur mb-3">
            <Radar className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight drop-shadow-sm">StudyCafe Radar</h1>
          <p className="mt-1 text-sm opacity-90">스터디카페 마케팅 레이더</p>
        </div>

        <main className="flex-1 px-6 py-6 space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  tab === t ? "bg-card shadow-[var(--shadow-card)] text-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {tab === "signup" && (
              <Field label="매장명">
                <input
                  required
                  name="storeName"
                  maxLength={30}
                  placeholder="예: 집중스터디카페 강남점"
                  className={inputCls}
                  value={form.storeName}
                  onChange={handleChange}
                />
              </Field>
            )}
            <Field label="이메일">
              <input
                required
                name="email"
                type="email"
                placeholder="owner@studycafe.kr"
                className={inputCls}
                value={form.email}
                onChange={handleChange}
              />
            </Field>
            <Field label={tab === "signup" ? "비밀번호 (8자 이상)" : "비밀번호"}>
              <div className="relative">
                <input
                  required
                  name="password"
                  type={showPw ? "text" : "password"}
                  minLength={tab === "signup" ? 8 : undefined}
                  placeholder="비밀번호 입력"
                  className={inputCls + " pr-10"}
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="비밀번호 표시"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {tab === "signup" && (
              <Field label="비밀번호 확인">
                <input
                  required
                  name="passwordConfirm"
                  type="password"
                  placeholder="비밀번호 재입력"
                  className={inputCls}
                  value={form.passwordConfirm}
                  onChange={handleChange}
                />
              </Field>
            )}

            {tab === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgot((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  비밀번호 찾기 →
                </button>
              </div>
            )}

            {tab === "login" && showForgot && (
              <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2">
                {forgotSent ? (
                  <p className="text-xs text-primary font-medium">✓ 재설정 링크를 발송했습니다.</p>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
                    </p>
                    <div className="flex gap-2">
                      <input type="email" placeholder="가입 이메일" className={inputCls + " flex-1"} />
                      <button
                        type="button"
                        onClick={() => setForgotSent(true)}
                        className="rounded-lg bg-foreground text-background px-3 text-xs font-medium"
                      >
                        발송
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "signup" && (
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-muted-foreground">
                  서비스 이용약관 및 개인정보처리방침에 동의합니다 (필수){" "}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline">
                    약관 보기
                  </button>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading !== null || (tab === "signup" && !agreed)}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold shadow-[0_8px_24px_-8px_var(--teal)] disabled:opacity-40 disabled:cursor-not-allowed transition hover:translate-y-[-1px]"
            >
              {loading === "email" ? "처리 중..." : tab === "login" ? "로그인" : "시작하기"}
            </button>
          </form>
        </main>

        <footer className="px-6 py-4 text-center text-[10px] text-muted-foreground">
          v1.0.0 · StudyCafe Radar · © 2026 All rights reserved
        </footer>

        {/* Loading overlay */}
        {loading === "social" && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">인증 중입니다...</p>
          </div>
        )}

        {/* Terms modal */}
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowTerms(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative w-full max-w-md bg-card rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold mb-3">서비스 이용약관</h3>
              <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>제1조 (목적) 본 약관은 StudyCafe Radar(이하 "서비스")가 제공하는 마케팅 모니터링 서비스의 이용 조건 및 절차를 규정함을 목적으로 합니다.</p>
                <p>제2조 (개인정보) 회원의 매장 정보 및 마케팅 데이터는 분석 목적으로만 사용되며, 제3자에게 제공되지 않습니다.</p>
                <p>제3조 (서비스 제공) 본 서비스는 KPI 데이터를 직접 입력하여 관리하는 방식으로 운영됩니다.</p>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="mt-4 w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
