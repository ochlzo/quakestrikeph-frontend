import type { APIRoute } from "astro"

import { validateAdminPinInput } from "@/lib/admin-pin-validation"
import { attachPinOwners, getAdminPinPayload, pinColumns, type SavedPinRow } from "@/lib/admin-pin-server"
import {
  auditAdminUserAction,
  getOptionalAdminClient,
  getAdminManagedUser,
  jsonError,
  jsonResponse,
  mapSupabaseError,
  readJsonBody,
  requireAdminSessionContext,
} from "@/lib/admin-user-server"

export const prerender = false

export const GET = (async ({ request }) => {
  try {
    const { userClient } = await requireAdminSessionContext(request)
    return jsonResponse(await getAdminPinPayload(userClient))
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute

export const POST = (async ({ request }) => {
  try {
    const { actor, userClient } = await requireAdminSessionContext(request)
    const validation = validateAdminPinInput(await readJsonBody(request))

    if (validation.error) {
      return jsonResponse({ error: validation.error }, 400)
    }

    const input = validation.value
    await getAdminManagedUser(userClient, input.authUserId)

    const { data, error } = await userClient
      .from("SavedPins")
      .insert({
        auth_user_id: input.authUserId,
        favorite_label: input.favoriteLabel,
        favorite_kind: input.favoriteKind,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      .select(pinColumns)
      .single<SavedPinRow>()

    if (error || !data) {
      throw mapSupabaseError(error, "Unable to create the saved pin.")
    }

    const { pins, users } = await getAdminPinPayload(userClient)
    const pin = pins.find((savedPin) => savedPin.favorite_id === data.favorite_id) ?? attachPinOwners([data], users)[0]

    const adminClient = getOptionalAdminClient()
    if (adminClient) {
      await auditAdminUserAction(adminClient, request, actor, "admin_saved_pin_created", {
        target_user_id: input.authUserId,
        favorite_id: data.favorite_id,
        favorite_label: input.favoriteLabel,
        favorite_kind: input.favoriteKind,
      })
    }

    return jsonResponse({ message: "Saved pin created.", pin }, 201)
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute
