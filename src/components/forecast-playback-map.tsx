"use client"

import * as React from "react"

import type {
  EarthquakeEventDetail,
  EarthquakeForecast,
  ForecastPlaybackEvent,
} from "@/data/earthquakes"
import { getMostLikelyDistanceBand } from "@/lib/earthquake-forecast"
import { magnitudeMarkerBand } from "@/lib/earthquake-map-filters"

const DISTANCE_LABEL_PLACEMENT = {
  10: { angle: 145, direction: "left" },
  25: { angle: 30, direction: "right" },
  50: { angle: 140, direction: "left" },
} as const

function popupRow(list: HTMLDListElement, label: string, value: string) {
  const term = document.createElement("dt")
  term.className = "text-muted-foreground"
  term.textContent = label
  const detail = document.createElement("dd")
  detail.className = "font-medium"
  detail.textContent = value
  list.append(term, detail)
}

function triggerPopup(trigger: EarthquakeEventDetail) {
  const content = document.createElement("div")
  content.className = "min-w-44 space-y-2 text-sm"
  const title = document.createElement("strong")
  title.textContent = "Trigger earthquake"
  const details = document.createElement("dl")
  details.className = "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"
  popupRow(details, "Magnitude", `M${trigger.magnitude.toFixed(1)}`)
  popupRow(details, "Depth", `${trigger.depth} km`)
  content.append(title, details)
  return content
}

function observationPopup(event: ForecastPlaybackEvent) {
  const details = document.createElement("dl")
  details.className = "grid min-w-48 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
  popupRow(details, "Magnitude", `M${event.magnitude.toFixed(1)}`)
  popupRow(details, "Depth", `${event.depth} km`)
  popupRow(details, "Distance from trigger", `${event.distanceKm.toFixed(1)} km`)
  return details
}

