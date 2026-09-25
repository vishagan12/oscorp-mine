import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DashboardTab, WorkerData, HexapodState, MapPoint, ZoneStatus, AlertItem } from '../types';

interface DashboardContextType {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  workers: WorkerData[];
  hexapod: HexapodState;
  mapPoints: MapPoint[];
  mapPath: { x: number; y: number }[];
  activeScanBeams: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[];
  zones: ZoneStatus[];
  alerts: AlertItem[];
  safetyScore: number;
  evacActive: boolean;
  sirenMuted: boolean;
  simulationRunning: boolean;
  toggleSiren: () => void;
  toggleSimulation: () => void;
  triggerHazard: (type: 'high_co' | 'low_o2' | 'methane' | 'fissure' | 'helmet_off' | 'cardiac' | 'evacuate') => void;
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

// Subterranean Waypoint Navigation Graph for Multi-Direction Exploration
interface MineNavNode {
  id: string;
  name: string;
  x: number;
  y: number;
  neighbors: string[];
}

const MINE_NAV_GRAPH: Record<string, MineNavNode> = {
  portal: { id: 'portal', name: 'Portal Entry 01', x: -180, y: 0, neighbors: ['haulage_west'] },
  haulage_west: { id: 'haulage_west', name: 'West Haulage Drift', x: -120, y: 0, neighbors: ['portal', 'junction_south'] },
  junction_south: { id: 'junction_south', name: 'South Decline Junction', x: -60, y: 0, neighbors: ['haulage_west', 'mid_south', 'haulage_mid'] },
  mid_south: { id: 'mid_south', name: 'South Ventilation Incline', x: -60, y: 55, neighbors: ['junction_south', 'vent_south'] },
  vent_south: { id: 'vent_south', name: 'Ventilation Shaft South', x: -60, y: 105, neighbors: ['mid_south'] },
  haulage_mid: { id: 'haulage_mid', name: 'Central Haulage Drift', x: -10, y: 10, neighbors: ['junction_south', 'junction_north'] },
  junction_north: { id: 'junction_north', name: 'North Crosscut Junction', x: 40, y: 20, neighbors: ['haulage_mid', 'mid_north', 'haulage_east'] },
  mid_north: { id: 'mid_north', name: 'North Extraction Crosscut', x: 40, y: -45, neighbors: ['junction_north', 'stope_north'] },
  stope_north: { id: 'stope_north', name: 'North Stope Active Face', x: 40, y: -115, neighbors: ['mid_north'] },
  haulage_east: { id: 'haulage_east', name: 'East Haulage Drift', x: 100, y: 22, neighbors: ['junction_north', 'junction_east'] },
  junction_east: { id: 'junction_east', name: 'Sub-Level 08 Split', x: 160, y: 20, neighbors: ['haulage_east', 'sublevel_mid', 'haulage_terminus'] },
  sublevel_mid: { id: 'sublevel_mid', name: 'Sub-Level 08 Incline', x: 215, y: 42, neighbors: ['junction_east', 'sublevel_east'] },
  sublevel_east: { id: 'sublevel_east', name: 'Sub-Level 08 Heading', x: 270, y: 55, neighbors: ['sublevel_mid'] },
  haulage_terminus: { id: 'haulage_terminus', name: 'Main Haulage East Face', x: 240, y: 0, neighbors: ['junction_east'] },
};

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
    x: -180,
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
    speedMps: 2.1,
    thermalMode: false,
    streamUrl: '',
  });

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapPath, setMapPath] = useState<{ x: number; y: number }[]>([{ x: -180, y: 0 }]);
  const [activeScanBeams, setActiveScanBeams] = useState<{ x1: number; y1: number; x2: number; y2: number; hit: boolean }[]>([]);

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alt-001',
      timestamp: new Date().toISOString(),
      severity: 'info',
      source: 'hexapod',
      message: 'Hexapod LiDAR SLAM active. Autonomous multi-branch route exploration initiated.',
    },
    {
      id: 'alt-002',
      timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      severity: 'info',
      source: 'system',
      message: '10 Wearable smart beacons locked. All atmospheric readings nominal.',
    }
  ]);

  const targetNodeIdRef = useRef<string>('haulage_west');
  const lastNodeIdRef = useRef<string>('portal');

  const clearMap = useCallback(() => {
    setMapPoints([]);
    setMapPath([{ x: hexapod.x, y: hexapod.y }]);
  }, [hexapod.x, hexapod.y]);

  // Real-time Incremental Map Building Engine (Phase 3 Spec)
  useEffect(() => {
    if (!simulationRunning) return;

    // Physical LiDAR ray tracer testing distance to tunnel walls (half-width = 15.5m)
    const getTunnelDistance = (x: number, y: number, angleDeg: number): number => {
      const rad = (angleDeg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      for (let d = 3; d < 72; d += 1.5) {
        const testX = x + cosA * d;
        const testY = y + sinA * d;

        const distToCenterline = minDistanceToTunnelNetwork(testX, testY);
        // Wall boundary at 15.2 meters with minor surface roughness
        if (distToCenterline >= 15.2) {
          return d + (Math.random() - 0.5) * 0.5;
        }
      }
      return 70;
    };

    const interval = setInterval(() => {
      setHexapod((prev) => {
        // Autonomous Multi-Direction Route Navigation
        const targetNode = MINE_NAV_GRAPH[targetNodeIdRef.current] || MINE_NAV_GRAPH['portal'];
        const dx = targetNode.x - prev.x;
        const dy = targetNode.y - prev.y;
        const distToTarget = Math.hypot(dx, dy);

        // When reaching a junction or dead-end, choose a new random connected corridor!
        if (distToTarget < 6) {
          const prevId = lastNodeIdRef.current;
          lastNodeIdRef.current = targetNode.id;

          // Pick from neighbors: prefer non-backtracking branches unless at a dead end
          const neighbors = targetNode.neighbors;
          let nextNodeId = neighbors[Math.floor(Math.random() * neighbors.length)];
          if (neighbors.length > 1 && Math.random() < 0.85) {
            const forwardNeighbors = neighbors.filter((id) => id !== prevId);
            if (forwardNeighbors.length > 0) {
              nextNodeId = forwardNeighbors[Math.floor(Math.random() * forwardNeighbors.length)];
            }
          }
          targetNodeIdRef.current = nextNodeId;
        }

        // Smooth steering towards destination waypoint
        const desiredHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
        let diff = desiredHeading - prev.heading;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        const turnStep = Math.sign(diff) * Math.min(Math.abs(diff), 8);
        const newHeading = Math.round((prev.heading + turnStep + 360) % 360);

        // Advance along heading vector smoothly at 0.75m/tick (~2.1 m/s rover speed)
        const stepDist = 0.75;
        const radHeading = (newHeading * Math.PI) / 180;
        const newX = +(prev.x + Math.cos(radHeading) * stepDist).toFixed(2);
        const newY = +(prev.y + Math.sin(radHeading) * stepDist).toFixed(2);

        const currentGas = Math.max(140, prev.gasPpm + (Math.random() - 0.5) * 2.5);

        // Cast 36 High-Resolution 360-Degree LiDAR Beams
        const beams: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[] = [];
        const newPointsBatch: MapPoint[] = [];

        for (let i = 0; i < 36; i++) {
          const angleDeg = (i * 10 + newHeading) % 360;
          const dist = getTunnelDistance(newX, newY, angleDeg);
          const rad = (angleDeg * Math.PI) / 180;
          const px = newX + dist * Math.cos(rad);
          const py = newY + dist * Math.sin(rad);

          const hit = dist < 65;
          beams.push({
            x1: newX,
            y1: newY,
            x2: px,
            y2: py,
            hit
          });

          if (hit) {
            newPointsBatch.push({
              x: px,
              y: py,
              gasPpm: currentGas + (Math.random() - 0.5) * 10
            });
          }
        }

        setActiveScanBeams(beams);

        setMapPoints((old) => {
          const combined = [...old, ...newPointsBatch];
          return combined.length > 2000 ? combined.slice(combined.length - 2000) : combined;
        });

        // Store up to 1000 points so the entire multi-branch route persists like Google Maps
        setMapPath((old) => {
          const p = [...old, { x: newX, y: newY }];
          return p.length > 1000 ? p.slice(p.length - 1000) : p;
        });

        return {
          ...prev,
          x: newX,
          y: newY,
          heading: newHeading,
          gasPpm: currentGas,
          coPpm: Number((currentGas * 0.016).toFixed(1)),
          ch4Percent: Number((currentGas * 0.0006).toFixed(3)),
          battery: Math.max(12, prev.battery - 0.001),
        };
      });

      setWorkers((prev) => prev.map((w) => ({
        ...w,
        bpm: Math.round(Math.min(150, Math.max(58, w.bpm + (Math.random() - 0.5) * 1.5))),
      })));

    }, 120);

    return () => clearInterval(interval);
  }, [simulationRunning]);

  const triggerHazard = useCallback((type: 'high_co' | 'low_o2' | 'methane' | 'fissure' | 'helmet_off' | 'cardiac' | 'evacuate') => {
    const timestamp = new Date().toISOString();
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
    }
  }, [evacActive]);

  const resetSystem = useCallback(() => {
    setWorkers(initialWorkers);
    setZones(initialZones);
    setSafetyScore(96);
    setEvacActive(false);
    setHexapod({
      x: 0,
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
      speedMps: 0.45,
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
    setSimulationRunning((r) => !r);
  }, []);

  const sendRobotCommand = useCallback((cmd: 'forward' | 'backward' | 'left' | 'right' | 'scan' | 'stop') => {
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
