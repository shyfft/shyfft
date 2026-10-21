import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Search, X } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { useStore } from "@/lib/store";
import { VerifiedBadge } from "@/components/shyfft/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — shyfft" },
      { name: "description", content: "Discover creators, photos and reels on shyfft." },
      { property: "og:title", content: "Explore — shyfft" },
      { property: "og:description", content: "Discover creators, photos and reels on shyfft." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const { posts, users, blocked } = useStore();
  const ME_ID = useStore().me.id;
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = users.filter((u) => u.id !== ME_ID && !blocked.has(u.id) &&
    (u.username.includes(query) || u.name.toLowerCase().includes(query)));
  return (
    <>
      <div className="glass sticky top-0 z-30 border-b p-3">
        <label className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {q && <button aria-label="Clear" onClick={() => setQ("")}><X className="size-4" /></button>}
        </label>
      </div>
      {query ? (
        <ul>
          {results.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No accounts found</li>}
          {results.map((u) => (
            <li key={u.id}>
              <Link to="/u/$username" params={{ username: u.username }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                <UserAvatar user={u} size={44} />
                <div className="text-sm leading-tight">
                  <p className="flex items-center gap-1 font-semibold">{u.username}<VerifiedBadge show={u.verified} className="size-3.5" /></p>
                  <p className="text-muted-foreground">{u.name}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((p, i) => (
            <Link key={p.id} to="/p/$id" params={{ id: p.id }}
              className={`relative bg-muted ${i % 7 === 2 ? "row-span-2" : ""}`}>
              <img src={p.media} alt="" loading="lazy" className="h-full w-full object-cover aspect-square" />
              {p.kind === "reel" && <Film className="absolute right-2 top-2 size-4 text-overlay-foreground drop-shadow" />}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
