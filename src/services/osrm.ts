// OSRM routing service — calls the public OSRM demo server for real
// road-network routing. Routes snap to actual streets from OpenStreetMap.
//
// NOTE: The OSRM demo server (router.project-osrm.org) is free but
// rate-limited. For production use, self-host OSRM or use a paid service.

import type { LatLng } from "@/lib/algorithms/graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RouteType = "fastest" | "shortest" | "least_traffic" | "emergency" | "fuel_efficient";

export interface OSRMRouteStep {
  distance: number; // metres
  duration: number; // seconds
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
  };
}

export interface OSRMRouteLeg {
  distance: number;
  duration: number;
  steps: OSRMRouteStep[];
  summary: string;
}

export interface OSRMRoute {
  distance: number; // total metres
  duration: number; // total seconds
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat][]
  };
  legs: OSRMRouteLeg[];
  weight: number;
  weight_name: string;
}

export interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
  waypoints: Array<{
    name: string;
    location: [number, number];
    distance: number;
  }>;
}

// ---------------------------------------------------------------------------
// Profile types — control the OSRM routing profile
// ---------------------------------------------------------------------------
export type OSRMProfile = "driving" | "cycling" | "foot";

// ---------------------------------------------------------------------------
// Core API call
// ---------------------------------------------------------------------------

const OSRM_BASE = "https://router.project-osrm.org";

/**
 * Fetch a route from the OSRM demo server.
 * @param waypoints  Array of [lat, lng] — at least 2.
 * @param profile    Routing profile (driving / cycling / foot).
 * @param alternatives Whether to request alternate routes.
 * @param routeType  Route type strategy for selecting between alternatives.
 */
