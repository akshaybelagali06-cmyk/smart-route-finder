// Sidebar with controls for Smart Route Optimizer.
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
} from "lucide-react";
import type { LatLng } from "@/lib/algorithms/graph";

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
}

const fmt = (p: LatLng | null) =>
  p ? `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` : "—";

export default function Sidebar(p: Props) {
  return (
    <motion.aside
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-strong flex flex-col gap-5 rounded-2xl p-5"
    >
      <header className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Navigation2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">
            <span className="text-gradient">Smart Route</span> Optimizer
          </h1>
          <p className="text-xs text-muted-foreground">
            A* pathfinding · Live traffic
          </p>
        </div>
      </header>

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
      </div>

      <div className="space-y-3">
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
      </div>

      <button
        onClick={p.onFindRoute}
        disabled={!p.source || !p.destination || p.loading}
        className="btn-primary flex items-center justify-center gap-2"
      >
        <RouteIcon className="h-4 w-4" />
        {p.loading ? "Calculating…" : "Find Optimal Route"}
      </button>

      <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        Click anywhere on the map to set your{" "}
        <span className="text-foreground">{p.picking}</span>. Switch the chip
        above to set the other point.
      </p>
    </motion.aside>
  );
}
