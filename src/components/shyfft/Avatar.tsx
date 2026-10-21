import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export function UserAvatar({ user, size = 36, ring = false, className }: { user?: User; size?: number; ring?: boolean; className?: string }) {
  const img = (
    <img src={user?.avatar} alt={user?.username ?? ""} width={size} height={size}
      className="rounded-full bg-muted object-cover" style={{ width: size, height: size }} />
  );
  if (!ring) return <span className={cn("inline-block shrink-0", className)}>{img}</span>;
  return (
    <span className={cn("inline-block shrink-0 rounded-full p-[2.5px] ring-story", className)}>
      <span className="block rounded-full bg-background p-[2px]">{img}</span>
    </span>
  );
}
