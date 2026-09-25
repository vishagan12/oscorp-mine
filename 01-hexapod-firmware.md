# Phase 1 — Hexapod Firmware: Camera + LiDAR/Gas Scanning

### Goal
Get the hexapod producing two real data streams: (1) a live MJPEG camera feed, (2) periodic scan packets containing distance readings + gas ppm + its own position estimate.

### Hardware assumption
- ESP32-CAM module (AI-Thinker or similar) mounted on the hexapod for video — runs its own tiny web server, independent of the main hexapod control board
- A 2D scanning distance sensor for mapping. Pick ONE based on what's in your kit, in order of preference for a 24h build:
  1. RPLidar A1 (best result, needs a UART-capable MCU + more setup time)
  2. A single ultrasonic (HC-SR04) or ToF (VL53L0X) sensor on a servo, sweeping 0–180° (slower but far faster to wire up — recommended default for time pressure)
- MQ-series gas sensor (already in your parts list)
- Hexapod's existing main MCU handles motion; this phase only adds sensing + transmission, do not touch gait/motion code

### Files to create

**`firmware/hexapod_cam/hexapod_cam.ino`**
- Standard ESP32-CAM MJPEG streaming sketch (use the well-known `CameraWebServer` example as a base — do not write a custom streamer from scratch, it's a solved problem)
- Connects to the same WiFi network as the gateway
- Serves stream at `http://<hexapod-cam-ip>/stream`
- Print its IP to Serial on boot so it can be hardcoded into the backend config

**`firmware/hexapod_scan/hexapod_scan.ino`**
- Runs on the hexapod's main ESP32
- If using servo+ultrasonic/ToF sweep: rotate servo in fixed steps (e.g. every 10°) across 0–180°, take a distance reading at each step
- Read gas sensor analog value once per full sweep
- Track hexapod's own position as a simple 2D dead-reckoning estimate: increment x/y based on commanded movement steps (this does not need to be accurate SLAM-grade odometry — it only needs to be consistent enough to plot a believable path for the demo)
- Package one sweep as a single JSON-serializable struct:
  ```cpp
  struct ScanPacket {
    float robot_x, robot_y, robot_heading;
    float distances[19];   // one per 10° step across 180°
    int gas_ppm;
  };
  ```
- Send via ESP-NOW to the existing gateway (same pattern as `seismic_node.ino` / `helmet_node.ino` — reuse that ESP-NOW send code, don't reinvent it)

### Done when
- [ ] ESP32-CAM serves a visible MJPEG stream when opened directly in a browser at `http://<ip>/stream`
- [ ] `hexapod_scan.ino` prints one complete `ScanPacket` to Serial per sweep, with plausible non-zero distance values
- [ ] A sweep completes in under ~3 seconds (needs to feel "live" on the dashboard, not sluggish)
- [ ] Gateway's Serial Monitor shows incoming ESP-NOW packets from the hexapod scan node (reuse the MAC-address pairing process from the manual's Step 1)
