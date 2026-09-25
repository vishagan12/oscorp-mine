# Phase 2 — Gateway Bridge + Backend Ingest Endpoints

### Goal
Get the hexapod's scan packets from the gateway into `mining-dashboard/app.py`, following the exact same pattern the existing seismic/helmet nodes already use — do not invent a new architecture.

### Edit: `firmware/gateway_node.ino`

- The gateway already receives ESP-NOW packets and does `HTTP POST` to `/api/seismic` and `/api/helmet` (see manual section 3.3). Add a third case for the hexapod scan node's MAC address:
  - On receiving a `ScanPacket`, serialize it to JSON with ArduinoJson (same library already used)
  - `HTTP POST` to a new endpoint: `/api/hexapod/scan`
- No changes to the seismic/helmet handling code paths.

### Edit: `mining-dashboard/app.py`

Add one new REST endpoint, following the existing style of `/api/seismic` and `/api/helmet/action`:

```python
@app.route('/api/hexapod/scan', methods=['POST'])
def hexapod_scan():
    data = request.get_json()
    # data: { robot_x, robot_y, robot_heading, distances: [...], gas_ppm }
    map_engine.ingest_scan(data)          # see Phase 3
    socketio.emit('hexapod_map_update', map_engine.get_latest_update())
    socketio.emit('hexapod_gas_update', {'gas_ppm': data['gas_ppm']})
    return jsonify({'status': 'ok'})
```

Add one new config value near the top of `app.py` for the camera:

```python
HEXAPOD_CAM_URL = "http://<hexapod-cam-ip>/stream"   # set after Phase 1 firmware boots and prints its IP
```

Add a route that exposes this URL to the frontend so it's never hardcoded in React:

```python
@app.route('/api/hexapod/camera_url')
def hexapod_camera_url():
    return jsonify({'url': HEXAPOD_CAM_URL})
```

(Proxying the raw MJPEG stream through Flask is unnecessary complexity for a 24h build — as long as the hexapod-cam and the judges' viewing device are on the same local network, the React `<img>` tag can point directly at the ESP32-CAM's stream URL. Only proxy through Flask if the demo network setup requires it.)

### Extend `/api/state`

The existing `/api/state` endpoint returns the full system snapshot (workers, zones, hexapod, atmosphere, safe score). Add to that snapshot:

```python
"hexapod_map": map_engine.get_full_state(),
"hexapod_camera_url": HEXAPOD_CAM_URL,
```

This keeps the existing pattern where the frontend can always GET a full picture on load, then receive incremental updates via SocketIO after that.

### Done when
- [ ] Sending a manual `curl -X POST http://localhost:5001/api/hexapod/scan` with a sample JSON payload returns `{"status": "ok"}` and triggers a `hexapod_map_update` SocketIO event (verify with a simple socket listener or browser console)
- [ ] `/api/state` includes the new `hexapod_map` and `hexapod_camera_url` fields
- [ ] `/api/hexapod/camera_url` returns the correct stream URL
- [ ] Existing endpoints (`/api/seismic`, `/api/helmet/*`, `/api/hexapod/action`) still work unchanged
