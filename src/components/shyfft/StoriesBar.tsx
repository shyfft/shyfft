import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { UserAvatar } from "./Avatar";

export function StoriesBar() {
  const { stories, getUser, me } = useStore();
  const ME_ID = useStore().me.id;
  const ids = [...new Set(stories.map((s) => s.userId))].filter((id) => id !== ME_ID);
  const mine = stories.some((s) => s.userId === ME_ID);
  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto border-b px-4 py-3">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1">
        {mine ? (
          <Link to="/stories/$username" params={{ username: me.username }}><UserAvatar user={me} size={60} ring /></Link>
        ) : (
          <Link to="/create" search={{ tab: "story" }} className="relative">
            <UserAvatar user={me} size={64} />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-brand text-primary-foreground"><Plus className="size-3" /></span>
          </Link>
        )}
        <span className="text-xs">Your story</span>
      </div>
      {ids.map((id) => {
        const u = getUser(id)!;
        return (
          <Link key={id} to="/stories/$username" params={{ username: u.username }} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <UserAvatar user={u} size={60} ring />
            <span className="w-full truncate text-center text-xs">{u.username}</span>
          </Link>
        );
      })}
    </div>
  );
}
