import assert from "node:assert/strict"
import test from "node:test"

import { addMapBasemap } from "../map-basemap.ts"

class FakeLayer {
  handlers = new Map<string, () => void>()
  readonly url: string

  constructor(url: string) {
    this.url = url
  }

  addTo(map: FakeMap) {
    map.layers.add(this)
    return this
  }

  once(event: string, handler: () => void) {
    this.handlers.set(event, handler)
    return this
  }
}

class FakeMap {
  layers = new Set<FakeLayer>()

  hasLayer(layer: FakeLayer) {
    return this.layers.has(layer)
  }

  removeLayer(layer: FakeLayer) {
    this.layers.delete(layer)
    return this
  }
}

test("uses the server-side Google tile proxy", async () => {
  const layers: FakeLayer[] = []
  const L = {
    tileLayer(url: string) {
      const layer = new FakeLayer(url)
      layers.push(layer)
      return layer
    },
  }
  const map = new FakeMap()

  await addMapBasemap(L as never, map as never)
  layers[1].handlers.get("tileload")?.()

  assert.equal(layers[1].url, "/api/map-tiles/{z}/{x}/{y}")
  assert.deepEqual([...map.layers], [layers[1]])
})

test("keeps the fallback when the proxy tile fails", async () => {
  const layers: FakeLayer[] = []
  const L = {
    tileLayer(url: string) {
      const layer = new FakeLayer(url)
      layers.push(layer)
      return layer
    },
  }
  const map = new FakeMap()

  await addMapBasemap(L as never, map as never)
  layers[1].handlers.get("tileerror")?.()

  assert.match(layers[0].url, /tile\.openstreetmap\.org/)
  assert.deepEqual([...map.layers], [layers[0]])
})
