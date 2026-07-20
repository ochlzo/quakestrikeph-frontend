import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePasswordInput,
  sanitizePhoneInput,
  validateEmailInput,
  validateMobileNumberInput,
  validatePasswordInput,
} from "./input-security.ts"

export type AccountStatus = "active" | "inactive"

export type AdminUserProfileInput = {
  email: string
  password?: string
  displayName: string | null
  firstName: string | null
  middleName: string | null
  lastName: string | null
  mobileNumber: string | null
}

type ValidationResult<T> =
  | { value: T; error?: undefined }
  | { value?: undefined; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(input: Record<string, unknown>, key: string) {
  const value = input[key]
  return typeof value === "string" ? value : ""
}

function optionalName(input: Record<string, unknown>, key: string) {
  const value = sanitizeNameInput(stringValue(input, key)).trim()
  return value || null
}

function optionalMobile(input: Record<string, unknown>): ValidationResult<string | null> {
  const value = sanitizePhoneInput(stringValue(input, "mobileNumber"))
  if (!value) return { value: null }

  const result = validateMobileNumberInput(value)
  if (result.error !== undefined) return { error: result.error }
  return { value: result.value }
}

function validateProfileInput(input: unknown, passwordMode: "required" | "optional") {
  if (!isRecord(input)) {
    return { error: "Submit the account details again." }
  }

  const emailResult = validateEmailInput(stringValue(input, "email"))
  const mobileResult = optionalMobile(input)

  if (emailResult.error) return { error: emailResult.error }
  if (mobileResult.error !== undefined) return { error: mobileResult.error }

  const rawPassword = stringValue(input, "password")
  const password = sanitizePasswordInput(rawPassword)

  if (passwordMode === "required") {
    const passwordResult = validatePasswordInput(password)
    if (passwordResult.error) return { error: passwordResult.error }
  } else if (password) {
    const passwordResult = validatePasswordInput(password)
    if (passwordResult.error) return { error: passwordResult.error }
  }

  const value: AdminUserProfileInput = {
    email: emailResult.value,
    displayName: optionalName(input, "displayName"),
    firstName: optionalName(input, "firstName"),
    middleName: optionalName(input, "middleName"),
    lastName: optionalName(input, "lastName"),
    mobileNumber: mobileResult.value,
  }

  if (password) value.password = password
  return { value }
}

export function validateAdminCreateUserInput(input: unknown): ValidationResult<AdminUserProfileInput> {
  return validateProfileInput(input, "required")
}

export function validateAdminUpdateUserInput(input: unknown): ValidationResult<AdminUserProfileInput> {
  return validateProfileInput(input, "optional")
}

export function validateAccountStatusInput(input: unknown): ValidationResult<{ accountStatus: AccountStatus }> {
  if (!isRecord(input)) {
    return { error: "Choose an account status." }
  }

  const accountStatus = String(input.accountStatus ?? "").toLowerCase()
  if (accountStatus !== "active" && accountStatus !== "inactive") {
    return { error: "Account status must be active or inactive." }
  }

  return { value: { accountStatus } }
}
