// POST /api/find-route — compute the optimal route between two points.
// Primary: OSRM real-road routing. Fallback: grid-based A* if OSRM fails.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar } from "@/lib/algorithms/astar";
import { buildTrafficMap, trafficBucket } from "@/lib/algorithms/traffic";
import {
  fetchOSRMRoute,
  osrmToLatLng,
  metresToKm,
  secondsToMinutes,
  estimateFuel,
  generateVoiceInstructions,
} from "@/services/osrm";

const Body = z.object({
  source: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
  trafficWeight: z.number().min(0).max(5).optional(),
  waypoints: z.array(z.tuple([z.number(), z.number()])).optional(),
  routeType: z.enum(["fastest", "shortest", "least_traffic", "emergency", "fuel_efficient"]).optional(),
  roadClosures: z.array(z.tuple([z.number(), z.number()])).optional(),
});

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
          trafficWeight = 1,
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
          // Try OSRM real-road routing first
          const osrmData = await fetchOSRMRoute(allWaypoints, "driving", false);

          if (osrmData.routes.length === 0) {
            throw new Error("No OSRM route found");
          }

          const route = osrmData.routes[0];
          const coordinates = osrmToLatLng(route.geometry.coordinates);
          const distanceKm = metresToKm(route.distance);
          const etaMinutes = secondsToMinutes(route.duration);

          // Apply route type modifiers
          let adjustedEta = etaMinutes;
          let trafficMultiplier = 1;
          switch (routeType) {
            case "emergency":
              adjustedEta = Math.max(1, Math.round(etaMinutes * 0.6));
              trafficMultiplier = 0.3;
              break;
            case "least_traffic":
              adjustedEta = Math.round(etaMinutes * 1.15);
              trafficMultiplier = 0.2;
              break;
            case "fuel_efficient":
              adjustedEta = Math.round(etaMinutes * 1.1);
              break;
          }

          // Simulate traffic score based on time of day and distance
          const hour = new Date().getHours();
          const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
          const baseTraffic = isRushHour ? 0.65 : 0.25;
          const trafficScore = Math.min(1, baseTraffic * trafficMultiplier + Math.random() * 0.15);

          // Generate traffic heatmap along the route
          const pathTraffic = coordinates
            .filter((_, i) => i % Math.max(1, Math.floor(coordinates.length / 30)) === 0)
            .map((c) => {
              const density = Math.min(1, trafficScore + (Math.random() - 0.5) * 0.3);
              const level = density < 0.33 ? "low" : density < 0.66 ? "medium" : "high";
              const color =
                level === "low" ? "#22c55e" : level === "medium" ? "#eab308" : "#ef4444";
              return { lat: c[0], lng: c[1], density: +density.toFixed(2), level, color };
            });

          // Fuel estimation
          const fuel = estimateFuel(distanceKm, adjustedEta);

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
            etaMinutes: adjustedEta,
            trafficScore: +trafficScore.toFixed(2),
            nodesExplored: coordinates.length,
            cost: route.weight,
            pathTraffic,
            bucket: trafficBucket(),
            routeType,
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

          // Fallback: grid-based A* routing
          const grid = buildGrid(source as LatLng, destination as LatLng, 22);
          const traffic = buildTrafficMap(grid);
          const start = nearestNode(grid, source as LatLng);
          const goal = nearestNode(grid, destination as LatLng);

          const result = aStar(grid, start, goal, traffic, { trafficWeight });
          if (!result) {
            return Response.json({ error: "No route found" }, { status: 404 });
          }

          const avgSpeed = 50 * (1 - result.trafficScore * 0.55);
          const etaMinutes = (result.distanceKm / Math.max(10, avgSpeed)) * 60;

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
            routeType: "fastest",
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
