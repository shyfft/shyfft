import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

type Peer = { id: string; name: string; username: string; avatar?: string };
type Status = "idle" | "calling" | "ringing" | "connected";
type State = { status: Status; peer: Peer | null; muted: boolean; startedAt: number | null };

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

let state: State = { status: "idle", peer: null, muted: false, startedAt: null };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };

let me: Peer | null = null;
let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let pendingOffer: RTCSessionDescriptionInit | null = null;
let queuedIce: RTCIceCandidateInit[] = [];
const outChannels = new Map<string, Promise<RealtimeChannel>>();
let remoteAudio: HTMLAudioElement | null = null;

// ---------- ringtone (Web Audio, no file needed) ----------
let ringCtx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
function startRing(outgoing: boolean) {
  stopRing();
  try {
    ringCtx = new AudioContext();
    const beep = () => {
      if (!ringCtx) return;
      const t = ringCtx.currentTime;
      [0, 0.4].forEach((off) => {
        const o = ringCtx!.createOscillator();
        const g = ringCtx!.createGain();
        o.frequency.value = outgoing ? 425 : 880;
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.2, t + off + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.35);
        o.connect(g).connect(ringCtx!.destination);
        o.start(t + off);
        o.stop(t + off + 0.36);
      });
    };
    beep();
    ringTimer = setInterval(beep, outgoing ? 3000 : 2000);
  } catch { /* audio blocked */ }
  if (!outgoing && "vibrate" in navigator) navigator.vibrate?.([400, 200, 400]);
}
function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
  ringCtx?.close().catch(() => {});
  ringCtx = null;
}

// ---------- signaling ----------
function channelFor(userId: string) {
  let p = outChannels.get(userId);
  if (!p) {
    p = new Promise((resolve) => {
      const ch = supabase.channel(`call:${userId}`);
      ch.subscribe((s) => { if (s === "SUBSCRIBED") resolve(ch); });
    });
    outChannels.set(userId, p);
  }
  return p;
}
async function signal(to: string, payload: Record<string, unknown>) {
  const ch = await channelFor(to);
  await ch.send({ type: "broadcast", event: "signal", payload: { ...payload, from: me } });
}

function cleanup() {
  stopRing();
  pc?.close(); pc = null;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  pendingOffer = null; queuedIce = [];
  if (remoteAudio) remoteAudio.srcObject = null;
  set({ status: "idle", peer: null, muted: false, startedAt: null });
}

async function makePc(peerId: string) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  pc = new RTCPeerConnection({ iceServers: ICE });
  stream.getTracks().forEach((t) => pc!.addTrack(t, stream!));
  pc.onicecandidate = (e) => { if (e.candidate) signal(peerId, { kind: "ice", candidate: e.candidate.toJSON() }); };
  pc.ontrack = (e) => { if (remoteAudio) { remoteAudio.srcObject = e.streams[0]; remoteAudio.play().catch(() => {}); } };
  pc.onconnectionstatechange = () => {
    if (pc?.connectionState === "connected") { stopRing(); set({ status: "connected", startedAt: Date.now() }); }
    if (pc && ["failed", "closed"].includes(pc.connectionState)) { toast.error("Call disconnected"); cleanup(); }
  };
}

export async function startCall(peer: Peer) {
  if (!me) return;
  if (state.status !== "idle") return toast.error("Already in a call");
  try {
    set({ status: "calling", peer });
    startRing(true);
    await makePc(peer.id);
    const offer = await pc!.createOffer();
    await pc!.setLocalDescription(offer);
    await signal(peer.id, { kind: "offer", sdp: offer });
    setTimeout(() => {
      if (state.status === "calling" && state.peer?.id === peer.id) { signal(peer.id, { kind: "end" }); toast("No answer"); cleanup(); }
    }, 45000);
  } catch (e) {
    toast.error((e as Error)?.name === "NotAllowedError" ? "Microphone permission is needed for calls" : "Could not start call");
    cleanup();
  }
}

async function accept() {
  const peer = state.peer;
  if (!peer || !pendingOffer) return;
  try {
    stopRing();
    await makePc(peer.id);
    await pc!.setRemoteDescription(pendingOffer);
    for (const c of queuedIce) await pc!.addIceCandidate(c).catch(() => {});
    queuedIce = [];
    const answer = await pc!.createAnswer();
    await pc!.setLocalDescription(answer);
    await signal(peer.id, { kind: "answer", sdp: answer });
  } catch (e) {
    toast.error((e as Error)?.name === "NotAllowedError" ? "Microphone permission is needed for calls" : "Could not join call");
    signal(peer.id, { kind: "end" });
    cleanup();
  }
}

