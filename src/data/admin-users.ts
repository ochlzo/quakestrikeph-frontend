import { supabase } from "@/db/supabase";
import type {
  AccountStatus,
  AdminUserProfileInput,
} from "@/lib/admin-user-validation";

export type AdminUserRow = {
  PUser_id: number | null;
  auth_user_id: string;
  role: string | null;
  account_status: AccountStatus | null;
  Email: string | null;
  DisplayName: string | null;
  FName: string | null;
  Mname: string | null;
  LName: string | null;
  MobileNum: string | null;
};

export type AuditValues = Partial<
  Record<
    | "Email"
    | "DisplayName"
    | "FName"
    | "Mname"
    | "LName"
    | "MobileNum"
    | "account_status"
    | "role",
    string | null
  >
>;

export type PubUserAuditRow = {
  aud_id: number;
  profile_email: string | null;
  action: "insert" | "update";
  changed_fields: string[] | null;
  old_values: AuditValues | null;
  new_values: AuditValues | null;
  changed_by_email: string | null;
  changed_at: string;
};

export type PasswordResetLogRow = {
  log_id: number;
  reset_email: string;
  status: "completed";
  reset_type: "email_otp";
  completed_at: string;
};

export async function getAdminDashboardData() {
  const usersRequest = supabase
    .from("PubUser")
    .select(
      'PUser_id, auth_user_id, role, account_status, "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"',
    )
    .order("PUser_id", { ascending: false });
  const auditRequest = supabase
    .from("PubUserAuditLog")
    .select(
      "aud_id, profile_email, action, changed_fields, old_values, new_values, changed_by_email, changed_at",
    )
    .order("changed_at", { ascending: false })
    .limit(50);
  const resetLogRequest = supabase
    .from("PasswordResetLog")
    .select("log_id, reset_email, status, reset_type, completed_at")
    .order("completed_at", { ascending: false })
    .limit(50);

  const [users, auditLogs, resetLogs] = await Promise.all([
    usersRequest,
    auditRequest,
    resetLogRequest,
  ]);

  return {
    users: { data: (users.data ?? []) as AdminUserRow[], error: users.error },
    auditLogs: {
      data: (auditLogs.data ?? []) as PubUserAuditRow[],
      error: auditLogs.error,
    },
    resetLogs: {
      data: (resetLogs.data ?? []) as PasswordResetLogRow[],
      error: resetLogs.error,
    },
  };
}

export async function getAdminAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sign in as an admin before managing users.");
  }

  return data.session.access_token;
}

export async function requestAdminApi<
  TBody extends Record<string, unknown> = Record<string, unknown>,
>(path: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as TBody & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Unable to manage that user right now.");
  }

  return body;
}

export function createAdminUserAccount(input: AdminUserProfileInput) {
  return requestAdminApi<{ message: string; user: AdminUserRow }>(
    "/api/admin/users",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateAdminUserAccount(
  userId: string,
  input: AdminUserProfileInput,
) {
  return requestAdminApi<{ message: string; user: AdminUserRow }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function setAdminUserAccountStatus(
  userId: string,
  accountStatus: AccountStatus,
) {
  return requestAdminApi<{ message: string; user: AdminUserRow }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ accountStatus }),
    },
  );
}
