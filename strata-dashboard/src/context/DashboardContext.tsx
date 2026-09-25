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

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [workers, setWorkers] = useState<WorkerData[]>(initialWorkers);
  const [zones, setZones] = useState<ZoneStatus[]>(initialZones);
  const [safetyScore, setSafetyScore] = useState<number>(96);
  const [evacActive, setEvacActive] = useState<boolean>(false);
  const [sirenMuted, setSirenMuted] = useState<boolean>(false);
  const [simulationRunning, setSimulationRunning] = useState<boolean>(true);

  const [hexapod, setHexapod] = useState<HexapodState>({
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

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapPath, setMapPath] = useState<{ x: number; y: number }[]>([{ x: 0, y: 0 }]);
  const [activeScanBeams, setActiveScanBeams] = useState<{ x1: number; y1: number; x2: number; y2: number; hit: boolean }[]>([]);

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alt-001',
      timestamp: new Date().toISOString(),
      severity: 'info',
      source: 'hexapod',
      message: 'Hexapod LiDAR SLAM active. 19-beam real-time scan building underground map.',
    },
    {
      id: 'alt-002',
      timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      severity: 'info',
      source: 'system',
      message: '10 Wearable smart beacons locked. All atmospheric readings nominal.',
    }
  ]);

  const stepCountRef = useRef(0);

  const clearMap = useCallback(() => {
    setMapPoints([]);
    setMapPath([{ x: hexapod.x, y: hexapod.y }]);
  }, [hexapod.x, hexapod.y]);

  // Real-time Incremental Map Building Engine (Phase 3 Spec)
  useEffect(() => {
    if (!simulationRunning) return;

    const getTunnelDistance = (x: number, y: number, angleDeg: number): number => {
      const rad = (angleDeg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      for (let d = 5; d < 80; d += 1) {
        const testX = x + cosA * d;
        const testY = y + sinA * d;

        // Tunnel corridor boundary calculation
        const tunnelCenterY = Math.sin(testX * 0.02) * 45;
        const distFromCenter = Math.abs(testY - tunnelCenterY);

        if (distFromCenter >= 30 + Math.sin(testX * 0.1) * 3) {
          return d + (Math.random() - 0.5) * 1.5;
        }

        // Support pillar obstacle
        if (Math.abs(testX % 90) < 6 && Math.abs(testY % 45) < 6) {
          return d;
        }
      }
      return 60;
    };

    const interval = setInterval(() => {
      stepCountRef.current += 1;
      const step = stepCountRef.current;

      setHexapod((prev) => {
        const speed = 1.2;
        const targetHeading = Math.sin(step * 0.04) * 45;
        const newHeading = Math.round(prev.heading + (targetHeading - prev.heading) * 0.1);
        const newX = prev.x + Math.cos((newHeading * Math.PI) / 180) * speed;
        const newY = prev.y + Math.sin((newHeading * Math.PI) / 180) * speed;

        const currentGas = Math.max(140, prev.gasPpm + (Math.random() - 0.5) * 4);

        const beams: { x1: number; y1: number; x2: number; y2: number; hit: boolean }[] = [];
        const newPointsBatch: MapPoint[] = [];

        for (let i = 0; i < 19; i++) {
          const angleDeg = newHeading - 90 + (i * 10);
          const dist = getTunnelDistance(newX, newY, angleDeg);
          const rad = (angleDeg * Math.PI) / 180;
          const px = newX + dist * Math.cos(rad);
          const py = newY + dist * Math.sin(rad);

          beams.push({
            x1: newX,
            y1: newY,
            x2: px,
            y2: py,
            hit: dist < 65
          });

          if (dist < 65) {
            newPointsBatch.push({
              x: px,
              y: py,
              gasPpm: currentGas + (Math.random() - 0.5) * 15
            });
          }
        }

        setActiveScanBeams(beams);

        setMapPoints((old) => {
          const combined = [...old, ...newPointsBatch];
          return combined.length > 1500 ? combined.slice(combined.length - 1500) : combined;
        });

        setMapPath((old) => {
          const p = [...old, { x: newX, y: newY }];
          return p.length > 250 ? p.slice(p.length - 250) : p;
        });

        return {
          ...prev,
          x: newX,
          y: newY,
          heading: newHeading,
          gasPpm: currentGas,
          coPpm: Number((currentGas * 0.016).toFixed(1)),
          ch4Percent: Number((currentGas * 0.0006).toFixed(3)),
          battery: Math.max(12, prev.battery - 0.002),
        };
      });

      setWorkers((prev) => prev.map((w) => ({
        ...w,
        bpm: Math.round(Math.min(150, Math.max(58, w.bpm + (Math.random() - 0.5) * 1.5))),
      })));

    }, 350);

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
