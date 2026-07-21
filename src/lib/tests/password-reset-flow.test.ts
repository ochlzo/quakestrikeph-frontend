import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { describe, it } from "node:test"

const componentPath = new URL("../../components/reset-password-page.tsx", import.meta.url)
const migrationPath = new URL(
  "../../../supabase/migrations/20260721090000_harden_password_reset_log.sql",
  import.meta.url,
)

describe("password reset security contract", () => {
  it("uses recovery OTPs and revokes sessions", async () => {
    const source = await readFile(componentPath, "utf8")

    assert.match(source, /resetPasswordForEmail\s*\(/)
    assert.match(source, /type:\s*"recovery"/)
    assert.match(source, /signOut\(\{\s*scope:\s*"global"/s)
    assert.match(source, /If an account exists for that email/)
    assert.doesNotMatch(source, /signInWithOtp\s*\(/)
  })

  it("limits reset logs to their owner and active admins", async () => {
    const migration = await readFile(migrationPath, "utf8")

    assert.match(migration, /using \(public\.is_admin_user\(\)\)/)
    assert.match(migration, /auth\.uid\(\) = auth_user_id/)
    assert.doesNotMatch(migration, /using \(true\)/)
  })
})
