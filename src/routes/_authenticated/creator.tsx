import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft, Heart, Lock, MessageCircle, Users, Film, Wallet, Gift, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/shyfft/AppShell";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/creator")({
  head: () => ({ meta: [
    { title: "Creator Studio — shyfft" },
    { name: "description", content: "Stats and monetization for verified shyfft creators." },
    { property: "og:title", content: "Creator Studio — shyfft" },
    { property: "og:description", content: "Stats and monetization for verified shyfft creators." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CreatorPage,
});

function CreatorPage() {
  const s = useStore();
  const router = useRouter();
  const me = s.me;
  const mine = useMemo(() => s.posts.filter((p) => p.userId === me?.id), [s.posts, me?.id]);
  const likes = mine.reduce((a, p) => a + p.likes, 0);
  const comments = mine.reduce((a, p) => a + p.commentCount, 0);
  const reels = mine.filter((p) => p.kind === "reel").length;
  const top = [...mine].sort((a, b) => b.likes + b.commentCount - (a.likes + a.commentCount)).slice(0, 3);
  const engagement = me && me.followers > 0 && mine.length > 0 ? (((likes + comments) / mine.length / me.followers) * 100).toFixed(1) : "0";

  const back = <button aria-label="Back" onClick={() => router.history.back()}><ChevronLeft className="size-6" /></button>;

  if (!me?.verified) {
    const goals = [
      { label: "Posts & Reels", have: mine.length, need: 30 },
      { label: "Followers", have: me?.followers ?? 0, need: 500 },
    ];
    return (
      <>
        <TopBar title="Creator Studio" left={back} />
        <div className="mx-auto max-w-lg px-4 pb-24 pt-6 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-brand text-primary-foreground"><Lock className="size-7" /></div>
          <h1 className="font-display text-xl font-bold">Unlock with the green tick</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verified creators get a Creator Studio with stats, monetization and a glowing profile.</p>
          <div className="mt-6 space-y-4 text-left">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.have / g.need) * 100));
              return (
                <div key={g.label}>
                  <div className="mb-1 flex justify-between text-xs font-semibold"><span>{g.label}</span><span>{g.have} / {g.need}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Reach the goals, keep posting original content, and the shyfft team reviews accounts for the green tick.</p>
        </div>
      </>
    );
  }

  const stats = [
    { icon: Users, label: "Followers", v: me.followers },
    { icon: Heart, label: "Total likes", v: likes },
    { icon: MessageCircle, label: "Comments", v: comments },
    { icon: Film, label: "Reels", v: reels },
  ];

  return (
    <>
      <TopBar title="Creator Studio" left={back} />
      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        <div className="rounded-3xl bg-brand p-5 text-primary-foreground shadow-lg">
          <p className="flex items-center gap-1 text-sm font-semibold">@{me.username}<VerifiedBadge show /></p>
          <p className="mt-3 text-xs opacity-80">Earnings balance</p>
          <p className="font-display text-3xl font-bold">₹0.00</p>
          <p className="mt-1 text-[11px] opacity-80">Payouts are not live yet — earnings will appear here once tips & gifts launch.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(({ icon: I, label, v }) => (
            <div key={label} className="rounded-2xl border p-3">
              <I className="size-4 text-primary" />
              <p className="mt-1 font-display text-xl font-bold">{v.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 rounded-2xl border p-3">
          <TrendingUp className="size-5 text-verified" />
          <div className="flex-1"><p className="text-sm font-semibold">Engagement rate</p><p className="text-xs text-muted-foreground">Avg likes + comments per post ÷ followers</p></div>
          <p className="font-display text-lg font-bold">{engagement}%</p>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold">Monetization</h2>
        {[{ icon: Gift, t: "Tips & gifts from fans", d: "Coming soon" }, { icon: Wallet, t: "UPI payouts", d: "Coming soon" }].map(({ icon: I, t, d }) => (
          <div key={t} className="mb-2 flex items-center gap-3 rounded-2xl border p-3">
            <I className="size-5 text-primary" /><span className="flex-1 text-sm font-medium">{t}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{d}</span>
          </div>
        ))}

        <h2 className="mb-2 mt-5 text-sm font-bold">Top posts</h2>
        {top.length === 0 ? <p className="text-sm text-muted-foreground">Post something to see stats.</p> : (
          <div className="grid grid-cols-3 gap-1">
            {top.map((p) => (
              <Link key={p.id} to="/p/$id" params={{ id: p.id }} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                {p.mediaType === "video" ? <video src={p.media} muted className="size-full object-cover" /> : <img src={p.media} alt="" className="size-full object-cover" />}
                <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-[10px] font-bold">♥ {p.likes}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
