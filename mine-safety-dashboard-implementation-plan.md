# STRATA — Mine Safety Monitoring Dashboard
## Implementation Plan

### 0. Project Summary

A real-time web dashboard for an underground mine safety system. It aggregates four data streams into one interface:

1. **Live camera feed** from an autonomous hexapod robot exploring the mine post-blast
2. **Live occupancy map** of the mine tunnel network, built incrementally from the hexapod's LiDAR + gas readings
3. **Worker vitals** (BPM, SpO2, temperature) from wearables
4. **Helmet status** (on/off) and system-wide alerts (gas thresholds, vitals out of range, helmet removed)

Backend: single Flask + SocketIO hub. Frontend: single-page dashboard, dark industrial theme. All device data (camera excluded) flows as small JSON events over WebSocket; camera video is served separately as an MJPEG stream.

---

### 1. Architecture

```
[Hexapod: Camera] ---(WiFi, MJPEG stream)---> [Flask /video_feed endpoint] ---> <img> tag in browser
[Hexapod: LiDAR + Gas] ---(WiFi/Serial, JSON)---> [Flask-SocketIO server] ---> map_update event ---> Canvas renderer
[Wearables: BPM/SpO2/Temp] ---(ESP-NOW -> Gateway ESP32 -> Serial/WiFi)---> [Flask-SocketIO server] ---> vitals_update event ---> Vitals cards
[Helmets: IR sensor] ---(ESP-NOW -> Gateway ESP32)---> [Flask-SocketIO server] ---> helmet_update event ---> Helmet badges
[Server-side rules engine] ---> alert event ---> Alert feed + banner
```

Single source of truth = the Flask-SocketIO server. Every panel on the dashboard is a subscriber to server-emitted events. No panel talks directly to hardware.

---

### 2. Tech Stack

- **Backend**: Python, Flask, Flask-SocketIO (eventlet or gevent worker for concurrent streams)
- **Hardware bridge**: pyserial (if gateway ESP32 connects over USB) or a lightweight MQTT/HTTP listener (if gateway pushes over WiFi)
- **Frontend**: Vanilla JS + Socket.IO client (fastest for a hackathon — avoid React build overhead unless team already has React tooling ready)
- **Camera streaming**: Flask MJPEG generator endpoint (`multipart/x-mixed-replace`)
- **Map rendering**: HTML5 Canvas, plotted incrementally from point-batch JSON
- **Styling**: Plain CSS with CSS variables for the color system below (no framework needed, keeps it fast)

---

### 3. Design System

- Background: `#0D0F12` (dark charcoal)
- Card surface: `rgba(255,255,255,0.04)` with `1px solid rgba(255,255,255,0.08)` border, `16px` radius, backdrop-blur for glass effect
- Safe / normal: `#3DDC84` (signal green)
- Warning: `#FFB020` (safety amber)
- Critical: `#FF4D4D`
- Font: Inter or General Sans, sans-serif
- Layout: CSS grid, 2 columns desktop — camera+map on top row (each ~50% width), vitals row and alerts panel on bottom row

---

### 4. Dashboard Layout (4 zones)

1. **Camera panel** (top-left): `<img src="/video_feed">` in a rounded frame, overlay chips for battery %, signal strength, live gas reading, green "LIVE" pulse indicator
2. **Map panel** (top-right): Canvas element, hexapod position marker, explored path as glowing line, gas hazard points color-coded on the grid
3. **Vitals panel** (bottom-left): horizontally scrollable worker cards — BPM sparkline, SpO2/temp radial gauges, helmet badge (green=on, red=off)
4. **Alerts panel** (bottom-right): scrolling timestamped alert feed with severity-colored dots + compact gas trend line chart (last hour)

---

### 5. SocketIO Event Schema

**Server → Client events:**

```jsonc
// map_update — emitted whenever hexapod sends a new LiDAR/gas batch
{
  "event": "map_update",
  "points": [{"x": 12.4, "y": 5.1}, ...],     // new LiDAR points, meters, relative to origin
  "robot_pos": {"x": 8.2, "y": 3.0, "heading": 47},
  "gas_ppm": 340
}

// vitals_update — emitted per worker on new wearable reading
{
  "event": "vitals_update",
  "worker_id": "W1",
  "bpm": 78,
  "spo2": 97,
  "temp_c": 36.9
}

// helmet_update
{
  "event": "helmet_update",
  "worker_id": "W1",
  "helmet_on": true
}

// alert
{
  "event": "alert",
  "severity": "warning",       // "warning" | "critical"
  "source": "gas" ,            // "gas" | "vitals" | "helmet"
  "worker_id": "W1",           // null if site-wide (e.g. gas)
  "message": "SpO2 below 90% for Worker 1",
  "timestamp": "2026-09-25T14:03:21Z"
}
```

