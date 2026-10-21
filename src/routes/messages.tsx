import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { timeAgo } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/messages")({
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
  const list = s.conversations.filter((c) => !s.blocked.has(c.userId) && s.getUser(c.userId)?.username.includes(q.toLowerCase()));
  return (
    <>
      <TopBar title={s.me.username} left={<button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>} />
      <div className="p-3">
        <label className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>
      <h3 className="px-4 pb-2 text-sm font-semibold">Messages</h3>
      <ul>
        {list.map((c) => {
          const u = s.getUser(c.userId)!;
          const last = c.messages[c.messages.length - 1];
          return (
            <li key={c.id}>
              <Link to="/messages/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                <UserAvatar user={u} size={52} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className={c.unread ? "font-bold" : "font-medium"}>{u.name}</p>
                  <p className={`truncate ${c.unread ? "font-semibold" : "text-muted-foreground"}`}>
                    {last ? `${last.fromId === "me" ? "You: " : ""}${last.text} · ${timeAgo(last.createdAt)}` : "Say hi 👋"}
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
