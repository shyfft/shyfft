import { Link, useLocation } from "@tanstack/react-router";
import { Compass, Film, Home, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";

const HIDE_NAV = ["/stories/", "/messages/", "/onboarding", "/auth", "/reset-password"];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { me, ready } = useStore();
  const hide = !ready || !me || HIDE_NAV.some((p) => pathname.startsWith(p));
  const item = (to: "/" | "/explore" | "/reels", active: boolean, icon: ReactNode, label: string) => (
    <Link to={to} aria-label={label} aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 items-center justify-center py-2 transition-transform active:scale-90", active ? "text-primary-foreground" : "text-muted-foreground")}>
      <span className={cn("flex size-11 items-center justify-center rounded-2xl transition-all duration-200", active && "scale-105 bg-brand shadow-glow")}>
        {icon}
      </span>
    </Link>
  );
  const profileActive = Boolean(me?.username && pathname.startsWith("/u/" + me.username));
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background sm:border-x">
      <main className={cn(!hide && "pb-24")}>
        {children}
      </main>
      {!hide && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="glass flex items-center rounded-3xl border shadow-lg">
            {item("/", pathname === "/", <Home className="size-6" strokeWidth={pathname === "/" ? 2.6 : 2} />, "Home")}
            {item("/explore", pathname === "/explore", <Compass className="size-6" strokeWidth={pathname === "/explore" ? 2.6 : 2} />, "Explore")}
            <Link to="/create" aria-label="Create" className="flex flex-1 items-center justify-center py-2">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-primary-foreground shadow-glow ring-2 ring-background/60 transition-transform active:scale-90">
                <Plus className="size-6" strokeWidth={2.4} />
              </span>
            </Link>
            {item("/reels", pathname === "/reels", <Film className="size-6" strokeWidth={pathname === "/reels" ? 2.6 : 2} />, "Reels")}
            {me?.username ? (
              <Link to="/u/$username" params={{ username: me.username }} aria-label="Profile" aria-current={profileActive ? "page" : undefined}
                className="flex flex-1 items-center justify-center py-2 transition-transform active:scale-90">
                <span className={cn("flex size-11 items-center justify-center rounded-2xl transition-all duration-200", profileActive && "scale-105 bg-brand shadow-glow")}>
                  <UserAvatar user={me} size={26} className="rounded-full" />
                </span>
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </div>
  );
}

export function TopBar({ title, left, right }: { title?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4">
      {left}
      <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</div>
      {right}
    </header>
  );
}
