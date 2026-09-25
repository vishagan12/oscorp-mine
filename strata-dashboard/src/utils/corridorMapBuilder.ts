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
export const STATIC_MAIN_HAULAGE: { x: number; y: number }[] = [
  { x: -185, y: 0 },
  { x: -140, y: 0 },
  { x: -100, y: 0 },
  { x: -60, y: 0 },   // Junction South
  { x: -25, y: 7 },
  { x: 10, y: 15 },
  { x: 40, y: 20 },   // Junction North
  { x: 80, y: 22 },
  { x: 120, y: 22 },
  { x: 160, y: 20 },  // Junction East
  { x: 200, y: 12 },
  { x: 240, y: 0 }    // Main Haulage East Terminus
];

export const STATIC_SOUTH_DECLINE: { x: number; y: number }[] = [
  { x: -60, y: 0 },   // Connects to Main Haulage
  { x: -60, y: 35 },
  { x: -60, y: 70 },
  { x: -60, y: 105 }  // Ventilation Shaft South
];

export const STATIC_NORTH_CROSSCUT: { x: number; y: number }[] = [
  { x: 40, y: 20 },   // Connects to Main Haulage
  { x: 40, y: -20 },
  { x: 40, y: -65 },
  { x: 40, y: -115 }  // North Stope Face
];

export const STATIC_EAST_STOPE: { x: number; y: number }[] = [
  { x: 160, y: 20 },  // Connects to Main Haulage
  { x: 195, y: 36 },
  { x: 230, y: 48 },
  { x: 270, y: 55 }   // Sub-Level 08 Heading
];

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

// Pre-measured dimension callouts positioned along actual corridors
const DIMENSION_MAIN = { x: -30, y: -16, widthText: '↔ 3.2m WIDTH', lengthText: '85m MAIN DRIFT', textWidth: 148 };
const DIMENSION_NORTH = { x: 58, y: -50, widthText: '↔ 2.4m WIDTH', lengthText: '35m TO STOPE', textWidth: 142 };
const DIMENSION_SOUTH = { x: -44, y: 55, widthText: '↔ 2.8m WIDTH', lengthText: '38m TO SHAFT', textWidth: 144 };
const DIMENSION_EAST = { x: 220, y: 65, widthText: '↔ 2.6m WIDTH', lengthText: '28m EXPLORED', textWidth: 140 };

/**
 * Pure function: buildCorridorPath
 * Returns memoized corridor floor plan model with pre-baked Path2D paths.
 */
export function buildCorridorPath(
  _mapPoints: { x: number; y: number; gasPpm: number }[],
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
      x: -185,
      y: 0,
      distanceMeters: 45,
      status: evacActive && currentGas > 500 ? 'blocked' : 'open'
    },
    {
      id: 'exit-b',
      label: 'EXIT B — 110m',
      x: 40,
      y: -115,
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
