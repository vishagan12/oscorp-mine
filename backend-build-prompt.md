# STRATA Backend — Full Build Prompt (for Cursor/Antigravity)

## Context

Repo: `vishagan12/oscorp-mine`. The frontend at `strata-dashboard/` is a Vite + React + TypeScript app that is ALREADY FULLY BUILT and currently fakes all live data via a `setInterval` inside `strata-dashboard/src/context/DashboardContext.tsx`. `socket.io-client` is already listed in `package.json` but is not yet imported or used anywhere.

**Your job**: build a Python Flask + Flask-SocketIO backend from scratch that emits data matching the EXACT TypeScript interfaces already defined in `strata-dashboard/src/types/index.ts`, then wire the frontend's `DashboardContext.tsx` to consume it via `socket.io-client`, replacing the internal `setInterval` simulation with real socket events (while keeping a simulation mode available as a fallback — see Phase 4 below).

Do not change the shape of any existing TypeScript interface. Do not rewrite any component in `strata-dashboard/src/components/` or `strata-dashboard/src/pages/` — they only ever touch data through `DashboardContext`, so the backend's job is to feed that context correctly and nothing downstream needs to know data is now real.

## Exact data shapes to match (copy these directly from `types/index.ts`, do not deviate)

```typescript
interface WorkerData {
  id: string; name: string; role: string; zone: string;
  bpm: number; bpmHistory: number[]; spo2: number; temp: number;
  helmetOn: boolean; battery: number;
  status: 'nominal' | 'warning' | 'critical';
  assignedEvacRoute: string;
}

interface HexapodState {
  x: number; y: number; heading: number; battery: number; signalDbm: number;
  status: 'scanning' | 'idle' | 'patrol' | 'evacuating';
  gasPpm: number; coPpm: number; o2Percent: number; ch4Percent: number;
  fissureDetected: boolean; speedMps: number; thermalMode: boolean;
  streamUrl: string;
}

interface MapPoint { x: number; y: number; gasPpm: number; intensity?: number; }

interface ZoneStatus {
  id: string; name: string; depthM: number; stressIndex: number;
  workersCount: number; gasStatus: 'safe' | 'warning' | 'critical';
  ventilationPct: number; stability: 'stable' | 'monitoring' | 'compromised';
}

interface AlertItem {
  id: string; timestamp: string;
  severity: 'warning' | 'critical' | 'info';
  source: 'gas' | 'vitals' | 'helmet' | 'hexapod' | 'system';
  workerId?: string; message: string; acknowledged?: boolean;
}
```

---

## Phase 1 — Backend skeleton

Create `backend/app.py`:

```python
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory state — mirrors the frontend's initial state exactly
state = {
    "workers": [...],   # same 10 workers as DashboardContext.tsx initialWorkers, copied verbatim
    "zones": [...],     # same 4 zones as DashboardContext.tsx initialZones, copied verbatim
    "hexapod": { "x": 0, "y": 0, "heading": 0, "battery": 100, "signalDbm": -60,
                 "status": "idle", "gasPpm": 0, "coPpm": 0, "o2Percent": 20.9,
                 "ch4Percent": 0, "fissureDetected": False, "speedMps": 0,
                 "thermalMode": False, "streamUrl": "" },
    "mapPoints": [],
    "alerts": [],
    "safetyScore": 96
}

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(state)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001)
```

Create `backend/requirements.txt`: `flask`, `flask-socketio`, `flask-cors`, `python-socketio`, `eventlet`

**Done when**: `python app.py` starts without errors, `curl http://localhost:5001/api/state` returns the full JSON state matching the shapes above exactly (field names must match TypeScript camelCase exactly — `bpmHistory` not `bpm_history`, `gasPpm` not `gas_ppm`).

---

## Phase 2 — Ingest endpoints (one per hardware source)

Add to `app.py`, each following identical pattern: parse JSON → update `state` → validate against thresholds → `socketio.emit(...)` → return `{"status": "ok"}`.

