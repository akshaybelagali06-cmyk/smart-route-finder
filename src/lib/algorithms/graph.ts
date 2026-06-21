// Complete graph.ts implementation
export type LatLng = [number, number];

export interface GridNode {
  id: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface Grid {
  nodes: GridNode[][];
  width: number;
  height: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Haversine distance between two points in km
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Bearing calculation function
export function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = toDeg(Math.atan2(y, x));
  return (deg + 360) % 360;
}

// Smallest difference between two bearings, in degrees (0-180)
export function angleDifference(b1: number, b2: number): number {
  let diff = Math.abs(b1 - b2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Build grid between two points
export function buildGrid(source: LatLng, destination: LatLng, gridSize: number): Grid {
  const minLat = Math.min(source[0], destination[0]);
  const maxLat = Math.max(source[0], destination[0]);
  const minLng = Math.min(source[1], destination[1]);
  const maxLng = Math.max(source[1], destination[1]);
  
  const latStep = (maxLat - minLat) / (gridSize - 1);
  const lngStep = (maxLng - minLng) / (gridSize - 1);
  
  const nodes: GridNode[][] = [];
  
  for (let i = 0; i < gridSize; i++) {
    nodes[i] = [];
    const lat = minLat + i * latStep;
    for (let j = 0; j < gridSize; j++) {
      const lng = minLng + j * lngStep;
      nodes[i][j] = {
        id: `${i},${j}`,
        lat,
        lng,
        x: i,
        y: j,
      };
    }
  }
  
  return {
    nodes,
    width: gridSize,
    height: gridSize,
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

// Find nearest grid node to a point
export function nearestNode(grid: Grid, point: LatLng): GridNode {
  let minDist = Infinity;
  let nearest: GridNode | null = null;
  
  for (const row of grid.nodes) {
    for (const node of row) {
      const dist = Math.hypot(node.lat - point[0], node.lng - point[1]);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }
  }
  
  return nearest!;
}

// Get valid neighbors of a grid node
export function neighbours(grid: Grid, node: GridNode): GridNode[] {
  const neighbors: GridNode[] = [];
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (const [dx, dy] of directions) {
    const newX = node.x + dx;
    const newY = node.y + dy;
    if (newX >= 0 && newX < grid.width && newY >= 0 && newY < grid.height) {
      neighbors.push(grid.nodes[newX][newY]);
    }
  }
  
  return neighbors;
}