import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({
    meta: [
      { title: "Chat — shyfft" },
      { name: "description", content: "A direct message conversation on shyfft." },
      { property: "og:title", content: "Chat — shyfft" },
      { property: "og:description", content: "A direct message conversation on shyfft." },
    ],
  }),
  component: Chat,
});

function Chat() {
  const { id } = Route.useParams();
  const s = useStore();
  const ME_ID = useStore().me.id;
  const conv = s.conversations.find((c) => c.id === id) ?? { id, userId: id, messages: [], unread: 0 };
  const user = s.getUser(id);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [conv.messages.length]);
  useEffect(() => { s.markConversationRead(id); }, [id, conv.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <p className="p-10 text-center text-muted-foreground">Conversation not found</p>;

  return (
    <div className="flex h-dvh flex-col">
      <header className="glass flex h-14 items-center gap-3 border-b px-3">
        <Link to="/messages" aria-label="Back"><ChevronLeft className="size-6" /></Link>
        <Link to="/u/$username" params={{ username: user.username }} className="flex items-center gap-2">
          <UserAvatar user={user} size={34} />
          <div className="leading-tight"><p className="flex items-center gap-1 text-sm font-semibold">{user.name}<VerifiedBadge show={user.verified} className="size-3.5" /></p><p className="text-xs text-muted-foreground">@{user.username}</p></div>
        </Link>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {conv.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.fromId === ME_ID ? "justify-end" : "justify-start")}>
            <p className={cn("max-w-[75%] rounded-3xl px-4 py-2 text-sm", m.fromId === ME_ID ? "bg-brand text-primary-foreground" : "bg-muted")}>{m.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { s.sendMessage(id, text.trim()); setText(""); } }}
        className="flex items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none" />
        <button aria-label="Send" disabled={!text.trim()} className="flex size-10 items-center justify-center rounded-full bg-brand text-primary-foreground disabled:opacity-40"><Send className="size-4" /></button>
      </form>
    </div>
  );
}
