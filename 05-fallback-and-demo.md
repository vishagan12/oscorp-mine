# Phase 5 — Fallback Simulation Mode + Demo Script

### Goal
If the physical hexapod (camera and/or scan hardware) isn't fully working by demo time, the dashboard must still look complete and live. This mirrors how the existing system already handles hazards: `/api/hexapod/action` lets you manually trigger `low_o2`, `high_co`, `flag_crack` for demo purposes even without live hardware.

### Create: `mining-dashboard/hexapod_simulator.py`

- A background thread/task (use the same pattern the existing manual-trigger `/api/hexapod/action` route already relies on) that, when enabled, calls `map_engine.ingest_scan()` on a timer (e.g. every 2 seconds) with a scripted path: a fixed sequence of `robot_x, robot_y, heading` values that trace a believable tunnel route, with `distances` generated to look like walls, and `gas_ppm` occasionally drifting into the warning/critical range from the manual's threshold table
- Add a route: `POST /api/hexapod/simulate/start` and `POST /api/hexapod/simulate/stop`, following the existing `/api/hexapod/action` and `/api/master_reset` route conventions
- For the camera: if `hexapod_cam.ino` isn't flashed/working, point `HEXAPOD_CAM_URL` at any local looping video/MJPEG placeholder (even a phone running an IP-camera app works) — the frontend code from Phase 4 does not need to know the difference

### Critical design point
Phases 2–4 must never be able to tell whether data came from real hardware or the simulator — same JSON shape, same endpoints, same SocketIO events. This is what makes the demo safe: flip one switch, not a different code path.

### Demo script (for whoever presents)

1. Open dashboard on Overview tab — show baseline: safe score 96/100, all zones nominal, 10/10 attendance
2. Switch to Hexapod Scout Tab — camera feed live, map panel empty/starting
3. Either let the real hexapod move, or call `/api/hexapod/simulate/start` — narrate: "the hexapod has just been dispatched into the tunnel after blasting"
4. Watch the map build live on screen as points accumulate; call out the gas color-coding as it happens
5. Trigger a hazard for full-system tie-in: use existing `/api/hexapod/action` (`high_co`) or `/api/seismic/manual_trigger` to show the evacuation siren + Nexus pathfinding kick in — this demonstrates the hexapod integration is part of the SAME safety system, not a bolted-on side feature
6. Call `/api/master_reset` to return to baseline before Q&A

### Done when
- [ ] `/api/hexapod/simulate/start` produces a live-building map indistinguishable in the UI from real hardware data
- [ ] `/api/hexapod/simulate/stop` cleanly stops without leaving the map or camera panel in a broken state
- [ ] The demo script above runs start-to-finish without needing a page refresh or backend restart