**Client → Server events:** none required for MVP (dashboard is read-only/observer).

---

### 6. Backend Rules Engine (server-side thresholds)

Run on every incoming vitals/gas packet, before re-emitting to clients:

- SpO2 < 90% → `critical` alert
- BPM < 50 or > 150 → `warning` alert
- Temp > 38.5°C → `warning` alert
- Gas ppm > site-defined threshold → `critical` alert, also flips the "SAFE TO ENTER" banner to red
- Helmet off for > 15 seconds continuous while inside a work zone → `warning` alert (escalate to `critical` after 60s)

---

### 7. File/Folder Structure

```
strata-dashboard/
├── app.py                  # Flask app entrypoint, SocketIO init, routes
├── ingest/
│   ├── camera_stream.py    # MJPEG generator, pulls frames from hexapod WiFi camera
│   ├── gateway_listener.py # Reads serial/WiFi from ESP32 gateway, parses packets
│   └── rules_engine.py     # Threshold checks -> alert events
├── static/
│   ├── css/dashboard.css
│   └── js/
│       ├── socket-client.js
│       ├── map-renderer.js
│       ├── vitals-panel.js
│       └── alerts-panel.js
├── templates/
│   └── dashboard.html
└── requirements.txt
```

---

### 8. Build Phases (in build order — each phase should be independently demoable)

**Phase 1 — Skeleton**
- Flask + SocketIO server boots, serves `dashboard.html` with 4 empty panel containers
- Socket.IO client connects, console-logs a test event
- Deliverable: page loads, socket connection confirmed in browser console

**Phase 2 — Camera feed**
- `/video_feed` MJPEG endpoint wired to hexapod's WiFi camera (or a placeholder webcam/video file for now)
- Camera panel renders live feed
- Deliverable: live video visible on dashboard

**Phase 3 — Map panel**
- `map_update` event emitted (mock generator acceptable initially: simulate LiDAR points along a scripted path)
- Canvas renderer plots points incrementally + moves robot marker
- Swap mock generator for real LiDAR/gas serial input once hardware is ready
- Deliverable: map builds live on screen as points arrive

**Phase 4 — Vitals + Helmet**
- `gateway_listener.py` parses incoming ESP-NOW-relayed packets (or mock JSON POSTs if gateway isn't ready)
- `vitals_update` / `helmet_update` events update the correct worker card
- Deliverable: worker cards update in real time as sensor data arrives

**Phase 5 — Rules engine + Alerts**
- Wire `rules_engine.py` into the ingest pipeline
- Alert feed populates, severity banner updates, "SAFE TO ENTER" flips on critical gas
- Deliverable: triggering a mock bad reading produces a visible alert end-to-end

**Phase 6 — Polish**
- Apply design system (colors, glass cards, fonts)
- Add overlay chips, gauges, sparkline charts
- Only after all data plumbing works — don't polish before phases 1–5 are functionally complete

---

### 9. Fallback / Simulation Plan (if hardware isn't ready in time)

For any subsystem not physically ready by demo time, keep the exact same SocketIO event schema and just swap the source:

- No hexapod yet → script a Python generator that emits `map_update` and `alert` (gas) events along a fake scripted path at fixed intervals
- No wearables yet → generator emits `vitals_update` with randomized-but-realistic values, occasionally drifting into warning range to show off the alert system
- No helmet sensor yet → generator toggles `helmet_update` on a timer to demo the badge + alert escalation

This means the dashboard code never has to change between "mock mode" and "real mode" — only the ingest layer's data source changes.

---

### 10. Open Items / Decisions Needed Before Building

- [ ] Confirm gateway ESP32 → server link: USB serial or WiFi/HTTP POST?
- [ ] Confirm number of workers to support on dashboard (affects vitals panel scroll vs fixed grid)
- [ ] Confirm gas sensor units/threshold values for the rules engine
- [ ] Decide origin/coordinate system for the map (meters from hexapod start point is simplest)
