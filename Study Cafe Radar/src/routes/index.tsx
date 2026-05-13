import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
} from "recharts";
import { Bell, TrendingUp, TrendingDown, Star, Users, Search, ArrowRight, X, LogOut } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { competitor, notifications, daily30 } from "@/lib/mock-data";
import { getLatestKpi, getKpiHistory } from "@/api/kpi";
import { getMe, logout } from "@/api/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "대시보드 — StudyCafe Radar" },
      { name: "description", content: "스터디카페 마케팅 KPI를 한눈에 모니터링하세요." },
    ],
  }),
  loader: async () => {
    const me = await getMe().catch(() => null);
    if (!me) throw redirect({ to: "/intro" });
    const [latestKpi, history] = await Promise.all([
      getLatestKpi().catch(() => null),
      getKpiHistory({ data: { days: 30 } }).catch(() => []),
    ]);
    return { me, latestKpi, history };
  },
  component: Dashboard,
});

function KpiCard({
  label, value, sub, trend, icon,
}: { label: string; value: string; sub?: string; trend?: { dir: "up" | "down" | "flat"; text: string }; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="flex items-center gap-1.5 text-[11px]">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
            trend.dir === "up" ? "bg-primary/10 text-primary" :
            trend.dir === "down" ? "bg-destructive/10 text-destructive" :
            "bg-muted text-muted-foreground"
          }`}>
            {trend.dir === "up" && <TrendingUp className="h-3 w-3" />}
            {trend.dir === "down" && <TrendingDown className="h-3 w-3" />}
            {trend.text}
          </span>
        )}
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function Dashboard() {
  const { me, latestKpi, history } = Route.useLoaderData();
  const [showNotif, setShowNotif] = useState(false);
  const navigate = useNavigate();

  // DB 데이터가 있으면 사용, 없으면 mock fallback
  const kpi = latestKpi
    ? {
        weeklyInflow: { value: latestKpi.weekly_inflow ?? 0, changeRate: latestKpi.weekly_change_rate ?? 0, direction: (latestKpi.weekly_change_rate ?? 0) >= 0 ? "up" : "down" as const },
        searchRank: { value: latestKpi.search_rank ?? "-", unit: "위", scope: "지역 내 스터디카페" },
        review: { count: latestKpi.review_count ?? 0, avgRating: latestKpi.avg_rating ?? 0 },
        monthlyVisitors: { estimated: latestKpi.monthly_visitors ?? 0, label: "이번달 예측" },
      }
    : null;

  const chartData = history.length > 0
    ? (history as Array<{ date: string; weekly_inflow: number | null }>).map((r) => ({ date: r.date.slice(5), inflow: r.weekly_inflow ?? 0 }))
    : daily30;

  const competitorData = [
    { name: "내 매장", value: latestKpi?.my_inflow ?? competitor.myInflow, fill: "var(--teal)" },
    { name: "주변 평균", value: latestKpi?.area_avg_inflow ?? competitor.areaAvgInflow, fill: "oklch(0.78 0.02 250)" },
  ];
  const percentile = latestKpi?.percentile ?? competitor.percentile;

  const storeName = me?.storeName ?? "집중스터디카페 강남점";
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(".", "년 ").replace(".", "월 ") + "일";

  return (
    <MobileShell>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-hero-gradient text-white px-5 pt-5 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold tracking-widest">STUDYCAFE RADAR</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotif(true)}
              className="relative rounded-full bg-white/15 p-2 hover:bg-white/25 transition"
              aria-label="알림"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            </button>
            <button
              onClick={async () => { await logout(); navigate({ to: "/auth" }); }}
              className="rounded-full bg-white/15 p-2 hover:bg-white/25 transition"
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h1 className="text-xl font-bold leading-tight drop-shadow-sm">{storeName}</h1>
        <div className="mt-1 flex items-center gap-2 text-xs opacity-90">
          <span>{today}</span>
          {!kpi && (
            <>
              <span>·</span>
              <span className="text-yellow-300">KPI 미입력 — 목업 데이터 표시 중</span>
            </>
          )}
        </div>
      </header>

      <main className="px-5 pt-5 space-y-6">
        {/* KPI 없을 때 안내 */}
        {!kpi ? (
          <Link
            to="/insights"
            className="block rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary"
          >
            💡 아직 KPI 데이터가 없습니다. 탭해서 수치를 입력하세요 →
          </Link>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>마지막 업데이트: {(latestKpi as { date: string }).date}</span>
            <Link to="/insights" className="font-semibold text-primary hover:underline">KPI 업데이트 →</Link>
          </div>
        )}

        {/* KPI Grid */}
        <section className="grid grid-cols-2 gap-3">
          <KpiCard
            label="이번 주 유입"
            value={(kpi?.weeklyInflow.value ?? 0).toLocaleString()}
            trend={{ dir: kpi?.weeklyInflow.direction ?? "flat", text: `+${kpi?.weeklyInflow.changeRate ?? 0}%` }}
            sub="전주 대비"
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="검색 순위"
            value={kpi ? `${kpi.searchRank.value}${kpi.searchRank.unit}` : "-위"}
            sub={kpi?.searchRank.scope ?? "지역 내 스터디카페"}
            icon={<Search className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="리뷰 / 평점"
            value={kpi ? `${kpi.review.count}개` : "-개"}
            sub={kpi ? `★ ${kpi.review.avgRating}` : "★ -"}
            icon={<Star className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="월 예상 방문"
            value={(kpi?.monthlyVisitors.estimated ?? 0).toLocaleString()}
            sub={kpi?.monthlyVisitors.label ?? "이번달 예측"}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
        </section>

        {/* 30일 유입 추이 */}
        <section className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">유입 추이</h2>
            <span className="text-[11px] text-muted-foreground">최근 30일</span>
          </div>
          <div className="h-44 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--teal)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, padding: "6px 10px" }} labelStyle={{ color: "var(--muted-foreground)" }} />
                <Line type="monotone" dataKey="inflow" stroke="url(#inflowG)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 경쟁사 비교 */}
        <section className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">경쟁사 비교</h2>
            <span className="text-[11px] text-muted-foreground">반경 {latestKpi?.radius ?? competitor.radius} · {latestKpi?.competitor_count ?? competitor.totalStores}곳</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitorData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: "var(--foreground)", fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} label={{ position: "right", fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}>
                  {competitorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 rounded-xl bg-navy text-navy-foreground px-4 py-3 text-sm font-semibold flex items-center gap-2">
            <span className="text-primary">🎯</span>
            내 매장이 지역 상위 <span className="text-primary text-base">{percentile}%</span>에 위치합니다
          </div>
        </section>

        {/* CTA */}
        <Link
          to="/insights"
          className="group block rounded-2xl bg-primary text-primary-foreground px-5 py-4 text-base font-semibold shadow-[0_8px_24px_-8px_var(--teal)] hover:translate-y-[-1px] transition"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">💡 AI 개선 추천 보기</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </main>

      {/* 알림 드로어 */}
      {showNotif && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowNotif(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-card rounded-t-3xl p-5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">알림</h3>
              <button onClick={() => setShowNotif(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-2">
              {notifications.map((n, i) => (
                <li key={i} className="rounded-xl border border-border p-3 text-sm flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  {n.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
