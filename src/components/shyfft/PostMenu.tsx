import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";

const REASONS = ["Spam", "Nudity or sexual content", "Hate speech", "Bullying or harassment", "False information", "Something else"];

export function PostMenu({ open, onClose, userId, postId }: { open: boolean; onClose: () => void; userId: string; postId?: string }) {
  const s = useStore();
  const ME_ID = useStore().me.id;
  const [report, setReport] = useState(false);
  const user = s.getUser(userId);
  const isMe = userId === ME_ID;
  const close = () => { setReport(false); onClose(); };
  const row = "w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium hover:bg-muted";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl pb-8">
        <SheetHeader><SheetTitle>{report ? "Why are you reporting?" : `@${user?.username}`}</SheetTitle></SheetHeader>
        <div className="px-2">
          {report ? REASONS.map((r) => (
            <button key={r} className={row} onClick={() => { s.report(userId, r, postId).then(() => toast.success("Thanks — report submitted"), () => toast.error("Could not send report")); close(); }}>{r}</button>
          )) : isMe ? (
            <button className={row} onClick={close}>Cancel</button>
          ) : (
            <>
              <button className={row} onClick={() => { s.toggleFollow(userId); close(); }}>
                {s.following.has(userId) ? "Unfollow" : "Follow"}
              </button>
              <button className={`${row} text-destructive`} onClick={() => setReport(true)}>Report</button>
              <button className={`${row} text-destructive`} onClick={() => { s.toggleBlock(userId); toast(`Blocked @${user?.username}`); close(); }}>Block</button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
