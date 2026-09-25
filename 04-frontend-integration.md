# Phase 4 — Frontend Integration (deepwatch-ts)

### Goal
Add the live camera feed and live-building map into the EXISTING Hexapod Scout Tab in `deepwatch-ts`, using the existing SocketIO client connection already used by Seismic Hub / Workers tabs. Do not create a new tab or a separate page.

### Locate first
Find the existing Hexapod Scout Tab component (per the manual: shows atmospheric gas, optical rock-fissure flags, battery diagnostics). Find the existing SocketIO client setup (likely a shared hook/context, since Seismic Hub and Workers tabs already receive live updates the same way).

### Create: `deepwatch-ts/src/components/hexapod/CameraPanel.tsx`

```tsx
export function CameraPanel({ streamUrl }: { streamUrl: string | null }) {
  if (!streamUrl) {
    return <div className="camera-panel camera-panel--offline">Camera offline</div>;
  }
  return (
    <div className="camera-panel">
      <img src={streamUrl} alt="Hexapod live feed" className="camera-panel__stream" />
      <span className="camera-panel__live-badge">● LIVE</span>
    </div>
  );
}
```

Fetch `streamUrl` once on mount from the existing backend's `/api/hexapod/camera_url` endpoint (Phase 2), store in component state.

### Create: `deepwatch-ts/src/components/hexapod/MapPanel.tsx`

- Use an HTML5 `<canvas>` ref
- On mount: GET `/api/state`, read `hexapod_map.points` and `hexapod_map.path`, draw them once (this handles page refresh / reconnect — matches the existing pattern other tabs use for initial state)
- Subscribe to the existing SocketIO client for a `hexapod_map_update` event; on each event, draw only the new points (`new_points` from Phase 3) onto the canvas without clearing it, and move the robot-position marker to `robot_pos`
- Color each point by `gas_ppm`: green under the safe CO threshold from the manual's regulation table, amber approaching it, red over it — reuse the existing color tokens already defined for zone stress (don't invent a new palette)

### Edit: the Hexapod Scout Tab component

- Import and render `<CameraPanel />` and `<MapPanel />` alongside the existing gas/battery/optical-flag telemetry cards — same tab, added panels, not a replacement
- Suggested layout: camera + map side by side at the top of the tab, existing telemetry cards below, unchanged

### Styling
Match the existing dark industrial theme already defined in the codebase (`#080A0D`, `#101318`, `#171B22`, coral `#FF441A` for alerts) — do not introduce a new color system for these two panels.

### Done when
- [ ] Opening the Hexapod Scout Tab shows the live camera stream rendering inside the existing tab layout
- [ ] The map canvas shows points appearing in real time as Phase 1–3 data flows in, without a full-canvas redraw/flicker on each update
- [ ] Refreshing the page still shows the map built so far (from `/api/state`), not a blank canvas
- [ ] All other tabs (Overview, Seismic Hub, Workers, Controls Center) are untouched and still function
