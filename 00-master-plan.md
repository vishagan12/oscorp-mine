# DEEPWATCH — Hexapod Camera + LiDAR Map Integration
## Master Plan (feed this file to Antigravity first)

### Context

Repo: `vishagan12/DeepSearch`. Existing components (DO NOT rebuild these):

- `deepwatch-ts/` — React + TypeScript + Tailwind dashboard, already has a "Hexapod Scout Tab" showing gas/battery/optical-flag telemetry (currently driven by manual trigger buttons)
- `mining-dashboard/app.py` — Flask + Flask-SocketIO backend on port 5001, exposes `/api/state`, `/api/hexapod/action`, etc.
- `nexus-backend/` — evacuation pathfinding algorithm
- `firmware/` — `seismic_node.ino`, `helmet_node.ino`, `gateway_node.ino` (ESP-NOW → HTTP POST bridge)

**Gap to close**: the Hexapod Scout is currently simulated. We need it to show a REAL live camera feed and a REAL incrementally-built map from LiDAR/gas data, wired into the existing backend and existing React tab — not a separate app.

### Execution order (5 phases, separate files)

1. `01-hexapod-firmware.md` — ESP32-CAM streaming + LiDAR/gas scanning firmware
2. `02-gateway-backend-ingest.md` — gateway bridge updates + new Flask endpoints
3. `03-map-building-engine.md` — server-side occupancy grid builder
4. `04-frontend-integration.md` — wire camera + map into the existing Hexapod Scout Tab in `deepwatch-ts`
5. `05-fallback-and-demo.md` — simulation fallback mode + judge demo script

Each phase file is self-contained: it states its goal, exact files to create/edit, and a "done when" checklist. Do not start a phase until the previous phase's checklist passes.

### Win condition (what "complete" means for the demo)

- [ ] Hexapod Scout Tab shows a live camera image that updates in real time
- [ ] Hexapod Scout Tab shows a map that visibly builds itself as new data arrives (not a static image)
- [ ] Both are driven by the SAME backend (`mining-dashboard/app.py`) that already powers workers/zones/seismic — one unified system, not a bolted-on demo
- [ ] If real hardware isn't ready at any point, a simulation mode produces the exact same data shape so the frontend never has to change
- [ ] Nothing in the existing Overview, Seismic Hub, Workers, or Controls Center tabs breaks

### Hard rule for Antigravity

Never modify the existing 10-worker data, zone stress logic, seismic FFT logic, or evacuation algorithm unless a phase file explicitly says to. This integration is additive.
