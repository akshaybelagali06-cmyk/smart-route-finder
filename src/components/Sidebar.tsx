// Sidebar with controls for Smart Route Optimizer.
// Extended with: search input, swap, route type selector, multi-stop, road closures.
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crosshair,
  MapPin,
  Navigation2,
  RotateCcw,
  Route as RouteIcon,
  Sparkles,
  Eye,
  EyeOff,
  ArrowUpDown,
  Plus,
  X,
  AlertTriangle,
  Fuel,
  Zap,
  Shield,
  Timer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LatLng } from "@/lib/algorithms/graph";
import type { RouteType } from "@/services/routing";
import SearchInput from "./SearchInput";

interface Props {
  source: LatLng | null;
  destination: LatLng | null;
  picking: "source" | "destination";
  onPickMode: (m: "source" | "destination") => void;
  onUseMyLocation: () => void;
  onReset: () => void;
  onFindRoute: () => void;
  loading: boolean;
  trafficWeight: number;
  setTrafficWeight: (n: number) => void;
  showExplored: boolean;
  setShowExplored: (v: boolean) => void;
  emergency: boolean;
  setEmergency: (v: boolean) => void;
  // New props
  sourceName: string;
  destinationName: string;
  onSourceSearch: (coords: LatLng, name: string) => void;
  onDestinationSearch: (coords: LatLng, name: string) => void;
  onSwap: () => void;
  routeType: RouteType;
  onRouteTypeChange: (t: RouteType) => void;
  waypoints: LatLng[];
  onAddWaypoint: () => void;
  onRemoveWaypoint: (index: number) => void;
  roadClosures: LatLng[];
  onToggleClosureMode: () => void;
  closureMode: boolean;
  onClearClosures: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const fmt = (p: LatLng | null) =>
  p ? `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` : "—";

const routeTypes: { value: RouteType; label: string; icon: typeof Timer; desc: string }[] = [
  { value: "fastest", label: "Fastest", icon: Timer, desc: "Minimum travel time" },
  { value: "shortest", label: "Shortest", icon: RouteIcon, desc: "Minimum distance" },
  { value: "least_traffic", label: "Low Traffic", icon: Shield, desc: "Avoid congestion" },
  { value: "emergency", label: "Emergency", icon: Zap, desc: "Priority routing" },
  { value: "fuel_efficient", label: "Eco", icon: Fuel, desc: "Save fuel" },
];

export default function Sidebar(p: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (p.sidebarCollapsed) {
    return (
      <motion.aside
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="glass-strong flex flex-col items-center gap-3 rounded-2xl p-3"
      >
        <button
          onClick={p.onToggleSidebar}
          className="rounded-lg p-2 hover:bg-secondary transition"
          title="Expand sidebar"
        >
          <Navigation2 className="h-5 w-5 text-primary" />
        </button>
        <button
          onClick={() => p.onPickMode("source")}
          className={`rounded-lg p-2 transition ${p.picking === "source" ? "bg-primary/20" : "hover:bg-secondary"}`}
          title="Set source"
        >
          <MapPin className="h-4 w-4" style={{ color: "#22d3ee" }} />
        </button>
        <button
          onClick={() => p.onPickMode("destination")}
          className={`rounded-lg p-2 transition ${p.picking === "destination" ? "bg-primary/20" : "hover:bg-secondary"}`}
          title="Set destination"
        >
          <MapPin className="h-4 w-4" style={{ color: "#f472b6" }} />
        </button>
        <button onClick={p.onFindRoute} disabled={p.loading} className="rounded-lg p-2 hover:bg-secondary transition" title="Find route">
          <RouteIcon className="h-4 w-4 text-primary" />
        </button>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-strong flex flex-col gap-4 rounded-2xl p-5 sidebar-scrollable"
    >
      <header className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Navigation2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">
            <span className="text-gradient">Smart Route</span> Optimizer
          </h1>
          <p className="text-xs text-muted-foreground">
            OSRM road routing · A* fallback · Live traffic
          </p>
        </div>
        <button
          onClick={p.onToggleSidebar}
          className="rounded-lg p-1.5 hover:bg-secondary transition md:hidden"
          title="Collapse"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Search inputs */}
      <div className="space-y-2">
        <SearchInput
          label="Source"
          value={p.sourceName || fmt(p.source)}
          onSelect={p.onSourceSearch}
          onClear={() => p.onPickMode("source")}
          accentColor="#22d3ee"
          placeholder="Search source location..."
        />
        <div className="flex justify-center">
          <button
            onClick={p.onSwap}
            className="rounded-full border border-border p-1.5 transition hover:bg-secondary hover:border-primary/40 active:scale-90"
            title="Swap source & destination"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <SearchInput
          label="Destination"
          value={p.destinationName || fmt(p.destination)}
          onSelect={p.onDestinationSearch}
          onClear={() => p.onPickMode("destination")}
          accentColor="#f472b6"
          placeholder="Search destination..."
        />
      </div>

      {/* Map pick mode selector */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={() => p.onPickMode("source")}
          className={`rounded-lg border px-3 py-2 transition ${
            p.picking === "source"
              ? "border-primary bg-primary/15"
              : "border-border hover:bg-secondary"
          }`}
        >
          <div className="flex items-center gap-1 font-medium">
            <MapPin className="h-3.5 w-3.5" /> Source
          </div>
          <div className="mt-1 truncate text-muted-foreground">
            {fmt(p.source)}
          </div>
        </button>
        <button
          onClick={() => p.onPickMode("destination")}
          className={`rounded-lg border px-3 py-2 transition ${
            p.picking === "destination"
              ? "border-primary bg-primary/15"
              : "border-border hover:bg-secondary"
          }`}
        >
          <div className="flex items-center gap-1 font-medium">
            <MapPin className="h-3.5 w-3.5" /> Destination
          </div>
          <div className="mt-1 truncate text-muted-foreground">
            {fmt(p.destination)}
          </div>
        </button>
      </div>

      {/* Route type selector */}
      <div className="space-y-2">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Route Type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {routeTypes.map((rt) => {
            const Icon = rt.icon;
            const active = p.routeType === rt.value;
            return (
              <button
                key={rt.value}
                onClick={() => p.onRouteTypeChange(rt.value)}
                className={`chip transition ${active ? "bg-primary/20 border-primary text-foreground" : "hover:bg-secondary"}`}
                title={rt.desc}
              >
                <Icon className="h-3 w-3" />
                {rt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={p.onUseMyLocation}
          className="chip hover:bg-secondary"
          type="button"
        >
          <Crosshair className="h-3.5 w-3.5" /> My location
        </button>
        <button
          onClick={p.onReset}
          className="chip hover:bg-secondary"
          type="button"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button
          onClick={p.onSwap}
          className="chip hover:bg-secondary"
          type="button"
        >
          <ArrowUpDown className="h-3.5 w-3.5" /> Swap
        </button>
      </div>

      {/* Advanced controls toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition"
      >
        <span>Advanced Controls</span>
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {showAdvanced && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="space-y-3"
        >
          {/* Traffic priority slider */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Traffic priority
              <span className="ml-2 text-foreground">
                {p.trafficWeight === 0
                  ? "Ignore"
                  : p.trafficWeight < 1.5
                    ? "Balanced"
                    : "Avoid jams"}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={3}
              step={0.5}
              value={p.trafficWeight}
              onChange={(e) => p.setTrafficWeight(parseFloat(e.target.value))}
              className="w-full accent-[oklch(0.72_0.18_220)]"
            />
          </div>

          {/* Show explored + emergency */}
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => p.setShowExplored(!p.showExplored)}
              className="chip hover:bg-secondary"
              type="button"
            >
              {p.showExplored ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hide explored
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Show explored
                </>
              )}
            </button>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={p.emergency}
                onChange={(e) => p.setEmergency(e.target.checked)}
                className="accent-[oklch(0.72_0.18_220)]"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Emergency
              </span>
            </label>
          </div>

          {/* Multi-stop waypoints */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Multi-stop Routing
              </label>
              <button
                onClick={p.onAddWaypoint}
                className="chip hover:bg-secondary text-[10px]"
                type="button"
              >
                <Plus className="h-3 w-3" /> Add stop
              </button>
            </div>
            {p.waypoints.length > 0 && (
              <div className="space-y-1">
                {p.waypoints.map((wp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px]"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#a78bfa]/20 text-[9px] font-bold text-[#a78bfa]">
                        {i + 1}
                      </span>
                      {fmt(wp)}
                    </span>
                    <button onClick={() => p.onRemoveWaypoint(i)}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Road closure simulation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Road Closures
              </label>
              <div className="flex gap-1">
                <button
                  onClick={p.onToggleClosureMode}
                  className={`chip text-[10px] transition ${p.closureMode ? "bg-destructive/20 border-destructive text-destructive" : "hover:bg-secondary"}`}
                  type="button"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {p.closureMode ? "Placing..." : "Add closure"}
                </button>
                {p.roadClosures.length > 0 && (
                  <button
                    onClick={p.onClearClosures}
                    className="chip hover:bg-secondary text-[10px]"
                    type="button"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
            {p.roadClosures.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                {p.roadClosures.length} closure{p.roadClosures.length > 1 ? "s" : ""} active — route will avoid these
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Find route button */}
      <button
        onClick={p.onFindRoute}
        disabled={p.loading}
        className="btn-primary flex items-center justify-center gap-2"
      >
        <RouteIcon className="h-4 w-4" />
        {p.loading ? "Calculating…" : "Find Optimal Route"}
      </button>

      <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        Search for places above or click on the map to set your{" "}
        <span className="text-foreground">{p.picking}</span>. Drag markers to
        adjust. Routes follow real roads via OSRM.
      </p>
    </motion.aside>
  );
}
