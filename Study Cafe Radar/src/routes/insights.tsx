import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ArrowLeft, ArrowRight, Trophy, Plus, X, ExternalLink } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { health, improvements, monthly6, projects, abTests, channels } from "@/lib/mock-data";

type Search = { section?: "ab" };

export const Route = createFileRoute("/insights")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    section: s.section === "ab" ? "ab" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI 인사이트 & 성과 분석 — StudyCafe Radar" },
      { name: "description", content: "AI 기반 마케팅 개선 추천과 A/B 테스트 성과를 확인하세요." },
    ],
  }),
  component: Insights,
});

const gradeColor: Record<string, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-blue-600 text-white",
  C: "bg-orange-500 text-white",
  D: "bg-destructive text-destructive-foreground",
};

const diffColor: Record<string, string> = {
  쉬움: "bg-emerald-100 text-emerald-700",
  보통: "bg-orange-100 text-orange-700",
  어려움: "bg-red-100 text-red-700",
};

function Insights() {
  const navigate = useNavigate();
  const { section } = Route.useSearch();
  const [budget, setBudget] = useState(300000);
  const [scoreAnim, setScoreAnim] = useState(0);
  const [showNewTest, setShowNewTest] = useState(false);
  const [tests, setTests] = useState([abTests.active]);

  useEffect(() => {
    let v = 0;
    const id = setInterval(() => {
      v += 3;
      if (v >= health.score) { v = health.score; clearInterval(id); }
      setScoreAnim(v);
    }, 18);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (section === "ab") {
      setTimeout(() => document.getElementById("ab-test")?.scrollIntoView({ behavior: "smooth" }), 200);
    }
  }, [section]);

  const sim = useMemo(() => {
    const visitors = Math.round(budget * 0.00413);
    const revenue = visitors * 2000;
    const percentile = Math.max(5, Math.round(50 - budget / 20000));
    return { visitors, revenue, percentile };
  }, [budget]);

  const maxRoi = Math.max(...channels.map((c) => c.roi));

  return (
    <MobileShell>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/" })} className="p-1 -ml-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold">AI 인사이트 & 성과분석</h1>
      </header>

      <main className="px-5 py-5 space-y-6">
        {/* A. 건강도 */}
        <section className="rounded-3xl p-5 bg-hero-gradient text-white shadow-[var(--shadow-elevated)]">
          <div className="text-xs font-semibold mb-1 opacity-90">마케팅 건강도</div>
          <div className="flex items-baseline gap-3">
            <div className="text-5xl font-bold tracking-tight tabular-nums">{scoreAnim}</div>
            <div className="text-lg font-medium">/ 100</div>
            <span className={`ml-auto rounded-lg px-3 py-1 text-sm font-bold ${gradeColor[health.grade]}`}>{health.grade}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${scoreAnim}%` }} />
          </div>
          <p className="mt-3 text-sm">경쟁사 대비 상위 <strong>{health.percentile}%</strong> 수준입니다</p>
        </section>

        {/* B. 우선순위 개선 카드 */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">우선순위 개선 추천</h2>
            <span className="text-[11px] text-muted-foreground">예상 효과 순</span>
          </div>
          <ul className="space-y-2">
            {improvements.map((item) => (
              <li key={item.rank} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-primary font-semibold">{item.effect}</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${diffColor[item.difficulty]}`}>{item.difficulty}</span>
                    </div>
                  </div>
                  <button className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg">
                    실행 <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* C. 6개월 비교 */}
        <section className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">경쟁사 6개월 비교</h2>
            <span className="text-[11px] text-muted-foreground">유입량(명)</span>
          </div>
          <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly6} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line name="내 매장" type="monotone" dataKey="mine" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line name="주변 평균" type="monotone" dataKey="avg" stroke="oklch(0.6 0.02 250)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* D. 맞춤 프로젝트 */}
        <section>
          <h2 className="text-sm font-semibold mb-3">맞춤 프로젝트 추천</h2>
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.name} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-sm">{p.name}</div>
                  <span className="text-xs font-bold text-primary">ROI {p.roi}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex gap-2 text-[11px]">
                  <span className="rounded-md bg-muted px-2 py-1">💰 {p.costRange}</span>
                  <span className="rounded-md bg-muted px-2 py-1">⏱ {p.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* E. A/B 테스트 */}
        <section id="ab-test" className="space-y-3" style={{ scrollMarginTop: 64 }}>
          <h2 className="text-sm font-semibold">A/B 테스트</h2>
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary px-2 py-0.5">진행중</span>
                <span className="text-[10px] text-muted-foreground">D+{t.dayCount}</span>
              </div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${t.progressPercent}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground text-right">{t.progressPercent}%</div>
            </div>
          ))}
          {abTests.completed.map((c) => (
            <div key={c.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">완료 · {c.winner} 승리</span>
                <span className="ml-auto text-[10px] text-muted-foreground">신뢰도 {c.confidence}%</span>
              </div>
              <div className="text-sm font-medium mb-3">{c.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-card border border-border p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">A</div>
                  <div className="text-base font-bold">+{c.resultA}%</div>
                </div>
                <div className="rounded-lg bg-primary text-primary-foreground p-2 text-center">
                  <div className="text-[10px] opacity-80">B 🏆</div>
                  <div className="text-base font-bold">+{c.resultB}%</div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* F. 채널별 ROI */}
        <section className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold mb-3">채널별 ROI</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-medium">채널</th>
                <th className="pb-2 font-medium text-right">지출</th>
                <th className="pb-2 font-medium text-right">방문</th>
                <th className="pb-2 font-medium text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.name} className={`border-t border-border ${c.roi === maxRoi ? "bg-primary/5" : ""}`}>
                  <td className="py-2.5 font-medium">{c.name}</td>
                  <td className="py-2.5 text-right tabular-nums">{(c.spend / 10000).toFixed(0)}만</td>
                  <td className="py-2.5 text-right tabular-nums">{c.visitors}</td>
                  <td className={`py-2.5 text-right font-bold tabular-nums ${c.roi === maxRoi ? "text-primary" : ""}`}>{c.roi}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* G. 예산 시뮬레이터 */}
        <section className="rounded-2xl bg-navy text-navy-foreground p-5 shadow-[var(--shadow-elevated)]">
          <h2 className="text-sm font-semibold mb-1">최적 마케팅 예산 시뮬레이터</h2>
          <p className="text-xs opacity-90 mb-4">슬라이더를 움직여 결과를 확인해보세요</p>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs opacity-90">월 예산</span>
            <span className="text-2xl font-bold tabular-nums">{(budget / 10000).toFixed(0)}<span className="text-sm font-normal opacity-80">만원</span></span>
          </div>
          <input
            type="range"
            min={50000}
            max={1000000}
            step={50000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs opacity-90">예상 유입 증가</div>
              <div className="text-lg font-bold text-primary tabular-nums">+{sim.visitors.toLocaleString()}<span className="text-xs ml-0.5">명</span></div>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs opacity-90">예상 매출 증가</div>
              <div className="text-lg font-bold text-primary tabular-nums">+{Math.round(sim.revenue / 10000).toLocaleString()}<span className="text-xs ml-0.5">만원</span></div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-primary/20 border border-primary/30 px-3 py-2 text-xs">
            이 예산이면 지역 상위 <strong className="text-primary">{sim.percentile}%</strong> 달성 가능
          </div>
        </section>

        <button
          onClick={() => setShowNewTest(true)}
          className="w-full rounded-2xl bg-primary text-primary-foreground px-5 py-4 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_var(--teal)] hover:translate-y-[-1px] transition"
        >
          <Plus className="h-4 w-4" />
          새 A/B 테스트 시작하기
        </button>

        <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 w-full">
          대시보드로 돌아가기 <ExternalLink className="h-3 w-3" />
        </Link>
      </main>

      {/* New Test Modal */}
      {showNewTest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowNewTest(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <form
            className="relative w-full max-w-md bg-card rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setTests((prev) => [
                ...prev,
                {
                  id: `ab_${Date.now()}`,
                  name: String(fd.get("name") || "새 실험"),
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
                  progressPercent: 5,
                  dayCount: 0,
                },
              ]);
              setShowNewTest(false);
              setTimeout(() => document.getElementById("ab-test")?.scrollIntoView({ behavior: "smooth" }), 100);
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">새 A/B 테스트</h3>
              <button type="button" onClick={() => setShowNewTest(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">실험명 (최대 30자)</span>
                <input name="name" required maxLength={30} placeholder="예: 메인 사진 A vs B" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">A안 설명</span>
                <input name="a" required placeholder="기존 버전" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">B안 설명</span>
                <input name="b" required placeholder="신규 버전" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">기간 (일, 7-30)</span>
                <input name="days" type="number" min={7} max={30} defaultValue={14} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold text-sm">등록하기</button>
          </form>
        </div>
      )}
    </MobileShell>
  );
}
