import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { compact } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";

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
    <div className="no-scrollbar h-[calc(100dvh-4.25rem)] snap-y snap-mandatory overflow-y-auto bg-overlay">
      {reels.map((r) => {
        const u = s.getUser(r.userId)!;
        const liked = s.liked.has(r.id);
        return (
          <section key={r.id} className="relative h-full snap-start text-overlay-foreground">
            {r.mediaType === "video"
              ? <video src={r.media} className="h-full w-full object-cover" autoPlay muted loop playsInline />
              : <img src={r.media} alt={r.caption} className="h-full w-full object-cover" />}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay/80 to-transparent p-4 pr-16">
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
            <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 text-xs font-semibold">
              <button onClick={() => s.toggleLike(r.id)} className="flex flex-col items-center gap-1">
                <Heart className={cn("size-7", liked && "fill-like text-like")} />{compact(r.likes)}
              </button>
              <Link to="/p/$id" params={{ id: r.id }} className="flex flex-col items-center gap-1"><MessageCircle className="size-7" />{r.commentCount}</Link>
              <button onClick={() => s.toggleSave(r.id)}><Bookmark className={cn("size-7", s.saved.has(r.id) && "fill-overlay-foreground")} /></button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
