// Service wrapper for the routing API.
import type { LatLng } from "@/lib/algorithms/graph";

// ---------------------------------------------------------------------------
// Route types
// ---------------------------------------------------------------------------

export type RouteType =
  | "fastest"
  | "shortest"
  | "least_traffic"
  | "emergency"
  | "fuel_efficient";

export interface FuelEstimate {
  litres: number;
  costINR: number;
  kwh: number;
  evCostINR: number;
}

export interface TurnByTurnStep {
  instruction: string;
  distance: number;
  duration: number;
  type: string;
  modifier?: string;
  location: LatLng;
}

export interface RouteResponse {
  coordinates: LatLng[];
  explored: LatLng[];
  distanceKm: number;
  etaMinutes: number;
  trafficScore: number;
  nodesExplored: number;
  cost: number;
  pathTraffic: Array<{
    lat: number;
    lng: number;
    density: number;
    level: "low" | "medium" | "high";
    color: string;
  }>;
  bucket: number;
  routeType?: RouteType;
  fuel?: FuelEstimate;
  voiceInstructions?: string[];
  turnByTurn?: TurnByTurnStep[];
  routingEngine?: "osrm" | "astar-fallback";
  waypoints?: Array<{
    name: string;
    location: LatLng;
    snappedDistance: number;
  }>;
}

export interface AlternateRoute {
  label: string;
  coordinates: LatLng[];
  distanceKm: number;
  etaMinutes: number;
  trafficScore: number;
  nodesExplored: number;
  fuel?: FuelEstimate;
  routingEngine?: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function findRoute(
  source: LatLng,
  destination: LatLng,
  trafficWeight = 1,
  options?: {
    waypoints?: LatLng[];
    routeType?: RouteType;
    roadClosures?: LatLng[];
  },
): Promise<RouteResponse> {
  const res = await fetch("/api/find-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source,
      destination,
      trafficWeight,
      waypoints: options?.waypoints,
      routeType: options?.routeType,
      roadClosures: options?.roadClosures,
    }),
  });
  if (!res.ok) throw new Error("Route lookup failed");
  return res.json();
}

export async function fetchAlternates(
  source: LatLng,
  destination: LatLng,
): Promise<{ routes: AlternateRoute[] }> {
  const res = await fetch("/api/alternate-routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  if (!res.ok) throw new Error("Alternate routes failed");
  return res.json();
}

export interface TrafficSample {
  lat: number;
  lng: number;
  density: number;
  level: string;
  color: string;
}
export async function fetchTraffic(
  source: LatLng,
  destination: LatLng,
): Promise<{ bucket: number; samples: TrafficSample[] }> {
  const qs = new URLSearchParams({
    slat: String(source[0]),
    slng: String(source[1]),
    dlat: String(destination[0]),
    dlng: String(destination[1]),
  });
  const res = await fetch(`/api/traffic?${qs}`);
  if (!res.ok) throw new Error("Traffic fetch failed");
  return res.json();
}
