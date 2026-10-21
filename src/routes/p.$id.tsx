import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { PostCard } from "@/components/shyfft/PostCard";
import { timeAgo } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/p/$id")({
  head: () => ({
    meta: [
      { title: "Post — shyfft" },
      { name: "description", content: "View a post and its comments on shyfft." },
      { property: "og:title", content: "Post — shyfft" },
      { property: "og:description", content: "View a post and its comments on shyfft." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const s = useStore();
  const router = useRouter();
  const post = s.posts.find((p) => p.id === id);
  const [text, setText] = useState("");
  return (
    <>
      <TopBar title="Post" left={<button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>} />
      {!post ? <p className="p-10 text-center text-muted-foreground">Post not available</p> : (
        <>
          <PostCard post={post} />
          <h3 className="px-4 pt-4 text-sm font-semibold">Comments</h3>
          <ul className="space-y-4 p-4">
            {post.comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet. Start the conversation.</li>}
            {post.comments.map((c) => {
              const u = s.getUser(c.userId)!;
              return (
                <li key={c.id} className="flex gap-3 text-sm">
                  <Link to="/u/$username" params={{ username: u.username }}><UserAvatar user={u} size={32} /></Link>
                  <div><span className="font-semibold">{u.username}</span> {c.text}<p className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</p></div>
                </li>
              );
            })}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { s.addComment(post.id, text.trim()); setText(""); } }}
            className="glass sticky bottom-[4.25rem] flex items-center gap-3 border-t px-4 py-2">
            <UserAvatar user={s.me} size={32} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 bg-transparent py-2 text-sm outline-none" />
            <button disabled={!text.trim()} className="text-sm font-bold text-primary disabled:opacity-40">Post</button>
          </form>
        </>
      )}
    </>
  );
}
