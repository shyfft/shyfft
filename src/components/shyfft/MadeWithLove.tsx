import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small creator credit shown on the loading splash and entry screens. */
export function MadeWithLove({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground",
        className,
      )}
    >
      <span>made with</span>
      <Heart className="size-3 shrink-0 fill-like text-like" aria-hidden />
      <span>by Shreyash Chavaragi</span>
    </p>
  );
}
