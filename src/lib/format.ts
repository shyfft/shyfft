export function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function avatarFallback(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=c0f2dc,b6d8ff,d1f7ef`;
}
export function formatActiveStatus(lastSeen?: number, isOnline?: boolean): string {
  if (isOnline) return "Active now";
  if (!lastSeen) return "";

  const diffMs = Date.now() - lastSeen;
  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (mins < 2) return "Active now";
  if (mins < 60) return `Active ${mins}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${timeAgo(lastSeen)} ago`;
}
