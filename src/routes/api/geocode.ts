// GET /api/geocode — search for places using Nominatim.
import { createFileRoute } from "@tanstack/react-router";
import { searchPlaces, reverseGeocode } from "@/services/geocoding";
import type { LatLng } from "@/lib/algorithms/graph";

export const Route = createFileRoute("/api/geocode")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get("q");
        const lat = url.searchParams.get("lat");
        const lng = url.searchParams.get("lng");

        // Reverse geocode
        if (lat && lng) {
          const name = await reverseGeocode([
            parseFloat(lat),
            parseFloat(lng),
          ] as LatLng);
          return Response.json({ name });
        }

        // Forward search
        if (!query) {
          return Response.json({ results: [] });
        }

        const results = await searchPlaces(query, 6);
        return Response.json({ results });
      },
    },
  },
});
