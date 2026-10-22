import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { compact, timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { FeedVideo } from "./FeedVideo";
import { PostMenu } from "./PostMenu";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";

export function PostCard({ post }: { post: Post }) {
  const s = useStore();
  const user = s.getUser(post.userId);
  const liked = s.liked.has(post.id);
  const saved = s.saved.has(post.id);
  const [burst, setBurst] = useState(0);
  const [menu, setMenu] = useState(false);
  if (!user) return null;

  const dbl = () => {
    if (!liked) s.toggleLike(post.id);
    setBurst((b) => b + 1);
  };

  return (
    <article className="border-b pb-3">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to="/u/$username" params={{ username: user.username }} className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar user={user} size={34} ring />
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">{user.username}<VerifiedBadge show={user.verified} /></p>
            {post.location && <p className="truncate text-xs text-muted-foreground">{post.location}</p>}
          </div>
        </Link>
        <button aria-label="More" onClick={() => setMenu(true)} className="p-1"><MoreHorizontal className="size-5" /></button>
      </div>
      <div className="relative bg-muted" onDoubleClick={dbl}>
        {post.mediaType === "video"
          ? <FeedVideo src={post.media} />
          : <img src={post.media} alt={post.caption} loading="lazy" className="aspect-square w-full object-cover" />}
        {burst > 0 && (
          <Heart key={burst} className="animate-pop pointer-events-none absolute inset-0 m-auto size-24 fill-overlay-foreground text-overlay-foreground drop-shadow-lg" />
        )}
      </div>
      <div className="flex items-center gap-4 px-4 pt-3">
        <button aria-label="Like" onClick={() => s.toggleLike(post.id)} className="active:scale-90 transition-transform">
          <Heart className={cn("size-6", liked && "fill-like text-like")} />
        </button>
        <Link to="/p/$id" params={{ id: post.id }} aria-label="Comments"><MessageCircle className="size-6" /></Link>
        <button aria-label="Share" onClick={() => { navigator.clipboard?.writeText(location.origin + "/p/" + post.id); toast.success("Link copied"); }}>
          <Send className="size-6" />
        </button>
        <button aria-label="Save" onClick={() => { s.toggleSave(post.id); toast(saved ? "Removed from saved" : "Saved"); }} className="ml-auto">
          <Bookmark className={cn("size-6", saved && "fill-foreground")} />
        </button>
      </div>
      <div className="space-y-1 px-4 pt-2 text-sm">
        <p className="font-semibold">{compact(post.likes)} likes</p>
        <p><span className="font-semibold">{user.username}</span><VerifiedBadge show={user.verified} className="ml-0.5 size-3.5" /> {post.caption}</p>
        {post.commentCount > 0 && (
          <Link to="/p/$id" params={{ id: post.id }} className="block text-muted-foreground">View all {post.commentCount} comments</Link>
        )}
        <p className="text-xs uppercase text-muted-foreground">{timeAgo(post.createdAt)}</p>
      </div>
      <PostMenu open={menu} onClose={() => setMenu(false)} userId={post.userId} postId={post.id} />
    </article>
  );
}
