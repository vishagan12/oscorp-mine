"""
OSCORP Mine Safety Telemetry — Business Logic Module
Threshold evaluation, map point conversion, and alert generation.
All thresholds match mining safety regulation standards.
"""

import math
import uuid
from datetime import datetime, timezone


# ─── Map Point Conversion ────────────────────────────────────────────────────

def distances_to_map_points(scan_data: dict) -> list[dict]:
    """Convert a hexapod LiDAR distance sweep into absolute MapPoint objects.

    scan_data expects:
        x, y, heading (degrees), distances (list of floats in meters),
        gasPpm (float)

    Each distance entry corresponds to a ray cast at heading - 90 + (i * 10) degrees.
    Returns list of {x, y, gasPpm} dicts matching the MapPoint TypeScript interface.
    """
    points = []
    rx = scan_data.get('x', 0)
    ry = scan_data.get('y', 0)
    heading = scan_data.get('heading', 0)
    gas = scan_data.get('gasPpm', 0)

    for i, dist in enumerate(scan_data.get('distances', [])):
        if dist <= 0:
            continue
        angle_deg = heading - 90 + (i * 10)
        angle_rad = math.radians(angle_deg)
        points.append({
            'x': round(rx + dist * math.cos(angle_rad), 2),
            'y': round(ry + dist * math.sin(angle_rad), 2),
            'gasPpm': gas,
        })
    return points


# ─── Worker Status Evaluation ────────────────────────────────────────────────

def compute_worker_status(worker: dict) -> str:
    """Evaluate a worker's vital signs against mining safety thresholds.

    Critical:  BPM > 150 | SpO2 < 90 | Temp > 38.5°C
    Warning:   BPM > 130 | SpO2 < 94 | Temp > 37.8°C
    Otherwise: nominal
    """
    bpm = worker.get('bpm', 72)
    spo2 = worker.get('spo2', 98)
    temp = worker.get('temp', 36.8)

    if bpm > 150 or spo2 < 90 or temp > 38.5:
        return 'critical'
    if bpm > 130 or spo2 < 94 or temp > 37.8:
        return 'warning'
    return 'nominal'


# ─── Gas Threshold Evaluation ────────────────────────────────────────────────

def check_gas_thresholds(data: dict) -> str:
    """Evaluate atmospheric gas levels against OSHA mine safety limits.

    CO > 50 ppm:  critical
    CO > 25 ppm:  warning
    CH4 > 1.0%:   critical
    CH4 > 0.5%:   warning
    O2 < 19.5%:   warning
    O2 < 18.0%:   critical
    """
    co = data.get('coPpm', 0)
    ch4 = data.get('ch4Percent', 0)
    o2 = data.get('o2Percent', 20.9)

    if co > 50 or ch4 > 1.0 or o2 < 18.0:
        return 'critical'
    if co > 25 or ch4 > 0.5 or o2 < 19.5:
        return 'warning'
    return 'safe'


# ─── Safety Score Computation ────────────────────────────────────────────────

def compute_safety_score(workers: list[dict], hexapod: dict, evac_active: bool) -> int:
    """Compute a 0-100 safety score from current system state."""
    score = 100

    # Worker penalties
    for w in workers:
        if w.get('status') == 'critical':
            score -= 8
        elif w.get('status') == 'warning':
            score -= 3
        if not w.get('helmetOn', True):
            score -= 5

    # Gas penalties
    gas_ppm = hexapod.get('gasPpm', 0)
    if gas_ppm > 500:
        score -= 15
    elif gas_ppm > 300:
        score -= 8

    co = hexapod.get('coPpm', 0)
    if co > 50:
        score -= 12
    elif co > 25:
        score -= 5

    # Fissure penalty
    if hexapod.get('fissureDetected', False):
        score -= 10

    # Evacuation penalty
    if evac_active:
        score -= 20

    return max(0, min(100, score))


# ─── Alert Factory ───────────────────────────────────────────────────────────

def create_alert(severity: str, source: str, message: str, worker_id: str = None) -> dict:
    """Create an AlertItem matching the TypeScript interface exactly."""
    alert = {
        'id': f'alt-{uuid.uuid4().hex[:8]}',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'severity': severity,
        'source': source,
        'message': message,
    }
    if worker_id:
        alert['workerId'] = worker_id
    return alert
