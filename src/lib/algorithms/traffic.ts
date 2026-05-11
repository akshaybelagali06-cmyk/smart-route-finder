// Simulated traffic system. Each grid cell gets a traffic density value
// in [0, 1] that changes over time. We use a deterministic noise function
// seeded by the current "time bucket" so all clients see the same map
// for a few seconds at a time.

import type { Grid, GridNode } from "./graph";

export type TrafficLevel = "low" | "medium" | "high";

export interface TrafficCell {
  density: number; // 0..1
  level: TrafficLevel;
  color: string;
}

// Cheap pseudo-random hash → [0, 1).
function hash(x: number, y: number, t: number): number {
  let h = x * 374761393 + y * 668265263 + t * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

export function trafficBucket(): number {
  // Updates roughly every 8 seconds — "live" but stable enough to plan a route.
  return Math.floor(Date.now() / 8000);
}

export function levelFor(density: number): TrafficLevel {
  if (density < 0.33) return "low";
  if (density < 0.66) return "medium";
  return "high";
}

export function colorFor(level: TrafficLevel): string {
  return level === "low" ? "#22c55e" : level === "medium" ? "#eab308" : "#ef4444";
}

export function trafficForNode(node: GridNode, bucket: number): TrafficCell {
  // Mix two octaves so adjacent cells correlate (smoother roads).
  const a = hash(node.row, node.col, bucket);
  const b = hash(Math.floor(node.row / 2), Math.floor(node.col / 2), bucket);
  const density = Math.min(1, a * 0.55 + b * 0.55);
  const level = levelFor(density);
  return { density, level, color: colorFor(level) };
}

export function buildTrafficMap(grid: Grid, bucket = trafficBucket()) {
  const map = new Map<string, TrafficCell>();
  for (const row of grid.nodes) {
    for (const n of row) map.set(n.id, trafficForNode(n, bucket));
  }
  return map;
}
