import type { APIRoute } from "astro";

import { validateAdminCreateUserInput } from "@/lib/admin-user-validation";
import {
  auditAdminUserAction,
  jsonError,
  jsonResponse,
  mapSupabaseError,
  readJsonBody,
  requireAdminContext,
  getAdminManagedUser,
} from "@/lib/admin-user-server";

export const prerender = false;

export const POST = (async ({ request }) => {
  try {
    const { actor, adminClient } = await requireAdminContext(request);
    const validation = validateAdminCreateUserInput(
      await readJsonBody(request),
    );

    if (validation.error !== undefined) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const input = validation.value;
    const { data: authData, error: createError } =
      await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          display_name: input.displayName,
          first_name: input.firstName,
          middle_name: input.middleName,
          last_name: input.lastName,
          mobile_number: input.mobileNumber,
        },
      });

    if (createError || !authData.user) {
      throw mapSupabaseError(createError, "Unable to create the user account.");
    }

    const user = await getAdminManagedUser(adminClient, authData.user.id);
    await auditAdminUserAction(
      adminClient,
      request,
      actor,
      "admin_user_created",
      {
        target_user_id: authData.user.id,
        target_email: input.email,
      },
    );

    return jsonResponse({ message: "Account created.", user }, 201);
  } catch (error) {
    return jsonError(error);
  }
}) satisfies APIRoute;