```python
@app.route('/api/worker/vitals', methods=['POST'])
def worker_vitals():
    data = request.get_json()  # { workerId, bpm, spo2, temp }
    worker = next((w for w in state['workers'] if w['id'] == data['workerId']), None)
    if not worker:
        return jsonify({"status": "error", "message": "unknown worker"}), 404
    worker['bpm'] = data['bpm']
    worker['bpmHistory'] = (worker['bpmHistory'] + [data['bpm']])[-10:]
    worker['spo2'] = data['spo2']
    worker['temp'] = data['temp']
    worker['status'] = compute_worker_status(worker)  # nominal/warning/critical from thresholds
    socketio.emit('worker_update', worker)
    check_and_emit_alerts(worker)
    return jsonify({"status": "ok"})

@app.route('/api/worker/helmet', methods=['POST'])
def worker_helmet():
    data = request.get_json()  # { workerId, helmetOn }
    worker = next((w for w in state['workers'] if w['id'] == data['workerId']), None)
    if not worker:
        return jsonify({"status": "error"}), 404
    worker['helmetOn'] = data['helmetOn']
    socketio.emit('worker_update', worker)
    if not data['helmetOn']:
        emit_alert(severity='warning', source='helmet', worker_id=worker['id'],
                   message=f"{worker['name']} helmet detached")
    return jsonify({"status": "ok"})

@app.route('/api/hexapod/scan', methods=['POST'])
def hexapod_scan():
    data = request.get_json()  # { x, y, heading, distances: [...], gasPpm, coPpm, o2Percent, ch4Percent }
    state['hexapod'].update({
        'x': data['x'], 'y': data['y'], 'heading': data['heading'],
        'gasPpm': data['gasPpm'], 'coPpm': data.get('coPpm', 0),
        'o2Percent': data.get('o2Percent', 20.9), 'ch4Percent': data.get('ch4Percent', 0),
    })
    new_points = distances_to_map_points(data)  # trig conversion, see Phase 3
    state['mapPoints'].extend(new_points)
    socketio.emit('hexapod_update', state['hexapod'])
    socketio.emit('map_update', {'newPoints': new_points})
    check_gas_thresholds(data)
    return jsonify({"status": "ok"})

@app.route('/api/hexapod/camera_url', methods=['POST'])
def set_camera_url():
    data = request.get_json()  # { streamUrl }
    state['hexapod']['streamUrl'] = data['streamUrl']
    socketio.emit('hexapod_update', state['hexapod'])
    return jsonify({"status": "ok"})
```

**Test each with curl BEFORE any real firmware sends data**, e.g.:
```
curl -X POST http://localhost:5001/api/worker/vitals -H "Content-Type: application/json" \
  -d '{"workerId":"W-01","bpm":140,"spo2":91,"temp":37.5}'
```
Confirm this produces a `worker_update` event AND a `critical` alert (140 BPM should breach threshold).

**Done when**: every endpoint above returns `{"status": "ok"}` on a curl test, and each produces the correctly-shaped SocketIO event.

---

## Phase 3 — Map point conversion + threshold logic

Create `backend/logic.py`:

```python
import math

def distances_to_map_points(scan_data):
    """Convert a hexapod distance sweep into absolute MapPoint objects."""
    points = []
    rx, ry, heading = scan_data['x'], scan_data['y'], scan_data['heading']
    for i, dist in enumerate(scan_data.get('distances', [])):
        if dist <= 0:
            continue
        angle_deg = heading - 90 + (i * 10)
        angle_rad = math.radians(angle_deg)
        points.append({
            'x': rx + dist * math.cos(angle_rad),
            'y': ry + dist * math.sin(angle_rad),
            'gasPpm': scan_data.get('gasPpm', 0)
        })
    return points

def compute_worker_status(worker):
    if worker['bpm'] > 150 or worker['spo2'] < 90 or worker['temp'] > 38.5:
        return 'critical'
    if worker['bpm'] > 130 or worker['spo2'] < 94 or worker['temp'] > 37.8:
        return 'warning'
    return 'nominal'

def check_gas_thresholds(data):
    if data.get('coPpm', 0) > 50:
        return 'critical'
    if data.get('coPpm', 0) > 25:
        return 'warning'
    return 'safe'
```

