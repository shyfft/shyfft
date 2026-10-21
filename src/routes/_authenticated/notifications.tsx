import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — shyfft" },
      { name: "description", content: "Likes, comments, follows and mentions on shyfft." },
      { property: "og:title", content: "Notifications — shyfft" },
      { property: "og:description", content: "Likes, comments, follows and mentions on shyfft." },
    ],
  }),
  component: Notifications,
});

const LABEL = { like: "liked your post.", comment: "commented:", follow: "started following you.", mention: "" };

function Notifications() {
  const s = useStore();
  const router = useRouter();
  const list = s.notifications.filter((n) => !s.blocked.has(n.userId));
  useEffect(() => {
    const t = setTimeout(s.markNotificationsRead, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <TopBar title="Notifications" left={<button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>} />
      <ul>
        {list.map((n) => {
          const u = s.getUser(n.userId)!;
          const post = n.postId ? s.posts.find((p) => p.id === n.postId) : undefined;
          return (
            <li key={n.id} className={cn("flex items-center gap-3 px-4 py-3", !n.read && "bg-accent/50")}>
              <Link to="/u/$username" params={{ username: u.username }}><UserAvatar user={u} size={44} /></Link>
              <p className="flex-1 text-sm">
                <span className="font-semibold">{u.username}</span> {LABEL[n.type]} {n.text} <span className="text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </p>
              {n.type === "follow" ? (
                <button onClick={() => s.toggleFollow(u.id)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", s.following.has(u.id) ? "bg-secondary" : "bg-brand text-primary-foreground")}>
                  {s.following.has(u.id) ? "Following" : "Follow back"}
                </button>
              ) : post && (
                <Link to="/p/$id" params={{ id: post.id }}><img src={post.media} alt="" className="size-11 rounded-md object-cover" /></Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
