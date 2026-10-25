import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";
import { listAdminPerms, listReports, saveAdminPerm, type AdminPerm, type Report } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Admin Dashboard — shyfft" },
    { name: "description", content: "Manage verification, moderators and reports on shyfft." },
    { property: "og:title", content: "Admin Dashboard — shyfft" },
    { property: "og:description", content: "Manage verification, moderators and reports on shyfft." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminPage,
});

const PERMS: Array<[keyof Omit<AdminPerm, "userId">, string]> = [
  ["verify", "Give / remove green tick"],
  ["deletePosts", "Remove any post"],
  ["viewReports", "See reports"],
];

function AdminPage() {
  const s = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "team" | "reports">("users");
  const [q, setQ] = useState("");
  const [perms, setPerms] = useState<AdminPerm[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const hasAccess = s.isAdmin || s.perms.verify || s.perms.deletePosts || s.perms.viewReports;

  useEffect(() => {
    if (s.isAdmin) listAdminPerms().then(setPerms).catch(() => toast.error("Could not load team"));
    if (s.perms.viewReports) listReports().then(setReports).catch(() => toast.error("Could not load reports"));
  }, [s.isAdmin, s.perms.viewReports]);

  const users = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.users.filter((u) => u.id !== s.me?.id && (!t || u.username.toLowerCase().includes(t) || u.name.toLowerCase().includes(t)));
  }, [s.users, s.me?.id, q]);

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Lock className="mb-3 size-12 text-destructive" />
        <h1 className="font-display text-xl font-bold">Access denied</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only admins can open this page.</p>
        <Link to="/" className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Go home</Link>
      </div>
    );
  }

  const toggle = async (userId: string, key: keyof Omit<AdminPerm, "userId">) => {
    const cur = perms.find((p) => p.userId === userId) ?? { userId, verify: false, deletePosts: false, viewReports: false };
    const next = { ...cur, [key]: !cur[key] };
    setBusy(userId);
    try {
      await saveAdminPerm(next);
      setPerms((ps) => [...ps.filter((p) => p.userId !== userId), next].filter((p) => p.verify || p.deletePosts || p.viewReports));
      toast.success("Permissions saved");
    } catch (e) { toast.error((e as { message?: string })?.message || "Could not save"); }
    finally { setBusy(null); }
  };

  const verify = async (id: string, v: boolean) => {
    setBusy(id);
    try { await s.setVerified(id, v); toast.success(v ? "Green tick given" : "Green tick removed"); }
    catch (e) { toast.error((e as { message?: string })?.message || "Not allowed"); }
    finally { setBusy(null); }
  };

  const tabs = [["users", "Users"], ...(s.isAdmin ? [["team", `Team (${perms.length})`]] : []), ...(s.perms.viewReports ? [["reports", `Reports (${reports.length})`]] : [])] as Array<[typeof tab, string]>;

  return (
    <>
      <TopBar title={s.isAdmin ? "Super Admin" : "Moderator"} left={<button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>} />
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
        <div className="mb-3 flex gap-2">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-xl border py-2 text-xs font-semibold", tab === k ? "border-primary bg-primary text-primary-foreground" : "bg-muted/40")}>{l}</button>
          ))}
        </div>
        {tab !== "reports" && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search @username" className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm" />
          </div>
        )}

        {tab === "users" && users.map((u) => (
          <div key={u.id} className="mb-2 flex items-center gap-3 rounded-2xl border p-3">
            <UserAvatar user={u} size={40} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">{u.username}<VerifiedBadge show={u.verified} /></p>
              <p className="truncate text-xs text-muted-foreground">{u.name}</p>
            </div>
            {s.perms.verify && (
              <button disabled={busy === u.id} onClick={() => verify(u.id, !u.verified)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50", u.verified ? "bg-destructive/10 text-destructive" : "bg-verified/15 text-verified")}>
                {u.verified ? "Remove tick" : "Verify"}
              </button>
            )}
          </div>
        ))}

        {tab === "team" && s.isAdmin && users.map((u) => {
          const p = perms.find((x) => x.userId === u.id);
          return (
            <div key={u.id} className="mb-2 rounded-2xl border p-3">
              <div className="flex items-center gap-2">
                <UserAvatar user={u} size={32} />
                <span className="flex-1 text-sm font-semibold">@{u.username}</span>
                {p && <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Moderator</span>}
              </div>
              <div className="mt-2 grid gap-1.5 border-t pt-2 text-xs">
                {PERMS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" disabled={busy === u.id} checked={!!p?.[k]} onChange={() => toggle(u.id, k)} />{label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {tab === "reports" && (reports.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No reports</p> : reports.map((r) => {
          const target = r.targetUserId ? s.getUser(r.targetUserId) : undefined;
          return (
            <div key={r.id} className="mb-2 rounded-2xl border p-3 text-sm">
              <p className="font-semibold">{r.reason}</p>
              <p className="text-xs text-muted-foreground">
                {target ? <>Against @{target.username} · </> : null}{new Date(r.createdAt).toLocaleString()}
              </p>
              {r.postId && <Link to="/p/$id" params={{ id: r.postId }} className="mt-1 inline-block text-xs font-semibold text-primary">Open post →</Link>}
            </div>
          );
        }))}
      </div>
    </>
  );
}
