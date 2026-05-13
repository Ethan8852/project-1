import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Radar, ArrowLeft } from "lucide-react";
import { getMe } from "@/api/auth";
import { processNaverOAuth, processGoogleOAuth, processKakaoOAuth, getOAuthConfig } from "@/api/oauth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — StudyCafe Radar" },
      { name: "description", content: "스터디카페 마케팅 모니터링 서비스에 로그인하세요." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  loader: async ({ location }) => {
    const me = await getMe().catch(() => null);
    if (me) throw redirect({ to: "/" });

    const { code, state } = location.search as { code?: string; state?: string };
    if (code && state) {
      const provider = state.split("_")[0];
      let oauthError: string | undefined;
      try {
        if (provider === "naver") await processNaverOAuth({ data: { code, state } });
        else if (provider === "google") await processGoogleOAuth({ data: { code, state } });
        else if (provider === "kakao") await processKakaoOAuth({ data: { code, state } });
      } catch (err) {
        oauthError = err instanceof Error ? err.message : "소셜 인증 실패";
      }
      if (!oauthError) throw redirect({ to: "/" });
      const oauthConfig = await getOAuthConfig().catch(() => ({ naverClientId: "", googleClientId: "", kakaoClientId: "" }));
      return { oauthError, oauthConfig };
    }
    const oauthConfig = await getOAuthConfig().catch(() => ({ naverClientId: "", googleClientId: "", kakaoClientId: "" }));
    return { oauthError: undefined, oauthConfig };
  },
  component: AuthPage,
});

function AuthPage() {
  const { oauthError, oauthConfig } = Route.useLoaderData() ?? {};
  const [error, setError] = useState<string | null>(oauthError ?? null);
  const { naverClientId = "", googleClientId = "", kakaoClientId = "" } = oauthConfig ?? {};

  const startOAuth = (provider: "naver" | "google" | "kakao") => {
    const state = `${provider}_${Math.random().toString(36).slice(2)}`;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth`);

    let url = "";
    if (provider === "naver") {
      if (!naverClientId) { setError("네이버 클라이언트 ID가 설정되지 않았습니다."); return; }
      url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${naverClientId}&redirect_uri=${redirectUri}&state=${state}`;
    } else if (provider === "google") {
      if (!googleClientId) { setError("Google 클라이언트 ID가 설정되지 않았습니다. (준비중)"); return; }
      url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${redirectUri}&scope=openid%20email%20profile&state=${state}`;
    } else if (provider === "kakao") {
      if (!kakaoClientId) { setError("카카오 클라이언트 ID가 설정되지 않았습니다. (준비중)"); return; }
      url = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${kakaoClientId}&redirect_uri=${redirectUri}&state=${state}`;
    }
    window.location.href = url;
  };

  return (
    <div className="min-h-screen flex justify-center bg-muted/30">
      <div className="relative w-full max-w-md min-h-screen bg-background flex flex-col shadow-[var(--shadow-elevated)]">

        {/* Hero */}
        <div className="bg-hero-gradient text-white flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center rounded-b-[2.5rem]">
          <Link to="/intro" className="absolute top-5 left-5 p-2 rounded-full bg-white/15 hover:bg-white/25 transition" aria-label="뒤로">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-white/15 backdrop-blur mb-5 shadow-lg">
            <Radar className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">StudyCafe Radar</h1>
          <p className="mt-2 text-sm opacity-90 leading-relaxed">스터디카페 마케팅을 레이더처럼<br />정확하게 모니터링하세요</p>
        </div>

        <main className="flex-1 px-6 py-10 flex flex-col gap-4">
          <p className="text-center text-sm font-medium text-muted-foreground">소셜 계정으로 빠르게 시작하세요</p>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {/* 네이버 — 주력 */}
          <button
            onClick={() => startOAuth("naver")}
            className="w-full rounded-2xl py-4 text-[15px] font-bold text-white flex items-center justify-center gap-3 shadow-[0_8px_24px_-8px_#03C75A88] hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{ background: "#03C75A" }}
          >
            <span className="text-xl font-black leading-none">N</span>
            네이버로 시작하기
          </button>

          {/* 구글 */}
          <button
            onClick={() => startOAuth("google")}
            className="w-full rounded-2xl py-4 text-[15px] font-semibold flex items-center justify-center gap-3 border border-border bg-card hover:bg-muted hover:-translate-y-0.5 active:translate-y-0 transition shadow-[var(--shadow-card)]"
          >
            <GoogleIcon />
            Google로 시작하기
          </button>

          {/* 카카오 */}
          <button
            onClick={() => startOAuth("kakao")}
            className="w-full rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-3 hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition shadow-[0_8px_24px_-8px_#FEE50088]"
            style={{ background: "#FEE500", color: "#181600" }}
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>
        </main>

        <footer className="px-6 pb-10 text-center text-[10px] text-muted-foreground space-y-1">
          <p>계속하면 <span className="underline cursor-pointer">이용약관</span> 및 <span className="underline cursor-pointer">개인정보처리방침</span>에 동의하게 됩니다.</p>
          <p>v1.0.0 · StudyCafe Radar · © 2026</p>
        </footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#181600" d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.636 5.077 4.133 6.488L5.1 21l4.688-2.977C10.479 18.34 11.227 18.4 12 18.4c5.523 0 10-3.477 10-7.6S17.523 3 12 3z"/>
    </svg>
  );
}
