import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shyfft/Avatar";
import { LogoMark } from "@/components/shyfft/Logo";
import { useStore } from "@/lib/store";
import { validateUsername } from "@/lib/username";

export const Route = createFileRoute("/onboarding")({
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
  const taken = s.users.filter((u) => u.id !== s.me.id).map((u) => u.username);
  const err = validateUsername(username, taken);

  const save = () => {
    if (err) { toast.error(err); return; }
    s.updateMe({ username: username.toLowerCase(), name, bio });
    toast.success("Profile saved");
    nav({ to: "/u/$username", params: { username: username.toLowerCase() } });
  };

  return (
    <div className="flex min-h-dvh flex-col p-6">
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <LogoMark size={52} />
        <h1 className="text-2xl font-bold">Make it yours</h1>
        <p className="text-sm text-muted-foreground">Choose a username. You can change it later.</p>
        <UserAvatar user={s.me} size={88} ring className="mt-2" />
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
      <button onClick={save} disabled={!!err} className="mt-auto rounded-2xl bg-brand py-3.5 font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
        Continue
      </button>
    </div>
  );
}
