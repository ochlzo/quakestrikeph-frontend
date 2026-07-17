import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  sanitizeDecimalInput,
  sanitizeEmailInput,
  sanitizeMagnitudeRangeInput,
  sanitizeNameInput,
  sanitizeOtpInput,
  sanitizePasswordInput,
  sanitizePhoneInput,
  sanitizeSearchInput,
  validateEmailInput,
  validateMobileNumberInput,
  validatePasswordInput,
} from "../input-security.ts"

describe("input security helpers", () => {
  it("normalizes and validates emails", () => {
    assert.equal(sanitizeEmailInput(" USER@Example.COM \u0000"), "user@example.com")
    assert.equal(validateEmailInput("bad-email").error, "Enter a valid email address.")
  })

  it("keeps passwords mostly intact while removing null bytes", () => {
    assert.equal(sanitizePasswordInput("  pass word\u0000  "), "  pass word  ")
    assert.equal(validatePasswordInput("short").error, "Password must be at least 8 characters.")
  })

  it("sanitizes profile and OTP fields", () => {
    assert.equal(sanitizeNameInput("Da<n> O'Brien"), "Dan O'Brien")
    assert.equal(sanitizeNameInput("jUAN dela-cruz"), "Juan Dela-Cruz")
    assert.equal(sanitizeNameInput("deLA-peña"), "Dela-Peña")
    assert.equal(sanitizePhoneInput("0912 abc 345 6789"), "09123456789")
    assert.equal(validateMobileNumberInput("09123456789").error, undefined)
    assert.equal(validateMobileNumberInput("08123456789").error, "Mobile number must start with 09.")
    assert.equal(validateMobileNumberInput("09123").error, "Mobile number must be exactly 11 digits.")
    assert.equal(sanitizeOtpInput("12a 34-56"), "123456")
  })

  it("sanitizes search and numeric filter text", () => {
    assert.equal(sanitizeSearchInput("  Cebu\u0000\nCity  "), " Cebu City ")
    assert.equal(sanitizeDecimalInput("4..5abc"), "4.5")
    assert.equal(sanitizeMagnitudeRangeInput("1<script>-2, 3-4"), "1-2, 3-4")
  })
})
