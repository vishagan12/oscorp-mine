# Phase 3 — Map Building Engine

### Goal
Turn a stream of scan packets (robot position + distance readings + gas ppm) into an incrementally-growing 2D map the frontend can render, without attempting full SLAM (out of scope for 24h).

### Create: `mining-dashboard/map_engine.py`

```python
class MapEngine:
    def __init__(self):
        self.points = []          # list of {x, y, gas_ppm}
        self.robot_path = []      # list of {x, y, heading, t}
        self.latest_gas = 0

    def ingest_scan(self, data):
        rx, ry, heading = data['robot_x'], data['robot_y'], data['robot_heading']
        self.robot_path.append({'x': rx, 'y': ry, 'heading': heading})
        self.latest_gas = data['gas_ppm']

        # Convert each of the 19 distance readings (0-180 deg sweep) into
        # absolute x,y points using basic trigonometry, relative to the
        # robot's current position and heading.
        for i, dist in enumerate(data['distances']):
            if dist <= 0:
                continue
            angle_deg = heading - 90 + (i * 10)   # sweep is robot-relative
            angle_rad = math.radians(angle_deg)
            px = rx + dist * math.cos(angle_rad)
            py = ry + dist * math.sin(angle_rad)
            self.points.append({'x': px, 'y': py, 'gas_ppm': data['gas_ppm']})

    def get_latest_update(self):
        # Only the newest batch — this is what gets emitted over SocketIO
        # for incremental rendering (see Phase 4)
        return {
            'new_points': self.points[-19:],
            'robot_pos': self.robot_path[-1] if self.robot_path else None,
            'gas_ppm': self.latest_gas
        }

    def get_full_state(self):
        # Full snapshot for initial page load / reconnect
        return {
            'points': self.points,
            'path': self.robot_path,
            'gas_ppm': self.latest_gas
        }
```

Import `math` at the top of the file. Instantiate one global `map_engine = MapEngine()` in `app.py` and use it from the `/api/hexapod/scan` route added in Phase 2.

### Note on scope
This is a point-cloud/scatter map, not a clean occupancy grid with walls — that's the right tradeoff for 24 hours. It still visually reads as "the hexapod is mapping the tunnel" because points accumulate along real walls as the robot moves, and it directly supports the hazard-heatmap look (color points by `gas_ppm`).

### Done when
- [ ] Feeding 5–10 sample scan packets (varying `robot_x`/`robot_y`/`heading`) into `map_engine.ingest_scan()` in a quick Python REPL produces a `points` list that looks like a plausible scatter of wall positions, not all clustered at one spot
- [ ] `get_latest_update()` only returns the newest 19 points, not the whole history (keeps SocketIO payloads small)
- [ ] `get_full_state()` returns everything, for use on initial dashboard load
