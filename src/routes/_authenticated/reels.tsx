import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle, Pause, Play, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { useSoundPref } from "@/components/shyfft/FeedVideo";
import { ShareSheet } from "@/components/shyfft/ShareSheet";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";
import { compact } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "Reels — shyfft" },
      { name: "description", content: "Watch short vertical reels from creators on shyfft." },
      { property: "og:title", content: "Reels — shyfft" },
      { property: "og:description", content: "Watch short vertical reels from creators on shyfft." },
    ],
  }),
  component: Reels,
});

function Reels() {
  const s = useStore();
  const reels = s.posts.filter((p) => p.kind === "reel");
  return (
    <div className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-auto bg-overlay">
      {reels.map((r) => <ReelItem key={r.id} reel={r} />)}
      {reels.length === 0 && <p className="p-10 text-center text-sm text-overlay-foreground/70">No reels yet — create one from the + tab.</p>}
    </div>
  );
}

function ReelItem({ reel: r }: { reel: Post }) {
  const s = useStore();
  const u = s.getUser(r.userId)!;
  const liked = s.liked.has(r.id);
  const wrap = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useSoundPref();
  const [paused, setPaused] = useState(false);
  const [share, setShare] = useState(false);
  const isVideo = r.mediaType === "video";

  // Only the reel in view plays — scrolling away pauses it, so no overlapping audio.
  useEffect(() => {
    const el = wrap.current;
    const v = video.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const on = !!e?.isIntersecting && e.intersectionRatio >= 0.6;
        if (on) { v.currentTime = 0; v.play().then(() => setPaused(false)).catch(() => setPaused(true)); }
        else { v.pause(); }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => { io.disconnect(); v.pause(); };
  }, [r.id]);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPaused(false)).catch(() => {}); }
    else { v.pause(); setPaused(true); }
  };

  return (
    <section ref={wrap} className="relative h-full snap-start text-overlay-foreground">
      {isVideo ? (
        <video ref={video} src={r.media} className="h-full w-full object-cover" loop muted={!soundOn} playsInline preload="metadata" onClick={togglePlay} />
      ) : (
        <img src={r.media} alt={r.caption} className="h-full w-full object-cover" />
      )}
      {isVideo && paused && (
        <button aria-label="Play" onClick={togglePlay}
          className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-overlay/50 backdrop-blur-sm">
          <Play className="ml-1 size-7 fill-current" />
        </button>
      )}
      {isVideo && (
        <button
          aria-label={soundOn ? "Mute sound" : "Play sound"}
          onClick={() => setSoundOn(!soundOn)}
          className="absolute right-3 top-4 flex items-center gap-2 rounded-full bg-overlay/60 px-3.5 py-2 text-xs font-semibold backdrop-blur-sm"
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {soundOn ? "Sound on" : "Tap for sound"}
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay/80 to-transparent p-4 pb-24 pr-16">
        <div className="flex items-center gap-2">
          <Link to="/u/$username" params={{ username: u.username }} className="flex items-center gap-2">
            <UserAvatar user={u} size={32} />
            <span className="text-sm font-semibold">{u.username}</span><VerifiedBadge show={u.verified} />
          </Link>
          {u.id !== s.me.id && (
            <button onClick={() => s.toggleFollow(u.id)} className="rounded-lg border border-overlay-foreground/60 px-2.5 py-0.5 text-xs font-semibold">
              {s.following.has(u.id) ? "Following" : "Follow"}
            </button>
          )}
        </div>
        <p className="mt-2 text-sm">{r.caption}</p>
      </div>
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 text-xs font-semibold">
        <button onClick={() => s.toggleLike(r.id)} className="flex flex-col items-center gap-1" aria-label="Like">
          <Heart className={cn("size-7", liked && "fill-like text-like")} />{compact(r.likes)}
        </button>
        <Link to="/p/$id" params={{ id: r.id }} className="flex flex-col items-center gap-1" aria-label="Comments"><MessageCircle className="size-7" />{r.commentCount}</Link>
        <button onClick={() => setShare(true)} aria-label="Share reel"><Send className="size-7" /></button>
        <button onClick={() => s.toggleSave(r.id)} aria-label="Save"><Bookmark className={cn("size-7", s.saved.has(r.id) && "fill-overlay-foreground")} /></button>
      </div>
      <ShareSheet open={share} onClose={() => setShare(false)} postId={r.id} />
    </section>
  );
}
