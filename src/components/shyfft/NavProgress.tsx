import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Gradient bar at the top while a page is loading. */
export function NavProgress() {
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div className={loading ? "h-full w-1/3 animate-[navbar_0.9s_ease-in-out_infinite] bg-brand" : "h-full w-0"} />
      <style>{`@keyframes navbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

/** Fades each new page in when the path changes. */
export function PageFade({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={path} className="animate-in fade-in duration-200 motion-reduce:animate-none">
      {children}
    </div>
  );
}
