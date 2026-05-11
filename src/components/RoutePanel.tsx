// Route information + alternates panel.
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Gauge, Map as MapIcon, Activity, Layers } from "lucide-react";
import type { RouteResponse, AlternateRoute } from "@/services/routing";

interface Props {
  route: RouteResponse | null;
  alternates: AlternateRoute[];
  emergency: boolean;
}

function trafficLabel(score: number) {
  if (score < 0.33) return { label: "Light", color: "var(--color-traffic-low)" };
  if (score < 0.66)
    return { label: "Moderate", color: "var(--color-traffic-med)" };
  return { label: "Heavy", color: "var(--color-traffic-high)" };
}

export default function RoutePanel({ route, alternates, emergency }: Props) {
  return (
    <AnimatePresence mode="wait">
      {route ? (
        <motion.div
          key="route"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="glass-strong space-y-4 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Optimal Route
            </h2>
            <span
              className="chip"
              style={{
                background: trafficLabel(route.trafficScore).color + "33",
                borderColor: trafficLabel(route.trafficScore).color,
                color: trafficLabel(route.trafficScore).color,
              }}
            >
              {trafficLabel(route.trafficScore).label} traffic
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<MapIcon className="h-4 w-4" />}
              label="Distance"
              value={`${route.distanceKm} km`}
            />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="ETA"
              value={`${
                emergency ? Math.max(1, Math.round(route.etaMinutes * 0.6)) : route.etaMinutes
              } min`}
              hint={emergency ? "Emergency mode" : undefined}
            />
            <Stat
              icon={<Activity className="h-4 w-4" />}
              label="Traffic score"
              value={`${(route.trafficScore * 100).toFixed(0)}%`}
            />
            <Stat
              icon={<Gauge className="h-4 w-4" />}
              label="Nodes explored"
              value={`${route.nodesExplored}`}
            />
          </div>

          {alternates.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> Alternate routes
              </h3>
              <div className="space-y-2">
                {alternates.map((alt) => (
                  <div
                    key={alt.label}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs"
                  >
                    <span className="font-medium">{alt.label}</span>
                    <span className="text-muted-foreground">
                      {alt.distanceKm} km · {alt.etaMinutes} min ·{" "}
                      {(alt.trafficScore * 100).toFixed(0)}% traffic
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-5 text-sm text-muted-foreground"
        >
          Pick a source and destination on the map, then run the A* search to
          see distance, ETA, traffic score and the nodes explored.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-accent">{hint}</div>}
    </div>
  );
}
