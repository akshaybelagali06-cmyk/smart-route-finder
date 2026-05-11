// POST /api/alternate-routes — return shortest, least-traffic and balanced routes.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar } from "@/lib/algorithms/astar";
import { buildTrafficMap } from "@/lib/algorithms/traffic";

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
            return {
              label: v.label,
              coordinates: r.coordinates,
              distanceKm: +r.distanceKm.toFixed(2),
              etaMinutes: Math.round(eta),
              trafficScore: +r.trafficScore.toFixed(2),
              nodesExplored: r.explored.length,
            };
          })
          .filter(Boolean);

        return Response.json({ routes });
      },
    },
  },
});
