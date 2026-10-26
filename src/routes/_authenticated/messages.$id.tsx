import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CheckCheck, ChevronLeft, Film, ImagePlus, Loader2, Phone, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { MAX_FILE_SIZE, useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";
import { startCall } from "@/components/shyfft/CallManager";
import { formatActiveStatus } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({
    meta: [
      { title: "Chat — shyfft" },
      { name: "description", content: "A direct message conversation on shyfft." },
      { property: "og:title", content: "Chat — shyfft" },
      { property: "og:description", content: "A direct message conversation on shyfft." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

function formatMessageTime(t?: number) {
  if (!t) return "";
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function isSameDay(t1: number, t2: number) {
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  return d1.toDateString() === d2.toDateString();
}

function formatDateHeader(t: number) {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Chat() {
  const { id } = Route.useParams();
  const s = useStore();
  const ME_ID = s.me?.id ?? "";
  const conv = s.conversations.find((c) => c.id === id) ?? { id, userId: id, messages: [], unread: 0 };
  const user = s.getUser(id);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomId = [ME_ID, id].sort().join("-");

  const presence = user ? s.getUserPresence?.(user.id) ?? { isOnline: false } : { isOnline: false };
  const statusText = formatActiveStatus(presence.lastSeen, presence.isOnline);

  // Realtime typing broadcast listener
  useEffect(() => {
    if (!ME_ID || !id) return;
    const channel = supabase.channel(`typing:${roomId}`);
    typingChannel.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === id) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 2500);
        }
      })
      .on("broadcast", { event: "stop-typing" }, (payload) => {
        if (payload.payload?.userId === id) {
          setIsOtherTyping(false);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingChannel.current = null;
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [ME_ID, id, roomId]);

  useEffect(() => {
    if (atBottom.current) end.current?.scrollIntoView?.({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "end" });
  }, [conv.messages.length, isOtherTyping]);
  useEffect(() => {
    const mark = () => { if (document.visibilityState === "visible") s.markConversationRead(id); };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [id, conv.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!user) return <p className="p-10 text-center text-muted-foreground">Conversation not found</p>;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setSendError(null);
    if (!ME_ID || !id) return;
    const now = Date.now();
    if (now - lastBroadcastRef.current > 1200) {
      lastBroadcastRef.current = now;
      void typingChannel.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: ME_ID },
      }).catch(() => {});
    }
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/^image\/|^video\//.test(f.type)) { setFile(null); toast.error("Only photos and videos can be sent"); return; }
    if (f.size > MAX_FILE_SIZE) { setFile(null); toast.error("Max file size is 250 MB"); return; }
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
    setSendError(null);
    setProgress(file ? 0 : null);

    // Stop typing notification on send
    void typingChannel.current?.send({
      type: "broadcast",
      event: "stop-typing",
      payload: { userId: ME_ID },
    }).catch(() => {});

    try {
      await s.sendMessage(id, text.trim(), file ? { file, onProgress: setProgress } : undefined);
      atBottom.current = true;
      setText("");
      cancelFile();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Message wasn't sent. Please try again.");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="glass flex h-14 items-center gap-3 border-b px-3">
        <Link to="/messages" aria-label="Back"><ChevronLeft className="size-6" /></Link>
        <Link to="/u/$username" params={{ username: user.username }} className="flex items-center gap-2">
          <div className="relative">
            <UserAvatar user={user} size={34} />
            {presence.isOnline && (
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
            )}
          </div>
          <div className="leading-tight">
            <p className="flex items-center gap-1 text-sm font-semibold">
              {user.name}
              <VerifiedBadge show={user.verified} className="size-3.5" />
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {isOtherTyping ? (
                <span className="font-semibold text-emerald-500 animate-pulse">typing...</span>
              ) : presence.isOnline ? (
                <span className="font-medium text-emerald-500">Active now</span>
              ) : statusText ? (
                <span>{statusText}</span>
              ) : (
                <span>@{user.username}</span>
              )}
            </p>
          </div>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => startCall({ id: user.id, name: user.name, username: user.username, avatar: user.avatar })} aria-label="Voice call" className="ml-auto rounded-full"><Phone className="size-5" /></Button>
      </header>

      <div ref={scroller} onScroll={() => {
        const el = scroller.current;
        if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {conv.messages.map((m, idx) => {
          const prev = conv.messages[idx - 1];
          const showDate = !prev || !isSameDay(prev.createdAt, m.createdAt);
          return (
            <div key={m.id} className="space-y-1">
              {showDate && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-muted/80 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {formatDateHeader(m.createdAt)}
                  </span>
                </div>
              )}
              <Bubble m={m} mine={m.fromId === ME_ID} />
            </div>
          );
        })}

        {isOtherTyping && (
          <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
            <UserAvatar user={user} size={24} />
            <div className="flex items-center gap-1 rounded-2xl bg-muted px-3.5 py-2">
              <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      {preview && file && (
        <div className="flex items-center gap-3 border-t px-3 pt-3">
          <div className="relative">
            {file.type.startsWith("video")
              ? <video src={preview} className="h-20 w-20 rounded-xl object-cover" muted playsInline />
              : <img src={preview} alt="Attachment preview" className="h-20 w-20 rounded-xl object-cover" />}
            <Button type="button" size="icon" aria-label="Remove attachment" onClick={cancelFile}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background">
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {progress !== null ? `Uploading… ${progress}%` : `${file.type.startsWith("video") ? "Video" : "Photo"} ready to send · ${(file.size / 1024 / 1024).toFixed(1)} MB`}
            </p>
            {progress !== null && (
              <div className="mt-1 h-1 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {sendError && <p role="alert" className="px-4 py-2 text-xs text-destructive">{sendError}</p>}
      <form onSubmit={send} className="flex items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="secondary" size="icon" aria-label="Attach photo or video" disabled={sending} onClick={() => fileInput.current?.click()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-90">
          <ImagePlus className="size-5" />
        </Button>
        <input value={text} disabled={sending} onChange={handleTextChange} placeholder="Message…" className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none" />
        <Button type="submit" size="icon" aria-label="Send" disabled={sending || (!text.trim() && !file)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground disabled:opacity-40">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
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
        <div className="mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <span>{formatMessageTime(m.createdAt)}</span>
          {mine && (
            <span className="flex items-center gap-1" aria-label={m.read ? "Seen" : m.deliveredAt ? "Delivered" : "Sent"}>
              {m.read ? (
                <>
                  <CheckCheck className="size-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Seen{m.readAt ? ` · ${formatMessageTime(m.readAt)}` : ""}
                  </span>
                </>
              ) : m.deliveredAt ? (
                <>
                  <CheckCheck className="size-3.5 text-muted-foreground" />
                  <span>Delivered · {formatMessageTime(m.deliveredAt)}</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-muted-foreground" />
                  <span>Sent</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
