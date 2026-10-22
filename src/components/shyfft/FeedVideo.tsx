import { Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SOUND_KEY = "shyfft-sound";

export function getSoundPref() {
  return localStorage.getItem(SOUND_KEY) === "on";
}
export function setSoundPref(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event("shyfft-sound"));
}
export function useSoundPref() {
  const [on, setOn] = useState(getSoundPref);
  useEffect(() => {
    const sync = () => setOn(getSoundPref());
    window.addEventListener("shyfft-sound", sync);
    return () => window.removeEventListener("shyfft-sound", sync);
  }, []);
  return [on, setSoundPref] as const;
}

/**
 * Premium inline video player: no native controls, tap to play/pause,
 * small sound toggle that fades out after ~2s, buffering + error states.
 */
export function FeedVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useSoundPref();
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [showCtl, setShowCtl] = useState(false);

  const flashControls = useCallback(() => {
    setShowCtl(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtl(false), 2000);
  }, []);

  // Autoplay muted while mostly visible; pause when scrolled away.
  useEffect(() => {
    const el = wrap.current;
    const v = ref.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => { io.disconnect(); v.pause(); };
  }, [src]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const togglePlay = () => {
    const v = ref.current;
    if (!v || error) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else { v.pause(); setPlaying(false); }
    flashControls();
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSoundOn(!soundOn);
    flashControls();
  };

  const retry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    ref.current?.load();
    ref.current?.play().then(() => setPlaying(true)).catch(() => {});
  };

  return (
    <div ref={wrap} className={cn("relative select-none", className)} onClick={togglePlay}>
      <video
        ref={ref}
        src={src}
        className="aspect-square w-full object-cover"
        loop
        muted={!soundOn}
        playsInline
        preload="metadata"
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => { setError(true); setBuffering(false); }}
      />
      {/* Center state icon: play/pause feedback, spinner while buffering, retry on error */}
      {error ? (
        <button aria-label="Retry video" onClick={retry}
          className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-overlay/60 text-overlay-foreground backdrop-blur-sm">
          <RotateCcw className="size-6" />
        </button>
      ) : buffering ? (
        <Loader2 className="pointer-events-none absolute inset-0 m-auto size-9 animate-spin text-overlay-foreground/90 drop-shadow" />
      ) : (
        <div className={cn("pointer-events-none absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-overlay/50 text-overlay-foreground backdrop-blur-sm transition-opacity duration-300", showCtl ? "opacity-100" : "opacity-0")}>
          {playing ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
        </div>
      )}
      {/* Small sound control — fades out after ~2s, reappears on tap */}
      {!error && (
        <button
          aria-label={soundOn ? "Mute" : "Unmute"}
          onClick={toggleSound}
          className={cn("absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-overlay/60 text-overlay-foreground backdrop-blur-sm transition-opacity duration-500", showCtl || !soundOn ? "opacity-100" : "opacity-0")}
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      )}
    </div>
  );
}
