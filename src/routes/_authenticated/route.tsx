import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/shyfft/Logo";
import { MadeWithLove } from "@/components/shyfft/MadeWithLove";
import { useStore } from "@/lib/store";
import { CallManager } from "@/components/shyfft/CallManager";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Gate,
});

function Gate() {
  const s = useStore();
  const { pathname } = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (s.ready && !s.me.onboarded && pathname !== "/onboarding") nav({ to: "/onboarding" });
  }, [s.ready, s.me, pathname, nav]);
  if (!s.ready) {
    return (
      <div className="relative flex h-dvh flex-col items-center justify-center gap-8">
        <div className="animate-pulse"><LogoMark size={56} /></div>
        <MadeWithLove className="absolute bottom-8" />
      </div>
    );
  }
  return <><Outlet /><CallManager /></>;
}
