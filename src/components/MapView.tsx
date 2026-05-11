// Interactive Leaflet map. Client-only — guard parent renders with mounted state.
import { useEffect, useMemo } from "react";
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
const icon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};
      border:3px solid white;
      box-shadow:0 0 0 2px ${color}55, 0 0 12px ${color};
      animation: pulse-soft 1.8s ease-in-out infinite;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

function ClickHandler({
  onClick,
}: {
  onClick: (latlng: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
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

export interface MapViewProps {
  source: LatLng | null;
  destination: LatLng | null;
  route: RouteResponse | null;
  alternates: AlternateRoute[];
  showExplored: boolean;
  trafficSamples: TrafficSample[];
  onPick: (p: LatLng) => void;
  center: LatLng;
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
  } = props;

  const fitPoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (source) pts.push(source);
    if (destination) pts.push(destination);
    if (route) pts.push(...route.coordinates);
    return pts;
  }, [source, destination, route]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="dark-tiles"
      />

      <ClickHandler onClick={onPick} />
      <FitBounds points={fitPoints} />

      {/* Traffic samples as faint colored dots */}
      {trafficSamples.map((t, i) => (
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
          </Tooltip>
        </Polyline>
      ))}

      {/* Primary path (animated) */}
      {route && (
        <Polyline
          positions={route.coordinates}
          pathOptions={{ color: "#22d3ee", weight: 6, opacity: 0.95 }}
          className="route-animated"
        />
      )}

      {source && <Marker position={source} icon={icon("#22d3ee")} />}
      {destination && <Marker position={destination} icon={icon("#f472b6")} />}
    </MapContainer>
  );
}
