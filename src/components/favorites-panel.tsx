"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, MapPin, MapPinOff, Plus, SearchIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/db/supabase";
import { sanitizePlainTextInput } from "@/lib/input-security";
import { addMapBasemap } from "@/lib/map-basemap";
import { getFavoriteLocationLabel, type FavoriteLocationRow } from "@/lib/pubuser";
import { cn } from "@/lib/utils";

type StatusState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

type FavoriteInsert = {
  auth_user_id: string;
  favorite_label: string;
  favorite_kind: "location" | "map_pin";
  latitude: number | null;
  longitude: number | null;
};

const FAVORITES_TABLE_CANDIDATES = ["Favorites", "FavoriteLocations"] as const;

type PlaceSuggestion = {
  displayName: string;
  latitude: number;
  longitude: number;
  kind: string;
  country?: string;
  state?: string;
  city?: string;
  town?: string;
  village?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

function buildSuggestionLabel(place: PlaceSuggestion) {
  return place.displayName.trim();
}

function isValidNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMissingTableError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("could not find the table") || message.includes("schema cache");
}

async function queryFavoritesTable() {
  const { data, error } = await supabase
    .from("Favorites")
    .select("favorite_id, auth_user_id, favorite_label, favorite_kind, latitude, longitude, created_at")
    .order("created_at", { ascending: false });

  if (!error) {
    return { data: (data ?? []) as FavoriteLocationRow[], error: null };
  }

  if (!isMissingTableError(error)) {
    return { data: [] as FavoriteLocationRow[], error };
  }

  const fallback = await supabase
    .from("FavoriteLocations")
    .select("favorite_id, auth_user_id, favorite_label, favorite_kind, latitude, longitude, created_at")
    .order("created_at", { ascending: false });

  if (!fallback.error) {
    return { data: (fallback.data ?? []) as FavoriteLocationRow[], error: null };
  }

  return { data: [] as FavoriteLocationRow[], error: fallback.error };
}

