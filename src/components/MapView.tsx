// Interactive Leaflet map. Client-only — guard parent renders with mounted state.
// Extended with: draggable markers, traffic heatmap, road closures, multi-stop.
import { useEffect, useMemo, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "@/lib/algorithms/graph";
import type { RouteResponse, AlternateRoute, TrafficSample } from "@/services/routing";

// Fix default marker icons (leaflet expects bundler-served assets).
const icon = (color: string, size = 18) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:3px solid white;
      box-shadow:0 0 0 2px ${color}55, 0 0 12px ${color};
      animation: pulse-soft 1.8s ease-in-out infinite;
      cursor: grab;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const waypointIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#a78bfa;
    border:2px solid white;
    box-shadow:0 0 0 2px #a78bfa55, 0 0 8px #a78bfa;
    cursor: grab;
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const closureIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:16px;height:16px;border-radius:4px;
    background:#ef4444;
    border:2px solid white;
    box-shadow:0 0 8px #ef444488;
    display:flex;align-items:center;justify-content:center;
    font-size:10px;color:white;font-weight:bold;
  ">✕</div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickHandler({
  onClick,
  mode,
}: {
  onClick: (latlng: LatLng, mode: "source" | "destination") => void;
  mode: "source" | "destination";
}) {
  // Store the latest callback in a ref so the useMapEvents handler (registered
  // once at mount) never captures a stale closure — this was the root cause of
  // destination never being set after `picking` state changed.
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      console.debug("[MapView] click →", lat, lng, "mode:", mode);
      onClickRef.current([lat, lng], mode);
    },
  });
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const b = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(b, { padding: [60, 60], maxZoom: 14 });
  }, [points, map]);
  return null;
}

// Draggable marker component
function DraggableMarker({
  position,
  icon: markerIcon,
  onDragEnd,
  tooltipText,
}: {
  position: LatLng;
  icon: L.DivIcon;
  onDragEnd: (pos: LatLng) => void;
  tooltipText?: string;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          onDragEnd([lat, lng]);
        }
      },
    }),
    [onDragEnd],
  );

  return (
    <Marker
      position={position}
      icon={markerIcon}
      draggable
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      {tooltipText && <Tooltip direction="top" offset={[0, -12]}>{tooltipText}</Tooltip>}
    </Marker>
  );
}

export interface MapViewProps {
  source: LatLng | null;
  destination: LatLng | null;
  route: RouteResponse | null;
  alternates: AlternateRoute[];
  showExplored: boolean;
  trafficSamples: TrafficSample[];
  onPick: (p: LatLng, mode: "source" | "destination") => void;
  center: LatLng;
  picking: "source" | "destination";
  onSourceDrag?: (p: LatLng) => void;
  onDestinationDrag?: (p: LatLng) => void;
  waypoints?: LatLng[];
  onWaypointDrag?: (index: number, p: LatLng) => void;
  roadClosures?: LatLng[];
  showTrafficHeatmap?: boolean;
}

