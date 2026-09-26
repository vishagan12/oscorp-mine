"""
OSCORP Mine Safety Platform — Flask + SocketIO Backend
Real-time telemetry ingestion, WebSocket broadcasting, and simulation fallback.

All emitted event shapes match the TypeScript interfaces in
strata-dashboard/src/types/index.ts field-for-field (camelCase preserved).
"""

import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS

from logic import (
    distances_to_map_points,
    compute_worker_status,
    check_gas_thresholds,
    compute_safety_score,
    create_alert,
)
from simulator import run_simulation_loop

# ─── App Setup ────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# ─── In-Memory State ─────────────────────────────────────────────────────────
# Mirrors the frontend's initial state exactly (field names match TypeScript camelCase)

state = {
    'workers': [
        {'id': 'W-01', 'name': 'J. Miller', 'role': 'Blaster Lead', 'zone': 'Zone A - Stope 4',
         'bpm': 74, 'bpmHistory': [72, 73, 75, 74, 74], 'spo2': 98, 'temp': 36.8,
         'helmetOn': True, 'battery': 92, 'status': 'nominal', 'assignedEvacRoute': 'Adit North -> Portal 1'},
        {'id': 'W-02', 'name': 'S. Patel', 'role': 'Geotech Eng', 'zone': 'Zone A - Stope 4',
         'bpm': 81, 'bpmHistory': [79, 80, 82, 81, 81], 'spo2': 97, 'temp': 37.1,
         'helmetOn': True, 'battery': 85, 'status': 'nominal', 'assignedEvacRoute': 'Adit North -> Portal 1'},
        {'id': 'W-03', 'name': 'T. Johnson', 'role': 'Haulage Driver', 'zone': 'Zone B - Decline 2',
         'bpm': 68, 'bpmHistory': [67, 68, 68, 69, 68], 'spo2': 99, 'temp': 36.6,
         'helmetOn': True, 'battery': 94, 'status': 'nominal', 'assignedEvacRoute': 'Haulway East -> Shaft 2'},
        {'id': 'W-04', 'name': 'M. Vance', 'role': 'Ventilation Tech', 'zone': 'Zone B - Decline 2',
         'bpm': 88, 'bpmHistory': [85, 87, 88, 89, 88], 'spo2': 96, 'temp': 37.0,
         'helmetOn': True, 'battery': 78, 'status': 'nominal', 'assignedEvacRoute': 'Haulway East -> Shaft 2'},
        {'id': 'W-05', 'name': 'R. Kowalski', 'role': 'Drill Operator', 'zone': 'Zone C - Level 6',
         'bpm': 95, 'bpmHistory': [92, 94, 96, 95, 95], 'spo2': 97, 'temp': 37.3,
         'helmetOn': True, 'battery': 88, 'status': 'nominal', 'assignedEvacRoute': 'Escape Way B -> Hoist 1'},
        {'id': 'W-06', 'name': 'D. Zhang', 'role': 'Surveyor', 'zone': 'Zone C - Level 6',
         'bpm': 76, 'bpmHistory': [75, 76, 76, 77, 76], 'spo2': 98, 'temp': 36.7,
         'helmetOn': True, 'battery': 64, 'status': 'nominal', 'assignedEvacRoute': 'Escape Way B -> Hoist 1'},
        {'id': 'W-07', 'name': "A. O'Connor", 'role': 'Electrician', 'zone': 'Zone D - Sub-Lvl 8',
         'bpm': 72, 'bpmHistory': [70, 71, 73, 72, 72], 'spo2': 99, 'temp': 36.5,
         'helmetOn': True, 'battery': 90, 'status': 'nominal', 'assignedEvacRoute': 'Sub-Drift South -> Shaft 1'},
        {'id': 'W-08', 'name': 'L. Garcia', 'role': 'Safety Warden', 'zone': 'Zone D - Sub-Lvl 8',
         'bpm': 83, 'bpmHistory': [82, 83, 84, 83, 83], 'spo2': 98, 'temp': 36.9,
         'helmetOn': True, 'battery': 96, 'status': 'nominal', 'assignedEvacRoute': 'Sub-Drift South -> Shaft 1'},
        {'id': 'W-09', 'name': 'E. Becker', 'role': 'Mucking Tech', 'zone': 'Zone B - Decline 2',
         'bpm': 89, 'bpmHistory': [87, 88, 90, 89, 89], 'spo2': 95, 'temp': 37.2,
         'helmetOn': True, 'battery': 71, 'status': 'nominal', 'assignedEvacRoute': 'Haulway East -> Shaft 2'},
        {'id': 'W-10', 'name': 'K. Tanaka', 'role': 'Robotics Handler', 'zone': 'Zone A - Scout Bay',
         'bpm': 71, 'bpmHistory': [70, 71, 71, 72, 71], 'spo2': 98, 'temp': 36.6,
         'helmetOn': True, 'battery': 99, 'status': 'nominal', 'assignedEvacRoute': 'Adit North -> Portal 1'},
    ],
    'zones': [
        {'id': 'Z-A', 'name': 'Zone A - Stope 4', 'depthM': -420, 'stressIndex': 18,
         'workersCount': 3, 'gasStatus': 'safe', 'ventilationPct': 92, 'stability': 'stable'},
        {'id': 'Z-B', 'name': 'Zone B - Decline 2', 'depthM': -510, 'stressIndex': 26,
         'workersCount': 3, 'gasStatus': 'safe', 'ventilationPct': 88, 'stability': 'stable'},
        {'id': 'Z-C', 'name': 'Zone C - Level 6 Face', 'depthM': -615, 'stressIndex': 32,
         'workersCount': 2, 'gasStatus': 'safe', 'ventilationPct': 84, 'stability': 'stable'},
        {'id': 'Z-D', 'name': 'Zone D - Sub-Lvl 8', 'depthM': -780, 'stressIndex': 21,
         'workersCount': 2, 'gasStatus': 'safe', 'ventilationPct': 95, 'stability': 'stable'},
    ],
    'hexapod': {
        'x': -185, 'y': 0, 'heading': 0, 'battery': 92, 'signalDbm': -60,
        'status': 'idle', 'gasPpm': 210, 'coPpm': 3.4, 'o2Percent': 20.9,
        'ch4Percent': 0.12, 'fissureDetected': False, 'speedMps': 0,
        'thermalMode': False, 'streamUrl': '',
    },
    'mapPoints': [],
    'alerts': [],
    'safetyScore': 96,
    'evacActive': False,
}