export function FavoritesPanel() {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const reverseTimerRef = useRef<number | null>(null);

  const [favorites, setFavorites] = useState<FavoriteLocationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isResolvingPoint, setIsResolvingPoint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });
  const [saveKeyword, setSaveKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [mapHover, setMapHover] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedPlaceName, setPickedPlaceName] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<PlaceSuggestion | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      setIsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        if (active) {
          setFavorites([]);
          setError("Sign in to save pinned locations.");
          setIsLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await queryFavoritesTable();

      if (!active) return;

      if (queryError && data.length === 0) {
        setFavorites([]);
        setError(queryError.message ?? "Could not load pinned locations.");
      } else {
        setFavorites(data);
        setError(null);
      }
      setIsLoading(false);
    }

    void loadFavorites();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmedSearch = searchKeyword.trim();

    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }

    if (trimmedSearch.length < 3) {
      setSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    searchTimerRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      setIsSearchingPlaces(true);

      void (async () => {
        try {
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("q", trimmedSearch);
          url.searchParams.set("limit", "7");
          url.searchParams.set("addressdetails", "1");
          url.searchParams.set("countrycodes", "ph");

          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error("Place search failed.");
          }

          const payload = (await response.json()) as Array<{
            display_name?: string;
            lat?: string;
            lon?: string;
            class?: string;
            type?: string;
            address?: Record<string, string>;
          }>;

          const nextSuggestions = payload
            .map<PlaceSuggestion | null>((item) => {
              const lat = Number(item.lat);
              const lon = Number(item.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon) || !item.display_name) {
                return null;
              }

              const address = item.address ?? {};

              return {
                displayName: item.display_name,
                latitude: lat,
                longitude: lon,
                kind: `${item.class ?? "place"}:${item.type ?? "match"}`,
                country: address.country,
                state: address.state,
                city: address.city,
                town: address.town,
                village: address.village,
              } satisfies PlaceSuggestion;
            })
            .filter((item): item is PlaceSuggestion => item !== null);

          setSuggestions(nextSuggestions);
        } catch (searchError) {
          if ((searchError as { name?: string } | null)?.name !== "AbortError") {
            setSuggestions([]);
          }
        } finally {
          setIsSearchingPlaces(false);
        }
      })();

      return () => controller.abort();
    }, 280);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchKeyword]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    async function initializeMap() {
      if (!mapHostRef.current || mapInstanceRef.current) {
        return;
      }

      const leaflet = await import("leaflet");
      if (cancelled || !mapHostRef.current || mapInstanceRef.current) {
        return;
      }

      delete (leaflet.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = leaflet.map(mapHostRef.current, {
        zoomControl: true,
        preferCanvas: true,
      });

      map.setView([12.8797, 121.774], 5.5);

      void addMapBasemap(leaflet, map);

      const pinIcon = leaflet.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const placeMarker = leaflet.marker([12.8797, 121.774], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      markerRef.current = placeMarker;
      mapInstanceRef.current = map;

      const applyPoint = (lat: number, lng: number) => {
        setPickedPoint({ lat, lng });
        placeMarker.setLatLng([lat, lng]);
      };

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        applyPoint(event.latlng.lat, event.latlng.lng);
        setSaveKeyword((current) => current || "Selected map pin");
      });

      map.on("mousemove", (event: import("leaflet").LeafletMouseEvent) => {
        setMapHover({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      placeMarker.on("dragend", () => {
        const latLng = placeMarker.getLatLng();
        applyPoint(latLng.lat, latLng.lng);
      });

      cleanup = () => {
        map.off();
        map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      };
    }

    void initializeMap();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !pickedPoint) {
      return;
    }

    if (reverseTimerRef.current) {
      window.clearTimeout(reverseTimerRef.current);
    }

    reverseTimerRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      setIsResolvingPoint(true);

      void (async () => {
        try {
          const url = new URL("https://nominatim.openstreetmap.org/reverse");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("lat", String(pickedPoint.lat));
          url.searchParams.set("lon", String(pickedPoint.lng));
          url.searchParams.set("zoom", "18");
          url.searchParams.set("addressdetails", "1");

          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error("Reverse lookup failed.");
          }

          const payload = (await response.json()) as {
            display_name?: string;
            name?: string;
            address?: Record<string, string>;
          };

          const address = payload.address ?? {};
          const placeName =
            payload.display_name?.trim() ||
            payload.name?.trim() ||
            [address.city, address.town, address.village, address.state, address.country]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(", ");

          if (placeName) {
            setPickedPlaceName(placeName);
            setSaveKeyword(placeName);
          }
        } catch (pointError) {
          if ((pointError as { name?: string } | null)?.name !== "AbortError") {
            // Keep the coordinate pin even if reverse geocoding fails.
          }
        } finally {
          setIsResolvingPoint(false);
        }
      })();

      return () => controller.abort();
    }, 350);

    return () => {
      if (reverseTimerRef.current) {
        window.clearTimeout(reverseTimerRef.current);
      }
    };
  }, [pickedPoint]);

  const normalizedSearch = searchKeyword.trim().toLowerCase();
  const visibleFavorites = useMemo(() => {
    if (!normalizedSearch) {
      return favorites;
    }

    return favorites.filter((favorite) => {
      const label = favorite.favorite_label.toLowerCase();
      const kind = favorite.favorite_kind.toLowerCase();
      const lat = favorite.latitude?.toString() ?? "";
      const lng = favorite.longitude?.toString() ?? "";
      return label.includes(normalizedSearch) || kind.includes(normalizedSearch) || `${lat},${lng}`.includes(normalizedSearch);
    });
  }, [favorites, normalizedSearch]);

  async function reloadFavorites() {
    const { data, error: reloadError } = await queryFavoritesTable();

    if (reloadError) {
      setStatus({
        kind: "error",
        message: getErrorMessage(reloadError, "Pinned location saved, but the list could not refresh."),
      });
      return;
    }

    setFavorites(data);
  }

  async function handleAddFavorite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedLabel = sanitizePlainTextInput(
      activeSuggestion ? saveKeyword : pickedPlaceName || saveKeyword,
      120,
    ).trim();
    if (!trimmedLabel) {
      setStatus({ kind: "error", message: "Type a place name or choose a point on the map first." });
      return;
    }

    if (pickedPoint && !activeSuggestion && !pickedPlaceName.trim()) {
      setStatus({ kind: "error", message: "Please wait a moment while we name the map pin." });
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setStatus({ kind: "error", message: "Sign in first to save a pinned location." });
      return;
    }

    const payload: FavoriteInsert = {
      auth_user_id: user.id,
      favorite_label: trimmedLabel,
      favorite_kind: isValidNumber(pickedPoint?.lat) && isValidNumber(pickedPoint?.lng) ? "map_pin" : "location",
      latitude: pickedPoint?.lat ?? null,
      longitude: pickedPoint?.lng ?? null,
    };

    setIsSaving(true);
    setStatus({ kind: "idle" });

    let insertError: { message?: string } | null = null;
    for (const tableName of FAVORITES_TABLE_CANDIDATES) {
      const { error } = await supabase
        .from(tableName)
        .insert(payload)
        .select("favorite_id, auth_user_id, favorite_label, favorite_kind, latitude, longitude, created_at")
        .maybeSingle<FavoriteLocationRow>();

      if (!error) {
        insertError = null;
        break;
      }

      insertError = error;
      if (!isMissingTableError(error)) {
        break;
      }
    }

    setIsSaving(false);

    if (insertError) {
      setStatus({
        kind: "error",
        message: getErrorMessage(insertError, "We could not save that pinned location right now."),
      });
      return;
    }

    setSaveKeyword("");
    setPickedPoint(null);
    setPickedPlaceName("");
    setActiveSuggestion(null);
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng(mapInstanceRef.current.getCenter());
    }
    await reloadFavorites();
    setStatus({
      kind: "success",
      message: "Pinned location saved.",
    });
  }

  async function handleDeleteFavorite(favoriteId: number) {
    setStatus({ kind: "idle" });
    let deleteError: { message?: string } | null = null;
    for (const tableName of FAVORITES_TABLE_CANDIDATES) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("favorite_id", favoriteId);

      if (!error) {
        deleteError = null;
        break;
      }

      deleteError = error;
      if (!isMissingTableError(error)) {
        break;
      }
    }

    if (deleteError) {
      setStatus({
        kind: "error",
        message: getErrorMessage(deleteError, "We could not remove that pinned location right now."),
      });
      return;
    }

    setFavorites((current) => current.filter((favorite) => favorite.favorite_id !== favoriteId));
    setStatus({
      kind: "success",
      message: "Pinned location removed.",
    });
  }

  function chooseSuggestion(place: PlaceSuggestion) {
    setActiveSuggestion(place);
    setSaveKeyword(buildSuggestionLabel(place));
    setPickedPlaceName(buildSuggestionLabel(place));
    setPickedPoint({ lat: place.latitude, lng: place.longitude });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([place.latitude, place.longitude], Math.max(mapInstanceRef.current.getZoom(), 10), {
        animate: true,
      });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([place.latitude, place.longitude]);
    }
    setSuggestions([]);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Pinned locations
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              Search by keyword or pin a point
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Type a city, barangay, landmark, or keyword to see suggestions. You can also click the map to drop a pin
              and save the exact spot.
            </p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {favorites.length} saved
          </div>
        </div>

        {status.kind !== "idle" ? (
          <p
            className={cn(
              "mt-4 rounded-xl border px-4 py-3 text-sm",
              status.kind === "error" &&
                "border-destructive/20 bg-destructive/10 text-destructive",
              status.kind === "success" &&
                "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            )}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleAddFavorite}>
          <div className="space-y-2">
            <Label htmlFor="favorite-keyword">Search place or keyword</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="favorite-keyword"
                value={saveKeyword}
                onChange={(event) => {
                  setSaveKeyword(sanitizePlainTextInput(event.target.value, 120));
                  setPickedPoint(null);
                  setPickedPlaceName("");
                  setActiveSuggestion(null);
                }}
                placeholder="e.g. Manila, Batangas City, your resort"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          {saveKeyword.trim().length >= 3 && (suggestions.length > 0 || isSearchingPlaces) ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-2">
              {isSearchingPlaces ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Finding places
                </div>
              ) : null}

              <div className="grid gap-2">
                {suggestions.map((place) => (
                  <button
                    key={`${place.latitude}-${place.longitude}-${place.displayName}`}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-background",
                      activeSuggestion?.displayName === place.displayName &&
                        "bg-background shadow-sm",
                    )}
                    onClick={() => chooseSuggestion(place)}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[color:var(--destructive)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {buildSuggestionLabel(place)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[
                          place.city,
                          place.town,
                          place.village,
                          place.state,
                          place.country,
                        ]
                          .map((part) => part?.trim())
                          .filter(Boolean)
                          .join(", ") || place.kind}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Search</p>
              <p className="mt-1 leading-6">Type a place and pick from the dropdown.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Map pin</p>
              <p className="mt-1 leading-6">Click anywhere on the map to set the exact point.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Hover</p>
              <p className="mt-1 leading-6">
                Move the cursor over the map to preview coordinates.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={isSaving || (pickedPoint !== null && !pickedPlaceName.trim() && !activeSuggestion)}
          >
            {isSaving ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Saving pinned location
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Save pinned location
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Selected place</p>
            <p className="mt-1 text-muted-foreground">
              {activeSuggestion ? buildSuggestionLabel(activeSuggestion) : "No suggestion selected yet."}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Pinned point</p>
            <p className="mt-1 text-muted-foreground">
              {pickedPoint
                ? `${formatCoordinate(pickedPoint.lat)}, ${formatCoordinate(pickedPoint.lng)}`
                : "Click the map to set a pin."}
              {isResolvingPoint ? " Resolving place name..." : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Map picker
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Pin it exactly on the map
              </h2>
            </div>
            <MapPinOff className="size-5 text-muted-foreground" />
          </div>

          <div className="relative h-[26rem]">
            <div ref={mapHostRef} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-border bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              {mapHover
                ? `Hover: ${formatCoordinate(mapHover.lat)}, ${formatCoordinate(mapHover.lng)}`
                : "Hover the map to preview coordinates"}
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-border bg-background/90 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur">
              Click anywhere on the map, or drag the pin after searching a place. The exact coordinates are saved with
              the favorite.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Pinned locations list
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                Your saved places
              </h2>
            </div>
            <MapPinOff className="size-5 text-muted-foreground" />
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="favorite-search">Search saved places</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="favorite-search"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(sanitizePlainTextInput(event.target.value, 120))}
                placeholder="Type to filter pinned locations"
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading pinned locations
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : visibleFavorites.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              {normalizedSearch
                ? "No saved places match that keyword."
                : "No pinned locations saved yet. Add a keyword or pin a location on the map."}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {visibleFavorites.map((favorite) => (
                <div
                  key={favorite.favorite_id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getFavoriteLocationLabel(favorite)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {favorite.favorite_kind.replace("_", " ")}
                      {favorite.latitude !== null && favorite.longitude !== null
                        ? ` • ${formatCoordinate(favorite.latitude)}, ${formatCoordinate(favorite.longitude)}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      void handleDeleteFavorite(favorite.favorite_id);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
