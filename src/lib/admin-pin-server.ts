import type { SupabaseClient } from "@supabase/supabase-js"

import { AdminApiError, mapSupabaseError, type AdminUserRow } from "@/lib/admin-user-server"

export type SavedPinRow = {
  favorite_id: number
  auth_user_id: string
  favorite_label: string
  favorite_kind: "location" | "city" | "map_pin"
  latitude: number | null
  longitude: number | null
  created_at: string
}

const pinColumns = "favorite_id, auth_user_id, favorite_label, favorite_kind, latitude, longitude, created_at"

function getUserLabel(user: Pick<AdminUserRow, "Email" | "DisplayName" | "FName" | "Mname" | "LName"> | undefined) {
  if (!user) return "Unknown user"
  if (user.DisplayName?.trim()) return user.DisplayName.trim()

  const parts = [user.FName, user.Mname, user.LName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[]

  return parts.length > 0 ? parts.join(" ") : user.Email?.trim() || "Unknown user"
}

export function attachPinOwners(pins: SavedPinRow[], users: AdminUserRow[]) {
  const usersById = new Map(users.map((user) => [user.auth_user_id, user]))

  return pins.map((pin) => {
    const user = usersById.get(pin.auth_user_id)

    return {
      ...pin,
      owner_email: user?.Email ?? null,
      owner_label: getUserLabel(user),
    }
  })
}

export async function getAdminPinPayload(adminClient: SupabaseClient) {
  const [pinsResult, usersResult] = await Promise.all([
    adminClient.rpc("get_admin_saved_pins"),
    adminClient.rpc("get_admin_pin_users"),
  ])

  if (pinsResult.error) {
    throw mapSupabaseError(pinsResult.error, "Unable to load saved pins.")
  }
  if (usersResult.error) {
    throw mapSupabaseError(usersResult.error, "Unable to load users for saved pins.")
  }

  const users = (usersResult.data ?? []) as AdminUserRow[]
  const pins = pinsResult.data ?? []
  return { pins, users }
}

export async function getAdminSavedPin(adminClient: SupabaseClient, favoriteId: number) {
  const { data, error } = await adminClient
    .from("SavedPins")
    .select(pinColumns)
    .eq("favorite_id", favoriteId)
    .maybeSingle<SavedPinRow>()

  if (error) {
    throw mapSupabaseError(error, "Unable to load the saved pin.")
  }
  if (!data) {
    throw new AdminApiError(404, "Saved pin was not found.")
  }

  return data
}

export { pinColumns }
