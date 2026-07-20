import { requestAdminApi, type AdminUserRow } from "@/data/admin-users"
import type { AdminPinInput, SavedPinKind } from "@/lib/admin-pin-validation"

export type AdminSavedPinRow = {
  favorite_id: number
  auth_user_id: string
  favorite_label: string
  favorite_kind: SavedPinKind
  latitude: number | null
  longitude: number | null
  created_at: string
  owner_email: string | null
  owner_label: string
}

export type AdminPinsPayload = {
  pins: AdminSavedPinRow[]
  users: AdminUserRow[]
}

export function getAdminPinsData() {
  return requestAdminApi<AdminPinsPayload>("/api/admin/pins")
}

export function createAdminSavedPin(input: AdminPinInput) {
  return requestAdminApi<{ message: string; pin: AdminSavedPinRow }>("/api/admin/pins", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateAdminSavedPin(pinId: number, input: AdminPinInput) {
  return requestAdminApi<{ message: string; pin: AdminSavedPinRow }>(`/api/admin/pins/${pinId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteAdminSavedPin(pinId: number) {
  return requestAdminApi<{ message: string }>(`/api/admin/pins/${pinId}`, {
    method: "DELETE",
  })
}
