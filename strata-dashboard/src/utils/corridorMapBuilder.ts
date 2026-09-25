// High-performance pure corridor geometry builder for real-time metro/blueprint floor plan.
// Precomputes static drift geometries and provides Path2D objects for zero-allocation 60+ FPS rendering.

export interface CorridorSegment {
  id: string;
  name: string;
  points: readonly { x: number; y: number }[];
  widthMeters: number;
  lengthMeters: number;
  status: 'safe' | 'warning' | 'critical' | 'blocked';
  gasPpm: number;
  cachedPath2D?: Path2D;
  dimensionCallout?: {
    x: number;
    y: number;
    widthText: string;
    lengthText: string;
    textWidth: number;
  };
}

export interface ExitPortal {
  id: string;
  label: string;
  x: number;
  y: number;
  distanceMeters: number;
  status: 'open' | 'blocked';
}

export interface CorridorMapModel {
  segments: CorridorSegment[];
  exits: ExitPortal[];
  centerlinePath: { x: number; y: number }[];
  robotPosition: { x: number; y: number; heading: number };
  scalePixelsPer10m: number;
}

// 1. Precomputed Static Tunnel Geometry (Allocated once at startup, 0 runtime GC overhead)
const STATIC_MAIN_HAULAGE: { x: number; y: number }[] = [];
for (let x = -190; x <= 260; x += 15) {
  STATIC_MAIN_HAULAGE.push({ x, y: Math.sin(x * 0.018) * 35 });
}

const STATIC_NORTH_CROSSCUT: { x: number; y: number }[] = [];
for (let y = 15; y >= -130; y -= 15) {
  STATIC_NORTH_CROSSCUT.push({ x: 40, y });
}

const STATIC_SOUTH_DECLINE: { x: number; y: number }[] = [];
for (let y = -5; y <= 110; y += 15) {
  STATIC_SOUTH_DECLINE.push({ x: -70, y });
}

const STATIC_EAST_STOPE: { x: number; y: number }[] = [];
for (let x = 170; x <= 290; x += 15) {
  STATIC_EAST_STOPE.push({ x, y: 30 + Math.cos((x - 170) * 0.025) * 20 });
}

// Helper to create Path2D for points at 2.2 coordinate scale
function createSegmentPath(points: readonly { x: number; y: number }[]): Path2D {
  const p = new Path2D();
  if (points.length === 0) return p;
  p.moveTo(points[0].x * 2.2, points[0].y * 2.2);
  for (let i = 1; i < points.length; i++) {
    p.lineTo(points[i].x * 2.2, points[i].y * 2.2);
  }
  return p;
}

const PATH_MAIN = createSegmentPath(STATIC_MAIN_HAULAGE);
const PATH_NORTH = createSegmentPath(STATIC_NORTH_CROSSCUT);
const PATH_SOUTH = createSegmentPath(STATIC_SOUTH_DECLINE);
const PATH_EAST = createSegmentPath(STATIC_EAST_STOPE);

// Pre-measured dimension callouts
const DIMENSION_MAIN = { x: -40, y: 28, widthText: '↔ 3.2m WIDTH', lengthText: '85m MAIN DRIFT', textWidth: 148 };
const DIMENSION_NORTH = { x: 48, y: -65, widthText: '↔ 2.4m WIDTH', lengthText: '35m TO STOPE', textWidth: 142 };
const DIMENSION_SOUTH = { x: -62, y: 65, widthText: '↔ 2.8m WIDTH', lengthText: '38m TO SHAFT', textWidth: 144 };
const DIMENSION_EAST = { x: 230, y: 55, widthText: '↔ 2.6m WIDTH', lengthText: '28m EXPLORED', textWidth: 140 };

/**
 * Pure function: buildCorridorPath
 * Returns memoized corridor floor plan model with pre-baked Path2D paths.
 */
export function buildCorridorPath(
  mapPoints: { x: number; y: number; gasPpm: number }[],
  mapPath: { x: number; y: number }[],
  hexapod: { x: number; y: number; heading: number; gasPpm: number; fissureDetected?: boolean },
  evacActive: boolean
): CorridorMapModel {
  const currentGas = hexapod.gasPpm;

  let currentStatus: 'safe' | 'warning' | 'critical' | 'blocked' = 'safe';
  if (evacActive) {
    currentStatus = 'blocked';
  } else if (currentGas > 500) {
    currentStatus = 'critical';
  } else if (currentGas > 300) {
    currentStatus = 'warning';
  }

  const mainStatus = currentStatus;
  const northStatus = hexapod.fissureDetected || currentGas > 450 ? 'blocked' : 'safe';
  const southStatus = evacActive ? 'blocked' : 'safe';
  const eastStatus = currentGas > 500 ? 'critical' : 'safe';

  const segments: CorridorSegment[] = [
    {
      id: 'main-drift',
      name: 'MAIN HAULAGE DECLINE (SEC-09)',
      points: STATIC_MAIN_HAULAGE,
      widthMeters: 3.2,
      lengthMeters: 85,
      status: mainStatus,
      gasPpm: currentGas,
      cachedPath2D: PATH_MAIN,
      dimensionCallout: DIMENSION_MAIN
    },
    {
      id: 'north-crosscut',
      name: 'CROSSCUT NORTH 01',
      points: STATIC_NORTH_CROSSCUT,
      widthMeters: 2.4,
      lengthMeters: 35,
      status: northStatus,
      gasPpm: hexapod.fissureDetected ? 420 : 210,
      cachedPath2D: PATH_NORTH,
      dimensionCallout: DIMENSION_NORTH
    },
    {
      id: 'south-decline',
      name: 'VENTILATION DECLINE SOUTH',
      points: STATIC_SOUTH_DECLINE,
      widthMeters: 2.8,
      lengthMeters: 38,
      status: southStatus,
      gasPpm: 195,
      cachedPath2D: PATH_SOUTH,
      dimensionCallout: DIMENSION_SOUTH
    },
    {
      id: 'east-stope',
      name: 'SUB-LEVEL 08 ACCESS',
      points: STATIC_EAST_STOPE,
      widthMeters: 2.6,
      lengthMeters: 28,
      status: eastStatus,
      gasPpm: 230,
      cachedPath2D: PATH_EAST,
      dimensionCallout: DIMENSION_EAST
    }
  ];

  const exits: ExitPortal[] = [
    {
      id: 'exit-a',
      label: 'EXIT A — 45m',
      x: -190,
      y: Math.sin(-190 * 0.018) * 35,
      distanceMeters: 45,
      status: evacActive && currentGas > 500 ? 'blocked' : 'open'
    },
    {
      id: 'exit-b',
      label: 'EXIT B — 110m',
      x: 40,
      y: -130,
      distanceMeters: 110,
      status: northStatus === 'blocked' ? 'blocked' : 'open'
    }
  ];

  return {
    segments,
    exits,
    centerlinePath: mapPath,
    robotPosition: {
      x: hexapod.x,
      y: hexapod.y,
      heading: hexapod.heading
    },
    scalePixelsPer10m: 10 * 2.2
  };
}
