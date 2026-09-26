import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DashboardTab, WorkerData, HexapodState, MapPoint, ZoneStatus, AlertItem, MinePatrolWaypoint, ActivePatrolInfo } from '../types';

const BACKEND_URL = 'http://localhost:5001';

interface DashboardContextType {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  workers: WorkerData[];
  hexapod: HexapodState;
  mapPoints: MapPoint[];
  mapPath: { x: number; y: number }[];
  activeScanBeams: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[];
  activePatrol: ActivePatrolInfo;
  patrolRoute: MinePatrolWaypoint[];
  zones: ZoneStatus[];
  alerts: AlertItem[];
  safetyScore: number;
  evacActive: boolean;
  sirenMuted: boolean;
  simulationRunning: boolean;
  toggleSiren: () => void;
  toggleSimulation: () => void;
  triggerHazard: (type: 'high_co' | 'low_o2' | 'methane' | 'fissure' | 'helmet_off' | 'cardiac' | 'evacuate' | 'seismic') => void;
  resetSystem: () => void;
  acknowledgeAlert: (id: string) => void;
  sendRobotCommand: (cmd: 'forward' | 'backward' | 'left' | 'right' | 'scan' | 'stop') => void;
  clearMap: () => void;
}

const initialWorkers: WorkerData[] = [
  { id: 'W-01', name: 'J. Miller', role: 'Blaster Lead', zone: 'Zone A - Stope 4', bpm: 74, bpmHistory: [72, 73, 75, 74, 74], spo2: 98, temp: 36.8, helmetOn: true, battery: 92, status: 'nominal', assignedEvacRoute: 'Adit North -> Portal 1' },
  { id: 'W-02', name: 'S. Patel', role: 'Geotech Eng', zone: 'Zone A - Stope 4', bpm: 81, bpmHistory: [79, 80, 82, 81, 81], spo2: 97, temp: 37.1, helmetOn: true, battery: 85, status: 'nominal', assignedEvacRoute: 'Adit North -> Portal 1' },
  { id: 'W-03', name: 'T. Johnson', role: 'Haulage Driver', zone: 'Zone B - Decline 2', bpm: 68, bpmHistory: [67, 68, 68, 69, 68], spo2: 99, temp: 36.6, helmetOn: true, battery: 94, status: 'nominal', assignedEvacRoute: 'Haulway East -> Shaft 2' },
  { id: 'W-04', name: 'M. Vance', role: 'Ventilation Tech', zone: 'Zone B - Decline 2', bpm: 88, bpmHistory: [85, 87, 88, 89, 88], spo2: 96, temp: 37.0, helmetOn: true, battery: 78, status: 'nominal', assignedEvacRoute: 'Haulway East -> Shaft 2' },
  { id: 'W-05', name: 'R. Kowalski', role: 'Drill Operator', zone: 'Zone C - Level 6', bpm: 95, bpmHistory: [92, 94, 96, 95, 95], spo2: 97, temp: 37.3, helmetOn: true, battery: 88, status: 'nominal', assignedEvacRoute: 'Escape Way B -> Hoist 1' },
  { id: 'W-06', name: 'D. Zhang', role: 'Surveyor', zone: 'Zone C - Level 6', bpm: 76, bpmHistory: [75, 76, 76, 77, 76], spo2: 98, temp: 36.7, helmetOn: true, battery: 64, status: 'nominal', assignedEvacRoute: 'Escape Way B -> Hoist 1' },
  { id: 'W-07', name: 'A. O\'Connor', role: 'Electrician', zone: 'Zone D - Sub-Lvl 8', bpm: 72, bpmHistory: [70, 71, 73, 72, 72], spo2: 99, temp: 36.5, helmetOn: true, battery: 90, status: 'nominal', assignedEvacRoute: 'Sub-Drift South -> Shaft 1' },
  { id: 'W-08', name: 'L. Garcia', role: 'Safety Warden', zone: 'Zone D - Sub-Lvl 8', bpm: 83, bpmHistory: [82, 83, 84, 83, 83], spo2: 98, temp: 36.9, helmetOn: true, battery: 96, status: 'nominal', assignedEvacRoute: 'Sub-Drift South -> Shaft 1' },
  { id: 'W-09', name: 'E. Becker', role: 'Mucking Tech', zone: 'Zone B - Decline 2', bpm: 89, bpmHistory: [87, 88, 90, 89, 89], spo2: 95, temp: 37.2, helmetOn: true, battery: 71, status: 'nominal', assignedEvacRoute: 'Haulway East -> Shaft 2' },
  { id: 'W-10', name: 'K. Tanaka', role: 'Robotics Handler', zone: 'Zone A - Scout Bay', bpm: 71, bpmHistory: [70, 71, 71, 72, 71], spo2: 98, temp: 36.6, helmetOn: true, battery: 99, status: 'nominal', assignedEvacRoute: 'Adit North -> Portal 1' },
];

