import { Link, useLocation } from "@tanstack/react-router";
import { Compass, Film, Home, PlusSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";

const HIDE_NAV = ["/stories/", "/messages/", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { me } = useStore();
  const hide = HIDE_NAV.some((p) => pathname.startsWith(p));
  const item = (to: string, active: boolean, icon: ReactNode, label: string) => (
    <Link to={to} aria-label={label} className={cn("flex flex-1 items-center justify-center py-3 transition-transform active:scale-90", active ? "text-foreground" : "text-muted-foreground")}>
      {icon}
    </Link>
  );
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background sm:border-x">
      <main className={cn(!hide && "pb-20")}>{children}</main>
      {!hide && (
        <nav className="glass fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg border-t pb-[env(safe-area-inset-bottom)]">
          {item("/", pathname === "/", <Home className="size-6" strokeWidth={pathname === "/" ? 2.6 : 2} />, "Home")}
          {item("/explore", pathname === "/explore", <Compass className="size-6" strokeWidth={pathname === "/explore" ? 2.6 : 2} />, "Explore")}
          <Link to="/create" aria-label="Create" className="flex flex-1 items-center justify-center py-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-glow active:scale-90 transition-transform">
              <PlusSquare className="size-5" />
            </span>
          </Link>
          {item("/reels", pathname === "/reels", <Film className="size-6" strokeWidth={pathname === "/reels" ? 2.6 : 2} />, "Reels")}
          <Link to="/u/$username" params={{ username: me.username }} aria-label="Profile" className="flex flex-1 items-center justify-center py-3">
            <UserAvatar user={me} size={26} className={cn("rounded-full", pathname.startsWith("/u/" + me.username) && "outline-2 outline-foreground outline-offset-1")} />
          </Link>
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
