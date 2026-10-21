export function validateUsername(raw: string, taken: string[]): string | null {
  const u = raw.toLowerCase();
  if (u.length < 3) return "At least 3 characters";
  if (u.length > 30) return "30 characters max";
  if (!/^[a-z0-9._]+$/.test(u)) return "Only letters, numbers, . and _";
  if (u.startsWith(".") || u.endsWith(".")) return "Can't start or end with a dot";
  if (taken.includes(u)) return "That username is taken";
  return null;
}
