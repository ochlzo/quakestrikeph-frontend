"use client"

import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, Save, UserPlus } from "lucide-react"

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
import type { AdminUserRow } from "@/data/admin-users"
import {
  validateAdminCreateUserInput,
  validateAdminUpdateUserInput,
  type AdminUserProfileInput,
} from "@/lib/admin-user-validation"
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePasswordInput,
  sanitizePhoneInput,
} from "@/lib/input-security"

type AdminUserDialogProps = {
  mode: "create" | "edit"
  open: boolean
  user?: AdminUserRow | null
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AdminUserProfileInput) => Promise<void>
}

type FormState = {
  email: string
  password: string
  displayName: string
  firstName: string
  middleName: string
  lastName: string
  mobileNumber: string
}

function getInitialState(mode: AdminUserDialogProps["mode"], user?: AdminUserRow | null): FormState {
  if (mode === "edit" && user) {
    return {
      email: user.Email ?? "",
      password: "",
      displayName: user.DisplayName ?? "",
      firstName: user.FName ?? "",
      middleName: user.Mname ?? "",
      lastName: user.LName ?? "",
      mobileNumber: user.MobileNum ?? "",
    }
  }

  return {
    email: "",
    password: "",
    displayName: "",
    firstName: "",
    middleName: "",
    lastName: "",
    mobileNumber: "",
  }
}

export function AdminUserDialog({
  mode,
  open,
  user,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: AdminUserDialogProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(mode, user))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(getInitialState(mode, user))
    setError(null)
  }, [mode, open, user])

  function setField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = mode === "create"
      ? validateAdminCreateUserInput(form)
      : validateAdminUpdateUserInput(form)

    if (validation.error !== undefined) {
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
            <DialogTitle>{mode === "create" ? "Create user account" : "Update user account"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a regular active account. Passwords are saved through Supabase Auth."
                : "Update profile credentials. Leave password blank to keep the current password."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-email`}>Email</Label>
              <Input
                id={`${mode}-admin-email`}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setField("email", sanitizeEmailInput(event.target.value))}
                readOnly={mode === "edit"}
                className={mode === "edit" ? "bg-muted/40" : undefined}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-password`}>
                {mode === "create" ? "Password" : "New password"}
              </Label>
              <Input
                id={`${mode}-admin-password`}
                type="password"
                autoComplete="new-password"
                placeholder={mode === "edit" ? "Leave blank to keep current" : "At least 8 characters"}
                value={form.password}
                onChange={(event) => setField("password", sanitizePasswordInput(event.target.value))}
                required={mode === "create"}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${mode}-admin-display-name`}>Display name</Label>
              <Input
                id={`${mode}-admin-display-name`}
                value={form.displayName}
                onChange={(event) => setField("displayName", sanitizeNameInput(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-first-name`}>First name</Label>
              <Input
                id={`${mode}-admin-first-name`}
                value={form.firstName}
                onChange={(event) => setField("firstName", sanitizeNameInput(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-middle-name`}>Middle name</Label>
              <Input
                id={`${mode}-admin-middle-name`}
                value={form.middleName}
                onChange={(event) => setField("middleName", sanitizeNameInput(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-last-name`}>Last name</Label>
              <Input
                id={`${mode}-admin-last-name`}
                value={form.lastName}
                onChange={(event) => setField("lastName", sanitizeNameInput(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-admin-mobile`}>Mobile number</Label>
              <Input
                id={`${mode}-admin-mobile`}
                inputMode="numeric"
                placeholder="09XXXXXXXXX"
                value={form.mobileNumber}
                onChange={(event) => setField("mobileNumber", sanitizePhoneInput(event.target.value))}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Saving
                </>
              ) : mode === "create" ? (
                <>
                  <UserPlus className="size-4" />
                  Create account
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
