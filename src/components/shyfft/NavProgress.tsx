import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { LogoMark } from "./Logo";

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

/** Animate the existing outlet without remounting shared layouts or calls. */
export function PageFade({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.resolvedLocation?.pathname });
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = content.current?.animate?.(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 220, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [path]);
  return (
    <div className="relative min-h-dvh" aria-busy={loading}>
      <div ref={content} inert={loading} className={loading ? "opacity-0" : "opacity-100"}>{children}</div>
      {loading && <div role="status" aria-label="Loading page" className="absolute inset-0 flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-pulse motion-reduce:animate-none"><LogoMark size={48} /></div>
      </div>}
    </div>
  );
}
