import type * as Leaflet from "leaflet"

const FALLBACK_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

export async function addMapBasemap(
  L: typeof Leaflet,
  map: Leaflet.Map,
) {
  const fallback = L.tileLayer(FALLBACK_TILE_URL, {
    maxZoom: 19,
    keepBuffer: 4,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  const google = L.tileLayer("/api/map-tiles/{z}/{x}/{y}", {
    maxZoom: 22,
    keepBuffer: 4,
    attribution:
      '&copy; <a href="https://www.google.com/permissions/geoguidelines/">Google</a> Map data',
  })

  google.once("tileload", () => map.removeLayer(fallback))
  google.once("tileerror", () => {
    if (!map.hasLayer(fallback)) fallback.addTo(map)
    map.removeLayer(google)
  })
  return google.addTo(map)
}