export function ForecastPlaybackMap({
  trigger,
  forecast,
  events,
  currentTime,
  showAllRings,
}: {
  trigger: EarthquakeEventDetail
  forecast: EarthquakeForecast
  events: ForecastPlaybackEvent[]
  currentTime: number
  showAllRings: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const leafletRef = React.useRef<typeof import("leaflet") | null>(null)
  const mapRef = React.useRef<import("leaflet").Map | null>(null)
  const triggerMarkerRef = React.useRef<import("leaflet").CircleMarker | null>(null)
  const markersRef = React.useRef<import("leaflet").LayerGroup | null>(null)
  const markerByIdRef = React.useRef(new Map<string, import("leaflet").CircleMarker>())
  const ringsRef = React.useRef<import("leaflet").LayerGroup | null>(null)
  const [ready, setReady] = React.useState(false)
  const latitude = trigger.latitude
  const longitude = trigger.longitude

  React.useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return
      leafletRef.current = L
      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 8,
        minZoom: 5,
        zoomControl: true,
        attributionControl: false,
      })
      L.control.attribution({ position: "bottomleft" }).addTo(map)
      L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        subdomains: ["0", "1", "2", "3"],
        maxZoom: 20,
        keepBuffer: 4,
        attribution: '&copy; <a href="https://www.google.com/permissions/geoguidelines/">Google</a> Map data',
      }).addTo(map)

      ringsRef.current = L.layerGroup().addTo(map)
      markersRef.current = L.layerGroup().addTo(map)
      triggerMarkerRef.current = L.circleMarker([latitude, longitude], {
        className: `earthquake-marker earthquake-marker--trigger earthquake-marker--magnitude-${magnitudeMarkerBand(trigger.magnitude)}`,
        radius: 9,
      }).addTo(map).bindPopup(triggerPopup(trigger))

      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }))
      resizeObserver.observe(containerRef.current)
      mapRef.current = map
      setReady(true)
    })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      markerByIdRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
      triggerMarkerRef.current = null
      leafletRef.current = null
      setReady(false)
    }
  }, [latitude, longitude, trigger.depth, trigger.magnitude])

  React.useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const rings = ringsRef.current
    if (!ready || !L || !map || !rings) return
    rings.clearLayers()
    const likelyBand = getMostLikelyDistanceBand(forecast)
    const likelyBoundaries = new Set(likelyBand?.boundariesKm ?? [])
    const radii: Array<10 | 25 | 50> = showAllRings ? [10, 25, 50] : [...likelyBoundaries]
    if (radii.length === 0) return
    const styles = getComputedStyle(document.documentElement)
    const likelyColor = styles.getPropertyValue("--forecast-ring-likely").trim()
    const contextColor = styles.getPropertyValue("--forecast-ring-context").trim()
    const latitudeKm = 110.574
    const longitudeKm = 111.32 * Math.cos(latitude * Math.PI / 180)

    let outerRing: import("leaflet").Circle | null = null
    for (const radiusKm of radii) {
      const likely = likelyBoundaries.has(radiusKm)
      const beyond = likelyBand?.key === "beyond50Km" && radiusKm === 50
      const ring = L.circle([latitude, longitude], {
        radius: radiusKm * 1000,
        interactive: false,
        stroke: true,
        color: likely ? likelyColor : contextColor,
        weight: likely ? 3 : 1.5,
        opacity: likely ? 0.85 : 0.55,
        fill: false,
        dashArray: beyond ? "8 6" : likely ? undefined : "4 6",
        className: [
          "forecast-distance-ring",
          likely ? "forecast-distance-ring--likely" : "",
          beyond ? "forecast-distance-ring--beyond" : "",
        ].filter(Boolean).join(" "),
      }).addTo(rings)
      outerRing = ring
      const placement = DISTANCE_LABEL_PLACEMENT[radiusKm]
      const angle = placement.angle * Math.PI / 180
      L.tooltip({
        permanent: true,
        direction: placement.direction,
        offset: placement.direction === "left" ? [-4, 0] : [4, 0],
        className: [
          "forecast-distance-label",
          likely ? "forecast-distance-label--likely" : "",
        ].filter(Boolean).join(" "),
      })
        .setLatLng([
          latitude + radiusKm * Math.sin(angle) / latitudeKm,
          longitude + radiusKm * Math.cos(angle) / longitudeKm,
        ])
        .setContent(beyond ? "Most likely beyond 50 km" : `${radiusKm} km`)
        .addTo(rings)
    }

    if (outerRing) {
      map.fitBounds(outerRing.getBounds(), {
        padding: [40, 40],
        maxZoom: 10,
        animate: false,
      })
    }
  }, [forecast, latitude, longitude, ready, showAllRings])

  React.useEffect(() => {
    const L = leafletRef.current
    const markers = markersRef.current
    if (!ready || !L || !markers) return
    const visibleIds = new Set<string>()
    const forecastEnd = Date.parse(forecast.createdAt) + 24 * 60 * 60 * 1000

    for (const event of events) {
      if (Date.parse(event.eventTime) > currentTime) continue
      visibleIds.add(event.id)
      if (markerByIdRef.current.has(event.id)) continue
      const postForecast = Date.parse(event.eventTime) > forecastEnd
      const marker = L.circleMarker([event.latitude, event.longitude], {
        className: [
          "earthquake-marker",
          `earthquake-marker--magnitude-${magnitudeMarkerBand(event.magnitude)}`,
          postForecast ? "earthquake-marker--post-forecast" : "",
        ].filter(Boolean).join(" "),
        radius: 6,
      }).addTo(markers).bindPopup(observationPopup(event), { minWidth: 210 })
      markerByIdRef.current.set(event.id, marker)
    }

    for (const [id, marker] of markerByIdRef.current) {
      if (visibleIds.has(id)) continue
      markers.removeLayer(marker)
      markerByIdRef.current.delete(id)
    }
    triggerMarkerRef.current?.bringToFront()
  }, [currentTime, events, forecast.createdAt, ready])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-80 w-full"
      role="application"
      aria-label="Playback map of earthquakes observed after the trigger event"
    />
  )
}
