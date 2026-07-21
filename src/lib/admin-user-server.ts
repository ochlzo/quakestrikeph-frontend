import { getSecret } from "astro:env/server"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"

import { getPasswordErrorMessage } from "./input-security.ts"

export type AdminUserRow = {
  PUser_id: number | null
  auth_user_id: string
  role: string | null
  account_status: "active" | "inactive" | null
  Email: string | null
  DisplayName: string | null
  FName: string | null
  Mname: string | null
  LName: string | null
  MobileNum: string | null
}

export type AdminContext = {
  actor: User
  actorProfile: { role: string | null; account_status: string | null; Email: string | null }
  adminClient: SupabaseClient
}

export type AdminSessionContext = {
  actor: User
  actorProfile: { role: string | null; account_status: string | null; Email: string | null }
  userClient: SupabaseClient
}

export class AdminApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
  }
}

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
}

function getSupabaseUrl() {
  return import.meta.env.PUBLIC_SUPABASE_URL?.trim() || getSecret("PUBLIC_SUPABASE_URL")?.trim()
}

function getPublicKey() {
  return import.meta.env.PUBLIC_SUPABASE_KEY?.trim() || getSecret("PUBLIC_SUPABASE_KEY")?.trim()
}

function getAdminKey() {
  return getSecret("SUPABASE_SECRET_KEY")?.trim() || getSecret("SUPABASE_SERVICE_ROLE_KEY")?.trim()
}

function createSupabaseClient(key: string, token?: string) {
  const supabaseUrl = getSupabaseUrl()
  if (!supabaseUrl) {
    throw new AdminApiError(503, "Supabase URL is not configured.")
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  })
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AdminApiError(401, "Sign in as an admin before managing users.")
  }

  return token
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

export function jsonError(error: unknown) {
  if (error instanceof AdminApiError) {
    return jsonResponse({ error: error.message }, error.status)
  }

  console.error("Admin user management failed", error)
  return jsonResponse({ error: "Unable to manage users right now." }, 500)
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new AdminApiError(400, "Submit a valid JSON request.")
  }
}

export async function requireAdminContext(request: Request): Promise<AdminContext> {
  const publicKey = getPublicKey()
  const adminKey = getAdminKey()

  if (!publicKey) {
    throw new AdminApiError(503, "Supabase publishable key is not configured.")
  }
  if (!adminKey) {
    throw new AdminApiError(503, "Supabase admin key is not configured.")
  }

  const token = getBearerToken(request)
  const userClient = createSupabaseClient(publicKey, token)
  const adminClient = createSupabaseClient(adminKey)
  const { data: authData, error: authError } = await userClient.auth.getUser(token)

  if (authError || !authData.user) {
    throw new AdminApiError(401, "Sign in again before managing users.")
  }

  const { data: profile, error: profileError } = await adminClient
    .from("PubUser")
    .select('role, account_status, "Email"')
    .eq("auth_user_id", authData.user.id)
    .maybeSingle<{ role: string | null; account_status: string | null; Email: string | null }>()

  if (profileError) {
    throw mapSupabaseError(profileError, "Unable to verify admin access.")
  }
  if (profile?.role !== "admin" || profile.account_status !== "active") {
    throw new AdminApiError(403, "Only active admin accounts can manage users.")
  }

  return { actor: authData.user, actorProfile: profile, adminClient }
}

export async function requireAdminSessionContext(request: Request): Promise<AdminSessionContext> {
  const publicKey = getPublicKey()

  if (!publicKey) {
    throw new AdminApiError(503, "Supabase publishable key is not configured.")
  }

  const token = getBearerToken(request)
  const userClient = createSupabaseClient(publicKey, token)
  const { data: authData, error: authError } = await userClient.auth.getUser(token)

  if (authError || !authData.user) {
    throw new AdminApiError(401, "Sign in again before managing users.")
  }

  const { data: profile, error: profileError } = await userClient
    .from("PubUser")
    .select('role, account_status, "Email"')
    .eq("auth_user_id", authData.user.id)
    .maybeSingle<{ role: string | null; account_status: string | null; Email: string | null }>()

  if (profileError) {
    throw mapSupabaseError(profileError, "Unable to verify admin access.")
  }
  if (profile?.role !== "admin" || profile.account_status !== "active") {
    throw new AdminApiError(403, "Only active admin accounts can manage users.")
  }

  return { actor: authData.user, actorProfile: profile, userClient }
}

export function getOptionalAdminClient() {
  const adminKey = getAdminKey()
  if (!adminKey) return null

  return createSupabaseClient(adminKey)
}

export function mapSupabaseError(error: unknown, fallback: string) {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown }
  const status = typeof candidate.status === "number" ? candidate.status : undefined
  const code = String(candidate.code ?? "").toLowerCase()
  const message = String(candidate.message ?? "").toLowerCase()

  if (
    status === 409 ||
    code === "23505" ||
    code.includes("already") ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate key")
  ) {
    return new AdminApiError(409, "That email or mobile number is already assigned to another user.")
  }

  if (status === 400 || code === "weak_password") {
    return new AdminApiError(400, getPasswordErrorMessage(error, fallback))
  }

  if (status === 404 || code === "user_not_found") {
    return new AdminApiError(404, "User account was not found.")
  }

  return new AdminApiError(500, fallback)
}

export async function getAdminManagedUser(adminClient: SupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("PubUser")
    .select('PUser_id, auth_user_id, role, account_status, "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"')
    .eq("auth_user_id", userId)
    .maybeSingle<AdminUserRow>()

  if (error) throw mapSupabaseError(error, "Unable to load the user account.")
  if (!data) throw new AdminApiError(404, "User account was not found.")
  return data
}

export function assertUserId(value: string | undefined) {
  const userId = String(value ?? "").trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new AdminApiError(400, "Choose a valid user account.")
  }

  return userId
}

export async function auditAdminUserAction(
  adminClient: SupabaseClient,
  request: Request,
  actor: User,
  action: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await adminClient.from("audit_logs").insert({
    user_email: actor.email?.toLowerCase() ?? null,
    path: new URL(request.url).pathname,
    method: request.method,
    metadata: {
      action,
      actor_id: actor.id,
      ...metadata,
    },
  })

  if (error) {
    console.error("Unable to write admin audit log", error)
  }
}
