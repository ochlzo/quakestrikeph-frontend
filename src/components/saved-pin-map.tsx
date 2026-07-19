"use client";

import { useEffect, useRef } from "react";

import { addMapBasemap } from "@/lib/map-basemap";

export type SavedPinPoint = {
  lat: number;
  lng: number;
};

type SavedPinMapProps = {
  point: SavedPinPoint | null;
  onPointChange: (point: SavedPinPoint) => void;
};

export function SavedPinMap({ point, onPointChange }: SavedPinMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const setMarkerRef = useRef<((point: SavedPinPoint, focus: boolean) => void) | null>(null);
  const pointRef = useRef(point);
  const onPointChangeRef = useRef(onPointChange);

  pointRef.current = point;
  onPointChangeRef.current = onPointChange;

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!hostRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !hostRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const bounds = isMobile
        ? L.latLngBounds(L.latLng(-2.7675, 114.1552), L.latLng(25.6415, 129.9023))
        : L.latLngBounds(L.latLng(2.1089, 101.9971), L.latLng(22.2891, 144.1846));

      const map = L.map(hostRef.current, {
        center: isMobile ? [9.6012, 122.2564] : [12.8797, 121.774],
        zoom: 6,
        minZoom: 6,
        maxBounds: bounds,
        maxBoundsViscosity: 1,
        preferCanvas: true,
      });

      mapRef.current = map;
      void addMapBasemap(L, map);

      const setMarker = (nextPoint: SavedPinPoint, focus: boolean) => {
        const current = markerRef.current?.getLatLng();
        const alreadyPlaced =
          current &&
          Math.abs(current.lat - nextPoint.lat) < 0.000001 &&
          Math.abs(current.lng - nextPoint.lng) < 0.000001;

        if (!markerRef.current) {
          markerRef.current = L.marker([nextPoint.lat, nextPoint.lng], { draggable: true })
            .on("dragend", (event) => {
              const position = (event.target as import("leaflet").Marker).getLatLng();
              onPointChangeRef.current({ lat: position.lat, lng: position.lng });
            })
            .addTo(map);
        } else {
          markerRef.current.setLatLng([nextPoint.lat, nextPoint.lng]);
        }

        if (focus && !alreadyPlaced) {
          map.setView([nextPoint.lat, nextPoint.lng], Math.max(map.getZoom(), 10), { animate: true });
        }
      };
      setMarkerRef.current = setMarker;

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const nextPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
        setMarker(nextPoint, false);
        onPointChangeRef.current(nextPoint);
      });

      if (pointRef.current) setMarker(pointRef.current, true);

      const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      resizeObserver.observe(hostRef.current);
      map.once("unload", () => resizeObserver.disconnect());
    }

    void initializeMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    setMarkerRef.current?.(point, true);
  }, [point]);

  return (
    <div
      ref={hostRef}
      className="h-[26rem] w-full"
      aria-label="Choose a pinned location on the map"
    />
  );
}
