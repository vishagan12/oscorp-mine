"""
OSCORP Mine Safety Telemetry — Simulation Engine
Background thread that exercises the SAME internal functions as real ingest endpoints,
producing identical SocketIO event shapes. Activated via POST /api/simulate/start.
"""

import math
import time
import random

# Patrol route matching the frontend's PATROL_ROUTE in DashboardContext.tsx
PATROL_WAYPOINTS = [
    {'x': -185, 'y': 0,    'speed': 2.2},
    {'x': -140, 'y': 0,    'speed': 2.4},
    {'x': -100, 'y': 0,    'speed': 2.0},
    {'x':  -60, 'y': 0,    'speed': 1.4},
    {'x':  -60, 'y': 35,   'speed': 2.0},
    {'x':  -60, 'y': 70,   'speed': 1.6},
    {'x':  -60, 'y': 105,  'speed': 0.0, 'dwell': 10},
    {'x':  -60, 'y': 70,   'speed': 2.0},
    {'x':  -60, 'y': 35,   'speed': 1.6},
    {'x':  -60, 'y': 0,    'speed': 1.4},
    {'x':  -25, 'y': 7,    'speed': 2.2},
    {'x':   10, 'y': 15,   'speed': 2.0},
    {'x':   40, 'y': 20,   'speed': 1.4},
    {'x':   40, 'y': -20,  'speed': 2.0},
    {'x':   40, 'y': -65,  'speed': 1.6},
    {'x':   40, 'y': -115, 'speed': 0.0, 'dwell': 12},
    {'x':   40, 'y': -65,  'speed': 2.0},
    {'x':   40, 'y': -20,  'speed': 1.6},
    {'x':   40, 'y': 20,   'speed': 1.4},
    {'x':   80, 'y': 22,   'speed': 2.4},
    {'x':  120, 'y': 22,   'speed': 2.0},
    {'x':  160, 'y': 20,   'speed': 1.4},
    {'x':  195, 'y': 36,   'speed': 2.0},
    {'x':  230, 'y': 48,   'speed': 1.6},
    {'x':  270, 'y': 55,   'speed': 0.0, 'dwell': 10},
    {'x':  230, 'y': 48,   'speed': 2.0},
    {'x':  195, 'y': 36,   'speed': 1.6},
    {'x':  160, 'y': 20,   'speed': 1.4},
    {'x':  200, 'y': 12,   'speed': 2.0},
    {'x':  240, 'y': 0,    'speed': 0.0, 'dwell': 8},
    {'x':  200, 'y': 12,   'speed': 2.2},
    {'x':  160, 'y': 20,   'speed': 2.2},
    {'x':  120, 'y': 22,   'speed': 2.5},
    {'x':   80, 'y': 22,   'speed': 2.4},
    {'x':   40, 'y': 20,   'speed': 2.2},
    {'x':   10, 'y': 15,   'speed': 2.2},
    {'x':  -25, 'y': 7,    'speed': 2.2},
    {'x':  -60, 'y': 0,    'speed': 2.4},
    {'x': -100, 'y': 0,    'speed': 2.4},
    {'x': -140, 'y': 0,    'speed': 2.0},
    {'x': -185, 'y': 0,    'speed': 1.8},
]

# Tunnel segments for wall-distance ray casting (same as frontend)
TUNNEL_SEGMENTS = [
    (-185, 0, -140, 0), (-140, 0, -100, 0), (-100, 0, -60, 0),
    (-60, 0, -25, 7), (-25, 7, 10, 15), (10, 15, 40, 20),
    (40, 20, 80, 22), (80, 22, 120, 22), (120, 22, 160, 20),
    (160, 20, 200, 12), (200, 12, 240, 0),
    (-60, 0, -60, 35), (-60, 35, -60, 70), (-60, 70, -60, 105),
    (40, 20, 40, -20), (40, -20, 40, -65), (40, -65, 40, -115),
    (160, 20, 195, 36), (195, 36, 230, 48), (230, 48, 270, 55),
]


def _dist_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def _min_dist_to_tunnel(px, py):
    return min(_dist_to_segment(px, py, *seg) for seg in TUNNEL_SEGMENTS)


def _get_tunnel_distance(x, y, angle_deg):
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    for d_int in range(3, 72):
        d = d_int * 1.5
        if d > 70:
            break
        tx, ty = x + cos_a * d, y + sin_a * d
        if _min_dist_to_tunnel(tx, ty) >= 15.2:
            return d + (random.random() - 0.5) * 0.5
    return 70.0


