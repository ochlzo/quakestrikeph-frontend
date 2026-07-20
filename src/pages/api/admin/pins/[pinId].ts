import type { APIRoute } from "astro"

import { validateAdminPinId, validateAdminPinInput } from "@/lib/admin-pin-validation"
import { attachPinOwners, getAdminPinPayload, getAdminSavedPin, pinColumns, type SavedPinRow } from "@/lib/admin-pin-server"
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

export const PATCH = (async ({ request, params }) => {
  try {
    const pinIdResult = validateAdminPinId(params.pinId)
    if (pinIdResult.error) {
      return jsonResponse({ error: pinIdResult.error }, 400)
    }

    const { actor, userClient } = await requireAdminSessionContext(request)
    const validation = validateAdminPinInput(await readJsonBody(request))

    if (validation.error) {
      return jsonResponse({ error: validation.error }, 400)
    }

    const input = validation.value
    const existingPin = await getAdminSavedPin(userClient, pinIdResult.value)
    await getAdminManagedUser(userClient, input.authUserId)

    const { data, error } = await userClient
      .from("SavedPins")
      .update({
        auth_user_id: input.authUserId,
        favorite_label: input.favoriteLabel,
        favorite_kind: input.favoriteKind,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      .eq("favorite_id", pinIdResult.value)
      .select(pinColumns)
      .single<SavedPinRow>()

    if (error || !data) {
      throw mapSupabaseError(error, "Unable to update the saved pin.")
    }

    const { pins, users } = await getAdminPinPayload(userClient)
    const pin = pins.find((savedPin) => savedPin.favorite_id === data.favorite_id) ?? attachPinOwners([data], users)[0]

    const adminClient = getOptionalAdminClient()
    if (adminClient) {
      await auditAdminUserAction(adminClient, request, actor, "admin_saved_pin_updated", {
        favorite_id: pinIdResult.value,
        previous_user_id: existingPin.auth_user_id,
        target_user_id: input.authUserId,
        favorite_label: input.favoriteLabel,
        favorite_kind: input.favoriteKind,
      })
    }

    return jsonResponse({ message: "Saved pin updated.", pin })
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute

export const DELETE = (async ({ request, params }) => {
  try {
    const pinIdResult = validateAdminPinId(params.pinId)
    if (pinIdResult.error) {
      return jsonResponse({ error: pinIdResult.error }, 400)
    }

    const { actor, userClient } = await requireAdminSessionContext(request)
    const existingPin = await getAdminSavedPin(userClient, pinIdResult.value)
    const { error } = await userClient
      .from("SavedPins")
      .delete()
      .eq("favorite_id", pinIdResult.value)

    if (error) {
      throw mapSupabaseError(error, "Unable to remove the saved pin.")
    }

    const adminClient = getOptionalAdminClient()
    if (adminClient) {
      await auditAdminUserAction(adminClient, request, actor, "admin_saved_pin_removed", {
        favorite_id: pinIdResult.value,
        target_user_id: existingPin.auth_user_id,
        favorite_label: existingPin.favorite_label,
        favorite_kind: existingPin.favorite_kind,
      })
    }

    return jsonResponse({ message: "Saved pin removed." })
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute
