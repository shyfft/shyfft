import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CheckCheck, ChevronLeft, Film, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
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
  const ME_ID = s.me.id;
  const conv = s.conversations.find((c) => c.id === id) ?? { id, userId: id, messages: [], unread: 0 };
  const user = s.getUser(id);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [conv.messages.length]);
  useEffect(() => { s.markConversationRead(id); }, [id, conv.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  if (!user) return <p className="p-10 text-center text-muted-foreground">Conversation not found</p>;

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/^image\/|^video\//.test(f.type)) { setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setFile(null); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const cancelFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      await s.sendMessage(id, text.trim(), file ? { file } : undefined);
      setText("");
      cancelFile();
    } finally {
      setSending(false);
    }
  };

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
          <Bubble key={m.id} m={m} mine={m.fromId === ME_ID} />
        ))}
        <div ref={end} />
      </div>
      {preview && file && (
        <div className="flex items-center gap-3 border-t px-3 pt-3">
          <div className="relative">
            {file.type.startsWith("video")
              ? <video src={preview} className="h-20 w-20 rounded-xl object-cover" muted playsInline />
              : <img src={preview} alt="Attachment preview" className="h-20 w-20 rounded-xl object-cover" />}
            <button aria-label="Remove attachment" onClick={cancelFile}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background">
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{file.type.startsWith("video") ? "Video" : "Photo"} ready to send · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <button type="button" aria-label="Attach photo or video" onClick={() => fileInput.current?.click()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-90">
          <ImagePlus className="size-5" />
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none" />
        <button aria-label="Send" disabled={sending || (!text.trim() && !file)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground disabled:opacity-40">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const s = useStore();
  const shared = m.postId ? s.posts.find((p) => p.id === m.postId) : undefined;
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%]", mine && "flex flex-col items-end")}>
        {m.media && (
          m.mediaType === "video"
            ? <video src={m.media} controls playsInline preload="metadata" className="max-h-72 rounded-3xl" />
            : <img src={m.media} alt="Shared media" loading="lazy" className="max-h-72 rounded-3xl object-cover" />
        )}
        {m.postId && (
          shared ? (
            <Link to="/reels" className={cn("block w-44 overflow-hidden rounded-2xl border", mine ? "bg-brand text-primary-foreground" : "bg-muted")}>
              {shared.mediaType === "video"
                ? <video src={shared.media} muted playsInline preload="metadata" className="aspect-[3/4] w-full object-cover" />
                : <img src={shared.media} alt={shared.caption} className="aspect-[3/4] w-full object-cover" />}
              <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"><Film className="size-3.5" /> Reel · @{s.getUser(shared.userId)?.username}</span>
            </Link>
          ) : (
            <p className={cn("rounded-3xl px-4 py-2 text-sm italic", mine ? "bg-brand text-primary-foreground" : "bg-muted")}>Reel unavailable</p>
          )
        )}
        {m.text && (
          <p className={cn("rounded-3xl px-4 py-2 text-sm", (m.media || m.postId) && "mt-1", mine ? "bg-brand text-primary-foreground" : "bg-muted")}>{m.text}</p>
        )}
        {mine && (
          <span className="mt-0.5 flex items-center gap-1 pr-1 text-[10px] text-muted-foreground" aria-label={m.read ? "Seen" : m.deliveredAt ? "Delivered" : "Sent"}>
            {m.read
              ? <><CheckCheck className="size-3.5 text-verified" /> Seen</>
              : m.deliveredAt
                ? <><CheckCheck className="size-3.5" /> Delivered</>
                : <><Check className="size-3.5" /> Sent</>}
          </span>
        )}
      </div>
    </div>
  );
}
