"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";

import { supabase } from "@/db/supabase";

type AdminRow = {
  id: string;
  is_admin: boolean;
};

function getDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Account"
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;

    async function loadRole() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        if (active) setStatus("denied");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, is_admin")
        .eq("id", user.id)
        .maybeSingle<AdminRow>();

      if (!active) return;

      if (error || !data?.is_admin) {
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Checking admin access
        </div>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/50">
              <ShieldAlert className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                QuakeStrike PH
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                Admin only
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            This area is restricted to admin accounts. If you think this is a mistake, ask a project admin to mark your user row as `is_admin = true`.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
