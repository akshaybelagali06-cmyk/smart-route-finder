// POST /api/find-route — compute the optimal route between two points.
// Primary: OSRM real-road routing. Fallback: grid-based A* if OSRM fails.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar } from "@/lib/algorithms/astar";
import { buildTrafficMap, trafficBucket, sampleTrafficAlongRoute } from "@/lib/algorithms/traffic";
import {
  fetchOSRMRoute,
  selectRouteByType,
  osrmToLatLng,
  metresToKm,
  secondsToMinutes,
  estimateFuel,
  generateVoiceInstructions,
  type RouteType,
} from "@/services/osrm";

const Body = z.object({
  source: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
  trafficWeight: z.number().min(0).max(5).optional(),
  waypoints: z.array(z.tuple([z.number(), z.number()])).optional(),
  routeType: z.enum(["fastest", "shortest", "least_traffic", "emergency", "fuel_efficient"]).optional(),
  roadClosures: z.array(z.tuple([z.number(), z.number()])).optional(),
});

// Helper to get default trafficWeight based on routeType
function getDefaultTrafficWeight(routeType: RouteType): number {
  switch (routeType) {
    case "shortest": return 0;
    case "fastest": return 1;
    case "least_traffic": return 2;
    case "emergency": return 1;
    case "fuel_efficient": return 1;
    default: return 1;
  }
}

export const Route = createFileRoute("/api/find-route")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = await request.json();
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const {
          source,
          destination,
          trafficWeight: requestedTrafficWeight,
          waypoints = [],
          routeType = "fastest",
        } = parsed.data;

        // Build the full waypoint list: source → waypoints → destination
        const allWaypoints: LatLng[] = [
          source as LatLng,
          ...waypoints.map((w) => w as LatLng),
          destination as LatLng,
        ];

        try {
          // -----------------------------------------------------------------
          // OSRM-success path
          // routeType now affects:
          // 1) which OSRM alternative is selected via selectRouteByType
          // 2) traffic scoring via sampleTrafficAlongRoute
          // 3) ETA only for 'emergency' via a single documented adjustment
          // -----------------------------------------------------------------
          
          // Determine if we need alternatives based on routeType
          const needsAlternatives = routeType === "shortest" || routeType === "fuel_efficient";
          
          // Call OSRM with routeType-aware alternatives flag
          const osrmData = await fetchOSRMRoute(
            allWaypoints, 
            "driving", 
            needsAlternatives ? 2 : false, 
            routeType
          );

          if (osrmData.routes.length === 0) {
            throw new Error("No OSRM route found");
          }

          // Select route based on routeType (if multiple routes available)
          const route = osrmData.routes.length > 1 
            ? selectRouteByType(osrmData.routes, routeType)
            : osrmData.routes[0];
            
          const coordinates = osrmToLatLng(route.geometry.coordinates);
          const distanceKm = metresToKm(route.distance);
          let etaMinutes = secondsToMinutes(route.duration);

          // EXCEPTION: Emergency vehicles have reduced effective travel time
          // This is a documented adjustment for emergency routing simulation
          if (routeType === "emergency") {
            etaMinutes = Math.max(1, Math.round(etaMinutes * 0.75));
          }
          // All other routeTypes use the REAL duration from the selected route
          // No multipliers applied for least_traffic, fuel_efficient, or shortest

          // Replace random traffic with deterministic geometry-based sampling
          const { trafficScore, pathTraffic } = sampleTrafficAlongRoute(coordinates, routeType);

          // Fuel estimation using REAL (or emergency-adjusted) etaMinutes
          const fuel = estimateFuel(distanceKm, etaMinutes);

          // Voice instructions
          const allSteps = route.legs.flatMap((l) => l.steps);
          const voiceInstructions = generateVoiceInstructions(allSteps);

          // Turn-by-turn steps
          const turnByTurn = allSteps
            .filter((s) => s.maneuver.type !== "depart")
            .map((s) => ({
              instruction: `${s.maneuver.modifier || s.maneuver.type} onto ${s.name || "road"}`,
              distance: Math.round(s.distance),
              duration: Math.round(s.duration),
              type: s.maneuver.type,
              modifier: s.maneuver.modifier,
              location: [s.maneuver.location[1], s.maneuver.location[0]] as LatLng,
            }));

          return Response.json({
            coordinates,
            explored: [], // OSRM doesn't expose explored nodes
            distanceKm,
            etaMinutes,
            trafficScore: +trafficScore.toFixed(2),
            nodesExplored: coordinates.length,
            cost: route.weight,
            pathTraffic,
            bucket: trafficBucket(),
            routeType, // Echo back actual routeType from request
            fuel,
            voiceInstructions,
            turnByTurn,
            routingEngine: "osrm",
            waypoints: osrmData.waypoints.map((w) => ({
              name: w.name,
              location: [w.location[1], w.location[0]] as LatLng,
              snappedDistance: Math.round(w.distance),
            })),
          });
        } catch (osrmError) {
          console.warn("[find-route] OSRM failed, falling back to grid A*:", osrmError);

          // -----------------------------------------------------------------
          // A* fallback path
          // -----------------------------------------------------------------
          const grid = buildGrid(source as LatLng, destination as LatLng, 22);
          const traffic = buildTrafficMap(grid);
          const start = nearestNode(grid, source as LatLng);
          const goal = nearestNode(grid, destination as LatLng);

          // Determine trafficWeight: use requested or default based on routeType
          const trafficWeight = requestedTrafficWeight ?? getDefaultTrafficWeight(routeType);

          // Pass routeType to A* so the cost function can adapt
          const result = aStar(grid, start, goal, traffic, { trafficWeight, routeType });
          
          if (!result) {
            return Response.json({ error: "No route found" }, { status: 404 });
          }

          // Calculate ETA from A* result (already considers traffic via cost function)
          const avgSpeed = 50 * (1 - result.trafficScore * 0.55);
          let etaMinutes = (result.distanceKm / Math.max(10, avgSpeed)) * 60;

          // Apply same emergency adjustment as OSRM path for consistency
          if (routeType === "emergency") {
            etaMinutes = Math.max(1, Math.round(etaMinutes * 0.75));
          }

          // Build pathTraffic from A* result (already computed with real densities)
          const pathTraffic = result.path.map((n) => ({
            lat: n.lat,
            lng: n.lng,
            density: traffic.get(n.id)?.density ?? 0,
            level: traffic.get(n.id)?.level ?? "low",
            color: traffic.get(n.id)?.color ?? "#22c55e",
          }));

          const fuel = estimateFuel(result.distanceKm, Math.round(etaMinutes));

          return Response.json({
          coordinates: result.coordinates,
          explored: result.explored,
          distanceKm: +result.distanceKm.toFixed(2),
          etaMinutes: Math.round(etaMinutes),
          trafficScore: +result.trafficScore.toFixed(2),
          nodesExplored: result.explored.length,
          cost: +result.cost.toFixed(2),
          pathTraffic,
          bucket: trafficBucket(),
          routeType,
          fuel,
          voiceInstructions: [],
          turnByTurn: [],
          routingEngine: "astar-fallback",
          waypoints: [],
        });
        }
      },
    },
  },
});