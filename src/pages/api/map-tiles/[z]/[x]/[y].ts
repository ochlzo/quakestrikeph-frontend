import { getSecret } from "astro:env/server"
import type { APIRoute } from "astro"

export const prerender = false

type MapSession = { token: string; expiresAt: number }

let session: MapSession | undefined
let sessionRequest: Promise<MapSession> | undefined

async function getSession(apiKey: string) {
  if (session && Date.now() < session.expiresAt - 60_000) return session.token

  sessionRequest ??= fetch(
    `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapType: "roadmap",
        language: "en-US",
        region: "PH",
      }),
    },
  ).then(async (response) => {
    if (!response.ok) throw new Error(`Google Maps session failed: ${response.status}`)
    const data = await response.json() as { session?: string; expiry?: string }
    const expiresAt = Number(data.expiry) * 1000
    if (!data.session || !Number.isFinite(expiresAt)) {
      throw new Error("Google Maps session is invalid")
    }
    return { token: data.session, expiresAt }
  })

  try {
    session = await sessionRequest
    return session.token
  } finally {
    sessionRequest = undefined
  }
}

export const GET = (async ({ params }) => {
  const z = Number(params.z)
  const x = Number(params.x)
  const y = Number(params.y)
  const maxCoordinate = 2 ** z

  if (
    !Number.isInteger(z) || z < 0 || z > 22 ||
    !Number.isInteger(x) || x < 0 || x >= maxCoordinate ||
    !Number.isInteger(y) || y < 0 || y >= maxCoordinate
  ) {
    return new Response("Invalid map tile", { status: 400 })
  }

  const apiKey = getSecret("GOOGLE_MAPS_API_KEY")?.trim()
  if (!apiKey) return new Response("Google Maps is not configured", { status: 503 })

  try {
    const token = await getSession(apiKey)
    const response = await fetch(
      `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(token)}&key=${encodeURIComponent(apiKey)}`,
    )
    if (!response.ok || !response.body) {
      return new Response("Google Maps tile unavailable", { status: response.status })
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": response.headers.get("Cache-Control") ?? "public, max-age=3600",
        "Content-Type": response.headers.get("Content-Type") ?? "image/png",
      },
    })
  } catch (error) {
    console.error("Unable to proxy Google Maps tile", error)
    return new Response("Google Maps tile unavailable", { status: 502 })
  }
}) satisfies APIRoute
