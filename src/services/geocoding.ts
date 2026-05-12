// Nominatim geocoding service — search places, addresses, landmarks.
// Uses the public Nominatim API from OpenStreetMap.
//
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// Max 1 request/second — we debounce on the client side.

import type { LatLng } from "@/lib/algorithms/graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance: number;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  boundingbox?: [string, string, string, string];
}

export interface PlaceResult {
  id: number;
  name: string;
  shortName: string;
  coords: LatLng;
  type: string;
  importance: number;
}

// ---------------------------------------------------------------------------
// Search (forward geocode)
// ---------------------------------------------------------------------------

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Search for places by query string.
 * @param query The search text (e.g. "Majestic Bangalore", "MG Road").
 * @param limit Max results (default 5).
 */
export async function searchPlaces(
  query: string,
  limit = 5,
): Promise<PlaceResult[]> {
  if (!query.trim()) return [];

  const url = new URL("/search", NOMINATIM_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SmartRouteOptimizer/1.0" },
  });
  if (!res.ok) throw new Error(`Nominatim search error: ${res.status}`);

  const data: NominatimResult[] = await res.json();
  return data.map(toPlaceResult);
}

/**
 * Reverse geocode — get place name from coordinates.
 */
export async function reverseGeocode(coords: LatLng): Promise<string> {
  const url = new URL("/reverse", NOMINATIM_BASE);
  url.searchParams.set("lat", String(coords[0]));
  url.searchParams.set("lon", String(coords[1]));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "16");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SmartRouteOptimizer/1.0" },
  });
  if (!res.ok) return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;

  const data: NominatimResult = await res.json();
  return shortenDisplayName(data.display_name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPlaceResult(r: NominatimResult): PlaceResult {
  return {
    id: r.place_id,
    name: r.display_name,
    shortName: shortenDisplayName(r.display_name),
    coords: [parseFloat(r.lat), parseFloat(r.lon)] as LatLng,
    type: r.type,
    importance: r.importance,
  };
}

function shortenDisplayName(name: string): string {
  // Take first 2-3 parts for a readable short name.
  const parts = name.split(", ");
  if (parts.length <= 2) return name;
  return parts.slice(0, 3).join(", ");
}
