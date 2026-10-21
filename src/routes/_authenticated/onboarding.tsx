import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { LogoMark } from "@/components/shyfft/Logo";
import { useStore } from "@/lib/store";
import { validateUsername } from "@/lib/username";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Choose your username — shyfft" },
      { name: "description", content: "Pick your shyfft username and set up your profile." },
      { property: "og:title", content: "Choose your username — shyfft" },
      { property: "og:description", content: "Pick your shyfft username and set up your profile." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const s = useStore();
  const nav = useNavigate();
  const [username, setUsername] = useState(s.me.username);
  const [name, setName] = useState(s.me.name);
  const [bio, setBio] = useState(s.me.bio);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taken = s.users.filter((u) => u.id !== s.me.id).map((u) => u.username);
  const err = validateUsername(username, taken);

  const save = async () => {
    if (err) { toast.error(err); return; }
    setBusy(true);
    const u = username.toLowerCase();
    const res = await s.updateMe({ username: u, name, bio, onboarded: true });
    setBusy(false);
    if (res) { toast.error(res); return; }
    toast.success("Profile saved");
    nav({ to: "/u/$username", params: { username: u } });
  };

  const pickAvatar = async (f?: File) => {
    if (!f) return;
    try { await s.uploadAvatar(f); toast.success("Photo updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
  };

  return (
    <div className="flex min-h-dvh flex-col p-6">
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <LogoMark size={52} />
        <h1 className="text-2xl font-bold">Make it yours</h1>
        <p className="text-sm text-muted-foreground">Choose a username. You can change it later.</p>
        <button onClick={() => fileRef.current?.click()} className="relative mt-2" aria-label="Change photo">
          <UserAvatar user={s.me} size={88} ring />
          <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-brand text-primary-foreground">
            <Camera className="size-4" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
      </div>
      <div className="mt-8 space-y-3">
        <label className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3">
          <span className="text-muted-foreground">@</span>
          <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="username" className="flex-1 bg-transparent outline-none" autoCapitalize="none" />
          {err ? <X className="size-5 text-destructive" /> : <Check className="size-5 text-primary" />}
        </label>
        {err && <p className="px-1 text-xs text-destructive">{err}</p>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border bg-card px-4 py-3 outline-none" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} className="w-full resize-none rounded-xl border bg-card px-4 py-3 outline-none" />
      </div>
      <button onClick={save} disabled={!!err || busy} className="mt-auto rounded-2xl bg-brand py-3.5 font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
        {busy ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
