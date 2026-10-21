import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LogoMark } from "@/components/shyfft/Logo";
import { MadeWithLove } from "@/components/shyfft/MadeWithLove";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — shyfft" },
      { name: "description", content: "Sign in or create your shyfft account." },
      { property: "og:title", content: "Sign in — shyfft" },
      { property: "og:description", content: "Sign in or create your shyfft account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const { authed } = useStore();
  const nav = useNavigate();

  useEffect(() => { if (authed) nav({ to: "/", replace: true }); }, [authed, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setSent("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: "google" | "lovable") => {
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message ?? "Sign-in failed");
  };

  const input = "w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={64} />
        <h1 className="font-display text-4xl font-bold text-brand">shyfft</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "up" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
        </p>
      </div>
      {sent ? (
        <p className="rounded-xl bg-accent p-4 text-center text-sm text-accent-foreground">{sent}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} autoComplete="email" />
          {mode !== "forgot" && (
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={input}
              autoComplete={mode === "up" ? "new-password" : "current-password"} />
          )}
          <button disabled={busy} className="w-full rounded-xl bg-brand py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy ? "Please wait…" : mode === "up" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
          {mode === "in" && (
            <button type="button" onClick={() => setMode("forgot")} className="block w-full text-center text-xs text-muted-foreground">Forgot password?</button>
          )}
        </form>
      )}
      {mode !== "forgot" && !sent && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <div className="space-y-2">
            <button onClick={() => social("google")} className="w-full rounded-xl border bg-card py-3 text-sm font-semibold">Continue with Google</button>
            <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>Continue with Lovable</button>
          </div>
        </>
      )}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "up" ? "Already have an account? " : mode === "forgot" ? "Remembered it? " : "New to shyfft? "}
        <button onClick={() => { setSent(null); setMode(mode === "in" ? "up" : "in"); }} className="font-semibold text-primary">
          {mode === "in" ? "Sign up" : "Sign in"}
        </button>
      </p>
      <MadeWithLove className="pt-2" />
    </div>
  );
}
