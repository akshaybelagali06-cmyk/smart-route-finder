// POST /api/alternate-routes — return multiple route alternatives via OSRM.
// Fallback: grid-based A* with different traffic weights.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar, type AStarResult } from "@/lib/algorithms/astar";
import { buildTrafficMap, sampleTrafficAlongRoute } from "@/lib/algorithms/traffic";
import {
  fetchOSRMRoute,
  osrmToLatLng,
  metresToKm,
  secondsToMinutes,
  estimateFuel,
  type OSRMRoute,
  type RouteType,
} from "@/services/osrm";

const Body = z.object({
  source: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
  routeType: z.enum(["fastest", "shortest", "least_traffic", "emergency", "fuel_efficient"]).optional(),
});

export const Route = createFileRoute("/api/alternate-routes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = await request.json();
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const { source, destination, routeType = "fastest" } = parsed.data;

        try {
          // Request OSRM with alternatives
          const osrmData = await fetchOSRMRoute(
            [source as LatLng, destination as LatLng],
            "driving",
            3, // request up to 3 alternatives
            routeType,
          );

          // Build route objects with computed properties - explicit types
          const routesWithProps = osrmData.routes.map((route: OSRMRoute, idx: number) => {
            const distanceKm = metresToKm(route.distance);
            const etaMinutes = secondsToMinutes(route.duration);
            const coordinates = osrmToLatLng(route.geometry.coordinates);
            
            // Use deterministic traffic scoring based on route geometry
            const { trafficScore } = sampleTrafficAlongRoute(coordinates, "fastest");
            
            const fuel = estimateFuel(distanceKm, etaMinutes);

            return {
              coordinates,
              distanceKm,
              etaMinutes,
              trafficScore: +trafficScore.toFixed(2),
              nodesExplored: coordinates.length,
              fuel,
              routingEngine: "osrm" as const,
              originalIndex: idx,
            };
          });

          // SORT by etaMinutes ascending before assigning labels
          const sortedRoutes = [...routesWithProps].sort((a, b) => a.etaMinutes - b.etaMinutes);
          
          // Find which route has shortest distance
          const shortestDistance = Math.min(...routesWithProps.map(r => r.distanceKm));
          const shortestRouteIndex = routesWithProps.findIndex(r => r.distanceKm === shortestDistance);
          
          // Find which route has least traffic
          const leastTrafficScore = Math.min(...routesWithProps.map(r => r.trafficScore));
          const leastTrafficIndex = routesWithProps.findIndex(r => r.trafficScore === leastTrafficScore);
          
          // Assign labels based on sorted position and properties
          const routes = routesWithProps.map((route, idx) => {
            let label = "";
            
            // Check if this is the fastest route (lowest etaMinutes)
            const isFastest = route.etaMinutes === sortedRoutes[0].etaMinutes;
            
            // Check if this is the shortest route
            const isShortest = idx === shortestRouteIndex;
            
            // Check if this is the least traffic route
            const isLeastTraffic = idx === leastTrafficIndex;
            
            if (isFastest && isShortest) {
              label = "Fastest & Shortest";
            } else if (isFastest) {
              label = "Fastest";
            } else if (isShortest) {
              label = "Shortest";
            } else {
              // Count how many alternatives before this one (in original order)
              let altNumber = 1;
              for (let i = 0; i < idx; i++) {
                if (routesWithProps[i] && 
                    routesWithProps[i].etaMinutes !== sortedRoutes[0].etaMinutes &&
                    i !== shortestRouteIndex) {
                  altNumber++;
                }
              }
              label = `Alternative ${altNumber}`;
            }
            
            // Append "Least Traffic" if this route has the lowest traffic score
            if (isLeastTraffic && !label.includes("Least Traffic")) {
              label = `${label} (Least Traffic)`;
            }
            
            return {
              label,
              coordinates: route.coordinates,
              distanceKm: route.distanceKm,
              etaMinutes: route.etaMinutes,
              trafficScore: route.trafficScore,
              nodesExplored: route.nodesExplored,
              fuel: route.fuel,
              routingEngine: route.routingEngine,
            };
          });

          return Response.json({ routes });
        } catch (osrmError) {
          console.warn(
            "[alternate-routes] OSRM failed, falling back to grid A*:",
            osrmError,
          );

          // Fallback: grid-based A*
          const grid = buildGrid(source as LatLng, destination as LatLng, 22);
          const traffic = buildTrafficMap(grid);
          const start = nearestNode(grid, source as LatLng);
          const goal = nearestNode(grid, destination as LatLng);

          const variants = [
            { label: "Shortest", trafficWeight: 0 },
            { label: "Balanced", trafficWeight: 1 },
            { label: "Least Traffic", trafficWeight: 3 },
          ];

          const routes = variants
            .map((v) => {
              const r: AStarResult | null = aStar(grid, start, goal, traffic, {
                trafficWeight: v.trafficWeight,
              });
              if (!r) return null;
              const avgSpeed = 50 * (1 - r.trafficScore * 0.55);
              const eta = (r.distanceKm / Math.max(10, avgSpeed)) * 60;
              const fuel = estimateFuel(r.distanceKm, Math.round(eta));
              return {
                label: v.label,
                coordinates: r.coordinates,
                distanceKm: +r.distanceKm.toFixed(2),
                etaMinutes: Math.round(eta),
                trafficScore: +r.trafficScore.toFixed(2),
                nodesExplored: r.explored.length,
                fuel,
                routingEngine: "astar-fallback" as const,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

          return Response.json({ routes });
        }
      },
    },
  },
});