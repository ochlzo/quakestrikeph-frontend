"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeCheck, Clock3, Edit3, HistoryIcon, LoaderCircle, RotateCcw, ShieldCheck, UserX, Users2 } from "lucide-react"
import { toast } from "sonner"

import { AdminUserDialog } from "@/components/admin-user-dialog"
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
  createAdminUserAccount,
  getAdminDashboardData,
  setAdminUserAccountStatus,
  updateAdminUserAccount,
  type AdminUserRow,
  type AuditValues,
  type PasswordResetLogRow,
  type PubUserAuditRow,
} from "@/data/admin-users"
import { supabase } from "@/db/supabase"
import type { AdminUserProfileInput } from "@/lib/admin-user-validation"
import { cn } from "@/lib/utils"

const auditDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
})

function getUserLabel(user: AdminUserRow) {
  if (user.DisplayName?.trim()) {
    return user.DisplayName.trim()
  }

  const parts = [user.FName, user.Mname, user.LName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[]

  return parts.length > 0 ? parts.join(" ") : user.Email?.trim() || "Account"
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function StatusBadge({ status }: { status: AdminUserRow["account_status"] }) {
  const isActive = status !== "inactive"

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        isActive
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/20 bg-destructive/10 text-destructive",
      )}
    >
      {isActive ? "active" : "inactive"}
    </span>
  )
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [auditLogs, setAuditLogs] = useState<PubUserAuditRow[]>([])
  const [resetLogs, setResetLogs] = useState<PasswordResetLogRow[]>([])
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingAudit, setIsLoadingAudit] = useState(true)
  const [isLoadingResetLogs, setIsLoadingResetLogs] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [resetLogError, setResetLogError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<AdminUserRow | null>(null)
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)
  const [statusUserId, setStatusUserId] = useState<string | null>(null)

  const loadDashboard = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoading(true)
    setIsLoadingAudit(true)
    setIsLoadingResetLogs(true)

    const [authResponse, dashboard] = await Promise.all([
      supabase.auth.getUser(),
      getAdminDashboardData(),
    ])

    if (!shouldApply()) {
      return
    }

    setCurrentAdminUserId(authResponse.data.user?.id ?? null)

    if (dashboard.users.error) {
      setUsers([])
      setError(dashboard.users.error.message)
    } else {
      setUsers(dashboard.users.data)
      setError(null)
    }

    if (dashboard.auditLogs.error) {
      setAuditLogs([])
      setAuditError(dashboard.auditLogs.error.message)
    } else {
      setAuditLogs(dashboard.auditLogs.data)
      setAuditError(null)
    }

    if (dashboard.resetLogs.error) {
      setResetLogs([])
      setResetLogError(dashboard.resetLogs.error.message)
    } else {
      setResetLogs(dashboard.resetLogs.data)
      setResetLogError(null)
    }

    setIsLoading(false)
    setIsLoadingAudit(false)
    setIsLoadingResetLogs(false)
  }, [])

  useEffect(() => {
    let active = true

    void loadDashboard(() => active)

    return () => {
      active = false
    }
  }, [loadDashboard])

  const latestLogin = useMemo(() => {
    let latestValue: number | null = null

    for (const user of users) {
      const candidate = user.PUser_id
      if (!candidate) continue
      if (latestValue === null || candidate > latestValue) latestValue = candidate
    }

    return latestValue
  }, [users])

  const activeUserCount = useMemo(
    () => users.filter((user) => user.account_status !== "inactive").length,
    [users],
  )

  async function handleCreateUser(input: AdminUserProfileInput) {
    setIsSubmittingUser(true)

    try {
      await createAdminUserAccount(input)
      toast.success("Account created.")
      setCreateOpen(false)
      await loadDashboard()
    } catch (createError) {
      toast.error(getErrorMessage(createError, "We could not create that account right now."))
    } finally {
      setIsSubmittingUser(false)
    }
  }

  async function handleUpdateUser(input: AdminUserProfileInput) {
    if (!editingUser) return

    setIsSubmittingUser(true)

    try {
      await updateAdminUserAccount(editingUser.auth_user_id, input)
      toast.success("Account updated.")
      setEditingUser(null)
      await loadDashboard()
    } catch (updateError) {
      toast.error(getErrorMessage(updateError, "We could not update that account right now."))
    } finally {
      setIsSubmittingUser(false)
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return

    const nextStatus = statusTarget.account_status === "inactive" ? "active" : "inactive"
    setStatusUserId(statusTarget.auth_user_id)

    try {
      await setAdminUserAccountStatus(statusTarget.auth_user_id, nextStatus)
      toast.success(nextStatus === "active" ? "Account reactivated." : "Account deactivated.")
      setStatusTarget(null)
      await loadDashboard()
    } catch (statusError) {
      toast.error(getErrorMessage(statusError, "We could not update that account status right now."))
    } finally {
      setStatusUserId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users2 className="size-4" />
            Saved users
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{users.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="size-4" />
            Active accounts
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{activeUserCount}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock3 className="size-4" />
            Latest record
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {latestLogin ? `PUser_id ${latestLogin}` : "No rows yet"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                <BadgeCheck className="size-5 text-[color:var(--destructive)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  PubUser
                </p>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  Account management
                </h2>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Users2 className="size-4" />
              Create account
            </Button>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading users
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No accounts have been saved into <span className="font-medium text-foreground">PubUser</span> yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="w-[10%] px-3 py-3 font-semibold">Status</th>
                    <th className="w-[8%] px-3 py-3 font-semibold">Role</th>
                    <th className="w-[21%] px-3 py-3 font-semibold">User</th>
                    <th className="w-[25%] px-3 py-3 font-semibold">Email</th>
                    <th className="w-[13%] px-3 py-3 font-semibold">Mobile</th>
                    <th className="w-[8%] px-3 py-3 font-semibold">Created</th>
                    <th className="w-[15%] px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.auth_user_id === currentAdminUserId
                    const nextStatus = user.account_status === "inactive" ? "active" : "inactive"

                    return (
                      <tr key={user.auth_user_id} className="border-t border-border">
                        <td className="px-3 py-4 align-top">
                          <StatusBadge status={user.account_status} />
                        </td>
                        <td className="px-3 py-4 align-top text-sm capitalize text-muted-foreground">
                          {user.role ?? "user"}
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="break-words font-medium text-foreground">{getUserLabel(user)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {user.DisplayName || user.FName || user.Mname || user.LName ? "Saved profile details" : "No name saved yet"}
                          </div>
                        </td>
                        <td className="break-all px-3 py-4 align-top text-sm text-muted-foreground">
                          {user.Email ?? "No email"}
                        </td>
                        <td className="break-words px-3 py-4 align-top text-sm text-muted-foreground">
                          {user.MobileNum ?? "Not set"}
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-muted-foreground">
                          {user.PUser_id ?? "No id"}
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex flex-col items-stretch justify-end gap-2 min-[1180px]:flex-row min-[1180px]:items-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full min-[1180px]:w-auto"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit3 className="size-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant={nextStatus === "inactive" ? "destructive" : "outline"}
                              size="sm"
                              className="w-full min-[1180px]:w-auto"
                              disabled={
                                statusUserId === user.auth_user_id ||
                                (isSelf && nextStatus === "inactive")
                              }
                              title={isSelf && nextStatus === "inactive" ? "Admins cannot deactivate their own account." : undefined}
                              onClick={() => setStatusTarget(user)}
                            >
                              {statusUserId === user.auth_user_id ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : nextStatus === "inactive" ? (
                                <UserX className="size-3.5" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              {nextStatus === "inactive" ? "Deactivate" : "Reactivate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <HistoryIcon className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Audit log
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Profile edit history
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoadingAudit ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading audit log
            </div>
          ) : auditError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {auditError}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No profile edits have been recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Changes</th>
                    <th className="px-4 py-3 font-semibold">Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.aud_id} className="border-t border-border">
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {auditDateFormatter.format(new Date(log.changed_at))}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-foreground">
                        {log.profile_email ?? "Unknown user"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm capitalize text-muted-foreground">
                        {log.action}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          {(log.changed_fields ?? []).map((field) => (
                            <div key={`${log.aud_id}-${field}`} className="rounded-xl bg-muted/35 px-3 py-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {field}
                              </div>
                              <div className="mt-1 text-sm text-foreground">
                                <span className="text-muted-foreground">{log.old_values?.[field as keyof AuditValues] ?? "Empty"}</span>
                                <span className="px-2 text-muted-foreground">to</span>
                                <span>{log.new_values?.[field as keyof AuditValues] ?? "Empty"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {log.changed_by_email ?? "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <HistoryIcon className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Password reset log
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Password recovery history
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoadingResetLogs ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading password reset log
            </div>
          ) : resetLogError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {resetLogError}
            </div>
          ) : resetLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              No password resets have been recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {resetLogs.map((log) => (
                    <tr key={log.log_id} className="border-t border-border">
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {auditDateFormatter.format(new Date(log.completed_at))}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-foreground">
                        {log.reset_email}
                      </td>
                      <td className="px-4 py-4 align-top text-sm capitalize text-muted-foreground">
                        {log.status}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {log.reset_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AdminUserDialog
        mode="create"
        open={createOpen}
        isSubmitting={isSubmittingUser}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateUser}
      />
      <AdminUserDialog
        mode="edit"
        open={Boolean(editingUser)}
        user={editingUser}
        isSubmitting={isSubmittingUser}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null)
        }}
        onSubmit={handleUpdateUser}
      />

      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => {
        if (!open) setStatusTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.account_status === "inactive" ? "Reactivate account?" : "Deactivate account?"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.account_status === "inactive"
                ? "This will allow the user to sign in again."
                : "This will keep the user row but prevent the account from signing in."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">{statusTarget ? getUserLabel(statusTarget) : "Selected account"}</div>
            <div className="mt-1 text-muted-foreground">{statusTarget?.Email ?? "No email"}</div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(statusUserId)}
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusTarget?.account_status === "inactive" ? "default" : "destructive"}
              disabled={Boolean(statusUserId)}
              onClick={() => {
                void handleConfirmStatusChange()
              }}
            >
              {statusUserId ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Saving
                </>
              ) : statusTarget?.account_status === "inactive" ? (
                <>
                  <RotateCcw className="size-4" />
                  Reactivate
                </>
              ) : (
                <>
                  <UserX className="size-4" />
                  Deactivate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
