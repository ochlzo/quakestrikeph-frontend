import { supabase } from "@/db/supabase";
import type { FavoriteLocationRow } from "@/lib/pubuser";

export type SavedPinInsert = {
  auth_user_id: string;
  favorite_label: string;
  favorite_kind: "location" | "map_pin";
  latitude: number | null;
  longitude: number | null;
};

const columns = "favorite_id, auth_user_id, favorite_label, favorite_kind, latitude, longitude, created_at";

export async function getSavedPins() {
  const { data, error } = await supabase
    .from("SavedPins")
    .select(columns)
    .order("created_at", { ascending: false });

  return { data: (data ?? []) as FavoriteLocationRow[], error };
}

export function createSavedPin(pin: SavedPinInsert) {
  return supabase.from("SavedPins").insert(pin);
}

export function deleteSavedPin(favoriteId: number) {
  return supabase.from("SavedPins").delete().eq("favorite_id", favoriteId);
}
