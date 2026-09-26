# DEEPWATCH — Full Sensor-to-Dashboard Wiring
## Master prompt for Cursor (paste this whole file as one instruction)

You are working in the existing `DeepSearch` repo (DEEPWATCH mining safety system). Existing structure — DO NOT restructure or rewrite these unless a step below explicitly says to:

- `deepwatch-ts/` — React + TypeScript + Tailwind frontend
- `mining-dashboard/app.py` — Flask + Flask-SocketIO backend on port 5001
- `nexus-backend/` — evacuation pathfinding
- `firmware/seismic_node.ino`, `firmware/helmet_node.ino`, `firmware/gateway_node.ino` — existing ESP-NOW nodes

## Core principle: build and verify each sensor in total isolation before connecting the next one

For every sensor below, follow this exact sequence and do not skip steps:
1. Get the raw hardware reading printing to Serial Monitor correctly
2. Send that reading to the backend via a `curl` command with fake/sample data BEFORE the real firmware sends it — this proves the backend endpoint and SocketIO event work independently of hardware
3. Flash real firmware, confirm the same endpoint receives real data
4. Confirm the correct dashboard panel updates live
5. Only then move to the next sensor

Never wire two new sensors into the dashboard in the same work session without testing step 2-4 individually for each — if something breaks, this is how you find out which sensor broke it in seconds instead of hours.

---

## Sensor 1: Seismic node (MPU-6050, already exists — verify, don't rebuild)

- Confirm `firmware/seismic_node.ino` still sends via ESP-NOW to the gateway
- Confirm `mining-dashboard/app.py`'s `/api/seismic` endpoint still works: `curl -X POST http://localhost:5001/api/seismic -H "Content-Type: application/json" -d '{"zone":"Main Tunnel","magnitude":5.8,"confidence":0.94}'`
- Confirm the Seismic Hub tab's FFT graph updates on this call
- If this already works, move on — do not touch this code

## Sensor 2: Smart helmet — vitals (pulse, temp) + IR helmet-worn detection (already exists — verify)

- Confirm `firmware/helmet_node.ino` reads pulse sensor, thermistor, and IR scalp sensor correctly on Serial Monitor first, in isolation, before trusting ESP-NOW transmission
- Confirm `/api/helmet/action` and the underlying live-data endpoint update the Workers tab table (BPM, temp, helmet SECURED/DETACHED badge) in real time
- Test: manually cover/uncover the IR sensor with your hand and confirm the dashboard badge flips within 2-3 seconds

## Sensor 3: Gas sensor (MQ-series, on helmet or hexapod)

- If not yet wired to any firmware: add analog read on the ESP32-C3 helmet node (or hexapod scan node) on the pin already documented as `GPIO 3 (ADC1_CH3)` per the existing pin table
- Print raw analog value to Serial first, confirm it changes when you breathe near it or use a lighter (unlit, just gas) near it — do this BEFORE wiring to ESP-NOW
- Add backend handling: extend whichever existing packet struct/endpoint (`/api/helmet/action` or new `/api/hexapod/scan`) to carry `gas_ppm`
- Confirm the correct threshold from the existing mining safety regulation table (CO > 25ppm = alert, > 50ppm = critical) fires a visible alert on the dashboard

## Sensor 4: Hexapod camera (ESP32-CAM)

- Flash the standard `CameraWebServer` example sketch first, completely unmodified, and confirm you can open `http://<its-ip>/stream` directly in a browser — do this before touching any dashboard code
- Only after that works: add the `/api/hexapod/camera_url` route to `app.py` returning that IP's stream URL
- In `deepwatch-ts`, create `CameraPanel.tsx` that fetches this URL once on mount and renders it in an `<img>` tag inside the existing Hexapod Scout Tab
- Test failure mode: unplug the camera and confirm the panel shows a graceful "Camera offline" state instead of a broken image icon

## Sensor 5: Hexapod distance scan (ultrasonic/ToF on servo sweep, or MiDaS depth fallback)

**If using ultrasonic/ToF + servo (primary approach):**
- Get the servo sweeping 0-180° in fixed steps with a distance reading at each step, printed to Serial, before any networking code
- Confirm readings look physically plausible (place a book at a known distance, confirm the sensor reads close to that number)
- Send one full sweep as a single JSON packet via ESP-NOW to the gateway, matching the `ScanPacket` structure (robot_x, robot_y, heading, distances array, gas_ppm)
- Add `/api/hexapod/scan` endpoint in `app.py`, create `map_engine.py` with the `MapEngine` class (ingest_scan, get_latest_update, get_full_state methods)
- Test with `curl -X POST http://localhost:5001/api/hexapod/scan` and sample JSON BEFORE trusting real hardware data
- Confirm `hexapod_map_update` SocketIO event fires and the `MapPanel.tsx` canvas draws new points without clearing previous ones

**If using MiDaS depth estimation instead (no distance sensor available):**
- Run MiDaS small model on the backend against incoming camera frames, NOT on the ESP32 — this needs real CPU/GPU compute
- Extract a horizontal strip of relative depth values across the center of each frame as a stand-in for a distance sweep
- Label this explicitly as "vision-based relative depth" in any UI text or judge-facing material — never call this LiDAR or claim absolute meter accuracy without a calibration reference
- Feed the extracted strip into the same `map_engine.ingest_scan()` function so downstream code doesn't care which method produced it

## Sensor 6: LoRa link (once modules arrive — build as a parallel path, not a replacement)

- Get two LoRa nodes sending/receiving plain text "ping" messages first, printing RSSI to Serial, with NO connection to the dashboard yet — this is your standalone range-test tool
- Only after the range test itself works: add a gateway-side listener that also accepts LoRa packets and forwards them to the same `/api/hexapod/scan` or `/api/helmet/action` endpoints ESP-NOW already uses — same JSON shape, so the backend and frontend never need to know which radio a packet arrived over
- Keep ESP-NOW as the default/working path; treat LoRa as an additive parallel path you can demo separately (the live range test) without risking the main sensor pipeline

## General rules for every sensor

- Every new backend route follows the existing `app.py` pattern: parse JSON, update relevant state, `socketio.emit(...)`, return `{"status": "ok"}`
- Every new SocketIO event has a corresponding listener already conceptually matching how the existing Seismic/Workers tabs consume live updates — reuse that existing client-side pattern, don't invent a second data-flow style
- Never let one sensor's failure crash the whole Flask process — wrap each ingest handler in try/except and log errors rather than letting an exception kill the server mid-demo
- After each sensor is verified working in isolation, run a full regression check: confirm Overview, Seismic Hub, Workers, Hexapod Scout, and Controls Center tabs ALL still load and function before moving to the next sensor

## Final integration checklist (only after all sensors pass individually)

- [ ] Seismic: manual trigger produces live FFT graph + evacuation banner
- [ ] Helmet vitals: BPM/temp update live, helmet badge flips on IR trigger
- [ ] Gas: threshold breach produces a dashboard alert
- [ ] Camera: live stream visible in Hexapod Scout Tab, graceful offline state
- [ ] Scan/map: points accumulate live on canvas without full redraw flicker
- [ ] (If ready) LoRa: range test tool runs standalone, showing RSSI live
- [ ] Full page load/refresh restores all state correctly from `/api/state`
- [ ] No individual sensor failure crashes the backend or freezes the frontend
