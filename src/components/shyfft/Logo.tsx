export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="shyfft-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-green)" />
          <stop offset="1" stopColor="var(--brand-blue)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#shyfft-g)" />
      <path d="M27 13.5c-1.6-1.6-4-2.3-6.6-2.3-3.7 0-6.3 1.9-6.3 4.7 0 6 12.4 3.4 12.4 9 0 2.8-2.7 4.7-6.5 4.7-2.8 0-5.3-.9-7-2.6"
        fill="none" stroke="var(--primary-foreground)" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="29.5" cy="10.5" r="2.2" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={30} />
      <span className="font-display text-2xl font-bold tracking-tight text-brand">shyfft</span>
    </span>
  );
}
