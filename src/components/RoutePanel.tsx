// Route information + alternates panel.
// Extended with: fuel estimation, turn-by-turn, voice nav, route analytics.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Gauge,
  Map as MapIcon,
  Activity,
  Layers,
  Fuel,
  Zap,
  Navigation,
  Volume2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Cpu,
} from "lucide-react";
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
  const [showTurnByTurn, setShowTurnByTurn] = useState(false);
  const [showFuel, setShowFuel] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakInstruction = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const speakAll = () => {
    if (!route?.voiceInstructions?.length) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = route.voiceInstructions.join(". ");
    speakInstruction(text);
  };

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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Optimal Route
              </h2>
              {route.routingEngine && (
                <span className="chip text-[10px]" style={{ background: route.routingEngine === "osrm" ? "#22d3ee22" : "#a78bfa22", borderColor: route.routingEngine === "osrm" ? "#22d3ee" : "#a78bfa", color: route.routingEngine === "osrm" ? "#22d3ee" : "#a78bfa" }}>
                  <Cpu className="h-2.5 w-2.5" />
                  {route.routingEngine === "osrm" ? "OSRM" : "A*"}
                </span>
              )}
            </div>
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

          {/* Core stats */}
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
              label={route.routingEngine === "osrm" ? "Road segments" : "Nodes explored"}
              value={`${route.nodesExplored}`}
            />
          </div>

          {/* Fuel estimation */}
          {route.fuel && (
            <div>
              <button
                onClick={() => setShowFuel(!showFuel)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                <span className="flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5" /> Fuel & Energy Estimate
                </span>
                {showFuel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showFuel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Fuel className="h-3 w-3" /> Petrol
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{route.fuel.litres} L</div>
                    <div className="text-[10px] text-muted-foreground">≈ ₹{route.fuel.costINR}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Zap className="h-3 w-3" /> EV Battery
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{route.fuel.kwh} kWh</div>
                    <div className="text-[10px] text-muted-foreground">≈ ₹{route.fuel.evCostINR}</div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Voice navigation */}
          {route.voiceInstructions && route.voiceInstructions.length > 0 && (
            <button
              onClick={speakAll}
              className={`chip w-full justify-center transition ${isSpeaking ? "bg-primary/20 border-primary" : "hover:bg-secondary"}`}
            >
              <Volume2 className={`h-3.5 w-3.5 ${isSpeaking ? "animate-pulse" : ""}`} />
              {isSpeaking ? "Stop voice navigation" : "🎙 Start voice navigation"}
            </button>
          )}

          {/* Turn-by-turn */}
          {route.turnByTurn && route.turnByTurn.length > 0 && (
            <div>
              <button
                onClick={() => setShowTurnByTurn(!showTurnByTurn)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                <span className="flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5" /> Turn-by-turn ({route.turnByTurn.length} steps)
                </span>
                {showTurnByTurn ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showTurnByTurn && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-2 max-h-40 space-y-1 overflow-y-auto"
                >
                  {route.turnByTurn.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground capitalize">{step.instruction}</div>
                        <div className="text-muted-foreground">
                          {step.distance >= 1000
                            ? `${(step.distance / 1000).toFixed(1)} km`
                            : `${step.distance} m`}
                          {" · "}
                          {Math.round(step.duration / 60)} min
                        </div>
                      </div>
                      <button
                        onClick={() => speakInstruction(step.instruction)}
                        className="shrink-0 p-0.5 hover:text-primary transition"
                        title="Speak this step"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          )}

          {/* Route analytics mini-chart */}
          {route.pathTraffic && route.pathTraffic.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" /> Traffic Along Route
              </div>
              <div className="flex items-end gap-[2px] rounded-lg border border-border/60 bg-muted/20 p-2" style={{ height: 48 }}>
                {route.pathTraffic.map((t, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(10, t.density * 100)}%`,
                      backgroundColor: t.color,
                      opacity: 0.7,
                    }}
                    title={`${t.level}: ${(t.density * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Alternate routes */}
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
                    <div>
                      <span className="font-medium">{alt.label}</span>
                      {alt.routingEngine && (
                        <span className="ml-1.5 text-[9px] text-muted-foreground">
                          ({alt.routingEngine === "osrm" ? "Road" : "Grid"})
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {alt.distanceKm} km · {alt.etaMinutes} min ·{" "}
                      {(alt.trafficScore * 100).toFixed(0)}% traffic
                      {alt.fuel && ` · ⛽${alt.fuel.litres}L`}
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
          Pick a source and destination on the map or search for places, then
          run the route search to see distance, ETA, fuel estimate, traffic
          score, and turn-by-turn navigation.
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
