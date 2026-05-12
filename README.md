# Smart Route Optimizer

A high-performance route finding application built with **React**, **Vite**, and **TanStack Router**. It implements the **A*** pathfinding algorithm with real-time traffic simulation to find the most efficient paths between two points on an interactive map.

## 🚀 Features

- **A\* Pathfinding Algorithm**: Optimized shortest-path discovery using a grid-based search space.
- **Live Traffic Simulation**: Dynamic traffic density simulation that affects route calculations in real-time.
- **Interactive Map**: Built with **Leaflet** and **OpenStreetMap**, allowing users to pick coordinates directly from the UI.
- **Alternate Routes**: Generates and visualizes multiple routing options with distance and ETA comparisons.
- **Explored Node Visualization**: Debug mode to see exactly how the algorithm searches the grid.
- **Emergency Mode**: Priority routing logic for urgent travel needs.
- **Responsive Design**: Premium dark-themed UI with glassmorphism effects and smooth animations.

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install dependencies:**
   Using npm:
   ```bash
   npm install
   ```
   Or using Bun:
   ```bash
   bun install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8080`.

## 📍 Roadmap

- [x] **Coordinate Population Fix**: Resolve issues with destination selection on the map.
- [x] **Enhanced Error Feedback**: Implement robust toast notifications for missing inputs and API failures.
- [ ] **Real-time Traffic APIs**: Integrate with live traffic data providers for real-world accuracy.
- [ ] **Multi-stop Routing**: Support for multiple waypoints in a single trip.
- [ ] **Export Options**: Allow users to save or export their optimal routes.

## 🏗️ Tech Stack

- **Framework**: React 19
- **Routing**: TanStack Router
- **Bundler**: Vite
- **Styling**: Tailwind CSS & Framer Motion
- **Map**: Leaflet & React-Leaflet
- **Icons**: Lucide React
- **Notifications**: Sonner