export default function MapView(props: MapViewProps) {
  const {
    source,
    destination,
    route,
    alternates,
    showExplored,
    trafficSamples,
    onPick,
    center,
    picking,
    onSourceDrag,
    onDestinationDrag,
    waypoints = [],
    onWaypointDrag,
    roadClosures = [],
    showTrafficHeatmap = true,
  } = props;

  const fitPoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (source) pts.push(source);
    if (destination) pts.push(destination);
    if (route) pts.push(...route.coordinates);
    return pts;
  }, [source, destination, route]);

  const pickColor = picking === "source" ? "#22d3ee" : "#f472b6";
  const pickLabel = picking === "source" ? "Click to set Source" : "Click to set Destination";

  const handleSourceDrag = useCallback(
    (p: LatLng) => onSourceDrag?.(p),
    [onSourceDrag],
  );
  const handleDestDrag = useCallback(
    (p: LatLng) => onDestinationDrag?.(p),
    [onDestinationDrag],
  );

  // Determine route color based on routing engine
  const routeColor = route?.routingEngine === "osrm" ? "#22d3ee" : "#a78bfa";

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
      // cursor style changes based on pick mode
      style={{ cursor: "crosshair" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="dark-tiles"
      />

      {/* Pick-mode hint banner rendered inside the map container */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          pointerEvents: "none",
          background: `${pickColor}22`,
          border: `1px solid ${pickColor}88`,
          borderRadius: 8,
          padding: "4px 14px",
          fontSize: 12,
          color: pickColor,
          fontWeight: 600,
          backdropFilter: "blur(6px)",
          whiteSpace: "nowrap",
        }}
      >
        {pickLabel}
        {route?.routingEngine && (
          <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 10 }}>
            via {route.routingEngine === "osrm" ? "OSRM Roads" : "A* Grid"}
          </span>
        )}
      </div>

      <ClickHandler onClick={onPick} mode={picking} />
      <FitBounds points={fitPoints} />

      {/* Traffic heatmap - show colored dots along roads */}
      {showTrafficHeatmap &&
        trafficSamples.map((t, i) => (
          <CircleMarker
            key={`t-${i}`}
            center={[t.lat, t.lng]}
            radius={4}
            pathOptions={{
              color: t.color,
              fillColor: t.color,
              fillOpacity: 0.25,
              weight: 0,
            }}
          />
        ))}

      {/* Route-based traffic heatmap (road-segment coloring) */}
      {route?.pathTraffic &&
        route.pathTraffic.map((t, i) => (
          <CircleMarker
            key={`pt-${i}`}
            center={[t.lat, t.lng]}
            radius={6}
            pathOptions={{
              color: t.color,
              fillColor: t.color,
              fillOpacity: 0.4,
              weight: 1,
            }}
          >
            <Tooltip>
              Traffic: {t.level} ({(t.density * 100).toFixed(0)}%)
            </Tooltip>
          </CircleMarker>
        ))}

      {/* Explored nodes */}
      {showExplored &&
        route?.explored.map((p, i) => (
          <CircleMarker
            key={`e-${i}`}
            center={p}
            radius={2}
            pathOptions={{ color: "#a78bfa", fillOpacity: 0.55, weight: 0 }}
          />
        ))}

      {/* Alternate routes */}
      {alternates.map((alt, i) => (
        <Polyline
          key={`alt-${i}`}
          positions={alt.coordinates}
          pathOptions={{
            color: i === 0 ? "#60a5fa" : i === 1 ? "#34d399" : "#f472b6",
            weight: 4,
            opacity: 0.45,
            dashArray: "6 8",
          }}
        >
          <Tooltip sticky>
            {alt.label} • {alt.distanceKm} km • {alt.etaMinutes} min
            {alt.fuel && ` • ⛽ ${alt.fuel.litres}L`}
          </Tooltip>
        </Polyline>
      ))}

      {/* Primary path (animated, road-snapped) */}
      {route && (
        <Polyline
          positions={route.coordinates}
          pathOptions={{ color: routeColor, weight: 6, opacity: 0.95 }}
          className="route-animated"
        >
          <Tooltip sticky>
            {route.distanceKm} km • {route.etaMinutes} min
            {route.fuel && ` • ⛽ ${route.fuel.litres}L`}
            {route.routingEngine && ` • ${route.routingEngine}`}
          </Tooltip>
        </Polyline>
      )}

      {/* Road closures */}
      {roadClosures.map((c, i) => (
        <Marker key={`closure-${i}`} position={c} icon={closureIcon}>
          <Tooltip>Road Closure #{i + 1}</Tooltip>
        </Marker>
      ))}

      {/* Multi-stop waypoints */}
      {waypoints.map((w, i) => (
        <DraggableMarker
          key={`wp-${i}`}
          position={w}
          icon={waypointIcon}
          onDragEnd={(p) => onWaypointDrag?.(i, p)}
          tooltipText={`Stop ${i + 1}`}
        />
      ))}

      {/* Draggable source marker */}
      {source && (
        <DraggableMarker
          position={source}
          icon={icon("#22d3ee")}
          onDragEnd={handleSourceDrag}
          tooltipText="Source — drag to move"
        />
      )}

      {/* Draggable destination marker */}
      {destination && (
        <DraggableMarker
          position={destination}
          icon={icon("#f472b6")}
          onDragEnd={handleDestDrag}
          tooltipText="Destination — drag to move"
        />
      )}
    </MapContainer>
  );
}