Import both functions into `app.py`. These thresholds match the mining safety regulation table from the project manual (CO > 25ppm warning / > 50ppm critical, SpO2 < 90% critical, BPM > 150 critical).

**Done when**: feeding a sample scan with `distances: [50,50,50,...]` and varying `heading` values produces `mapPoints` that trace a plausible arc, not all identical coordinates.

---

## Phase 4 — Simulation fallback mode (build this in parallel, not last)

Create `backend/simulator.py` — a background thread using `socketio.start_background_task` that, when enabled via `POST /api/simulate/start`, calls the SAME internal functions Phase 2's routes call (not duplicate logic), on a timer, walking a scripted path and occasionally drifting a worker's vitals or hexapod gas into warning range.

```python
@app.route('/api/simulate/start', methods=['POST'])
def start_simulation():
    socketio.start_background_task(run_simulation_loop)
    return jsonify({"status": "ok"})

@app.route('/api/simulate/stop', methods=['POST'])
def stop_simulation():
    global simulation_active
    simulation_active = False
    return jsonify({"status": "ok"})
```

This must produce IDENTICAL event shapes to real hardware — the frontend must never be able to tell the difference. This is your insurance policy if any physical sensor fails during judging.

**Done when**: `/api/simulate/start` produces live-updating workers/hexapod/map data visually indistinguishable from a real sensor test, and `/api/simulate/stop` cleanly halts it.

---

## Phase 5 — Frontend wiring (`DashboardContext.tsx`)

This is the only frontend file that should change.

- Add `import { io, Socket } from 'socket.io-client';` at the top
- On mount (inside a `useEffect`), connect: `const socket = io('http://localhost:5001');`
- On initial load, `fetch('http://localhost:5001/api/state')` and use its response to set initial `workers`, `zones`, `hexapod`, `mapPoints`, `alerts` state — replacing the hardcoded `initialWorkers`/`initialZones` constants as the SOURCE OF TRUTH (keep the constants in the file as a fallback default only, used if the fetch fails)
- Subscribe to each event and merge into existing state, matching the existing `setWorkers`/`setHexapod`/etc setters already in the file:
  ```typescript
  socket.on('worker_update', (worker: WorkerData) => {
    setWorkers(prev => prev.map(w => w.id === worker.id ? worker : w));
  });
  socket.on('hexapod_update', (hexapod: HexapodState) => setHexapod(hexapod));
  socket.on('map_update', (data: { newPoints: MapPoint[] }) => {
    setMapPoints(prev => [...prev, ...data.newPoints]);
  });
  socket.on('alert', (alert: AlertItem) => setAlerts(prev => [alert, ...prev]));
  ```
- **Keep the existing `setInterval` simulation code intact but gate it**: only run the internal JS simulation if the socket fails to connect (`socket.on('connect_error', () => { /* fall back to existing setInterval logic */ })`) — this preserves your current working demo mode as an automatic fallback with zero risk
- Do not touch `toggleSimulation`, `triggerHazard`, or `sendRobotCommand` signatures — if you want these to control the REAL backend simulator instead of local JS state, have them call the Phase 4 endpoints (`fetch('/api/simulate/start')`, etc.) instead of mutating local state directly, but keep the same function signatures so no component needs to change

**Done when**: with the backend running, opening the dashboard shows data that updates from real `curl` test calls instead of the internal timer; killing the backend and refreshing falls back to the existing simulated experience without a crash.

---

## Final integration checklist

- [ ] `/api/state` shape matches `types/index.ts` exactly, field-for-field
- [ ] Each ingest endpoint tested via curl before any real firmware touches it
- [ ] Map points visibly trace a plausible path/arc from sample scan data
- [ ] Threshold breaches produce alerts matching the existing `AlertItem` shape
- [ ] Simulation mode produces identical event shapes to real endpoints
- [ ] Frontend falls back gracefully to its original `setInterval` demo if the backend is unreachable
- [ ] No changes made to any file under `components/` or `pages/`
