"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Edit3, LoaderCircle, MapPin, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AdminPinDialog } from "@/components/admin-pin-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createAdminSavedPin,
  deleteAdminSavedPin,
  getAdminPinsData,
  updateAdminSavedPin,
  type AdminSavedPinRow,
} from "@/data/admin-pins"
import type { AdminUserRow } from "@/data/admin-users"
import type { AdminPinInput } from "@/lib/admin-pin-validation"

const pinDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
})
const pinTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeStyle: "short",
})

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function formatCoordinate(value: number | null) {
  return value === null ? null : value.toFixed(5)
}

function getCoordinateLabel(pin: AdminSavedPinRow) {
  const latitude = formatCoordinate(pin.latitude)
  const longitude = formatCoordinate(pin.longitude)
  return latitude && longitude ? `${latitude}, ${longitude}` : "No coordinates"
}

export function AdminPinsPanel() {
  const [pins, setPins] = useState<AdminSavedPinRow[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPin, setEditingPin] = useState<AdminSavedPinRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminSavedPinRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPinId, setDeletingPinId] = useState<number | null>(null)

  const loadPins = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoading(true)

    try {
      const data = await getAdminPinsData()
      if (!shouldApply()) return

      setPins(data.pins)
      setUsers(data.users)
      setError(null)
    } catch (loadError) {
      if (!shouldApply()) return
      setPins([])
      setUsers([])
      setError(getErrorMessage(loadError, "Unable to load saved pins."))
    } finally {
      if (shouldApply()) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void loadPins(() => active)

    return () => {
      active = false
    }
  }, [loadPins])

  const coordinatePinCount = useMemo(
    () => pins.filter((pin) => pin.latitude !== null && pin.longitude !== null).length,
    [pins],
  )

  async function handleCreatePin(input: AdminPinInput) {
    setIsSubmitting(true)

    try {
      await createAdminSavedPin(input)
      toast.success("Saved pin created.")
      setCreateOpen(false)
      await loadPins()
    } catch (createError) {
      toast.error(getErrorMessage(createError, "We could not create that saved pin right now."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdatePin(input: AdminPinInput) {
    if (!editingPin) return
    setIsSubmitting(true)

    try {
      await updateAdminSavedPin(editingPin.favorite_id, input)
      toast.success("Saved pin updated.")
      setEditingPin(null)
      await loadPins()
    } catch (updateError) {
      toast.error(getErrorMessage(updateError, "We could not update that saved pin right now."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePin() {
    if (!deleteTarget) return
    setDeletingPinId(deleteTarget.favorite_id)

    try {
      await deleteAdminSavedPin(deleteTarget.favorite_id)
      toast.success("Saved pin removed.")
      setDeleteTarget(null)
      await loadPins()
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, "We could not remove that saved pin right now."))
    } finally {
      setDeletingPinId(null)
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="border-b border-border px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <MapPin className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                SavedPins
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Pin management
              </h2>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={users.length === 0}>
            <Plus className="size-4" />
            Create pin
          </Button>
        </div>
      </div>

      <div className="grid gap-4 border-b border-border p-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Total saved pins
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{pins.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            With coordinates
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{coordinatePinCount}</p>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading saved pins
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : pins.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
            No saved pins exist yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="w-[22%] px-3 py-3 font-semibold">Owner</th>
                  <th className="w-[26%] px-3 py-3 font-semibold">Label</th>
                  <th className="w-[9%] px-3 py-3 font-semibold">Type</th>
                  <th className="w-[13%] px-3 py-3 font-semibold">Coordinates</th>
                  <th className="w-[14%] px-3 py-3 font-semibold">Created</th>
                  <th className="w-[16%] px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pins.map((pin) => (
                  <tr key={pin.favorite_id} className="border-t border-border">
                    <td className="px-3 py-4 align-top">
                      <div className="break-words font-medium text-foreground">{pin.owner_label}</div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">{pin.owner_email ?? "No email"}</div>
                    </td>
                    <td className="break-words px-3 py-4 align-top font-medium text-foreground">
                      {pin.favorite_label}
                    </td>
                    <td className="px-3 py-4 align-top text-sm capitalize text-muted-foreground">
                      {pin.favorite_kind.replace("_", " ")}
                    </td>
                    <td className="break-words px-3 py-4 align-top text-sm text-muted-foreground">
                      {getCoordinateLabel(pin)}
                    </td>
                    <td className="px-3 py-4 align-top text-sm text-muted-foreground">
                      <time dateTime={pin.created_at} className="block leading-6">
                        <span className="block whitespace-nowrap">{pinDateFormatter.format(new Date(pin.created_at))}</span>
                        <span className="block whitespace-nowrap">{pinTimeFormatter.format(new Date(pin.created_at))}</span>
                      </time>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex min-w-[10rem] flex-col items-stretch justify-end gap-2 min-[1180px]:flex-row min-[1180px]:items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full min-[1180px]:w-auto"
                          onClick={() => setEditingPin(pin)}
                        >
                          <Edit3 className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="w-full min-[1180px]:w-auto"
                          disabled={deletingPinId === pin.favorite_id}
                          onClick={() => setDeleteTarget(pin)}
                        >
                          {deletingPinId === pin.favorite_id ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminPinDialog
        mode="create"
        open={createOpen}
        users={users}
        isSubmitting={isSubmitting}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreatePin}
      />
      <AdminPinDialog
        mode="edit"
        open={Boolean(editingPin)}
        pin={editingPin}
        users={users}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open) setEditingPin(null)
        }}
        onSubmit={handleUpdatePin}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove saved pin?</DialogTitle>
            <DialogDescription>
              This removes the saved pin from the selected user's account.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">{deleteTarget?.favorite_label ?? "Selected pin"}</div>
            <div className="mt-1 text-muted-foreground">{deleteTarget?.owner_email ?? "No email"}</div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deletingPinId)}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(deletingPinId)}
              onClick={() => {
                void handleDeletePin()
              }}
            >
              {deletingPinId ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Removing
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Remove pin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
