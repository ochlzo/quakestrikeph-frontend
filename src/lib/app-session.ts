import type { User } from "@supabase/supabase-js"

import { supabase } from "@/db/supabase"
import {
  ensurePubUserRow,
  getPubUserProfileByAuthUserId,
  type AlertPreferences,
  type PubUserProfile,
} from "@/lib/pubuser"

export type AppSession = {
  user: User | null
  profile: PubUserProfile | null
  isAuthenticated: boolean
  isActive: boolean
  isAdmin: boolean
  alertPreferences: AlertPreferences
}

type AppSessionOptions = {
  force?: boolean
  signOutInactive?: boolean
}

const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  alerts_on: false,
  phivolcs_only: false,
  near_pins_only: false,
}

const CACHE_TTL_MS = 30_000

let cachedSession: { value: AppSession; loadedAt: number } | null = null
let inFlightSession: Promise<AppSession> | null = null

function anonymousSession(): AppSession {
  return {
    user: null,
    profile: null,
    isAuthenticated: false,
    isActive: false,
    isAdmin: false,
    alertPreferences: DEFAULT_ALERT_PREFERENCES,
  }
}

function buildAppSession(user: User | null, profile: PubUserProfile | null): AppSession {
  const isAuthenticated = Boolean(user)
  const isActive = isAuthenticated && profile?.account_status !== "inactive"
  const isAdmin = isActive && profile?.role === "admin"

  return {
    user,
    profile,
    isAuthenticated,
    isActive,
    isAdmin,
    alertPreferences: {
      alerts_on: profile?.alerts_on ?? false,
      phivolcs_only: profile?.phivolcs_only ?? false,
      near_pins_only: profile?.near_pins_only ?? false,
    },
  }
}

async function loadAppSession() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return anonymousSession()
  }

  let profile: PubUserProfile | null = null

  try {
    profile = await ensurePubUserRow(data.user)
  } catch {
    try {
      profile = await getPubUserProfileByAuthUserId(data.user.id)
    } catch {
      profile = null
    }
  }

  return buildAppSession(data.user, profile)
}

async function signOutIfInactive(session: AppSession, enabled?: boolean) {
  if (!enabled || !session.isAuthenticated || session.isActive) {
    return session
  }

  clearAppSessionCache()
  await supabase.auth.signOut()
  return anonymousSession()
}

export function clearAppSessionCache() {
  cachedSession = null
  inFlightSession = null
}

export function cacheAppSessionProfile(profile: PubUserProfile | null) {
  if (!cachedSession?.value.user) return

  cachedSession = {
    value: buildAppSession(cachedSession.value.user, profile),
    loadedAt: Date.now(),
  }
}

export async function getCurrentAppSession(options: AppSessionOptions = {}) {
  const now = Date.now()
  if (!options.force && cachedSession && now - cachedSession.loadedAt < CACHE_TTL_MS) {
    return signOutIfInactive(cachedSession.value, options.signOutInactive)
  }

  inFlightSession ??= loadAppSession()

  try {
    const session = await signOutIfInactive(
      await inFlightSession,
      options.signOutInactive,
    )
    cachedSession = { value: session, loadedAt: Date.now() }
    return session
  } finally {
    inFlightSession = null
  }
}
