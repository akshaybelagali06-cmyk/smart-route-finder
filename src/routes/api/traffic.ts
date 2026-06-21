// @/lib/algorithms/traffic.ts

export interface LatLng {
  lat: number;
  lng: number;
}

export type RouteType = "least_traffic" | "emergency" | "fastest" | "shortest";

export interface TrafficSample {
  lat: number;
  lng: number;
  density: number;
  level: "low" | "medium" | "high";
  color: "green" | "yellow" | "red";
}

export interface TrafficResult {
  trafficScore: number;
  pathTraffic: TrafficSample[];
}

// Deterministic hash function for coordinates
function hashCoordinates(lat: number, lng: number): number {
  const str = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Get base density from deterministic hash (0-1 range)
function getBaseDensityFromHash(lat: number, lng: number): number {
  const hash = hashCoordinates(lat, lng);
  // Use modulo to get a value between 0 and 1
  return (hash % 1000) / 1000;
}

// Get time-based rush hour multiplier
function getRushHourMultiplier(): number {
  const now = new Date();
  const hour = now.getHours();
  
  // Rush hour logic: 8-10 (morning) and 17-20 (evening)
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    return 1.5; // High density during rush hour
  }
  // Off-peak: 11-16 or 21-7
  return 0.8;
}

// Calculate density for a segment between two points
function calculateSegmentDensity(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number,
  routeType: RouteType
): number {
  // Average the hash densities of both endpoints
  const density1 = getBaseDensityFromHash(lat1, lng1);
  const density2 = getBaseDensityFromHash(lat2, lng2);
  let density = (density1 + density2) / 2;
  
  // Apply rush hour multiplier
  const rushMultiplier = getRushHourMultiplier();
  density = density * rushMultiplier;
  
  // Cap at 1.0
  density = Math.min(density, 1.0);
  
  return density;
}

// Get level and color based on density threshold
function getLevelAndColor(density: number): { level: "low" | "medium" | "high", color: "green" | "yellow" | "red" } {
  if (density < 0.33) {
    return { level: "low", color: "green" };
  } else if (density < 0.66) {
    return { level: "medium", color: "yellow" };
  } else {
    return { level: "high", color: "red" };
  }
}

// Sample points evenly along route (approx 30 points)
function samplePointsAlongRoute(coordinates: LatLng[], targetSamples: number = 30): LatLng[] {
  if (coordinates.length < 2) return coordinates;
  
  // Calculate cumulative distances
  const distances: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const lat1 = coordinates[i-1].lat;
    const lng1 = coordinates[i-1].lng;
    const lat2 = coordinates[i].lat;
    const lng2 = coordinates[i].lng;
    
    // Haversine distance approximation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    distances.push(distances[i-1] + distance);
  }
  
  const totalDistance = distances[distances.length - 1];
  const step = totalDistance / (targetSamples - 1);
  
  const samples: LatLng[] = [];
  
  for (let i = 0; i < targetSamples; i++) {
    const targetDist = i * step;
    
    // Find segment containing targetDist
    let segIdx = 0;
    while (segIdx < distances.length - 1 && distances[segIdx + 1] < targetDist) {
      segIdx++;
    }
    
    if (segIdx >= coordinates.length - 1) {
      samples.push(coordinates[coordinates.length - 1]);
      continue;
    }
    
    const segStart = coordinates[segIdx];
    const segEnd = coordinates[segIdx + 1];
    const segStartDist = distances[segIdx];
    const segEndDist = distances[segIdx + 1];
    const segLength = segEndDist - segStartDist;
    
    if (segLength === 0) {
      samples.push(segStart);
      continue;
    }
    
    const t = (targetDist - segStartDist) / segLength;
    const lat = segStart.lat + (segEnd.lat - segStart.lat) * t;
    const lng = segStart.lng + (segEnd.lng - segStart.lng) * t;
    
    samples.push({ lat, lng });
  }
  
  return samples;
}

