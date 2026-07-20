import { sanitizePlainTextInput } from "./input-security.ts"

export type SavedPinKind = "location" | "city" | "map_pin"

export type AdminPinInput = {
  authUserId: string
  favoriteLabel: string
  favoriteKind: SavedPinKind
  latitude: number | null
  longitude: number | null
}

type ValidationResult<T> =
  | { value: T; error?: undefined }
  | { value?: undefined; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isValidAuthUserId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function optionalCoordinate(value: unknown, minimum: number, maximum: number, label: string) {
  if (value === null || value === undefined || value === "") return { value: null }

  const coordinate = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    return { error: `${label} must be a valid coordinate.` }
  }

  return { value: coordinate }
}

export function validateAdminPinInput(input: unknown): ValidationResult<AdminPinInput> {
  if (!isRecord(input)) {
    return { error: "Submit the pinned location details again." }
  }

  const authUserId = String(input.authUserId ?? "").trim()
  if (!isValidAuthUserId(authUserId)) {
    return { error: "Choose a valid user for this pinned location." }
  }

  const favoriteLabel = sanitizePlainTextInput(String(input.favoriteLabel ?? ""), 120).trim()
  if (!favoriteLabel) {
    return { error: "Enter a pinned location label." }
  }

  const favoriteKind = String(input.favoriteKind ?? "").trim().toLowerCase()
  if (favoriteKind !== "location" && favoriteKind !== "city" && favoriteKind !== "map_pin") {
    return { error: "Pinned location type must be location, city, or map pin." }
  }

  const latitude = optionalCoordinate(input.latitude, -90, 90, "Latitude")
  const longitude = optionalCoordinate(input.longitude, -180, 180, "Longitude")
  if (latitude.error) return { error: latitude.error }
  if (longitude.error) return { error: longitude.error }

  if ((latitude.value === null) !== (longitude.value === null)) {
    return { error: "Latitude and longitude must be provided together." }
  }
  if (favoriteKind === "map_pin" && (latitude.value === null || longitude.value === null)) {
    return { error: "Map pins need both latitude and longitude." }
  }

  return {
    value: {
      authUserId,
      favoriteLabel,
      favoriteKind,
      latitude: latitude.value,
      longitude: longitude.value,
    },
  }
}

export function validateAdminPinId(value: string | undefined) {
  const pinId = Number(value)
  if (!Number.isInteger(pinId) || pinId <= 0) {
    return { error: "Choose a valid pinned location." }
  }

  return { value: pinId }
}
