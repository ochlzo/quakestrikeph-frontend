"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";

import { supabase } from "@/db/supabase";
import { ensurePubUserRow } from "@/lib/pubuser";

export function AdminGate({ children }: { children: ReactNode }) {
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

      try {
        await ensurePubUserRow(user);
      } catch {
        // Continue with the auth lookup; the row may already exist or be retried elsewhere.
      }

      const { data: profile, error } = await supabase
        .from("PubUser")
        .select('role, account_status')
        .eq("auth_user_id", user.id)
        .maybeSingle<{ role: string | null; account_status: string | null }>();

      if (error || profile?.role !== "admin" || profile.account_status !== "active") {
        if (active) setStatus("denied");
        return;
      }

      if (!active) return;
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
                Account access
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            This area is available after you sign in as an admin account and complete your PubUser profile.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
