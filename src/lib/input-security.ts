// eslint-disable-next-line no-control-regex -- Control characters are intentionally stripped at this input boundary.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g
const SPACING_CHARACTERS = /\s+/g
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_ALLOWED_CHARACTERS = /[^\p{L}\p{M}\s.'-]/gu
const NAME_WORD_START = /(^|[\s.'-])(\p{L})/gu

function limitLength(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export function sanitizePlainTextInput(value: string, maxLength = 120) {
  return limitLength(
    value
      .normalize("NFKC")
      .replace(CONTROL_CHARACTERS, " ")
      .replace(SPACING_CHARACTERS, " "),
    maxLength,
  )
}

export function sanitizeSearchInput(value: string) {
  return sanitizePlainTextInput(value, 120)
}

export function sanitizeEmailInput(value: string) {
  return limitLength(
    value
      .normalize("NFKC")
      .replace(CONTROL_CHARACTERS, "")
      .trim()
      .toLowerCase(),
    254,
  )
}

export function validateEmailInput(value: string) {
  const email = sanitizeEmailInput(value)
  if (!email) return { value: email, error: "Enter your email first." }
  if (!EMAIL_PATTERN.test(email)) return { value: email, error: "Enter a valid email address." }
  return { value: email }
}

export function sanitizePasswordInput(value: string) {
  // eslint-disable-next-line no-control-regex -- Null bytes are intentionally stripped before authentication.
  return limitLength(value.replace(/\u0000/g, ""), 128)
}

export function validatePasswordInput(value: string, minimumLength = 8) {
  const password = sanitizePasswordInput(value)
  if (!password) return { value: password, error: "Enter your password." }
  if (password.length < minimumLength) {
    return { value: password, error: `Password must be at least ${minimumLength} characters.` }
  }
  return { value: password }
}

export function sanitizeOtpInput(value: string) {
  return limitLength(value.normalize("NFKC").replace(/\D/g, ""), 12)
}

export function validateOtpInput(value: string) {
  const otp = sanitizeOtpInput(value)
  if (!otp) return { value: otp, error: "Enter the one-time code from your email." }
  return { value: otp }
}

export function sanitizeNameInput(value: string) {
  return sanitizePlainTextInput(value, 80)
    .replace(NAME_ALLOWED_CHARACTERS, "")
    .toLocaleLowerCase("en-PH")
    .replace(NAME_WORD_START, (_match, prefix: string, letter: string) => (
      `${prefix}${letter.toLocaleUpperCase("en-PH")}`
    ))
}

export function sanitizePhoneInput(value: string) {
  return limitLength(value.normalize("NFKC").replace(/\D/g, ""), 11)
}

export function validateMobileNumberInput(value: string) {
  const mobileNumber = sanitizePhoneInput(value)
  if (!mobileNumber) return { value: mobileNumber, error: "Enter your mobile number." }
  if (mobileNumber.length !== 11) {
    return { value: mobileNumber, error: "Mobile number must be exactly 11 digits." }
  }
  if (!mobileNumber.startsWith("09")) {
    return { value: mobileNumber, error: "Mobile number must start with 09." }
  }
  return { value: mobileNumber }
}

export function sanitizeIntegerInput(value: string) {
  return limitLength(value.normalize("NFKC").replace(/[^\d]/g, ""), 8)
}

export function sanitizeDecimalInput(value: string) {
  const sanitized = value.normalize("NFKC").replace(/[^\d.]/g, "")
  const [head, ...tail] = sanitized.split(".")
  return limitLength(tail.length ? `${head}.${tail.join("")}` : head, 8)
}

export function sanitizeMagnitudeRangeInput(value: string) {
  return limitLength(value.normalize("NFKC").replace(/[^\d.,\-\s]/g, ""), 120)
}
