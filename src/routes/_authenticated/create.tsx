import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, MapPin, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/shyfft/AppShell";
import { MAX_FILE_SIZE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "post" | "reel" | "story";

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } =>
    ({ tab: s["tab"] === "reel" || s["tab"] === "story" ? (s["tab"] as Tab) : undefined }),
  head: () => ({
    meta: [
      { title: "Create — shyfft" },
      { name: "description", content: "Share a photo, video, reel or 24-hour story on shyfft." },
      { property: "og:title", content: "Create — shyfft" },
      { property: "og:description", content: "Share a photo, video, reel or 24-hour story on shyfft." },
    ],
  }),
  component: Create,
});

function Create() {
  const { tab: initial } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initial ?? "post");
  const [file, setFile] = useState<{ url: string; type: "image" | "video"; raw: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [loc, setLoc] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const s = useStore();
  const nav = useNavigate();

  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) { toast.error("Max file size is 250 MB"); return; }
    setFile({ url: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : "image", raw: f });
  };

  const share = async () => {
    if (!file) { toast.error("Pick a photo or video first"); return; }
    if (busy) return;
    setBusy(true);
    setProgress(0);
    try {
      if (tab === "story") {
        await s.createStory(file.raw, setProgress);
        toast.success("Story shared for 24 hours");
        nav({ to: "/" });
      } else {
        await s.createPost({ file: file.raw, kind: tab, caption, location: loc || undefined, onProgress: setProgress });
        toast.success(tab === "reel" ? "Reel shared" : "Post shared");
        nav({ to: tab === "reel" ? "/reels" : "/" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <>
      <TopBar title="New" right={<button onClick={share} disabled={busy} className="text-sm font-bold text-primary disabled:opacity-50">{busy ? (progress !== null ? `Uploading ${progress}%` : "Sharing…") : "Share"}</button>} />
      {busy && progress !== null && (
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex gap-2 p-3">
        {(["post", "reel", "story"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-full py-2 text-sm font-semibold capitalize transition", tab === t ? "bg-brand text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>
      <input ref={input} type="file" hidden accept={tab === "reel" ? "video/*,image/*" : "image/*,video/*"} onChange={(e) => pick(e.target.files?.[0])} />
      <div className="px-3">
        {file ? (
          <div className={cn("relative overflow-hidden rounded-2xl bg-muted", tab === "post" ? "aspect-square" : "aspect-[9/16] max-h-[60vh] mx-auto")}>
            {file.type === "video"
              ? <video src={file.url} className="h-full w-full object-cover" autoPlay muted loop playsInline />
              : <img src={file.url} alt="Preview" className="h-full w-full object-cover" />}
            <button aria-label="Remove" onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-overlay/60 p-1.5 text-overlay-foreground"><X className="size-4" /></button>
          </div>
        ) : (
          <button onClick={() => input.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-muted-foreground hover:bg-muted">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-brand text-primary-foreground shadow-glow"><ImagePlus className="size-7" /></span>
            <span className="text-sm font-medium">Choose a {tab === "reel" ? "video" : "photo or video"}</span>
          </button>
        )}
      </div>
      {tab !== "story" && (
        <div className="space-y-2 p-3">
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption…" rows={3}
            className="w-full resize-none rounded-xl bg-muted p-3 text-sm outline-none" />
          <label className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
            <MapPin className="size-4 text-muted-foreground" />
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Add location" className="flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
      )}
      {tab === "story" && <p className="p-4 text-center text-sm text-muted-foreground">Stories disappear after 24 hours.</p>}
    </>
  );
}
