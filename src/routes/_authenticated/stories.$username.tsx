import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/stories/$username")({
  head: () => ({
    meta: [
      { title: "Story — shyfft" },
      { name: "description", content: "View a 24-hour story on shyfft." },
      { property: "og:title", content: "Story — shyfft" },
      { property: "og:description", content: "View a 24-hour story on shyfft." },
    ],
  }),
  component: StoryViewer,
});

const DURATION = 5000;

function StoryViewer() {
  const { username } = Route.useParams();
  const s = useStore();
  const nav = useNavigate();
  const order = [...new Set(s.stories.map((x) => x.userId))];
  const user = s.byUsername(username);
  const items = s.stories.filter((x) => x.userId === user?.id).reverse();
  const [i, setI] = useState(0);

  useEffect(() => setI(0), [username]);

  const next = () => {
    if (i < items.length - 1) return setI(i + 1);
    const nid = order[order.indexOf(user!.id) + 1]; const nextUser = nid ? s.getUser(nid) : undefined;
    nextUser ? nav({ to: "/stories/$username", params: { username: nextUser.username } }) : nav({ to: "/" });
  };
  const prev = () => (i > 0 ? setI(i - 1) : undefined);

  useEffect(() => {
    const t = setTimeout(next, DURATION);
    return () => clearTimeout(t);
  });

  if (!user || items.length === 0) {
    return <div className="flex h-dvh items-center justify-center bg-overlay text-overlay-foreground">Story expired</div>;
  }
  const story = items[i] ?? items[0]!;
  return (
    <div className="relative h-dvh bg-overlay text-overlay-foreground">
      <img src={story.media} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-overlay/70 to-transparent p-3">
        <div className="flex gap-1">
          {items.map((it, k) => (
            <div key={it.id} className="h-0.5 flex-1 overflow-hidden rounded bg-overlay-foreground/30">
              <div key={`${it.id}-${i}`} className="h-full bg-overlay-foreground"
                style={{ width: k < i ? "100%" : k > i ? "0%" : undefined, animation: k === i ? `story-progress ${DURATION}ms linear forwards` : undefined }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <UserAvatar user={user} size={32} />
          <span className="text-sm font-semibold">{user.username}</span>
          <span className="text-xs opacity-70">{timeAgo(story.createdAt)}</span>
          <button aria-label="Close" onClick={() => nav({ to: "/" })} className="ml-auto"><X className="size-6" /></button>
        </div>
      </div>
      <button aria-label="Previous" onClick={prev} className="absolute bottom-0 left-0 top-20 w-1/3" />
      <button aria-label="Next" onClick={next} className="absolute bottom-0 right-0 top-20 w-2/3" />
    </div>
  );
}