export async function fetchOSRMRoute(
  waypoints: LatLng[],
  profile: OSRMProfile = "driving",
  alternatives: boolean | number = false,
  routeType?: RouteType,
): Promise<OSRMResponse> {
  if (waypoints.length < 2) throw new Error("Need at least 2 waypoints");

  // Determine alternatives parameter based on routeType
  let finalAlternatives = alternatives;
  
  if (routeType === "shortest" || routeType === "fuel_efficient") {
    // Request alternatives for these route types to have options to choose from
    // Request 2 alternatives (max) to avoid overloading the API
    finalAlternatives = 2;
  }

  // OSRM expects lng,lat order in the URL.
  const coords = waypoints.map((w) => `${w[1]},${w[0]}`).join(";");

  const url = new URL(`/route/v1/${profile}/${coords}`, OSRM_BASE);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");
  url.searchParams.set(
    "alternatives",
    typeof finalAlternatives === "number" ? String(finalAlternatives) : String(finalAlternatives),
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data: OSRMResponse = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM: ${data.code}`);
  return data;
}

// ---------------------------------------------------------------------------
// Route selection by type
// ---------------------------------------------------------------------------

/**
 * Calculate fuel efficiency factor for a route
 * Returns a value where lower is better (more fuel-efficient)
 * 
 * @param distanceKm Route distance in kilometers
 * @param durationMin Route duration in minutes
 * @returns Fuel efficiency score (lower = more efficient)
 */
function calculateFuelEfficiencyScore(distanceKm: number, durationMin: number): number {
  if (durationMin === 0) return Infinity;
  
  const avgSpeedKmh = (distanceKm / durationMin) * 60;
  // Target speed: 60 km/h (highway-efficient speed)
  // Prefer speeds close to 60 km/h without exceeding it significantly
  // Higher speeds increase air resistance and fuel consumption
  const targetSpeed = 60;
  
  let score: number;
  if (avgSpeedKmh <= targetSpeed) {
    // Below target: smaller penalty for being slower
    // Square the deviation to penalize very slow speeds more
    const deviation = targetSpeed - avgSpeedKmh;
    score = deviation * deviation;
  } else {
    // Above target: linear penalty for excessive speed (fuel efficiency drops)
    score = (avgSpeedKmh - targetSpeed) * 2;
  }
  
  // Also factor in the raw distance (shorter routes are generally better)
  // but weight it less than speed consistency
  return score + (distanceKm * 0.1);
}

/**
 * Select the most appropriate route based on routeType
 * 
 * @param routes Array of routes from OSRM
 * @param routeType The routing strategy to use
 * @returns The selected route
 */
export function selectRouteByType(routes: OSRMRoute[], routeType: RouteType): OSRMRoute {
  // Fallback for single route
  if (routes.length === 1) {
    return routes[0];
  }
  
  switch (routeType) {
    case "shortest":
      // Return route with minimum distance
      return routes.reduce((best, current) => 
        current.distance < best.distance ? current : best
      );
      
    case "fuel_efficient":
      // Return route with best fuel efficiency score
      // Score based on steady average speed (preferring ~60km/h) and reasonable distance
      return routes.reduce((best, current) => {
        const currentScore = calculateFuelEfficiencyScore(
          current.distance / 1000, // metres to km
          current.duration / 60    // seconds to minutes
        );
        const bestScore = calculateFuelEfficiencyScore(
          best.distance / 1000,
          best.duration / 60
        );
        return currentScore < bestScore ? current : best;
      });
      
    case "fastest":
    case "least_traffic":
    case "emergency":
    default:
      // Return OSRM's default best-duration route
      return routes[0];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert OSRM [lng, lat] geometry → our [lat, lng] LatLng array. */
export function osrmToLatLng(coords: [number, number][]): LatLng[] {
  return coords.map(([lng, lat]) => [lat, lng] as LatLng);
}

/** Calculate distance in km from metres. */
export function metresToKm(m: number): number {
  return +(m / 1000).toFixed(2);
}

/** Calculate ETA in minutes from seconds. */
export function secondsToMinutes(s: number): number {
  return Math.round(s / 60);
}

/**
 * Estimate fuel consumption.
 * Average car: ~8 L/100km city, ~6 L/100km highway.
 * We blend based on average speed.
 * 
 * IMPORTANT: Callers MUST pass the REAL route duration from the SELECTED route,
 * not an artificially scaled ETA. Fuel must be derived from actual distance/duration
 * of the selected route, not a post-hoc multiplier. This ensures accurate fuel
 * calculations based on actual route characteristics (e.g., stop-and-go vs highway).
 */
export function estimateFuel(distanceKm: number, durationMin: number) {
  const avgSpeedKmh = durationMin > 0 ? (distanceKm / durationMin) * 60 : 30;
  // City driving (<40 km/h) = 9 L/100km, Highway (>80 km/h) = 6 L/100km
  const factor = avgSpeedKmh < 40 ? 9 : avgSpeedKmh > 80 ? 6 : 9 - ((avgSpeedKmh - 40) / 40) * 3;
  const litres = (distanceKm * factor) / 100;
  const costINR = litres * 102; // Approx ₹102/L for petrol in India
  // EV: ~15 kWh/100km average
  const kwh = (distanceKm * 15) / 100;
  const evCost = kwh * 8; // Approx ₹8/kWh
  return {
    litres: +litres.toFixed(1),
    costINR: Math.round(costINR),
    kwh: +kwh.toFixed(1),
    evCostINR: Math.round(evCost),
  };
}

/**
 * Generate turn-by-turn voice instructions from OSRM steps.
 */
export function generateVoiceInstructions(steps: OSRMRouteStep[]): string[] {
  return steps
    .filter((s) => s.maneuver.type !== "depart" && s.maneuver.type !== "arrive")
    .map((s) => {
      const dist =
        s.distance >= 1000
          ? `${(s.distance / 1000).toFixed(1)} kilometres`
          : `${Math.round(s.distance)} metres`;
      const dir = s.maneuver.modifier
        ? s.maneuver.modifier.replace(/-/g, " ")
        : s.maneuver.type;
      const road = s.name || "the road";
      return `In ${dist}, ${dir} onto ${road}`;
    });
}