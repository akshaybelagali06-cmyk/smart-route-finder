// GET /api/traffic — return simulated traffic samples around a bbox.
import { createFileRoute } from "@tanstack/react-router";
import { buildGrid } from "@/lib/algorithms/graph";
import { buildTrafficMap, trafficBucket } from "@/lib/algorithms/traffic";

export const Route = createFileRoute("/api/traffic")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const num = (k: string, d: number) =>
          Number.parseFloat(url.searchParams.get(k) ?? `${d}`);
        const a: [number, number] = [num("slat", 28.61), num("slng", 77.21)];
        const b: [number, number] = [num("dlat", 28.7), num("dlng", 77.3)];

        const grid = buildGrid(a, b, 14);
        const traffic = buildTrafficMap(grid);
        const samples: Array<{
          lat: number;
          lng: number;
          density: number;
          level: string;
          color: string;
        }> = [];
        for (const row of grid.nodes) {
          for (const n of row) {
            const t = traffic.get(n.id)!;
            samples.push({
              lat: n.lat,
              lng: n.lng,
              density: +t.density.toFixed(2),
              level: t.level,
              color: t.color,
            });
          }
        }
        return Response.json({ bucket: trafficBucket(), samples });
      },
    },
  },
});