# ─── Simulation State ────────────────────────────────────────────────────────

simulation_active = False


def is_simulation_active():
    return simulation_active


# ─── REST Endpoints ──────────────────────────────────────────────────────────

@app.route('/api/state', methods=['GET'])
def get_state():
    """Return the full system state (matches TypeScript types exactly)."""
    return jsonify({
        'workers': state['workers'],
        'zones': state['zones'],
        'hexapod': state['hexapod'],
        'mapPoints': state['mapPoints'],
        'alerts': state['alerts'],
        'safetyScore': state['safetyScore'],
        'evacActive': state['evacActive'],
    })


@app.route('/api/worker/vitals', methods=['POST'])
def worker_vitals():
    """Ingest worker biometric telemetry: { workerId, bpm, spo2, temp }"""
    data = request.get_json()
    worker = next((w for w in state['workers'] if w['id'] == data['workerId']), None)
    if not worker:
        return jsonify({'status': 'error', 'message': 'unknown worker'}), 404

    worker['bpm'] = data['bpm']
    worker['bpmHistory'] = (worker['bpmHistory'] + [data['bpm']])[-10:]
    worker['spo2'] = data['spo2']
    worker['temp'] = data['temp']
    worker['status'] = compute_worker_status(worker)

    socketio.emit('worker_update', worker)

    # Generate alerts on threshold breach
    if worker['status'] == 'critical':
        alert = create_alert('critical', 'vitals', f"{worker['name']} vital signs critical — BPM:{data['bpm']} SpO2:{data['spo2']}", worker['id'])
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)
    elif worker['status'] == 'warning':
        alert = create_alert('warning', 'vitals', f"{worker['name']} vital signs elevated — BPM:{data['bpm']} SpO2:{data['spo2']}", worker['id'])
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)

    return jsonify({'status': 'ok'})


@app.route('/api/worker/helmet', methods=['POST'])
def worker_helmet():
    """Ingest helmet on/off status: { workerId, helmetOn }"""
    data = request.get_json()
    worker = next((w for w in state['workers'] if w['id'] == data['workerId']), None)
    if not worker:
        return jsonify({'status': 'error', 'message': 'unknown worker'}), 404

    worker['helmetOn'] = data['helmetOn']
    socketio.emit('worker_update', worker)

    if not data['helmetOn']:
        alert = create_alert('warning', 'helmet', f"{worker['name']} helmet detached", worker['id'])
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)

    return jsonify({'status': 'ok'})


@app.route('/api/hexapod/scan', methods=['POST'])
def hexapod_scan():
    """Ingest hexapod LiDAR scan: { x, y, heading, distances, gasPpm, coPpm, o2Percent, ch4Percent }"""
    data = request.get_json()

    state['hexapod'].update({
        'x': data['x'],
        'y': data['y'],
        'heading': data['heading'],
        'gasPpm': data.get('gasPpm', 0),
        'coPpm': data.get('coPpm', 0),
        'o2Percent': data.get('o2Percent', 20.9),
        'ch4Percent': data.get('ch4Percent', 0),
    })

    new_points = distances_to_map_points(data)
    state['mapPoints'].extend(new_points)

    socketio.emit('hexapod_update', state['hexapod'])
    socketio.emit('map_update', {'newPoints': new_points})

    # Gas threshold check
    gas_status = check_gas_thresholds(data)
    if gas_status == 'critical':
        alert = create_alert('critical', 'gas', f"DANGEROUS atmosphere — CO:{data.get('coPpm', 0)} ppm, CH4:{data.get('ch4Percent', 0)}%")
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)
    elif gas_status == 'warning':
        alert = create_alert('warning', 'gas', f"Elevated gases detected — CO:{data.get('coPpm', 0)} ppm")
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)

    return jsonify({'status': 'ok'})


