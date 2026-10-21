import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ show, className }: { show?: boolean | undefined; className?: string }) {
  if (!show) return null;
  return <BadgeCheck aria-label="Verified" className={cn("inline size-4 shrink-0 align-[-3px] text-verified", className)} />;
}
