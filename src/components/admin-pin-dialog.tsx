"use client"

import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, MapPin, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminSavedPinRow } from "@/data/admin-pins"
import type { AdminUserRow } from "@/data/admin-users"
import {
  validateAdminPinInput,
  type AdminPinInput,
  type SavedPinKind,
} from "@/lib/admin-pin-validation"
import { sanitizePlainTextInput } from "@/lib/input-security"

type AdminPinDialogProps = {
  mode: "create" | "edit"
  open: boolean
  pin?: AdminSavedPinRow | null
  users: AdminUserRow[]
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AdminPinInput) => Promise<void>
}

type FormState = {
  authUserId: string
  favoriteLabel: string
  favoriteKind: SavedPinKind
  latitude: string
  longitude: string
}

function getUserLabel(user: AdminUserRow) {
  if (user.DisplayName?.trim()) return user.DisplayName.trim()

  const parts = [user.FName, user.Mname, user.LName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[]

  return parts.length > 0 ? parts.join(" ") : user.Email?.trim() || "Account"
}

function getInitialState(mode: AdminPinDialogProps["mode"], users: AdminUserRow[], pin?: AdminSavedPinRow | null): FormState {
  if (mode === "edit" && pin) {
    return {
      authUserId: pin.auth_user_id,
      favoriteLabel: pin.favorite_label,
      favoriteKind: pin.favorite_kind,
      latitude: pin.latitude === null ? "" : String(pin.latitude),
      longitude: pin.longitude === null ? "" : String(pin.longitude),
    }
  }

  return {
    authUserId: users[0]?.auth_user_id ?? "",
    favoriteLabel: "",
    favoriteKind: "map_pin",
    latitude: "",
    longitude: "",
  }
}

function parseCoordinate(value: string) {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : null
}

export function AdminPinDialog({
  mode,
  open,
  pin,
  users,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: AdminPinDialogProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(mode, users, pin))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(getInitialState(mode, users, pin))
    setError(null)
  }, [mode, open, pin, users])

  function setField<TKey extends keyof FormState>(field: TKey, value: FormState[TKey]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateAdminPinInput({
      authUserId: form.authUserId,
      favoriteLabel: form.favoriteLabel,
      favoriteKind: form.favoriteKind,
      latitude: parseCoordinate(form.latitude),
      longitude: parseCoordinate(form.longitude),
    })

    if (validation.error) {
      setError(validation.error)
      return
    }

    setError(null)
    await onSubmit(validation.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create saved pin" : "Edit saved pin"}</DialogTitle>
            <DialogDescription>
              Choose the owner account and saved location details.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${mode}-pin-owner`}>Owner</Label>
              <select
                id={`${mode}-pin-owner`}
                value={form.authUserId}
                onChange={(event) => setField("authUserId", event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30"
                disabled={users.length === 0}
                required
              >
                {users.map((user) => (
                  <option key={user.auth_user_id} value={user.auth_user_id}>
                    {getUserLabel(user)} ({user.Email ?? "no email"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${mode}-pin-label`}>Label</Label>
              <Input
                id={`${mode}-pin-label`}
                value={form.favoriteLabel}
                onChange={(event) => setField("favoriteLabel", sanitizePlainTextInput(event.target.value, 120))}
                placeholder="Home, Office, School, or evacuation point"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-pin-kind`}>Type</Label>
              <select
                id={`${mode}-pin-kind`}
                value={form.favoriteKind}
                onChange={(event) => setField("favoriteKind", event.target.value as SavedPinKind)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="map_pin">Map pin</option>
                <option value="location">Location</option>
                <option value="city">City</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-pin-latitude`}>Latitude</Label>
              <Input
                id={`${mode}-pin-latitude`}
                type="number"
                step="any"
                min={-90}
                max={90}
                value={form.latitude}
                onChange={(event) => setField("latitude", event.target.value)}
                placeholder="14.5995"
                required={form.favoriteKind === "map_pin"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-pin-longitude`}>Longitude</Label>
              <Input
                id={`${mode}-pin-longitude`}
                type="number"
                step="any"
                min={-180}
                max={180}
                value={form.longitude}
                onChange={(event) => setField("longitude", event.target.value)}
                placeholder="120.9842"
                required={form.favoriteKind === "map_pin"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || users.length === 0}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Saving
                </>
              ) : mode === "create" ? (
                <>
                  <MapPin className="size-4" />
                  Create pin
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save pin
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
