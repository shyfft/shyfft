import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/shyfft/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — shyfft" },
      { name: "description", content: "Choose a new password for your shyfft account." },
      { property: "og:title", content: "Set a new password — shyfft" },
      { property: "og:description", content: "Choose a new password for your shyfft account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    nav({ to: "/" });
  };
  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <div className="flex justify-center"><LogoMark size={56} /></div>
      <h1 className="text-center text-2xl font-bold">Set a new password</h1>
      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
        className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none" autoComplete="new-password" />
      <button disabled={busy} className="rounded-xl bg-brand py-3 font-semibold text-primary-foreground disabled:opacity-60">Save password</button>
      <MadeWithLove className="pt-6" />
    </form>
  );
}
