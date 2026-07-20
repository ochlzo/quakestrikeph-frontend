"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";
import { clearAppSessionCache } from "@/lib/app-session";

export function AdminLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      clearAppSessionCache();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 rounded-xl"
      disabled={isLoggingOut}
      onClick={() => {
        void handleLogout();
      }}
    >
      {isLoggingOut ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Logging out
        </>
      ) : (
        <>
          <LogOut className="size-4" />
          Logout
        </>
      )}
    </Button>
  );
}
