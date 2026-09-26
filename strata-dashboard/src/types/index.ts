export type DashboardTab = 'overview' | 'crew' | 'hazard_sim';

export type AlertSeverity = 'nominal' | 'warning' | 'critical';

export interface AlertItem {
  id: string;
  timestamp: string;
  severity: 'warning' | 'critical' | 'info';
  source: 'gas' | 'vitals' | 'helmet' | 'hexapod' | 'system';
  workerId?: string;
  message: string;
  acknowledged?: boolean;
}

export interface WorkerData {
  id: string;
  name: string;
  role: string;
  zone: string;
  bpm: number;
  bpmHistory: number[];
  spo2: number;
  temp: number;
  helmetOn: boolean;
  battery: number;
  status: 'nominal' | 'warning' | 'critical';
  assignedEvacRoute: string;
}

export interface HexapodState {
  x: number;
  y: number;
  heading: number;
  battery: number;
  signalDbm: number;
  status: 'scanning' | 'idle' | 'patrol' | 'evacuating';
  gasPpm: number;
  coPpm: number;
  o2Percent: number;
  ch4Percent: number;
  fissureDetected: boolean;
  speedMps: number;
  thermalMode: boolean;
  streamUrl: string;
}

export interface MapPoint {
  x: number;
  y: number;
  gasPpm: number;
  intensity?: number;
}

export interface ZoneStatus {
  id: string;
  name: string;
  depthM: number;
  stressIndex: number;
  workersCount: number;
  gasStatus: 'safe' | 'warning' | 'critical';
  ventilationPct: number;
  stability: 'stable' | 'monitoring' | 'compromised';
}

export interface MinePatrolWaypoint {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  turnType: 'straight' | 'left' | 'right' | 'uturn';
  turnPrompt: string;
  targetSpeed: number;
  dwellTicks?: number;
  inspectionNote?: string;
}

export interface ActivePatrolInfo {
  index: number;
  totalWaypoints: number;
  currentWaypoint: MinePatrolWaypoint;
  nextWaypoint: MinePatrolWaypoint;
  distToNext: number;
  status: 'cruising' | 'cornering' | 'inspecting' | 'evacuating';
  cycleCount: number;
}
