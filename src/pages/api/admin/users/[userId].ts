import type { APIRoute } from "astro"

import {
  validateAccountStatusInput,
  validateAdminUpdateUserInput,
} from "@/lib/admin-user-validation"
import {
  AdminApiError,
  assertUserId,
  auditAdminUserAction,
  getAdminManagedUser,
  jsonError,
  jsonResponse,
  mapSupabaseError,
  readJsonBody,
  requireAdminContext,
} from "@/lib/admin-user-server"

export const prerender = false

export const PATCH = (async ({ request, params }) => {
  try {
    const targetUserId = assertUserId(params.userId)
    const { actor, adminClient } = await requireAdminContext(request)
    const validation = validateAdminUpdateUserInput(await readJsonBody(request))

    if (validation.error) {
      return jsonResponse({ error: validation.error }, 400)
    }

    const existingUser = await getAdminManagedUser(adminClient, targetUserId)
    const input = validation.value

    if (input.mobileNumber) {
      const { data: mobileOwner, error: mobileOwnerError } = await adminClient
        .from("PubUser")
        .select("auth_user_id")
        .eq("MobileNum", input.mobileNumber)
        .neq("auth_user_id", targetUserId)
        .maybeSingle<{ auth_user_id: string }>()

      if (mobileOwnerError) {
        throw mapSupabaseError(mobileOwnerError, "Unable to validate the mobile number.")
      }
      if (mobileOwner) {
        throw new AdminApiError(409, "That email or mobile number is already assigned to another user.")
      }
    }

    const authAttributes: {
      password?: string
      user_metadata?: Record<string, string | null>
    } = {
      user_metadata: {
        display_name: input.displayName,
        first_name: input.firstName,
        middle_name: input.middleName,
        last_name: input.lastName,
        mobile_number: input.mobileNumber,
      },
    }

    if (input.password) {
      authAttributes.password = input.password
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetUserId, authAttributes)
    if (authUpdateError) {
      throw mapSupabaseError(authUpdateError, "Unable to update the user credentials.")
    }

    const { error: profileUpdateError } = await adminClient
      .from("PubUser")
      .update({
        DisplayName: input.displayName,
        FName: input.firstName,
        Mname: input.middleName,
        LName: input.lastName,
        MobileNum: input.mobileNumber,
      })
      .eq("auth_user_id", targetUserId)

    if (profileUpdateError) {
      throw mapSupabaseError(profileUpdateError, "Unable to update the user profile.")
    }

    const user = await getAdminManagedUser(adminClient, targetUserId)
    await auditAdminUserAction(adminClient, request, actor, "admin_user_updated", {
      target_user_id: targetUserId,
      target_email: existingUser.Email,
      updated_fields: [
        "displayName",
        "firstName",
        "middleName",
        "lastName",
        "mobileNumber",
        ...(input.password ? ["password"] : []),
      ],
    })

    return jsonResponse({ message: "Account updated.", user })
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute

export const PUT = (async ({ request, params }) => {
  try {
    const targetUserId = assertUserId(params.userId)
    const { actor, adminClient } = await requireAdminContext(request)
    const validation = validateAccountStatusInput(await readJsonBody(request))

    if (validation.error) {
      return jsonResponse({ error: validation.error }, 400)
    }

    if (actor.id === targetUserId && validation.value.accountStatus === "inactive") {
      throw new AdminApiError(403, "Admins cannot deactivate their own account.")
    }

    await getAdminManagedUser(adminClient, targetUserId)

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: validation.value.accountStatus === "inactive" ? "876000h" : "none",
    })

    if (authUpdateError) {
      throw mapSupabaseError(authUpdateError, "Unable to update the account status.")
    }

    const { error: profileUpdateError } = await adminClient
      .from("PubUser")
      .update({ account_status: validation.value.accountStatus })
      .eq("auth_user_id", targetUserId)

    if (profileUpdateError) {
      throw mapSupabaseError(profileUpdateError, "Unable to update the account status.")
    }

    const user = await getAdminManagedUser(adminClient, targetUserId)
    await auditAdminUserAction(adminClient, request, actor, "admin_user_status_updated", {
      target_user_id: targetUserId,
      target_email: user.Email,
      account_status: validation.value.accountStatus,
    })

    return jsonResponse({ message: "Account status updated.", user })
  } catch (error) {
    return jsonError(error)
  }
}) satisfies APIRoute
