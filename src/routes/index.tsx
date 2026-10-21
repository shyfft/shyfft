import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle } from "lucide-react";
import { Logo } from "@/components/shyfft/Logo";
import { PostCard } from "@/components/shyfft/PostCard";
import { StoriesBar } from "@/components/shyfft/StoriesBar";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "shyfft — Home" },
      { name: "description", content: "Your shyfft feed: photos, reels and stories from people you follow." },
      { property: "og:title", content: "shyfft — Home" },
      { property: "og:description", content: "Your shyfft feed: photos, reels and stories from people you follow." },
    ],
  }),
  component: Home,
});

function Home() {
  const { posts, notifications, conversations } = useStore();
  const unreadN = notifications.some((n) => !n.read);
  const unreadM = conversations.reduce((a, c) => a + c.unread, 0);
  const feed = posts.filter((p) => p.kind === "post");
  return (
    <>
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4">
        <Logo />
        <div className="flex items-center gap-5">
          <Link to="/notifications" aria-label="Notifications" className="relative">
            <Heart className="size-6" />
            {unreadN && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-like" />}
          </Link>
          <Link to="/messages" aria-label="Messages" className="relative">
            <MessageCircle className="size-6" />
            {unreadM > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground">{unreadM}</span>
            )}
          </Link>
        </div>
      </header>
      <StoriesBar />
      {feed.map((p) => <PostCard key={p.id} post={p} />)}
      <p className="py-10 text-center text-sm text-muted-foreground">You're all caught up ✨</p>
    </>
  );
}
