// POST /api/find-route — compute the optimal A* route between two points.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildGrid, nearestNode, type LatLng } from "@/lib/algorithms/graph";
import { aStar } from "@/lib/algorithms/astar";
import { buildTrafficMap, trafficBucket } from "@/lib/algorithms/traffic";

const Body = z.object({
  source: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
  trafficWeight: z.number().min(0).max(5).optional(),
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
        const { source, destination, trafficWeight = 1 } = parsed.data;

        const grid = buildGrid(source as LatLng, destination as LatLng, 22);
        const traffic = buildTrafficMap(grid);
        const start = nearestNode(grid, source as LatLng);
        const goal = nearestNode(grid, destination as LatLng);

        const result = aStar(grid, start, goal, traffic, { trafficWeight });
        if (!result) {
          return Response.json({ error: "No route found" }, { status: 404 });
        }

        // Average speed model: 50 km/h base, scaled down by traffic.
        const avgSpeed = 50 * (1 - result.trafficScore * 0.55);
        const etaMinutes = (result.distanceKm / Math.max(10, avgSpeed)) * 60;

        // Path traffic samples for colored rendering.
        const pathTraffic = result.path.map((n) => ({
          lat: n.lat,
          lng: n.lng,
          density: traffic.get(n.id)?.density ?? 0,
          level: traffic.get(n.id)?.level ?? "low",
          color: traffic.get(n.id)?.color ?? "#22c55e",
        }));

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
        });
      },
    },
  },
});