def run_simulation_loop(socketio, state, simulation_active_ref):
    """Background simulation loop. Called via socketio.start_background_task().

    Uses the same state dict and emits identical event shapes as the real ingest
    endpoints, so the frontend cannot distinguish simulated from real data.
    """
    waypoint_idx = 0
    dwell_count = 0
    cycle_count = 1
    hex_state = state['hexapod']
    hex_state['x'] = -185.0
    hex_state['y'] = 0.0
    hex_state['heading'] = 0
    hex_state['speedMps'] = 2.2
    hex_state['status'] = 'scanning'
    hex_state['battery'] = 92.0

    tick = 0

    while simulation_active_ref():
        tick += 1
        total_pts = len(PATROL_WAYPOINTS)
        current_target = PATROL_WAYPOINTS[waypoint_idx]
        next_target = PATROL_WAYPOINTS[(waypoint_idx + 1) % total_pts]

        dx = current_target['x'] - hex_state['x']
        dy = current_target['y'] - hex_state['y']
        dist_to_target = math.hypot(dx, dy)

        # --- Patrol navigation ---
        if dwell_count > 0:
            dwell_count -= 1
            hex_state['speedMps'] = 0.0
            hex_state['heading'] = (hex_state['heading'] + 6) % 360
            if dwell_count == 0:
                waypoint_idx = (waypoint_idx + 1) % total_pts
                if waypoint_idx == 0:
                    cycle_count += 1
        else:
            if dist_to_target < 3.8:
                if current_target.get('dwell', 0) > 0:
                    dwell_count = current_target['dwell']
                    hex_state['speedMps'] = 0.0
                else:
                    waypoint_idx = (waypoint_idx + 1) % total_pts
                    if waypoint_idx == 0:
                        cycle_count += 1

            desired_heading = math.degrees(math.atan2(dy, dx))
            diff = desired_heading - hex_state['heading']
            while diff > 180:
                diff -= 360
            while diff < -180:
                diff += 360

            is_sharp = abs(diff) > 40
            target_speed = min(1.4, current_target['speed']) if is_sharp else current_target['speed']
            hex_state['speedMps'] = round(hex_state['speedMps'] + (target_speed - hex_state['speedMps']) * 0.25, 2)

            max_turn = 14 if is_sharp else 9
            turn_step = (1 if diff > 0 else -1) * min(abs(diff), max_turn)
            hex_state['heading'] = round((hex_state['heading'] + turn_step + 360) % 360)

            step_dist = hex_state['speedMps'] * 0.25
            rad = math.radians(hex_state['heading'])
            hex_state['x'] = round(hex_state['x'] + math.cos(rad) * step_dist, 2)
            hex_state['y'] = round(hex_state['y'] + math.sin(rad) * step_dist, 2)

        # --- Gas drift ---
        hex_state['gasPpm'] = max(140, hex_state.get('gasPpm', 210) + (random.random() - 0.5) * 2.2)
        hex_state['coPpm'] = round(hex_state['gasPpm'] * 0.016, 1)
        hex_state['ch4Percent'] = round(hex_state['gasPpm'] * 0.0006, 3)
        hex_state['battery'] = max(12, hex_state.get('battery', 92) - 0.001)

        # --- LiDAR scan beams & SLAM points ---
        new_points = []
        beams = []
        for i in range(36):
            angle_deg = (i * 10 + hex_state['heading']) % 360
            dist = _get_tunnel_distance(hex_state['x'], hex_state['y'], angle_deg)
            rad = math.radians(angle_deg)
            px = round(hex_state['x'] + dist * math.cos(rad), 2)
            py = round(hex_state['y'] + dist * math.sin(rad), 2)
            hit = dist < 65
            beams.append({'x1': hex_state['x'], 'y1': hex_state['y'], 'x2': px, 'y2': py, 'hit': hit})
            if hit:
                new_points.append({
                    'x': px, 'y': py,
                    'gasPpm': hex_state['gasPpm'] + (random.random() - 0.5) * 8
                })

        state['mapPoints'] = (state['mapPoints'] + new_points)[-2200:]

        # --- Emit hexapod telemetry ---
        socketio.emit('hexapod_update', hex_state)
        socketio.emit('map_update', {'newPoints': new_points, 'beams': beams})
        socketio.emit('path_update', {'x': hex_state['x'], 'y': hex_state['y']})

        # --- Worker vital signs drift (every 3 ticks) ---
        if tick % 3 == 0:
            for w in state['workers']:
                w['bpm'] = round(min(150, max(58, w['bpm'] + (random.random() - 0.5) * 1.5)))
                w['bpmHistory'] = (w['bpmHistory'] + [w['bpm']])[-10:]
            socketio.emit('workers_update', state['workers'])

        # --- Safety score update (every 5 ticks) ---
        if tick % 5 == 0:
            from logic import compute_safety_score
            state['safetyScore'] = compute_safety_score(
                state['workers'], hex_state, state.get('evacActive', False)
            )
            socketio.emit('safety_score_update', {'safetyScore': state['safetyScore']})

        socketio.sleep(0.12)  # ~8.3 Hz, matching frontend's 120ms setInterval
