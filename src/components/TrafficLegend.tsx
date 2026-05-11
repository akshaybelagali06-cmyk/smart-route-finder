// Floating traffic legend.
import { motion } from "framer-motion";

export default function TrafficLegend() {
  const items = [
    { c: "var(--color-traffic-low)", l: "Low" },
    { c: "var(--color-traffic-med)", l: "Medium" },
    { c: "var(--color-traffic-high)", l: "High" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass pointer-events-auto flex items-center gap-3 rounded-full px-3.5 py-2 text-xs"
    >
      <span className="font-medium text-muted-foreground">Traffic</span>
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: i.c, boxShadow: `0 0 8px ${i.c}` }}
          />
          {i.l}
        </span>
      ))}
    </motion.div>
  );
}
