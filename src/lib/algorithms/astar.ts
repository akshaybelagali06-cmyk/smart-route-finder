// Manual A* implementation on top of the lat/lng grid graph.
//   f(n) = g(n) + h(n)
//   g(n) = actual cost (distance + traffic weight) from start
//   h(n) = haversine heuristic to goal
//
// Returns the reconstructed path AND the explored nodes so the UI can
// visualise the search.

import {
  type Grid,
  type GridNode,
  type LatLng,
  haversine,
  neighbours,
} from "./graph";
import { type TrafficCell } from "./traffic";

export interface AStarOptions {
  // Higher = traffic matters more. 0 = ignore traffic (shortest distance).
  trafficWeight?: number;
}

export interface AStarResult {
  path: GridNode[];
  coordinates: LatLng[];
  explored: LatLng[];
  distanceKm: number;
  trafficScore: number; // average density 0..1 along the path
  cost: number;
}

interface QItem {
  node: GridNode;
  f: number;
}

// Tiny binary-heap priority queue (min by f).
class PQ {
  private h: QItem[] = [];
  push(item: QItem) {
    this.h.push(item);
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].f <= this.h[i].f) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  pop(): QItem | undefined {
    if (!this.h.length) return undefined;
    const top = this.h[0];
    const last = this.h.pop()!;
    if (this.h.length) {
      this.h[0] = last;
      let i = 0;
      const n = this.h.length;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < n && this.h[l].f < this.h[s].f) s = l;
        if (r < n && this.h[r].f < this.h[s].f) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
        i = s;
      }
    }
    return top;
  }
  get size() {
    return this.h.length;
  }
}

export function aStar(
  grid: Grid,
  start: GridNode,
  goal: GridNode,
  traffic: Map<string, TrafficCell>,
  options: AStarOptions = {},
): AStarResult | null {
  const trafficWeight = options.trafficWeight ?? 1;
  const goalLatLng: LatLng = [goal.lat, goal.lng];

  const open = new PQ();
  const openSet = new Set<string>();
  const closed = new Set<string>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, GridNode>();
  const explored: LatLng[] = [];

  gScore.set(start.id, 0);
  open.push({ node: start, f: haversine([start.lat, start.lng], goalLatLng) });
  openSet.add(start.id);

  while (open.size) {
    const current = open.pop()!.node;
    if (closed.has(current.id)) continue;
    openSet.delete(current.id);
    closed.add(current.id);
    explored.push([current.lat, current.lng]);

    if (current.id === goal.id) {
      // Reconstruct path.
      const path: GridNode[] = [current];
      let c: GridNode | undefined = current;
      while ((c = cameFrom.get(c!.id))) path.unshift(c);

      let distanceKm = 0;
      let densitySum = 0;
      for (let i = 0; i < path.length; i++) {
        if (i > 0) {
          distanceKm += haversine(
            [path[i - 1].lat, path[i - 1].lng],
            [path[i].lat, path[i].lng],
          );
        }
        densitySum += traffic.get(path[i].id)?.density ?? 0;
      }

      return {
        path,
        coordinates: path.map((n) => [n.lat, n.lng] as LatLng),
        explored,
        distanceKm,
        trafficScore: densitySum / path.length,
        cost: gScore.get(current.id) ?? 0,
      };
    }

    for (const nb of neighbours(grid, current)) {
      if (closed.has(nb.id)) continue;
      const stepDist = haversine([current.lat, current.lng], [nb.lat, nb.lng]);
      const t = traffic.get(nb.id)?.density ?? 0;
      // cost = distance + trafficWeight * (distance * trafficDensity)
      const stepCost = stepDist + trafficWeight * stepDist * t * 3;
      const tentative = (gScore.get(current.id) ?? Infinity) + stepCost;
      if (tentative < (gScore.get(nb.id) ?? Infinity)) {
        cameFrom.set(nb.id, current);
        gScore.set(nb.id, tentative);
        const f = tentative + haversine([nb.lat, nb.lng], goalLatLng);
        open.push({ node: nb, f });
        openSet.add(nb.id);
      }
    }
  }
  return null;
}
