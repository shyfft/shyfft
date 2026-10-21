import type { ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LogOut, Moon, Shield, UserX, User as UserIcon, Sun } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — shyfft" },
      { name: "description", content: "Account, privacy, appearance and blocked accounts on shyfft." },
      { property: "og:title", content: "Settings — shyfft" },
      { property: "og:description", content: "Account, privacy, appearance and blocked accounts on shyfft." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const s = useStore();
  const router = useRouter();
  const blocked = [...s.blocked].map(s.getUser).filter(Boolean);
  const row = "flex items-center gap-3 px-4 py-3.5 text-sm";
  return (
    <>
      <TopBar title="Settings" left={<button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>} />
      <Group title="Account">
        <Link to="/onboarding" className={row}><UserIcon className="size-5" /><span className="flex-1">Username & profile</span><ChevronRight className="size-4 text-muted-foreground" /></Link>
      </Group>
      <Group title="Appearance">
        <label className={row}>
          {s.theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
          <span className="flex-1">Dark mode</span>
          <Switch checked={s.theme === "dark"} onCheckedChange={(v) => s.setTheme(v ? "dark" : "light")} />
        </label>
      </Group>
      <Group title="Privacy">
        <label className={row}>
          <Shield className="size-5" /><span className="flex-1">Private account<span className="block text-xs text-muted-foreground">Only approved followers see your posts</span></span>
          <Switch checked={s.privateAccount} onCheckedChange={(v) => { s.setPrivateAccount(v); s.updateMe({ isPrivate: v }); }} />
        </label>
      </Group>
      <Group title={`Blocked accounts (${blocked.length})`}>
        {blocked.length === 0 && <p className={`${row} text-muted-foreground`}><UserX className="size-5" />No one blocked</p>}
        {blocked.map((u) => (
          <div key={u!.id} className={row}>
            <UserAvatar user={u} size={36} /><span className="flex-1 font-medium">{u!.username}</span>
            <button onClick={() => s.toggleBlock(u!.id)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Unblock</button>
          </div>
        ))}
      </Group>
      <Group title="Session">
        <button onClick={() => toast("Sign-in will be enabled once accounts are connected")} className={`${row} w-full text-destructive`}><LogOut className="size-5" />Log out</button>
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mx-3 divide-y overflow-hidden rounded-2xl bg-card border">{children}</div>
    </section>
  );
}
