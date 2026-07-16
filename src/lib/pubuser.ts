import type { User } from "@supabase/supabase-js";

import { supabase } from "@/db/supabase";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  validateMobileNumberInput,
} from "@/lib/input-security";

export type PubUserProfile = {
  PUser_id: number | null;
  auth_user_id: string | null;
  role: string | null;
  Email: string | null;
  DisplayName: string | null;
  FName: string | null;
  Mname: string | null;
  LName: string | null;
  MobileNum: string | null;
};

export type PubUserProfileInput = {
  DisplayName: string | null;
  FName: string | null;
  Mname: string | null;
  LName: string | null;
  MobileNum: string | null;
};

function normalizeEmail(email: string) {
  return sanitizeEmailInput(email);
}

function getNameParts(user: User) {
  const rawName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "";

  const parts = rawName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { FName: null, Mname: null, LName: null };
  }

  if (parts.length === 1) {
    return { FName: sanitizeNameInput(parts[0]).trim() || null, Mname: null, LName: null };
  }

  if (parts.length === 2) {
    return {
      FName: sanitizeNameInput(parts[0]).trim() || null,
      Mname: null,
      LName: sanitizeNameInput(parts[1]).trim() || null,
    };
  }

  return {
    FName: sanitizeNameInput(parts[0]).trim() || null,
    Mname: sanitizeNameInput(parts.slice(1, -1).join(" ")).trim() || null,
    LName: sanitizeNameInput(parts.at(-1) ?? "").trim() || null,
  };
}

function getDisplayNameFromParts(profile: Pick<PubUserProfileInput, "FName" | "Mname" | "LName">) {
  return [profile.FName, profile.Mname, profile.LName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function isDuplicateMobileNumberError(error: { code?: string; message?: string; details?: string }) {
  return (
    error.code === "23505" &&
    [
      error.message ?? "",
      error.details ?? "",
    ].some((value) => value.includes("PubUser_mobile_number_unique"))
  );
}

export function getPubUserDisplayName(profile: PubUserProfile | null) {
  if (!profile) {
    return "Account";
  }

  if (profile.DisplayName?.trim()) {
    return profile.DisplayName.trim();
  }

  const parts = [profile.FName, profile.Mname, profile.LName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return profile.Email?.trim() || "Account";
}

async function getPubUserRowByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("PubUser")
    .select('PUser_id, auth_user_id, role, "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"')
    .ilike("Email", normalizedEmail)
    .maybeSingle<PubUserProfile>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function ensurePubUserRow(user: User) {
  const email = user.email?.trim();
  if (!email) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await getPubUserRowByEmail(normalizedEmail);
  if (existing) {
    return existing;
  }

  const nameParts = getNameParts(user);
  const displayName = getDisplayNameFromParts(nameParts);
  const { data, error } = await supabase
    .from("PubUser")
    .insert({
      auth_user_id: user.id,
      role: "user",
      Email: normalizedEmail,
      DisplayName: displayName ? sanitizeNameInput(displayName).trim() : null,
      ...nameParts,
      MobileNum: null,
    })
    .select('PUser_id, auth_user_id, role, "Email", "DisplayName", "FName", "Mname", "LName", "MobileNum"')
    .maybeSingle<PubUserProfile>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getPubUserProfile(email: string) {
  return getPubUserRowByEmail(email);
}

export async function updatePubUserProfile(
  email: string,
  profile: PubUserProfileInput,
) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }

  const authUser = authData.user;
  if (!authUser) {
    throw new Error("You must be signed in to save your PubUser profile.");
  }

  const normalizedEmail = normalizeEmail(email);
  const mobileNumberResult = validateMobileNumberInput(profile.MobileNum ?? "");
  if (mobileNumberResult.error) {
    throw new Error(mobileNumberResult.error);
  }

  const payload = {
    auth_user_id: authUser.id,
    Email: normalizedEmail,
    DisplayName: profile.DisplayName ? sanitizeNameInput(profile.DisplayName).trim() || null : null,
    FName: profile.FName ? sanitizeNameInput(profile.FName).trim() || null : null,
    Mname: profile.Mname ? sanitizeNameInput(profile.Mname).trim() || null : null,
    LName: profile.LName ? sanitizeNameInput(profile.LName).trim() || null : null,
    MobileNum: sanitizePhoneInput(mobileNumberResult.value),
  };

  const { error } = await supabase
    .from("PubUser")
    .upsert(payload, { onConflict: "auth_user_id" });

  if (error) {
    if (isDuplicateMobileNumberError(error)) {
      throw new Error("This mobile number is already used by another account.");
    }

    throw error;
  }
}
