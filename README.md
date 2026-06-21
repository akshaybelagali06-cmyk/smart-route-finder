# Smart Route Optimizer

Smart Route Optimizer is a modern route-planning web application built with **React 19**, **TypeScript**, **Vite**, and **TanStack Router**. It combines real road routing via the public **OSRM** API with fallback grid-based **A*** pathfinding, live traffic simulation, voice navigation, and alternate route analytics.

## ✨ What This App Does

- Let users set a **source** and **destination** by clicking on the map or searching for a place.
- Display the optimal route on an interactive **Leaflet** map using OpenStreetMap tiles.
- Fetch real street-routing data from **OSRM** and gracefully fall back to a custom **A*** grid search when needed.
- Simulate traffic density and route complexity using deterministic traffic sampling.
- Offer **alternate routes**, **fuel estimates**, **turn-by-turn instructions**, and **voice navigation**.

## 🔧 Core Features

- **Real road routing with OSRM**: Uses the public OSRM demo server to get actual driving routes, distances, and turn-by-turn steps.
- **A* fallback routing**: When OSRM fails, the app computes a route over a generated grid and still returns a working path.
- **Live traffic simulation**: Traffic is simulated using hashed GPS coordinates plus rush-hour multipliers to create deterministic traffic scores.
- **Route type strategies**: Supports `fastest`, `shortest`, `least_traffic`, `emergency`, and `fuel_efficient` modes.
- **Alternate route planning**: Requests alternate routes from OSRM and labels them by fastest, shortest, and least traffic.
- **Point selection and drag**: Users can click or drag the source/destination markers on the map.
- **Waypoint support**: Add and edit multi-stop waypoints on the route.
- **Road closure markers**: Place closures on the map to simulate blocked roads.
- **Fuel and EV cost estimates**: Calculates petrol and electric energy costs based on route distance and duration.
- **Voice guidance**: Uses browser speech synthesis to read route instructions aloud.
- **Responsive UI**: Mobile-friendly sidebar layout with polished glassmorphism styling.

## 📦 Tech Stack

- React 19
- TypeScript
- Vite
- TanStack Router
- Tailwind CSS
- Radix UI primitives
- Framer Motion
- Leaflet + React-Leaflet
- Sonner notifications
- Lucide icons
- Zod validation
- Axios (dependency available, though route fetch uses native fetch)

## 🧠 How It Works

### Client-side

- The main route page is in `src/routes/index.tsx`.
- User picks source/destination via the map or search input.
- `src/components/MapView.tsx` renders the map, markers, route lines, traffic samples, and interactive controls.
- `src/components/SearchInput.tsx` performs place autocomplete using the geocoding API.
- `src/components/RoutePanel.tsx` displays route stats, alternates, fuel estimates, and navigation controls.
- `src/services/routing.ts` wraps calls to each server endpoint and standardizes response data.

### Server-side APIs

The application uses TanStack Router file-based server routes to power the backend logic.

#### `POST /api/find-route`

- Computes the main route between `source` and `destination`.
- Accepts:
  - `source`: `[lat, lng]`
  - `destination`: `[lat, lng]`
  - `trafficWeight` (optional)
  - `waypoints` (optional)
  - `routeType` (optional)
  - `roadClosures` (optional)
- Uses OSRM first, then falls back to a grid-based A* algorithm when OSRM fails.
- Returns:
  - route coordinates
  - distance (km)
  - ETA (minutes)
  - traffic score
  - number of explored nodes/segments
  - cost and traffic bucket
  - fuel estimates
  - voice instructions and turn-by-turn instructions
  - selected routing engine (`osrm` or `astar-fallback`)

#### `POST /api/alternate-routes`

- Requests alternate routes from OSRM for the same source/destination.
- Computes metrics for each alternative route, such as:
  - distance
  - ETA
  - traffic score
  - fuel estimate
- Labels routes as `Fastest`, `Shortest`, and `Least Traffic` when possible.
- Falls back to multiple A* variants if OSRM is unavailable.

#### `GET /api/geocode`

- Uses the public OpenStreetMap **Nominatim** API.
- Supports:
  - forward geocoding: `?q=<query>`
  - reverse geocoding: `?lat=<lat>&lng=<lng>`
- Returns place results for search autocomplete and readable coordinate labels.

#### `GET /api/traffic`

- Provides simulated traffic samples between source and destination.
- Uses deterministic coordinate hashing and time-of-day rush-hour logic.
- Returns traffic density markers for map visualization.

## 🧩 Important Implementation Details

- `src/services/osrm.ts` contains the OSRM API wrapper, coordinate conversion helpers, route selection logic, fuel estimation, and voice-instruction generation.
- `src/lib/algorithms/traffic.ts` contains the traffic simulation logic.
- `src/lib/algorithms/graph.ts` and `src/lib/algorithms/astar.ts` implement the grid, nearest-node lookup, and A* pathfinding fallback.
- `src/routes/api/find-route.ts` and `src/routes/api/alternate-routes.ts` orchestrate route requests, apply route-type logic, and merge OSRM/A* outputs.

## 🚀 Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the app in your browser at the address shown by Vite.

## 🧪 Available Scripts

- `npm run dev` — start local development server
- `npm run build` — build production assets
- `npm run preview` — preview built output locally
- `npm run lint` — run ESLint
- `npm run format` — format files with Prettier

## 📝 Notes

- The app uses the public OSRM demo server and Nominatim search API. For production use, replace these with your own service or a hosted provider.
- Traffic is simulated locally rather than using a paid live traffic feed.
- The code is optimized for interactive route planning and rapid prototyping.

## 📁 Useful Files

- `src/routes/index.tsx` — main page and route state management
- `src/components/MapView.tsx` — interactive map display and markers
- `src/components/RoutePanel.tsx` — route summary and alternate routes panel
- `src/components/SearchInput.tsx` — autocomplete search input
- `src/services/routing.ts` — client-side route service wrapper
- `src/services/osrm.ts` — OSRM route helper and metrics
- `src/services/geocoding.ts` — Nominatim search and reverse geocoding
- `src/routes/api/find-route.ts` — route calculation API
- `src/routes/api/alternate-routes.ts` — alternate routes API
- `src/routes/api/geocode.ts` — geocoding API route
- `src/lib/algorithms/traffic.ts` — traffic simulation logic

## 📌 Summary

This repository is a full-stack route optimization app that blends real road routing with smart fallback algorithms, traffic-aware scoring, and an immersive map-first UI. It is built end-to-end with modern React tooling and server routes provided by TanStack Router.