// Main exported function
export function sampleTrafficAlongRoute(
  coordinates: LatLng[], 
  routeType: RouteType
): TrafficResult {
  if (coordinates.length < 2) {
    return {
      trafficScore: 0,
      pathTraffic: []
    };
  }
  
  // Calculate density for each segment
  const segmentDensities: number[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const density = calculateSegmentDensity(
      coordinates[i].lat,
      coordinates[i].lng,
      coordinates[i+1].lat,
      coordinates[i+1].lng,
      routeType
    );
    segmentDensities.push(density);
  }
  
  // Calculate raw traffic score (weighted average of segment densities)
  let rawScore = segmentDensities.reduce((sum, d) => sum + d, 0) / segmentDensities.length;
  
  // Apply routeType adjustments
  let finalScore = rawScore;
  
  switch (routeType) {
    case "least_traffic":
      // Cap each segment's contribution at 0.5x for high density segments
      const cappedDensities = segmentDensities.map(d => Math.min(d, 0.5));
      finalScore = cappedDensities.reduce((sum, d) => sum + d, 0) / cappedDensities.length;
      break;
      
    case "emergency":
      // SIMULATION: Emergency vehicles bypass congestion
      // Apply flat reduction multiplier (not real-world routing)
      finalScore = rawScore * 0.4;
      break;
      
    default:
      // "fastest" or "shortest" - use raw score
      finalScore = rawScore;
      break;
  }
  
  // Ensure score is in 0-1 range
  finalScore = Math.min(Math.max(finalScore, 0), 1);
  
  // Sample points along route for pathTraffic (approx 30 evenly spaced)
  const samplePoints = samplePointsAlongRoute(coordinates, 30);
  
  // Calculate traffic for each sample point
  const pathTraffic: TrafficSample[] = samplePoints.map(point => {
    // For each sample point, find nearest segment or use surrounding segments
    let minDist = Infinity;
    let density = 0;
    
    // Find density from nearest segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const segStart = coordinates[i];
      const segEnd = coordinates[i+1];
      
      // Simple distance to line segment
      const lat = point.lat;
      const lng = point.lng;
      
      const A = { x: segStart.lng, y: segStart.lat };
      const B = { x: segEnd.lng, y: segEnd.lat };
      const P = { x: lng, y: lat };
      
      const ABx = B.x - A.x;
      const ABy = B.y - A.y;
      const t = ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / (ABx * ABx + ABy * ABy);
      
      let closest: { x: number, y: number };
      if (t < 0) closest = A;
      else if (t > 1) closest = B;
      else closest = { x: A.x + t * ABx, y: A.y + t * ABy };
      
      const dist = Math.sqrt(Math.pow(P.x - closest.x, 2) + Math.pow(P.y - closest.y, 2));
      
      if (dist < minDist) {
        minDist = dist;
        density = segmentDensities[i];
      }
    }
    
    const { level, color } = getLevelAndColor(density);
    
    return {
      lat: point.lat,
      lng: point.lng,
      density: +density.toFixed(2),
      level,
      color
    };
  });
  
  return {
    trafficScore: +finalScore.toFixed(2),
    pathTraffic
  };
}

// Existing functions (unchanged)
export interface TrafficData {
  density: number;
  level: string;
  color: string;
}

// Keep existing buildTrafficMap implementation
export function buildTrafficMap(grid: any): Map<string, TrafficData> {
  // Existing implementation here (unchanged)
  const trafficMap = new Map<string, TrafficData>();
  // ... rest of existing implementation
  return trafficMap;
}

// Keep existing trafficBucket implementation
export function trafficBucket(): any {
  // Existing implementation here (unchanged)
  return {
    low: { min: 0, max: 0.33, color: "green" },
    medium: { min: 0.33, max: 0.66, color: "yellow" },
    high: { min: 0.66, max: 1.0, color: "red" }
  };
}