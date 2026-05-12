import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
  type RouteType,
  type TrafficSample,
} from "@/services/routing";
import { useIsMobile } from "@/hooks/use-mobile";

// Leaflet uses `window`; load the map only on the client.
const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Smart Route Optimizer · OSRM Road Routing + Live Traffic" },
      {
        name: "description",
        content:
          "Find the optimal route between two points using real OpenStreetMap roads via OSRM. Interactive map, alternate routes, fuel estimation, voice navigation, and live traffic simulation.",
      },
      { property: "og:title", content: "Smart Route Optimizer" },
      {
        property: "og:description",
        content:
          "Real road-network routing with OSRM, A* fallback, live traffic simulation, and turn-by-turn navigation.",
      },
    ],
  }),
});

const DEFAULT_CENTER: LatLng = [12.9716, 77.5946]; // Bangalore

function Index() {
  const isMobile = useIsMobile();
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
  const [routeType, setRouteType] = useState<RouteType>("fastest");

  // Place names from search
  const [sourceName, setSourceName] = useState("");
  const [destinationName, setDestinationName] = useState("");

  // Multi-stop waypoints
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);

  // Road closures
  const [roadClosures, setRoadClosures] = useState<LatLng[]>([]);
  const [closureMode, setClosureMode] = useState(false);

  // Sidebar collapse (mobile)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Day/night theme auto-switch
  useEffect(() => {
    const hour = new Date().getHours();
    const isDark = hour < 6 || hour >= 19;
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  useEffect(() => setMounted(true), []);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

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

  // Reverse geocode helper
  const reverseGeocode = useCallback(async (coords: LatLng): Promise<string> => {
    try {
      const res = await fetch(
        `/api/geocode?lat=${coords[0]}&lng=${coords[1]}`,
      );
      if (res.ok) {
        const data = await res.json();
        return data.name || `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
      }
    } catch { /* ignore */ }
    return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  }, []);

  const handlePick = useCallback(
    async (p: LatLng, currentMode: "source" | "destination") => {
      // If in closure mode, add a road closure instead
      if (closureMode) {
        setRoadClosures((prev) => [...prev, p]);
        toast.success("Road closure added", {
          description: `${p[0].toFixed(4)}, ${p[1].toFixed(4)}`,
        });
        return;
      }

      console.debug("[Index] handlePick: mode =", currentMode, "| coords =", p);
      if (currentMode === "source") {
        setSource(p);
        setPicking("destination");
        const name = await reverseGeocode(p);
        setSourceName(name);
        toast.success("Source set", { description: name });
      } else {
        setDestination(p);
        setPicking("source");
        const name = await reverseGeocode(p);
        setDestinationName(name);
        toast.success("Destination set", { description: name });
      }
    },
    [closureMode, reverseGeocode],
  );

  // Draggable marker handlers
  const handleSourceDrag = useCallback(
    async (p: LatLng) => {
      setSource(p);
      const name = await reverseGeocode(p);
      setSourceName(name);
      toast.info("Source moved", { description: name });
    },
    [reverseGeocode],
  );

  const handleDestDrag = useCallback(
    async (p: LatLng) => {
      setDestination(p);
      const name = await reverseGeocode(p);
      setDestinationName(name);
      toast.info("Destination moved", { description: name });
    },
    [reverseGeocode],
  );

  // Search handlers
  const handleSourceSearch = useCallback(
    (coords: LatLng, name: string) => {
      setSource(coords);
      setSourceName(name);
      setCenter(coords);
      setPicking("destination");
      toast.success("Source set", { description: name });
    },
    [],
  );

  const handleDestSearch = useCallback(
    (coords: LatLng, name: string) => {
      setDestination(coords);
      setDestinationName(name);
      setCenter(coords);
      setPicking("source");
      toast.success("Destination set", { description: name });
    },
    [],
  );

  // Swap source and destination
  const handleSwap = useCallback(() => {
    const tmpCoords = source;
    const tmpName = sourceName;
    setSource(destination);
    setSourceName(destinationName);
    setDestination(tmpCoords);
    setDestinationName(tmpName);
    toast.info("Source & destination swapped");
  }, [source, destination, sourceName, destinationName]);

  // Multi-stop waypoint handlers
  const handleAddWaypoint = useCallback(() => {
    if (!source) {
      toast.error("Set a source first, then click the map to add a stop");
      return;
    }
    // Add a waypoint midway between source and destination (or near source)
    if (destination) {
      const midLat = (source[0] + destination[0]) / 2 + (Math.random() - 0.5) * 0.01;
      const midLng = (source[1] + destination[1]) / 2 + (Math.random() - 0.5) * 0.01;
      setWaypoints((prev) => [...prev, [midLat, midLng]]);
    } else {
      setWaypoints((prev) => [
        ...prev,
        [source[0] + 0.005, source[1] + 0.005],
      ]);
    }
    toast.info("Waypoint added — drag it on the map");
  }, [source, destination]);

  const handleRemoveWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleWaypointDrag = useCallback((index: number, p: LatLng) => {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? p : wp)));
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
        setSource(p);
        setCenter(p);
        setPicking("destination");
        const name = await reverseGeocode(p);
        setSourceName(name);
        toast.success("Using your location as source", { description: name });
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
    setSourceName("");
    setDestinationName("");
    setWaypoints([]);
    setRoadClosures([]);
    setClosureMode(false);
  };

  const onFindRoute = async () => {
    if (!source) {
      toast.error("Source missing", { description: "Click the map or search for a source point." });
      return;
    }
    if (!destination) {
      toast.error("Destination missing", { description: "Click the map or search for a destination point." });
      return;
    }
    console.debug("[Index] onFindRoute → source:", source, "| destination:", destination);
    setLoading(true);

    // Expand sidebar on mobile to show results
    if (isMobile) setSidebarCollapsed(false);

    try {
      const effectiveRouteType = emergency ? "emergency" : routeType;
      const [r, alt] = await Promise.all([
        findRoute(source, destination, trafficWeight, {
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          routeType: effectiveRouteType,
          roadClosures: roadClosures.length > 0 ? roadClosures : undefined,
        }),
        fetchAlternates(source, destination),
      ]);
      setRoute(r);
      setAlternates(alt.routes);
      const engine = r.routingEngine === "osrm" ? "OSRM Roads" : "A* Grid";
      toast.success("Route ready", {
        description: `${r.distanceKm} km · ${r.etaMinutes} min · ${engine}${r.fuel ? ` · ⛽${r.fuel.litres}L` : ""}`,
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
      <div className={`mx-auto grid h-[calc(100vh-3rem)] max-w-[1500px] gap-4 ${
        sidebarCollapsed
          ? "grid-cols-[60px_1fr]"
          : "grid-cols-1 md:grid-cols-[380px_1fr]"
      }`}>
        <div className="flex flex-col gap-4 overflow-y-auto sidebar-scrollable">
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
            sourceName={sourceName}
            destinationName={destinationName}
            onSourceSearch={handleSourceSearch}
            onDestinationSearch={handleDestSearch}
            onSwap={handleSwap}
            routeType={routeType}
            onRouteTypeChange={setRouteType}
            waypoints={waypoints}
            onAddWaypoint={handleAddWaypoint}
            onRemoveWaypoint={handleRemoveWaypoint}
            roadClosures={roadClosures}
            onToggleClosureMode={() => setClosureMode(!closureMode)}
            closureMode={closureMode}
            onClearClosures={() => {
              setRoadClosures([]);
              setClosureMode(false);
            }}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          {!sidebarCollapsed && (
            <RoutePanel route={route} alternates={alternates} emergency={emergency} />
          )}
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
                picking={picking}
                onSourceDrag={handleSourceDrag}
                onDestinationDrag={handleDestDrag}
                waypoints={waypoints}
                onWaypointDrag={handleWaypointDrag}
                roadClosures={roadClosures}
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
              <div className="glass-strong rounded-full px-4 py-2 text-sm flex items-center gap-2">
                <span className="loading-dot" />
                <span className="loading-dot" style={{ animationDelay: "0.15s" }} />
                <span className="loading-dot" style={{ animationDelay: "0.3s" }} />
                Computing road route…
              </div>
            </div>
          )}

          {/* Mobile toggle button */}
          {isMobile && sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute left-4 top-4 z-[500] glass-strong rounded-xl px-3 py-2 text-xs font-medium"
            >
              ☰ Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="loading-dot" />
        <span className="loading-dot" style={{ animationDelay: "0.15s" }} />
        <span className="loading-dot" style={{ animationDelay: "0.3s" }} />
        Loading map…
      </div>
    </div>
  );
}
