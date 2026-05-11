import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import RoutePanel from "@/components/RoutePanel";
import TrafficLegend from "@/components/TrafficLegend";
import type { LatLng } from "@/lib/algorithms/graph";
import {
  fetchAlternates,
  fetchTraffic,
  findRoute,
  type AlternateRoute,
  type RouteResponse,
  type TrafficSample,
} from "@/services/routing";

// Leaflet uses `window`; load the map only on the client.
const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Smart Route Optimizer · A* + Live Traffic" },
      {
        name: "description",
        content:
          "Find the optimal route between two points using the A* algorithm with simulated live traffic. Interactive map, alternate routes and explored-node visualization.",
      },
      { property: "og:title", content: "Smart Route Optimizer" },
      {
        property: "og:description",
        content:
          "A* shortest-path routing with live traffic simulation, built on OpenStreetMap.",
      },
    ],
  }),
});

const DEFAULT_CENTER: LatLng = [28.6139, 77.209]; // New Delhi

function Index() {
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState<"source" | "destination">("source");
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [alternates, setAlternates] = useState<AlternateRoute[]>([]);
  const [trafficSamples, setTrafficSamples] = useState<TrafficSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [trafficWeight, setTrafficWeight] = useState(1);
  const [showExplored, setShowExplored] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);

  useEffect(() => setMounted(true), []);

  // Live traffic refresh.
  useEffect(() => {
    if (!source || !destination) return;
    let cancelled = false;
    const load = async () => {
      try {
        const t = await fetchTraffic(source, destination);
        if (!cancelled) setTrafficSamples(t.samples);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [source, destination]);

  const handlePick = (p: LatLng) => {
    if (picking === "source") {
      setSource(p);
      setPicking("destination");
      toast.success("Source set", { description: `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` });
    } else {
      setDestination(p);
      setPicking("source");
      toast.success("Destination set", { description: `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` });
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
        setSource(p);
        setCenter(p);
        setPicking("destination");
        toast.success("Using your location as source");
      },
      () => toast.error("Unable to get your location"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const reset = () => {
    setSource(null);
    setDestination(null);
    setRoute(null);
    setAlternates([]);
    setTrafficSamples([]);
    setPicking("source");
  };

  const onFindRoute = async () => {
    if (!source || !destination) return;
    setLoading(true);
    try {
      const [r, alt] = await Promise.all([
        findRoute(source, destination, trafficWeight),
        fetchAlternates(source, destination),
      ]);
      setRoute(r);
      setAlternates(alt.routes);
      toast.success("Route ready", {
        description: `${r.distanceKm} km · ${r.etaMinutes} min · ${r.nodesExplored} nodes`,
      });
    } catch (e) {
      toast.error("Couldn't compute route", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Toaster richColors position="top-center" theme="dark" />
      <div className="mx-auto grid h-[calc(100vh-3rem)] max-w-[1500px] grid-cols-1 gap-4 md:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-4 overflow-y-auto">
          <Sidebar
            source={source}
            destination={destination}
            picking={picking}
            onPickMode={setPicking}
            onUseMyLocation={useMyLocation}
            onReset={reset}
            onFindRoute={onFindRoute}
            loading={loading}
            trafficWeight={trafficWeight}
            setTrafficWeight={setTrafficWeight}
            showExplored={showExplored}
            setShowExplored={setShowExplored}
            emergency={emergency}
            setEmergency={setEmergency}
          />
          <RoutePanel route={route} alternates={alternates} emergency={emergency} />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border glass">
          {mounted ? (
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                source={source}
                destination={destination}
                route={route}
                alternates={alternates}
                showExplored={showExplored}
                trafficSamples={trafficSamples}
                onPick={handlePick}
                center={center}
              />
            </Suspense>
          ) : (
            <MapSkeleton />
          )}
          <div className="pointer-events-none absolute left-1/2 top-4 z-[400] -translate-x-1/2">
            <TrafficLegend />
          </div>
          {loading && (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-background/40 backdrop-blur-sm">
              <div className="glass-strong rounded-full px-4 py-2 text-sm">
                Running A* search…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  );
}
