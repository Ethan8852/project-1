import { Link, useLocation } from "@tanstack/react-router";
import { Home, Lightbulb, BarChart3 } from "lucide-react";

const tabs = [
  { to: "/", label: "대시보드", icon: Home },
  { to: "/insights", label: "AI추천", icon: Lightbulb },
  { to: "/insights", label: "성과분석", icon: BarChart3, search: { section: "ab" } },
] as const;

export function BottomTabBar() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="grid grid-cols-3">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const isActive =
            (t.to === "/" && location.pathname === "/") ||
            (t.to === "/insights" && location.pathname === "/insights" && (i === 1 ? !location.search?.section : location.search?.section === "ab"));
          return (
            <li key={i}>
              <Link
                to={t.to}
                search={"search" in t ? (t.search as any) : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
