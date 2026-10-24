import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Search, 
  Trash2, 
  CheckCircle, 
  AlertTriangle,
  Lock
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const SUPER_ADMIN_EMAIL = "shreyashchavaragi@gmail.com";

// Sub-admin permissions template
export interface SubAdminPermission {
  userId: string;
  username: string;
  canVerify: boolean;
  canDeletePosts: boolean;
  canViewReports: boolean;
}

export function AdminPage() {
  const s = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "team">("users");

  // Local storage based sub-admin registry (instant sync bina database migration ke)
  const [subAdmins, setSubAdmins] = useState<SubAdminPermission[]>(() => {
    try {
      const saved = localStorage.getItem("shyfft_sub_admins");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isSuperAdmin = s.me?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const currentSubAdmin = subAdmins.find((a) => a.userId === s.me?.id);
  const hasAdminAccess = isSuperAdmin || !!currentSubAdmin || s.isAdmin;

  // Agar user admin nahi hai to access block
  if (!hasAdminAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock className="size-12 text-destructive mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Sirf authorized admins hi is panel ko access kar sakte hain.
        </p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  // Filtered users list
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return s.users;
    const q = search.toLowerCase();
    return s.users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [s.users, search]);

  // Sub-admin toggle logic (Sirf Super Admin kar sakta hai)
  const updateSubAdmin = (user: typeof s.users[0], permission: "canVerify" | "canDeletePosts" | "canViewReports") => {
    if (!isSuperAdmin) {
      s.toast("Sirf Super Admin permissions badal sakta hai");
      return;
    }
    const existing = subAdmins.find((a) => a.userId === user.id);
    let updated: SubAdminPermission[];
    if (existing) {
      updated = subAdmins.map((a) =>
        a.userId === user.id ? { ...a, [permission]: !a[permission] } : a
      );
    } else {
      updated = [
        ...subAdmins,
        {
          userId: user.id,
          username: user.username,
          canVerify: permission === "canVerify",
          canDeletePosts: permission === "canDeletePosts",
          canViewReports: permission === "canViewReports",
        },
      ];
    }
    // Remove if all permissions false
    updated = updated.filter((a) => a.canVerify || a.canDeletePosts || a.canViewReports);
    setSubAdmins(updated);
    localStorage.setItem("shyfft_sub_admins", JSON.stringify(updated));
    s.toast("Permissions updated!");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
              shyfft Admin
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {isSuperAdmin ? "Super Admin" : "Moderator"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logged in as: {s.me?.email || s.me?.username}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
            activeTab === "users"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/30 hover:bg-muted border-border"
          }`}
        >
          Manage Users & Badges
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("team")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
              activeTab === "team"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 hover:bg-muted border-border"
            }`}
          >
            Sub-Admin Team ({subAdmins.length})
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by @username or name..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-background"
        />
      </div>

      {/* Tab 1: User Verification & Management */}
      {activeTab === "users" && (
        <div className="space-y-2">
          {filteredUsers.map((u) => {
            const canVerify = isSuperAdmin || currentSubAdmin?.canVerify;
            return (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-2xl border bg-card/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center font-bold text-xs uppercase">
                        {u.username.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold flex items-center gap-1 truncate">
                      {u.name}
                      {u.verified && <CheckCircle className="size-3 text-emerald-500 fill-emerald-500" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {canVerify && (
                    <button
                      onClick={() => s.setVerification(u.id, !u.verified)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                        u.verified
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                      }`}
                    >
                      {u.verified ? "Remove Badge" : "Verify"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Manage Sub-Admins (Super Admin Only) */}
      {activeTab === "team" && isSuperAdmin && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Aap kisi bhi user ko select karke specific permissions de sakte ho:
          </p>

          {filteredUsers.map((u) => {
            if (u.id === s.me?.id) return null; // Don't show super admin self
            const adminData = subAdmins.find((a) => a.userId === u.id);

            return (
              <div key={u.id} className="p-3 rounded-2xl border bg-card/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold">@{u.username}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">({u.name})</span>
                  </div>
                  {adminData && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      Active Sub-Admin
                    </span>
                  )}
                </div>

                {/* Permission checkboxes */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!adminData?.canVerify}
                      onChange={() => updateSubAdmin(u, "canVerify")}
                    />
                    Verify Users (Badge)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!adminData?.canDeletePosts}
                      onChange={() => updateSubAdmin(u, "canDeletePosts")}
                    />
                    Delete Posts
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
