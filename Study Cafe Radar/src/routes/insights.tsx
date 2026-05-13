import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ArrowLeft, ArrowRight, Trophy, Plus, X, ExternalLink, RefreshCw, Save, CheckCircle } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { health, improvements, monthly6, projects, abTests, channels } from "@/lib/mock-data";
import { saveKpi, getLatestKpi } from "@/api/kpi";
import { getMe } from "@/api/auth";
import { getCompetitorInfo, getPlaceStats } from "@/api/naver";

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
  loader: async () => {
    const [me, latestKpi] = await Promise.all([
      getMe().catch(() => null),
      getLatestKpi().catch(() => null),
    ]);
    return { me, latestKpi };
  },
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

type KpiForm = {
  date: string;
  weeklyInflow: string;
  searchRank: string;
  reviewCount: string;
  avgRating: string;
  monthlyVisitors: string;
  myInflow: string;
  areaAvgInflow: string;
  competitorCount: string;
  percentile: string;
  radius: string;
};

function KpiInputSection({ me, latestKpi }: { me: Awaited<ReturnType<typeof getMe>>; latestKpi: Awaited<ReturnType<typeof getLatestKpi>> }) {
  const today = new Date().toISOString().slice(0, 10);
  const lk = latestKpi as Record<string, unknown> | null;
  const [form, setForm] = useState<KpiForm>({
    date: today,
    weeklyInflow: String(lk?.weekly_inflow ?? ""),
    searchRank: String(lk?.search_rank ?? ""),
    reviewCount: String(lk?.review_count ?? ""),
    avgRating: String(lk?.avg_rating ?? ""),
    monthlyVisitors: String(lk?.monthly_visitors ?? ""),
    myInflow: String(lk?.my_inflow ?? ""),
    areaAvgInflow: String(lk?.area_avg_inflow ?? ""),
    competitorCount: String(lk?.competitor_count ?? ""),
    percentile: String(lk?.percentile ?? ""),
    radius: String(lk?.radius ?? "1km"),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  const set = (key: keyof KpiForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
    setSaveError(null);
  };

  const handleAutoFetch = async () => {
    const address = me?.naverAddress;
    if (!address) { setAutoError("네이버 플레이스가 연동되지 않았습니다. 설정에서 먼저 연동해 주세요."); return; }
    setAutoFetching(true);
    setAutoError(null);
    try {
      const [stats, info] = await Promise.all([
        getPlaceStats().catch(() => ({ reviewCount: null, avgRating: null })),
        getCompetitorInfo({ data: { address } }).catch(() => null),
      ]);
      setForm((prev) => ({
        ...prev,
        ...(stats.reviewCount !== null ? { reviewCount: String(stats.reviewCount) } : {}),
        ...(stats.avgRating !== null ? { avgRating: String(stats.avgRating) } : {}),
        ...(info?.competitorCount !== undefined ? { competitorCount: String(info.competitorCount) } : {}),
        ...(info?.estimatedRank ? { searchRank: String(info.estimatedRank) } : {}),
      }));
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "자동 조회 실패");
    } finally {
      setAutoFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await saveKpi({
        data: {
          date: form.date,
          weeklyInflow: form.weeklyInflow ? parseInt(form.weeklyInflow) : undefined,
          searchRank: form.searchRank ? parseInt(form.searchRank) : undefined,
          reviewCount: form.reviewCount ? parseInt(form.reviewCount) : undefined,
          avgRating: form.avgRating ? parseFloat(form.avgRating) : undefined,
          monthlyVisitors: form.monthlyVisitors ? parseInt(form.monthlyVisitors) : undefined,
          myInflow: form.myInflow ? parseInt(form.myInflow) : undefined,
          areaAvgInflow: form.areaAvgInflow ? parseInt(form.areaAvgInflow) : undefined,
          competitorCount: form.competitorCount ? parseInt(form.competitorCount) : undefined,
          percentile: form.percentile ? parseInt(form.percentile) : undefined,
          radius: form.radius || undefined,
        },
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Smart Place KPI 입력</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">리뷰·평점·경쟁사는 자동 수집, 유입량은 직접 입력</p>
        </div>
        <button
          type="button"
          onClick={handleAutoFetch}
          disabled={autoFetching}
          className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted transition disabled:opacity-60 flex-shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${autoFetching ? "animate-spin" : ""}`} />
          {autoFetching ? "수집 중…" : "자동 수집"}
        </button>
      </div>

      {autoError && <p className="text-xs text-destructive">{autoError}</p>}

      <form onSubmit={handleSave} className="space-y-4">
        {/* 날짜 */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">기준 날짜</label>
          <input type="date" value={form.date} onChange={set("date")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {/* 유입 & 순위 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              이번주 유입 (명)
              <span className="rounded bg-orange-100 text-orange-700 px-1.5 py-0.5 text-[10px] font-semibold">Smart Place에서 직접 확인</span>
            </label>
            <input type="number" min={0} placeholder="Smart Place 대시보드 → 통계 → 이번주 유입" value={form.weeklyInflow} onChange={set("weeklyInflow")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">검색 순위 (위)</label>
            <input type="number" min={1} placeholder="예: 3" value={form.searchRank} onChange={set("searchRank")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">리뷰 수 (개)</label>
            <input type="number" min={0} placeholder="예: 48" value={form.reviewCount} onChange={set("reviewCount")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">평점 (0~5)</label>
            <input type="number" min={0} max={5} step={0.1} placeholder="예: 4.5" value={form.avgRating} onChange={set("avgRating")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* 경쟁사 섹션 */}
        <div className="rounded-xl bg-card border border-border p-3 space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground">경쟁사 비교</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">내 유입 (명)</label>
              <input type="number" min={0} placeholder="예: 1200" value={form.myInflow} onChange={set("myInflow")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">지역 평균 유입 (명)</label>
              <input type="number" min={0} placeholder="예: 900" value={form.areaAvgInflow} onChange={set("areaAvgInflow")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">경쟁사 수 (곳)</label>
              <input type="number" min={0} placeholder="자동 조회 가능" value={form.competitorCount} onChange={set("competitorCount")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">상위 퍼센타일 (%)</label>
              <input type="number" min={0} max={100} placeholder="예: 30" value={form.percentile} onChange={set("percentile")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">반경</label>
            <input type="text" placeholder="예: 1km" value={form.radius} onChange={set("radius")} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {saveError && <p className="text-xs text-destructive">{saveError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:-translate-y-0.5 transition"
        >
          {saved
            ? <><CheckCircle className="h-4 w-4" /> 저장 완료 — 대시보드에 반영됐습니다</>
            : <><Save className="h-4 w-4" /> {saving ? "저장 중…" : "KPI 저장하기"}</>
          }
        </button>
      </form>
    </section>
  );
}

function Insights() {
  const navigate = useNavigate();
  const { section } = Route.useSearch();
  const { me, latestKpi } = Route.useLoaderData();
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
        {/* KPI 입력 */}
        <KpiInputSection me={me} latestKpi={latestKpi} />

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
