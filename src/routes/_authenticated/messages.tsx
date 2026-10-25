import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";
import { formatActiveStatus, timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — shyfft" },
      { name: "description", content: "Your direct messages on shyfft." },
      { property: "og:title", content: "Messages — shyfft" },
      { property: "og:description", content: "Your direct messages on shyfft." },
    ],
  }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const { pathname } = useLocation();
  if (pathname !== "/messages" && pathname !== "/messages/") return <Outlet />;
  return <Inbox />;
}

function Inbox() {
  const s = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = s.conversations.filter(
    (c) => !s.blocked.has(c.userId) && s.getUser(c.userId)?.username?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <TopBar
        title={s.me?.username ?? "Messages"}
        left={
          <button aria-label="Back" onClick={() => router.history.back()}>
            <ChevronLeft className="size-6" />
          </button>
        }
      />
      <div className="p-3">
        <label className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      <h3 className="px-4 pb-2 text-sm font-semibold">Messages</h3>
      <ul>
        {list.map((c) => {
          const u = s.getUser(c.userId);
          if (!u) return null;
          const presence = s.getUserPresence?.(u.id) ?? { isOnline: false };
          const statusText = formatActiveStatus(presence.lastSeen, presence.isOnline);
          const last = c.messages[c.messages.length - 1];

          return (
            <li key={c.id}>
              <Link
                to="/messages/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
              >
                <div className="relative">
                  <UserAvatar user={u} size={52} />
                  {presence.isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center justify-between">
                    <p className={cn("flex items-center gap-1 truncate", c.unread ? "font-bold" : "font-medium")}>
                      {u.name}
                      <VerifiedBadge show={u.verified} className="size-3.5" />
                    </p>
                    {presence.isOnline ? (
                      <span className="shrink-0 text-xs font-medium text-emerald-500">Active now</span>
                    ) : (
                      last && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(last.createdAt)}
                        </span>
                      )
                    )}
                  </div>
                  <p className={cn("truncate", c.unread ? "font-semibold" : "text-muted-foreground")}>
                    {last
                      ? `${last.fromId === s.me?.id ? "You: " : ""}${last.text}`
                      : statusText || "Say hi 👋"}
                  </p>
                </div>
                {c.unread > 0 && <span className="size-2.5 rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
