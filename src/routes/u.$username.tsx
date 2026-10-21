import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Bookmark, Film, Grid3x3, Lock, Menu, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/shyfft/AppShell";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { PostMenu } from "@/components/shyfft/PostMenu";
import { compact, ME_ID } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — shyfft` },
      { name: "description", content: `See photos and reels from @${params.username} on shyfft.` },
      { property: "og:title", content: `@${params.username} — shyfft` },
      { property: "og:description", content: `See photos and reels from @${params.username} on shyfft.` },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { username } = Route.useParams();
  const s = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<"posts" | "reels" | "saved">("posts");
  const [menu, setMenu] = useState(false);
  const user = s.byUsername(username);
  if (!user) return <p className="p-10 text-center text-muted-foreground">User not found</p>;
  const isMe = user.id === ME_ID;
  const blocked = s.blocked.has(user.id);
  const following = s.following.has(user.id);
  const locked = !isMe && user.isPrivate && !following;
  const all = s.posts.filter((p) => p.userId === user.id);
  const shown = tab === "saved" ? s.posts.filter((p) => s.saved.has(p.id)) : all.filter((p) => (tab === "reels" ? p.kind === "reel" : p.kind === "post"));
  const hasStory = s.stories.some((x) => x.userId === user.id);

  return (
    <>
      <TopBar title={<span className="flex items-center gap-1">{user.username}{user.verified && <BadgeCheck className="size-4 text-primary" />}</span>}
        right={isMe
          ? <Link to="/settings" aria-label="Settings"><Menu className="size-6" /></Link>
          : <button aria-label="More" onClick={() => setMenu(true)}><MoreHorizontal className="size-6" /></button>} />
      <section className="p-4">
        <div className="flex items-center gap-6">
          {hasStory
            ? <Link to="/stories/$username" params={{ username }}><UserAvatar user={user} size={82} ring /></Link>
            : <UserAvatar user={user} size={86} />}
          <div className="grid flex-1 grid-cols-3 text-center">
            <Stat n={all.length} l="posts" /><Stat n={user.followers} l="followers" /><Stat n={user.following} l="following" />
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">{user.name}</p>
        <p className="whitespace-pre-line text-sm">{user.bio}</p>
        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Link to="/onboarding" className="flex-1 rounded-xl bg-secondary py-2 text-center text-sm font-semibold">Edit profile</Link>
              <Link to="/settings" className="flex-1 rounded-xl bg-secondary py-2 text-center text-sm font-semibold">Settings</Link>
            </>
          ) : blocked ? (
            <button onClick={() => s.toggleBlock(user.id)} className="flex-1 rounded-xl bg-secondary py-2 text-sm font-semibold">Unblock</button>
          ) : (
            <>
              <button onClick={() => s.toggleFollow(user.id)}
                className={cn("flex-1 rounded-xl py-2 text-sm font-semibold", following ? "bg-secondary" : "bg-brand text-primary-foreground shadow-glow")}>
                {following ? "Following" : "Follow"}
              </button>
              <button onClick={() => nav({ to: "/messages/$id", params: { id: s.openConversation(user.id) } })}
                className="flex-1 rounded-xl bg-secondary py-2 text-sm font-semibold">Message</button>
            </>
          )}
        </div>
      </section>
      {blocked ? <p className="p-10 text-center text-sm text-muted-foreground">You blocked this account.</p>
        : locked ? (
          <div className="flex flex-col items-center gap-2 border-t p-12 text-center">
            <Lock className="size-10" /><p className="font-semibold">This account is private</p>
            <p className="text-sm text-muted-foreground">Follow to see their photos and reels.</p>
          </div>
        ) : (
          <>
            <div className="flex border-t">
              {([["posts", Grid3x3], ["reels", Film], ...(isMe ? [["saved", Bookmark] as const] : [])] as Array<readonly ["posts" | "reels" | "saved", typeof Film]>).map(([k, Icon]) => (
                <button key={k} aria-label={k} onClick={() => setTab(k)}
                  className={cn("flex flex-1 justify-center border-t-2 py-3", tab === k ? "border-foreground" : "border-transparent text-muted-foreground")}>
                  <Icon className="size-5" />
                </button>
              ))}
            </div>
            {shown.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">Nothing here yet</p> : (
              <div className="grid grid-cols-3 gap-0.5">
                {shown.map((p) => (
                  <Link key={p.id} to="/p/$id" params={{ id: p.id }} className={cn("bg-muted", tab === "reels" ? "aspect-[9/16]" : "aspect-square")}>
                    {p.mediaType === "video" ? <video src={p.media} className="h-full w-full object-cover" muted />
                      : <img src={p.media} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      <PostMenu open={menu} onClose={() => setMenu(false)} userId={user.id} />
    </>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><p className="font-display text-lg font-bold">{compact(n)}</p><p className="text-xs text-muted-foreground">{l}</p></div>;
}
