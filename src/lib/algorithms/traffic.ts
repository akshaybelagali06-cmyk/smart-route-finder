import type { LatLng, Grid } from "./graph";

// Single source of truth for RouteType
export type RouteType = "fastest" | "shortest" | "least_traffic" | "emergency" | "fuel_efficient";

export interface PathTrafficSample {
  lat: number;
  lng: number;
  density: number;
  level: "low" | "medium" | "high";
  color: string;
}

export interface TrafficSampleResult {
  trafficScore: number;
  pathTraffic: PathTrafficSample[];
}

export interface TrafficCell {
  density: number;
  level: string;
  color: string;
}

export interface TrafficBucket {
  low: { min: number; max: number; color: string };
  medium: { min: number; max: number; color: string };
  high: { min: number; max: number; color: string };
}

// Deterministic density calculation for a lat/lng point
function calculateDensity(lat: number, lng: number): number {
  const hour = new Date().getHours();
  const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const baseDensity = isRushHour ? 0.6 : 0.25;
  
  // Deterministic hash function
  const hash = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453) % 1;
  let density = Math.min(1, baseDensity + (hash - 0.5) * 0.4);
  return Math.max(0, density);
}

// Get level and color based on density
function getLevelAndColor(density: number): { level: "low" | "medium" | "high"; color: string } {
  if (density < 0.33) {
    return { level: "low", color: "#22c55e" };
  } else if (density < 0.66) {
    return { level: "medium", color: "#eab308" };
  } else {
    return { level: "high", color: "#ef4444" };
  }
}

export function sampleTrafficAlongRoute(
  coordinates: LatLng[],
  routeType: RouteType = "fastest",
): TrafficSampleResult {
  if (coordinates.length === 0) {
    return { trafficScore: 0, pathTraffic: [] };
  }

  // Sample ~30 evenly spaced points
  const step = Math.max(1, Math.floor(coordinates.length / 30));
  const pathTraffic: PathTrafficSample[] = [];
  let densitySum = 0;
  let count = 0;

  for (let i = 0; i < coordinates.length; i += step) {
    const [lat, lng] = coordinates[i];
    let density = calculateDensity(lat, lng);

    if (routeType === "least_traffic") {
      density = density * 0.5; // dampen high-density segments
    }

    const { level, color } = getLevelAndColor(density);
    pathTraffic.push({ lat, lng, density: +density.toFixed(2), level, color });
    densitySum += density;
    count++;
  }

  let trafficScore = count > 0 ? densitySum / count : 0;

  if (routeType === "emergency") {
    trafficScore *= 0.4; // priority/clearance simulation
  }

  return { trafficScore: +trafficScore.toFixed(2), pathTraffic };
}

export function buildTrafficMap(grid: Grid): Map<string, TrafficCell> {
  const trafficMap = new Map<string, TrafficCell>();
  
  for (const row of grid.nodes) {
    for (const node of row) {
      const density = calculateDensity(node.lat, node.lng);
      const { level, color } = getLevelAndColor(density);
      
      trafficMap.set(node.id, {
        density: +density.toFixed(2),
        level,
        color,
      });
    }
  }
  
  return trafficMap;
}

export function trafficBucket(): TrafficBucket {
  return {
    low: { min: 0, max: 0.33, color: "#22c55e" },
    medium: { min: 0.33, max: 0.66, color: "#eab308" },
    high: { min: 0.66, max: 1.0, color: "#ef4444" },
  };
}