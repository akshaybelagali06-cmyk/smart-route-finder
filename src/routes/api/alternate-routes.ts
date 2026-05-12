// POST /api/alternate-routes — return multiple route alternatives via OSRM.
// Fallback: grid-based A* with different traffic weights.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar } from "@/lib/algorithms/astar";
import { buildTrafficMap } from "@/lib/algorithms/traffic";
import {
  fetchOSRMRoute,
  osrmToLatLng,
  metresToKm,
  secondsToMinutes,
  estimateFuel,
} from "@/services/osrm";

const Body = z.object({
  source: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
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
        const { source, destination } = parsed.data;

        try {
          // Request OSRM with alternatives
          const osrmData = await fetchOSRMRoute(
            [source as LatLng, destination as LatLng],
            "driving",
            3, // request up to 3 alternatives
          );

          const labels = [
            "Fastest",
            "Alternative 1",
            "Alternative 2",
            "Alternative 3",
          ];

          const routes = osrmData.routes.map((route, i) => {
            const distanceKm = metresToKm(route.distance);
            const etaMinutes = secondsToMinutes(route.duration);
            const coordinates = osrmToLatLng(route.geometry.coordinates);

            // Simulate traffic score
            const hour = new Date().getHours();
            const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
            const trafficScore = Math.min(
              1,
              (isRushHour ? 0.5 : 0.2) + Math.random() * 0.25 + i * 0.05,
            );

            const fuel = estimateFuel(distanceKm, etaMinutes);

            return {
              label: labels[i] || `Route ${i + 1}`,
              coordinates,
              distanceKm,
              etaMinutes,
              trafficScore: +trafficScore.toFixed(2),
              nodesExplored: coordinates.length,
              fuel,
              routingEngine: "osrm" as const,
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
              const r = aStar(grid, start, goal, traffic, {
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
            .filter(Boolean);

          return Response.json({ routes });
        }
      },
    },
  },
});