@app.route('/api/hexapod/camera_url', methods=['POST'])
def set_camera_url():
    """Set hexapod live camera stream URL: { streamUrl }"""
    data = request.get_json()
    state['hexapod']['streamUrl'] = data['streamUrl']
    socketio.emit('hexapod_update', state['hexapod'])
    return jsonify({'status': 'ok'})


@app.route('/api/hexapod/command', methods=['POST'])
def hexapod_command():
    """Send a manual command to hexapod: { command: 'forward' | 'backward' | ... }"""
    data = request.get_json()
    cmd = data.get('command', '')
    # In real deployment, forward to hardware. Here we just acknowledge.
    socketio.emit('hexapod_command', {'command': cmd})
    return jsonify({'status': 'ok', 'command': cmd})


@app.route('/api/evacuate', methods=['POST'])
def trigger_evacuation():
    """Trigger mine-wide evacuation protocol."""
    state['evacActive'] = True
    state['hexapod']['status'] = 'evacuating'
    alert = create_alert('critical', 'system', 'EVACUATION PROTOCOL ACTIVATED — All personnel proceed to nearest exit')
    state['alerts'].insert(0, alert)
    socketio.emit('alert', alert)
    socketio.emit('hexapod_update', state['hexapod'])
    socketio.emit('evac_update', {'evacActive': True})
    return jsonify({'status': 'ok'})


@app.route('/api/evacuate/cancel', methods=['POST'])
def cancel_evacuation():
    """Cancel evacuation and return to normal operations."""
    state['evacActive'] = False
    state['hexapod']['status'] = 'scanning'
    alert = create_alert('info', 'system', 'Evacuation cancelled — Normal operations resumed')
    state['alerts'].insert(0, alert)
    socketio.emit('alert', alert)
    socketio.emit('hexapod_update', state['hexapod'])
    socketio.emit('evac_update', {'evacActive': False})
    return jsonify({'status': 'ok'})


@app.route('/api/alert/acknowledge', methods=['POST'])
def acknowledge_alert():
    """Acknowledge an alert: { alertId }"""
    data = request.get_json()
    alert = next((a for a in state['alerts'] if a['id'] == data.get('alertId')), None)
    if alert:
        alert['acknowledged'] = True
        socketio.emit('alert_ack', {'alertId': alert['id']})
    return jsonify({'status': 'ok'})


@app.route('/api/seismic', methods=['POST'])
def seismic_event():
    """Ingest seismic node data: { zone, magnitude, confidence }"""
    data = request.get_json()
    mag = data.get('magnitude', 0)
    zone_name = data.get('zone', '')
    
    zone = next((z for z in state['zones'] if zone_name.lower() in z['name'].lower()), state['zones'][0])
    
    if mag > 4.5:
        zone['stability'] = 'compromised'
        alert = create_alert('critical', 'system', f'SEISMIC EVENT: Magnitude {mag} detected in {zone["name"]}')
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)
        
        # Trigger evac on major seismic event
        if mag > 5.5 and not state['evacActive']:
            state['evacActive'] = True
            state['hexapod']['status'] = 'evacuating'
            evac_alert = create_alert('critical', 'system', 'EVACUATION PROTOCOL ACTIVATED due to major seismic event')
            state['alerts'].insert(0, evac_alert)
            socketio.emit('alert', evac_alert)
            socketio.emit('hexapod_update', state['hexapod'])
            socketio.emit('evac_update', {'evacActive': True})
            
    elif mag > 3.0:
        zone['stability'] = 'monitoring'
        alert = create_alert('warning', 'system', f'Tremor: Magnitude {mag} detected in {zone["name"]}')
        state['alerts'].insert(0, alert)
        socketio.emit('alert', alert)

    socketio.emit('zones_update', state['zones'])
    return jsonify({'status': 'ok'})

# ─── Simulation Control ─────────────────────────────────────────────────────

@app.route('/api/simulate/start', methods=['POST'])
def start_simulation():
    """Start the background simulation loop."""
    global simulation_active
    if simulation_active:
        return jsonify({'status': 'already_running'})
    simulation_active = True
    socketio.start_background_task(run_simulation_loop, socketio, state, is_simulation_active)
    return jsonify({'status': 'ok'})


@app.route('/api/simulate/stop', methods=['POST'])
def stop_simulation():
    """Stop the background simulation loop."""
    global simulation_active
    simulation_active = False
    return jsonify({'status': 'ok'})


# ─── SocketIO Events ─────────────────────────────────────────────────────────

@socketio.on('connect')
def handle_connect():
    print(f'[OSCORP] Client connected: {request.sid}')


@socketio.on('disconnect')
def handle_disconnect():
    print(f'[OSCORP] Client disconnected: {request.sid}')


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('=' * 50)
    print(' OSCORP Mine Safety Platform - Backend')
    print(' Port: 5001 | Mode: eventlet')
    print('=' * 50)
    socketio.run(app, host='0.0.0.0', port=5001)
