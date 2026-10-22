import { Check, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";

/** Recipient picker for sharing a post/reel into direct messages. */
export function ShareSheet({ open, onClose, postId }: { open: boolean; onClose: () => void; postId: string }) {
  const s = useStore();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // People I follow or already chat with, excluding blocked accounts and myself.
  const recipients = s.users.filter((u) =>
    u.id !== s.me.id && !s.blocked.has(u.id) &&
    (s.following.has(u.id) || s.conversations.some((c) => c.userId === u.id)),
  );

  const toggle = (id: string) =>
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const send = async () => {
    if (picked.size === 0 || sending) return;
    setSending(true);
    let ok = 0, failed = 0;
    for (const id of picked) {
      try { await s.sendMessage(id, "", { postId }); ok++; }
      catch { failed++; }
    }
    setSending(false);
    setPicked(new Set());
    onClose();
    if (failed === 0) toast.success(ok === 1 ? "Reel sent" : `Reel sent to ${ok} people`);
    else toast.error(`Sent to ${ok}, failed for ${failed}`);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setPicked(new Set()); onClose(); } }}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader><SheetTitle>Share to</SheetTitle></SheetHeader>
        <div className="max-h-80 overflow-y-auto px-2">
          {recipients.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Follow someone or start a chat to share reels with them.</p>
          )}
          {recipients.map((u) => {
            const on = picked.has(u.id);
            return (
              <button key={u.id} onClick={() => toggle(u.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted">
                <UserAvatar user={u} size={44} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                </span>
                <span className={cn("flex size-6 items-center justify-center rounded-full border-2 transition-colors", on ? "border-transparent bg-brand text-primary-foreground" : "border-muted-foreground/40")}>
                  {on && <Check className="size-4" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-4 pt-3">
          <button onClick={send} disabled={picked.size === 0 || sending}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? "Sending…" : picked.size > 1 ? `Send to ${picked.size} people` : "Send"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