function hangup() {
  if (state.peer) signal(state.peer.id, { kind: state.status === "ringing" ? "decline" : "end" });
  cleanup();
}

function toggleMute() {
  const m = !state.muted;
  stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
  set({ muted: m });
}

async function onSignal(p: { kind: string; from: Peer; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
  if (!p?.from) return;
  const fromCurrent = state.peer?.id === p.from.id;
  switch (p.kind) {
    case "offer":
      if (state.status !== "idle") { signal(p.from.id, { kind: "busy" }); return; }
      pendingOffer = p.sdp ?? null;
      set({ status: "ringing", peer: p.from });
      startRing(false);
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        try {
          const n = new Notification("Incoming voice call", { body: `${p.from.name} (@${p.from.username}) is calling you`, icon: p.from.avatar, tag: "shyfft-call", requireInteraction: true });
          n.onclick = () => { window.focus(); n.close(); };
        } catch { /* ignore */ }
      }
      break;
    case "answer":
      if (fromCurrent && pc && p.sdp) {
        await pc.setRemoteDescription(p.sdp);
        for (const c of queuedIce) await pc.addIceCandidate(c).catch(() => {});
        queuedIce = [];
      }
      break;
    case "ice":
      if (!fromCurrent || !p.candidate) return;
      if (pc?.remoteDescription) await pc.addIceCandidate(p.candidate).catch(() => {});
      else queuedIce.push(p.candidate);
      break;
    case "decline": if (fromCurrent) { toast("Call declined"); cleanup(); } break;
    case "busy": if (fromCurrent) { toast("User is on another call"); cleanup(); } break;
    case "end": if (fromCurrent) cleanup(); break;
  }
}

function useCall() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}

function Timer({ from }: { from: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return <>{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</>;
}

export function CallManager() {
  const s = useStore();
  const c = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const myId = s.me?.id;

  useEffect(() => { remoteAudio = audioRef.current; }, []);
  useEffect(() => {
    if (s.me?.id) me = { id: s.me.id, name: s.me.name, username: s.me.username, avatar: s.me.avatar };
  }, [s.me]);

  useEffect(() => {
    if (!myId) return;
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    const ch = supabase.channel(`call:${myId}`).on("broadcast", { event: "signal" }, ({ payload }) => { onSignal(payload as never); }).subscribe();
    const bye = () => { if (state.peer) signal(state.peer.id, { kind: "end" }); };
    window.addEventListener("beforeunload", bye);
    return () => { window.removeEventListener("beforeunload", bye); supabase.removeChannel(ch); };
  }, [myId]);

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      {c.status !== "idle" && c.peer && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 px-6 py-16 backdrop-blur-xl animate-in fade-in">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={c.status !== "connected" ? "rounded-full p-1 bg-brand animate-pulse" : "rounded-full p-1 bg-brand"}>
              {c.peer.avatar
                ? <img src={c.peer.avatar} alt="" className="size-28 rounded-full border-4 border-background object-cover" />
                : <div className="flex size-28 items-center justify-center rounded-full border-4 border-background bg-muted text-3xl font-bold">{c.peer.name.slice(0, 1)}</div>}
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{c.peer.name}</p>
              <p className="text-sm text-muted-foreground">@{c.peer.username}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {c.status === "calling" && "Calling…"}
              {c.status === "ringing" && "Incoming voice call"}
              {c.status === "connected" && c.startedAt && <Timer from={c.startedAt} />}
            </p>
          </div>
          <div className="flex items-center gap-8">
            {c.status === "connected" && (
              <button onClick={toggleMute} aria-label={c.muted ? "Unmute" : "Mute"} className="flex size-16 items-center justify-center rounded-full bg-muted">
                {c.muted ? <MicOff className="size-7" /> : <Mic className="size-7" />}
              </button>
            )}
            <button onClick={hangup} aria-label="End call" className="flex size-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <PhoneOff className="size-7" />
            </button>
            {c.status === "ringing" && (
              <button onClick={accept} aria-label="Accept call" className="flex size-16 items-center justify-center rounded-full bg-brand text-primary-foreground">
                <Phone className="size-7" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
