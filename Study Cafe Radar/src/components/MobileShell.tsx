import type { ReactNode } from "react";
import { BottomTabBar } from "./BottomTabBar";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex justify-center">
      <div className="relative w-full max-w-md min-h-screen bg-background pb-20 shadow-[var(--shadow-elevated)]">
        {children}
        <BottomTabBar />
      </div>
    </div>
  );
}