const initialZones: ZoneStatus[] = [
  { id: 'Z-A', name: 'Zone A - Stope 4', depthM: -420, stressIndex: 18, workersCount: 3, gasStatus: 'safe', ventilationPct: 92, stability: 'stable' },
  { id: 'Z-B', name: 'Zone B - Decline 2', depthM: -510, stressIndex: 26, workersCount: 3, gasStatus: 'safe', ventilationPct: 88, stability: 'stable' },
  { id: 'Z-C', name: 'Zone C - Level 6 Face', depthM: -615, stressIndex: 32, workersCount: 2, gasStatus: 'safe', ventilationPct: 84, stability: 'stable' },
  { id: 'Z-D', name: 'Zone D - Sub-Lvl 8', depthM: -780, stressIndex: 21, workersCount: 2, gasStatus: 'safe', ventilationPct: 95, stability: 'stable' },
];

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Comprehensive 41-Waypoint Autonomous SLAM Exploration Route
// Covers 100% of the subterranean drift network:
// West Haulage -> South Vent Incline & Terminus -> Central Curves -> North Stope Face -> East Haulage -> Sub-Level 08 Heading -> East Face -> Full Westbound Return
export const PATROL_ROUTE: MinePatrolWaypoint[] = [
  // 1. West Haulage: Portal 01 to South Junction
  { id: 'p0', name: 'Portal Entry 01 Base', zone: 'Sector 09', x: -185, y: 0, turnType: 'straight', turnPrompt: 'Advance East along Main Haulage Decline', targetSpeed: 2.2 },
  { id: 'p1', name: 'West Haulage - Sec A', zone: 'Sector 09', x: -140, y: 0, turnType: 'straight', turnPrompt: 'Proceed straight through West Haulage', targetSpeed: 2.4 },
  { id: 'p2', name: 'West Haulage - Sec B', zone: 'Sector 09', x: -100, y: 0, turnType: 'right', turnPrompt: 'Approaching South Decline Junction', targetSpeed: 2.0 },
  
  // 2. Branch A: South Ventilation Incline
  { id: 'j_south', name: 'South Decline Junction', zone: 'Sector 09', x: -60, y: 0, turnType: 'right', turnPrompt: 'Turn right into South Ventilation Incline', targetSpeed: 1.4 },
  { id: 's1', name: 'South Incline - Upper', zone: 'Vent Shaft South', x: -60, y: 35, turnType: 'straight', turnPrompt: 'Descending South Ventilation Incline', targetSpeed: 2.0 },
  { id: 's2', name: 'South Incline - Lower', zone: 'Vent Shaft South', x: -60, y: 70, turnType: 'straight', turnPrompt: 'Approaching South Shaft Terminus', targetSpeed: 1.6 },
  { id: 's_term', name: 'Vent Shaft South Face', zone: 'Vent Shaft South', x: -60, y: 105, turnType: 'uturn', turnPrompt: 'Terminus reached: 360° LiDAR Inspection Scan', targetSpeed: 0.0, dwellTicks: 10, inspectionNote: 'Ventilation Shaft nominal. Airflow 4.2 m/s.' },
  { id: 's_ret2', name: 'South Incline - Ascending', zone: 'Vent Shaft South', x: -60, y: 70, turnType: 'straight', turnPrompt: 'Ascending South Incline toward Haulage', targetSpeed: 2.0 },
  { id: 's_ret1', name: 'South Incline - Approach', zone: 'Vent Shaft South', x: -60, y: 35, turnType: 'left', turnPrompt: 'Approaching Main Haulage Junction', targetSpeed: 1.6 },
  { id: 'j_south_ret', name: 'South Decline Junction', zone: 'Sector 09', x: -60, y: 0, turnType: 'right', turnPrompt: 'Turn right onto Central Haulage Drift', targetSpeed: 1.4 },

  // 3. Central Haulage Drift to North Junction
  { id: 'm1', name: 'Central Haulage - Curve 1', zone: 'Sector 09', x: -25, y: 7, turnType: 'straight', turnPrompt: 'Navigating Central Haulage Drift curve', targetSpeed: 2.2 },
  { id: 'm2', name: 'Central Haulage - Curve 2', zone: 'Sector 09', x: 10, y: 15, turnType: 'left', turnPrompt: 'Approaching North Crosscut Junction', targetSpeed: 2.0 },

  // 4. Branch B: North Extraction Crosscut
  { id: 'j_north', name: 'North Crosscut Junction', zone: 'Sector 07', x: 40, y: 20, turnType: 'left', turnPrompt: 'Turn left into North Extraction Crosscut', targetSpeed: 1.4 },
  { id: 'n1', name: 'North Crosscut - Entry', zone: 'North Stope Face', x: 40, y: -20, turnType: 'straight', turnPrompt: 'Advancing along North Extraction Crosscut', targetSpeed: 2.0 },
  { id: 'n2', name: 'North Crosscut - Mid Stope', zone: 'North Stope Face', x: 40, y: -65, turnType: 'straight', turnPrompt: 'Approaching active extraction rock face', targetSpeed: 1.6 },
  { id: 'n_term', name: 'North Stope Active Face', zone: 'North Stope Face', x: 40, y: -115, turnType: 'uturn', turnPrompt: 'Face reached: SLAM Wall Profiling & Crack Scan', targetSpeed: 0.0, dwellTicks: 12, inspectionNote: 'Fissure analysis active. Rock integrity verified.' },
  { id: 'n_ret2', name: 'North Crosscut - Return', zone: 'North Stope Face', x: 40, y: -65, turnType: 'straight', turnPrompt: 'Exiting North Crosscut toward Haulage', targetSpeed: 2.0 },
  { id: 'n_ret1', name: 'North Crosscut - Exit Drift', zone: 'North Stope Face', x: 40, y: -20, turnType: 'right', turnPrompt: 'Approaching Central Haulage Junction', targetSpeed: 1.6 },
  { id: 'j_north_ret', name: 'North Crosscut Junction', zone: 'Sector 07', x: 40, y: 20, turnType: 'left', turnPrompt: 'Turn left onto East Haulage Drift', targetSpeed: 1.4 },

  // 5. East Haulage Drift to Sub-Level 08 Split
  { id: 'e1', name: 'East Haulage - Sec 1', zone: 'Sector 08', x: 80, y: 22, turnType: 'straight', turnPrompt: 'Cruising along East Haulage Drift', targetSpeed: 2.4 },
  { id: 'e2', name: 'East Haulage - Sec 2', zone: 'Sector 08', x: 120, y: 22, turnType: 'right', turnPrompt: 'Approaching Sub-Level 08 Incline Split', targetSpeed: 2.0 },

  // 6. Branch C: Sub-Level 08 Incline
  { id: 'j_east', name: 'Sub-Level 08 Split', zone: 'Sub-Level 08', x: 160, y: 20, turnType: 'right', turnPrompt: 'Turn right down Sub-Level 08 Access Drift', targetSpeed: 1.4 },
  { id: 'sl1', name: 'Sub-Level 08 Incline', zone: 'Sub-Level 08', x: 195, y: 36, turnType: 'straight', turnPrompt: 'Descending Sub-Level 08 decline ramp', targetSpeed: 2.0 },
  { id: 'sl2', name: 'Sub-Level 08 Lower Drift', zone: 'Sub-Level 08', x: 230, y: 48, turnType: 'straight', turnPrompt: 'Approaching Sub-Level 08 excavation heading', targetSpeed: 1.6 },
  { id: 'sl_term', name: 'Sub-Level 08 Heading', zone: 'Sub-Level 08', x: 270, y: 55, turnType: 'uturn', turnPrompt: 'Heading reached: Subterranean Gas & Thermal Scan', targetSpeed: 0.0, dwellTicks: 10, inspectionNote: 'Deep strata telemetry: Methane nominal.' },
  { id: 'sl_ret2', name: 'Sub-Level 08 Ascent 2', zone: 'Sub-Level 08', x: 230, y: 48, turnType: 'straight', turnPrompt: 'Ascending Sub-Level 08 return ramp', targetSpeed: 2.0 },
  { id: 'sl_ret1', name: 'Sub-Level 08 Ascent 1', zone: 'Sub-Level 08', x: 195, y: 36, turnType: 'left', turnPrompt: 'Approaching Main Haulage Split', targetSpeed: 1.6 },
  { id: 'j_east_ret', name: 'Sub-Level 08 Split', zone: 'Sub-Level 08', x: 160, y: 20, turnType: 'straight', turnPrompt: 'Surveying Main Haulage East Terminus Face', targetSpeed: 1.4 },

  // 7. Main Haulage East Face Survey
  { id: 't1', name: 'East Extension Drift', zone: 'Sector 08', x: 200, y: 12, turnType: 'straight', turnPrompt: 'Advancing to Main Haulage East Face', targetSpeed: 2.0 },
  { id: 'east_term', name: 'Main Haulage East Terminus', zone: 'Sector 08', x: 240, y: 0, turnType: 'uturn', turnPrompt: 'East Terminus reached: Perimeter 100% Surveyed', targetSpeed: 0.0, dwellTicks: 8, inspectionNote: 'Haulage perimeter 100% mapped. Beginning Westbound Patrol.' },
  { id: 't1_ret', name: 'East Extension Return', zone: 'Sector 08', x: 200, y: 12, turnType: 'straight', turnPrompt: 'Westbound return along East Haulage Drift', targetSpeed: 2.2 },
  { id: 'j_east_west', name: 'Sub-Level 08 Split', zone: 'Sector 08', x: 160, y: 20, turnType: 'straight', turnPrompt: 'Passing Sub-Level 08 Split westbound', targetSpeed: 2.2 },

  // 8. Return Sweep along Main Haulage back to Portal 01
  { id: 'e2_west', name: 'East Haulage Westbound 2', zone: 'Sector 08', x: 120, y: 22, turnType: 'straight', turnPrompt: 'Full speed transit along East Haulage', targetSpeed: 2.5 },
  { id: 'e1_west', name: 'East Haulage Westbound 1', zone: 'Sector 08', x: 80, y: 22, turnType: 'straight', turnPrompt: 'Approaching North Crosscut Junction westbound', targetSpeed: 2.4 },
  { id: 'j_north_west', name: 'North Junction Westbound', zone: 'Sector 07', x: 40, y: 20, turnType: 'straight', turnPrompt: 'Passing North Crosscut Junction', targetSpeed: 2.2 },
  { id: 'm2_west', name: 'Central Curve Westbound 2', zone: 'Sector 09', x: 10, y: 15, turnType: 'straight', turnPrompt: 'Navigating Central Haulage curve westbound', targetSpeed: 2.2 },
  { id: 'm1_west', name: 'Central Curve Westbound 1', zone: 'Sector 09', x: -25, y: 7, turnType: 'straight', turnPrompt: 'Approaching South Decline Junction westbound', targetSpeed: 2.2 },
  { id: 'j_south_west', name: 'South Junction Westbound', zone: 'Sector 09', x: -60, y: 0, turnType: 'straight', turnPrompt: 'Entering West Haulage Main Incline', targetSpeed: 2.4 },
  { id: 'p2_west', name: 'West Haulage Incline 2', zone: 'Sector 09', x: -100, y: 0, turnType: 'straight', turnPrompt: 'Approaching Portal Entry 01 approach', targetSpeed: 2.4 },
  { id: 'p1_west', name: 'West Haulage Incline 1', zone: 'Sector 09', x: -140, y: 0, turnType: 'straight', turnPrompt: 'Decelerating on Portal 01 final approach', targetSpeed: 2.0 },
  { id: 'p0_cycle', name: 'Portal Entry 01 Base', zone: 'Sector 09', x: -185, y: 0, turnType: 'straight', turnPrompt: 'Patrol cycle completed. Reinitializing autonomous routine.', targetSpeed: 1.8 }
];

