// Graph & grid utilities for the Smart Route Optimizer.
// We build a uniform lat/lng grid bounding the source and destination,
// connect each cell to its 8 neighbours, and use this as the search space.

export type LatLng = [number, number]; // [lat, lng]

export interface GridNode {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
}

export interface Grid {
  rows: number;
  cols: number;
  nodes: GridNode[][];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  cellLat: number;
  cellLng: number;
}

// Haversine distance (km).
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Build a grid that comfortably contains source & destination.
export function buildGrid(source: LatLng, destination: LatLng, size = 22): Grid {
  const padLat = Math.abs(source[0] - destination[0]) * 0.35 + 0.005;
  const padLng = Math.abs(source[1] - destination[1]) * 0.35 + 0.005;
  const minLat = Math.min(source[0], destination[0]) - padLat;
  const maxLat = Math.max(source[0], destination[0]) + padLat;
  const minLng = Math.min(source[1], destination[1]) - padLng;
  const maxLng = Math.max(source[1], destination[1]) + padLng;

  const rows = size;
  const cols = size;
  const cellLat = (maxLat - minLat) / (rows - 1);
  const cellLng = (maxLng - minLng) / (cols - 1);

  const nodes: GridNode[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: GridNode[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        id: `${r}_${c}`,
        row: r,
        col: c,
        lat: minLat + r * cellLat,
        lng: minLng + c * cellLng,
      });
    }
    nodes.push(row);
  }

  return { rows, cols, nodes, minLat, maxLat, minLng, maxLng, cellLat, cellLng };
}

export function nearestNode(grid: Grid, point: LatLng): GridNode {
  const r = Math.round((point[0] - grid.minLat) / grid.cellLat);
  const c = Math.round((point[1] - grid.minLng) / grid.cellLng);
  const rr = Math.max(0, Math.min(grid.rows - 1, r));
  const cc = Math.max(0, Math.min(grid.cols - 1, c));
  return grid.nodes[rr][cc];
}

// 8-direction neighbours.
export function neighbours(grid: Grid, node: GridNode): GridNode[] {
  const out: GridNode[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = node.row + dr;
      const nc = node.col + dc;
      if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;
      out.push(grid.nodes[nr][nc]);
    }
  }
  return out;
}
