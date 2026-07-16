"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, HistoryIcon, LoaderCircle, ShieldCheck, Users2 } from "lucide-react";

import { supabase } from "@/db/supabase";

type PubUserRow = {
  PUser_id: number | null;
  role: string | null;
  Email: string | null;
  DisplayName: string | null;
  FName: string | null;
  Mname: string | null;
  LName: string | null;
  MobileNum: string | null;
};
type AuditValues = Partial<Record<"Email" | "DisplayName" | "FName" | "Mname" | "LName" | "MobileNum", string | null>>;
type PubUserAuditRow = {
  audit_id: number;
  profile_email: string | null;
  action: "insert" | "update";
  changed_fields: string[] | null;
  old_values: AuditValues | null;
  new_values: AuditValues | null;
  changed_by_email: string | null;
  changed_at: string;
};

type PasswordResetLogRow = {
  log_id: number;
  reset_email: string;
  status: "completed";
  reset_type: "email_otp";
  completed_at: string;
};

const auditDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getUserLabel(user: PubUserRow) {
  if (user.DisplayName?.trim()) {
    return user.DisplayName.trim();
  }

  const parts = [user.FName, user.Mname, user.LName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];

  return parts.length > 0 ? parts.join(" ") : user.Email?.trim() || "Account";
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<PubUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<PubUserAuditRow[]>([]);
  const [resetLogs, setResetLogs] = useState<PasswordResetLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [isLoadingResetLogs, setIsLoadingResetLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [resetLogError, setResetLogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setIsLoading(true);
      setIsLoadingAudit(true);
      setIsLoadingResetLogs(true);

      const usersRequest = supabase
        .from("PubUser")
        .select('PUser_id, role, "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"')
        .order("PUser_id", { ascending: false });
      const auditRequest = supabase
        .from("PubUserAuditLog")
        .select("audit_id, profile_email, action, changed_fields, old_values, new_values, changed_by_email, changed_at")
        .order("changed_at", { ascending: false })
        .limit(50);
      const resetLogRequest = supabase
        .from("PasswordResetLog")
        .select("log_id, reset_email, status, reset_type, completed_at")
        .order("completed_at", { ascending: false })
        .limit(50);
      const [
        { data, error: queryError },
        { data: auditData, error: auditQueryError },
        { data: resetLogData, error: resetLogQueryError },
      ] = await Promise.all([
        usersRequest,
        auditRequest,
        resetLogRequest,
      ]);

      if (!active) {
        return;
      }

      if (queryError) {
        setUsers([]);
        setError(queryError.message);
      } else {
        setUsers((data ?? []) as PubUserRow[]);
        setError(null);
      }

      if (auditQueryError) {
        setAuditLogs([]);
        setAuditError(auditQueryError.message);
      } else {
        setAuditLogs((auditData ?? []) as PubUserAuditRow[]);
        setAuditError(null);
      }

      if (resetLogQueryError) {
        setResetLogs([]);
        setResetLogError(resetLogQueryError.message);
      } else {
        setResetLogs((resetLogData ?? []) as PasswordResetLogRow[]);
        setResetLogError(null);
      }

      setIsLoading(false);
      setIsLoadingAudit(false);
      setIsLoadingResetLogs(false);
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const latestLogin = useMemo(() => {
    let latestValue: number | null = null;

    for (const user of users) {
      const candidate = user.PUser_id;
      if (!candidate) {
        continue;
      }

      if (latestValue === null || candidate > latestValue) {
        latestValue = candidate;
      }
    }

    return latestValue;
  }, [users]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users2 className="size-4" />
            Saved users
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{users.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="size-4" />
            Profile rows
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{users.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock3 className="size-4" />
            Latest record
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {latestLogin ? `PUser_id ${latestLogin}` : "No rows yet"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <HistoryIcon className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Audit log
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Profile edit history
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoadingAudit ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading audit log
            </div>
          ) : auditError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {auditError}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No profile edits have been recorded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Changes</th>
                    <th className="px-4 py-3 font-semibold">Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.audit_id} className="border-t border-border">
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {auditDateFormatter.format(new Date(log.changed_at))}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-foreground">
                        {log.profile_email ?? "Unknown user"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm capitalize text-muted-foreground">
                        {log.action}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          {(log.changed_fields ?? []).map((field) => (
                            <div key={`${log.audit_id}-${field}`} className="rounded-xl bg-muted/35 px-3 py-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {field}
                              </div>
                              <div className="mt-1 text-sm text-foreground">
                                <span className="text-muted-foreground">{log.old_values?.[field as keyof AuditValues] ?? "Empty"}</span>
                                <span className="px-2 text-muted-foreground">to</span>
                                <span>{log.new_values?.[field as keyof AuditValues] ?? "Empty"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {log.changed_by_email ?? "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <HistoryIcon className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Password reset log
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Password recovery history
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoadingResetLogs ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading password reset log
            </div>
          ) : resetLogError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {resetLogError}
            </div>
          ) : resetLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No password resets have been recorded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {resetLogs.map((log) => (
                    <tr key={log.log_id} className="border-t border-border">
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {auditDateFormatter.format(new Date(log.completed_at))}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-foreground">
                        {log.reset_email}
                      </td>
                      <td className="px-4 py-4 align-top text-sm capitalize text-muted-foreground">
                        {log.status}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {log.reset_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <BadgeCheck className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                PubUser
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Accounts saved in PubUser
              </h2>
            </div>
          </div>
        </div>

      <div className="p-6">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading users
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No accounts have been saved into <span className="font-medium text-foreground">PubUser</span> yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Mobile</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.PUser_id ?? getUserLabel(user)} className="border-t border-border">
                      <td className="px-4 py-4 align-top text-sm capitalize text-muted-foreground">
                        {user.role ?? "user"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-foreground">{getUserLabel(user)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {user.DisplayName || user.FName || user.Mname || user.LName ? "Saved profile details" : "No name saved yet"}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {user.Email ?? "No email"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {user.MobileNum ?? "Not set"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {user.PUser_id ?? "No id"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