// Tunnel segments for exact physical distance computation
const TUNNEL_SEGMENTS: [number, number, number, number][] = [
  // Main haulage
  [-185, 0, -140, 0],
  [-140, 0, -100, 0],
  [-100, 0, -60, 0],
  [-60, 0, -25, 7],
  [-25, 7, 10, 15],
  [10, 15, 40, 20],
  [40, 20, 80, 22],
  [80, 22, 120, 22],
  [120, 22, 160, 20],
  [160, 20, 200, 12],
  [200, 12, 240, 0],
  // South decline
  [-60, 0, -60, 35],
  [-60, 35, -60, 70],
  [-60, 70, -60, 105],
  // North crosscut
  [40, 20, 40, -20],
  [40, -20, 40, -65],
  [40, -65, 40, -115],
  // Sub-level 08 access
  [160, 20, 195, 36],
  [195, 36, 230, 48],
  [230, 48, 270, 55]
];

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function minDistanceToTunnelNetwork(px: number, py: number): number {
  let minD = Infinity;
  for (let i = 0; i < TUNNEL_SEGMENTS.length; i++) {
    const s = TUNNEL_SEGMENTS[i];
    const d = distToSegment(px, py, s[0], s[1], s[2], s[3]);
    if (d < minD) minD = d;
  }
  return minD;
}

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [workers, setWorkers] = useState<WorkerData[]>(initialWorkers);
  const [zones, setZones] = useState<ZoneStatus[]>(initialZones);
  const [safetyScore, setSafetyScore] = useState<number>(96);
  const [evacActive, setEvacActive] = useState<boolean>(false);
  const [sirenMuted, setSirenMuted] = useState<boolean>(false);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(true);

  const [hexapod, setHexapod] = useState<HexapodState>({
    x: -185,
    y: 0,
    heading: 0,
    battery: 92,
    signalDbm: -60,
    status: 'scanning',
    gasPpm: 210,
    coPpm: 3.5,
    o2Percent: 20.8,
    ch4Percent: 0.12,
    fissureDetected: false,
    speedMps: 2.2,
    thermalMode: false,
    streamUrl: '',
  });

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapPath, setMapPath] = useState<{ x: number; y: number }[]>([{ x: -185, y: 0 }]);
  const [activeScanBeams, setActiveScanBeams] = useState<{ x1: number; y1: number; x2: number; y2: number; hit: boolean }[]>([]);

  // Navigation patrol state
  const waypointIdxRef = useRef<number>(0);
  const dwellCountRef = useRef<number>(0);
  const cycleCountRef = useRef<number>(1);

  const [activePatrol, setActivePatrol] = useState<ActivePatrolInfo>({
    index: 0,
    totalWaypoints: PATROL_ROUTE.length,
    currentWaypoint: PATROL_ROUTE[0],
    nextWaypoint: PATROL_ROUTE[1],
    distToNext: 45,
    status: 'cruising',
    cycleCount: 1,
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alt-001',
      timestamp: new Date().toISOString(),
      severity: 'info',
      source: 'hexapod',
      message: 'Hexapod LiDAR SLAM active. 100% Comprehensive Subterranean Multi-Branch Patrol initialized.',
    },
    {
      id: 'alt-002',
      timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      severity: 'info',
      source: 'system',
      message: '10 Wearable smart beacons locked. All atmospheric readings nominal.',
    }
  ]);

  const clearMap = useCallback(() => {
    setMapPoints([]);
    setMapPath([{ x: hexapod.x, y: hexapod.y }]);
  }, [hexapod.x, hexapod.y]);

  // ─── Backend Connection & Fallback Logic ───────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const backendConnected = useRef<boolean>(false);

  // Attempt backend connection on mount; fall back to local sim on failure
  useEffect(() => {
    let socket: Socket | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const connectToBackend = async () => {
      try {
        // 1. Fetch initial state from backend REST API
        const res = await fetch(`${BACKEND_URL}/api/state`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const data = await res.json();

        // Seed state from backend (source of truth)
        setWorkers(data.workers || initialWorkers);
        setZones(data.zones || initialZones);
        setHexapod(data.hexapod || hexapod);
        setMapPoints(data.mapPoints || []);
        setAlerts(data.alerts || []);
        setSafetyScore(data.safetyScore ?? 96);
        setEvacActive(data.evacActive ?? false);

        // 2. Connect WebSocket
        socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[OSCORP] Backend connected via WebSocket');
          backendConnected.current = true;
        });

        // Worker telemetry (single worker update)
        socket.on('worker_update', (worker: WorkerData) => {
          setWorkers(prev => prev.map(w => w.id === worker.id ? worker : w));
        });

        // Workers bulk update (simulation mode)
        socket.on('workers_update', (updatedWorkers: WorkerData[]) => {
          setWorkers(updatedWorkers);
        });

        // Hexapod telemetry
        socket.on('hexapod_update', (hex: HexapodState) => {
          setHexapod(hex);
        });

        // Map SLAM points + LiDAR beams
        socket.on('map_update', (data: { newPoints: MapPoint[]; beams?: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[] }) => {
          setMapPoints(prev => {
            const combined = [...prev, ...data.newPoints];
            return combined.length > 2200 ? combined.slice(combined.length - 2200) : combined;
          });
          if (data.beams) {
            setActiveScanBeams(data.beams);
          }
        });

        // Path breadcrumb trail
        socket.on('path_update', (pos: { x: number; y: number }) => {
          setMapPath(prev => {
            const p = [...prev, pos];
            return p.length > 1200 ? p.slice(p.length - 1200) : p;
          });
        });

        // Alerts
        socket.on('alert', (alert: AlertItem) => {
          setAlerts(prev => [alert, ...prev]);
        });

        // Alert acknowledgment
        socket.on('alert_ack', (data: { alertId: string }) => {
          setAlerts(prev => prev.map(a => a.id === data.alertId ? { ...a, acknowledged: true } : a));
        });

        // Safety score
        socket.on('safety_score_update', (data: { safetyScore: number }) => {
          setSafetyScore(data.safetyScore);
        });

        // Evacuation state
        socket.on('evac_update', (data: { evacActive: boolean }) => {
          setEvacActive(data.evacActive);
        });

        // Zones update (e.g. from seismic events)
        socket.on('zones_update', (updatedZones: ZoneStatus[]) => {
          setZones(updatedZones);
        });

        socket.on('connect_error', () => {
          console.warn('[OSCORP] Backend connection lost — falling back to local simulation');
          backendConnected.current = false;
          startLocalSimulation();
        });

        socket.on('disconnect', () => {
          console.warn('[OSCORP] Backend disconnected');
          backendConnected.current = false;
        });

        // Auto-start backend simulation
        fetch(`${BACKEND_URL}/api/simulate/start`, { method: 'POST' }).catch(() => {});

      } catch (err) {
        console.warn('[OSCORP] Backend unreachable — using local simulation fallback', err);
        backendConnected.current = false;
        startLocalSimulation();
      }
    };

    // ─── Local Simulation Fallback (existing logic preserved) ──────────────
    const startLocalSimulation = () => {
      if (fallbackInterval) return; // already running

      // Physical LiDAR ray tracer testing distance to tunnel walls (half-width = 15.5m)
      const getTunnelDistance = (x: number, y: number, angleDeg: number): number => {
        const rad = (angleDeg * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        for (let d = 3; d < 72; d += 1.5) {
          const testX = x + cosA * d;
          const testY = y + sinA * d;
          const distToCenterline = minDistanceToTunnelNetwork(testX, testY);
          if (distToCenterline >= 15.2) return d + (Math.random() - 0.5) * 0.5;
        }
        return 70;
      };

      fallbackInterval = setInterval(() => {
        if (!simulationRunning) return;

        setHexapod((prev) => {
          let newX = prev.x;
          let newY = prev.y;
          let newHeading = prev.heading;
          let effectiveSpeed = prev.speedMps;
          let patrolStatus: 'cruising' | 'cornering' | 'inspecting' | 'evacuating' = 'cruising';

          if (evacActive) {
            patrolStatus = 'evacuating';
            effectiveSpeed = 2.8;
            let targetX = -185, targetY = 0;
            if (prev.x < -45 && prev.x > -75 && prev.y > 5) { targetX = -60; targetY = 0; }
            else if (prev.x > 25 && prev.x < 55 && prev.y < -5) { targetX = 40; targetY = 20; }
            else if (prev.x > 150 && prev.y > 15) { targetX = 160; targetY = 20; }
            const dx = targetX - prev.x, dy = targetY - prev.y;
            const desiredHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
            let diff = desiredHeading - prev.heading;
            while (diff > 180) diff -= 360;
            while (diff < -180) diff += 360;
            const turnStep = Math.sign(diff) * Math.min(Math.abs(diff), 14);
            newHeading = Math.round((prev.heading + turnStep + 360) % 360);
            const stepDist = effectiveSpeed * 0.12;
            newX = +(prev.x + Math.cos((newHeading * Math.PI) / 180) * stepDist).toFixed(2);
            newY = +(prev.y + Math.sin((newHeading * Math.PI) / 180) * stepDist).toFixed(2);
          } else {
            const totalPts = PATROL_ROUTE.length;
            const currIdx = waypointIdxRef.current;
            const currentTarget = PATROL_ROUTE[currIdx] || PATROL_ROUTE[0];
            const nextTarget = PATROL_ROUTE[(currIdx + 1) % totalPts];
            const dx = currentTarget.x - prev.x, dy = currentTarget.y - prev.y;
            const distToTarget = Math.hypot(dx, dy);

            if (dwellCountRef.current > 0) {
              dwellCountRef.current -= 1;
              effectiveSpeed = 0.0;
              patrolStatus = 'inspecting';
              newHeading = Math.round((prev.heading + 6) % 360);
              if (dwellCountRef.current === 0) {
                const nextIdx = (currIdx + 1) % totalPts;
                waypointIdxRef.current = nextIdx;
                if (nextIdx === 0) cycleCountRef.current += 1;
              }
            } else {
              if (distToTarget < 3.8) {
                if (currentTarget.dwellTicks && currentTarget.dwellTicks > 0) {
                  dwellCountRef.current = currentTarget.dwellTicks;
                  effectiveSpeed = 0.0;
                  patrolStatus = 'inspecting';
                } else {
                  const nextIdx = (currIdx + 1) % totalPts;
                  waypointIdxRef.current = nextIdx;
                  if (nextIdx === 0) cycleCountRef.current += 1;
                }
              }
              const desiredHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
              let diff = desiredHeading - prev.heading;
              while (diff > 180) diff -= 360;
              while (diff < -180) diff += 360;
              const isSharpTurn = Math.abs(diff) > 40;
              patrolStatus = isSharpTurn ? 'cornering' : 'cruising';
              const targetSpeed = isSharpTurn ? Math.min(1.4, currentTarget.targetSpeed) : currentTarget.targetSpeed;
              effectiveSpeed = +(prev.speedMps + (targetSpeed - prev.speedMps) * 0.25).toFixed(2);
              const maxTurnStep = isSharpTurn ? 14 : 9;
              const turnStep = Math.sign(diff) * Math.min(Math.abs(diff), maxTurnStep);
              newHeading = Math.round((prev.heading + turnStep + 360) % 360);
              const stepDist = effectiveSpeed * 0.25;
              const radHeading = (newHeading * Math.PI) / 180;
              newX = +(prev.x + Math.cos(radHeading) * stepDist).toFixed(2);
              newY = +(prev.y + Math.sin(radHeading) * stepDist).toFixed(2);
            }

            setActivePatrol({
              index: currIdx, totalWaypoints: totalPts,
              currentWaypoint: currentTarget, nextWaypoint: nextTarget,
              distToNext: Math.max(1, Math.round(distToTarget)),
              status: patrolStatus, cycleCount: cycleCountRef.current,
            });
          }

          const currentGas = Math.max(140, prev.gasPpm + (Math.random() - 0.5) * 2.2);
          const beams: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[] = [];
          const newPointsBatch: MapPoint[] = [];
          for (let i = 0; i < 36; i++) {
            const angleDeg = (i * 10 + newHeading) % 360;
            const dist = getTunnelDistance(newX, newY, angleDeg);
            const rad = (angleDeg * Math.PI) / 180;
            const px = newX + dist * Math.cos(rad), py = newY + dist * Math.sin(rad);
            const hit = dist < 65;
            beams.push({ x1: newX, y1: newY, x2: px, y2: py, hit });
            if (hit) newPointsBatch.push({ x: px, y: py, gasPpm: currentGas + (Math.random() - 0.5) * 8 });
          }

          setActiveScanBeams(beams);
          setMapPoints((old) => {
            const combined = [...old, ...newPointsBatch];
            return combined.length > 2200 ? combined.slice(combined.length - 2200) : combined;
          });
          setMapPath((old) => {
            const p = [...old, { x: newX, y: newY }];
            return p.length > 1200 ? p.slice(p.length - 1200) : p;
          });

          return {
            ...prev, x: newX, y: newY, heading: newHeading, speedMps: effectiveSpeed,
            gasPpm: currentGas, coPpm: Number((currentGas * 0.016).toFixed(1)),
            ch4Percent: Number((currentGas * 0.0006).toFixed(3)),
            battery: Math.max(12, prev.battery - 0.001),
          };
        });

        setWorkers((prev) => prev.map((w) => ({
          ...w, bpm: Math.round(Math.min(150, Math.max(58, w.bpm + (Math.random() - 0.5) * 1.5))),
        })));
      }, 120);
    };

    connectToBackend();

    return () => {
      if (socket) { socket.disconnect(); socketRef.current = null; }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerHazard = useCallback((type: 'high_co' | 'low_o2' | 'methane' | 'fissure' | 'helmet_off' | 'cardiac' | 'evacuate' | 'seismic') => {
    const timestamp = new Date().toISOString();
    
    // If backend connected, proxy hazard trigger to backend for simulated events
    // For 'seismic', we can manually call the new /api/seismic endpoint
    if (backendConnected.current && type === 'seismic') {
      fetch(`${BACKEND_URL}/api/seismic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: 'Zone A - Stope 4', magnitude: 6.2, confidence: 0.98 })
      }).catch(() => {});
      return; // Backend will push the updates back via websockets
    }

    switch (type) {
      case 'high_co':
        setHexapod((h) => ({ ...h, coPpm: 72.0, gasPpm: 850 }));
        setSafetyScore(58);
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'critical',
          source: 'gas',
          message: 'CRITICAL: Carbon Monoxide spike at 72.0 PPM. Danger threshold breached!',
        }, ...a]);
        break;
      case 'low_o2':
        setHexapod((h) => ({ ...h, o2Percent: 18.2 }));
        setSafetyScore(62);
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'warning',
          source: 'gas',
          message: 'HYPOXIA WARNING: Oxygen level dropped to 18.2% in haulway.',
        }, ...a]);
        break;
      case 'methane':
        setHexapod((h) => ({ ...h, ch4Percent: 1.48, gasPpm: 1200 }));
        setSafetyScore(45);
        setEvacActive(true);
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'critical',
          source: 'gas',
          message: 'EXPLOSIVE METHANE BREAKTHROUGH: CH₄ reached 1.48% VOL in Hexapod Scout tunnel!',
        }, ...a]);
        break;
      case 'fissure':
        setHexapod((h) => ({ ...h, fissureDetected: true }));
        setSafetyScore(75);
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'warning',
          source: 'hexapod',
          message: 'ROCK FISSURE DETECTED: 14mm shear aperture flagged on rock face.',
        }, ...a]);
        break;
      case 'helmet_off':
        setWorkers((ws) => ws.map((w) => (w.id === 'W-01' ? { ...w, helmetOn: false, status: 'warning' } : w)));
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'warning',
          source: 'helmet',
          workerId: 'W-01',
          message: 'HELMET DETACHED: Proximity sensor removed for W-01 (J. Miller).',
        }, ...a]);
        break;
      case 'cardiac':
        setWorkers((ws) => ws.map((w) => (w.id === 'W-05' ? { ...w, bpm: 156, spo2: 88, status: 'critical' } : w)));
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'critical',
          source: 'vitals',
          workerId: 'W-05',
          message: 'CARDIAC DISTRESS: Tachycardia (156 BPM) and Hypoxia (88% SpO₂) for W-05 (R. Kowalski)!',
        }, ...a]);
        break;
      case 'evacuate':
        setEvacActive((prev) => !prev);
        if (!evacActive) {
          setSafetyScore(30);
          setAlerts((a) => [{
            id: `alt-${Date.now()}`,
            timestamp,
            severity: 'critical',
            source: 'system',
            message: 'GENERAL MINE EVACUATION ORDER: Evacuation sirens active across all sub-levels.',
          }, ...a]);
        }
        break;
      case 'seismic':
        setZones(prev => prev.map(z => z.id === 'Z-A' ? { ...z, stability: 'compromised' } : z));
        setSafetyScore(40);
        setEvacActive(true);
        setAlerts((a) => [{
          id: `alt-${Date.now()}`,
          timestamp,
          severity: 'critical',
          source: 'system',
          message: 'SEISMIC EVENT: Magnitude 6.2 detected in Zone A - Stope 4. EVACUATION PROTOCOL ACTIVATED.',
        }, ...a]);
        break;
    }
  }, [evacActive]);

  const resetSystem = useCallback(() => {
    setWorkers(initialWorkers);
    setZones(initialZones);
    setSafetyScore(96);
    setEvacActive(false);
    waypointIdxRef.current = 0;
    dwellCountRef.current = 0;
    cycleCountRef.current = 1;
    setHexapod({
      x: -185,
      y: 0,
      heading: 0,
      battery: 92,
      signalDbm: -60,
      status: 'scanning',
      gasPpm: 210,
      coPpm: 3.5,
      o2Percent: 20.8,
      ch4Percent: 0.12,
      fissureDetected: false,
      speedMps: 2.2,
      thermalMode: false,
      streamUrl: '',
    });
    setAlerts((a) => [{
      id: `alt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'info',
      source: 'system',
      message: 'Master Reset executed. Baseline nominal parameters restored.',
    }, ...a]);
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  }, []);

  const toggleSiren = useCallback(() => {
    setSirenMuted((m) => !m);
  }, []);

  const toggleSimulation = useCallback(() => {
    setSimulationRunning((r) => {
      const next = !r;
      // If backend connected, control backend simulation
      if (backendConnected.current) {
        fetch(`${BACKEND_URL}/api/simulate/${next ? 'start' : 'stop'}`, { method: 'POST' }).catch(() => {});
      }
      return next;
    });
  }, []);

  const sendRobotCommand = useCallback((cmd: 'forward' | 'backward' | 'left' | 'right' | 'scan' | 'stop') => {
    // Forward command to backend if connected
    if (backendConnected.current) {
      fetch(`${BACKEND_URL}/api/hexapod/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      }).catch(() => {});
    }

    // Also apply locally for immediate UI feedback
    setHexapod((h) => {
      let dx = 0;
      let dy = 0;
      let dHeading = h.heading;

      if (cmd === 'forward') {
        const rad = (h.heading * Math.PI) / 180;
        dx = Math.cos(rad) * 6;
        dy = Math.sin(rad) * 6;
      } else if (cmd === 'backward') {
        const rad = (h.heading * Math.PI) / 180;
        dx = -Math.cos(rad) * 6;
        dy = -Math.sin(rad) * 6;
      } else if (cmd === 'left') {
        dHeading = (h.heading - 25 + 360) % 360;
      } else if (cmd === 'right') {
        dHeading = (h.heading + 25) % 360;
      }

      return {
        ...h,
        x: h.x + dx,
        y: h.y + dy,
        heading: dHeading,
        status: cmd === 'stop' ? 'idle' : 'patrol',
      };
    });
  }, []);

  return (
    <DashboardContext.Provider value={{
      activeTab,
      setActiveTab,
      workers,
      hexapod,
      mapPoints,
      mapPath,
      activeScanBeams,
      activePatrol,
      patrolRoute: PATROL_ROUTE,
      zones,
      alerts,
      safetyScore,
      evacActive,
      sirenMuted,
      simulationRunning,
      toggleSiren,
      toggleSimulation,
      triggerHazard,
      resetSystem,
      acknowledgeAlert,
      sendRobotCommand,
      clearMap,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};
