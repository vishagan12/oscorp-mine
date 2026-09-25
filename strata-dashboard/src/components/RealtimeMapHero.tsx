import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildCorridorPath } from '../utils/corridorMapBuilder';

export const RealtimeMapHero: React.FC = () => {
  const { hexapod, mapPoints, mapPath, activeScanBeams, evacActive, clearMap } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1.15);
  const [followRobot, setFollowRobot] = useState<boolean>(true);
  const [showLidar, setShowLidar] = useState<boolean>(true);
  const [showPointCloud, setShowPointCloud] = useState<boolean>(true);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Smooth camera position lerping (no jitter)
  const cameraPosRef = useRef<{ x: number; y: number }>({ x: hexapod.x * 2.2, y: hexapod.y * 2.2 });

  // Memoized corridor floor plan model
  const corridorModel = useMemo(() => {
    return buildCorridorPath(mapPoints, mapPath, hexapod, evacActive);
  }, [hexapod.gasPpm > 300, hexapod.gasPpm > 500, hexapod.fissureDetected, evacActive]);

  // Cached Path2D for robot traveled path
  const traveledPath2D = useMemo(() => {
    const p = new Path2D();
    if (mapPath.length > 0) {
      p.moveTo(mapPath[0].x * 2.2, mapPath[0].y * 2.2);
      for (let i = 1; i < mapPath.length; i++) {
        p.lineTo(mapPath[i].x * 2.2, mapPath[i].y * 2.2);
      }
    }
    return p;
  }, [mapPath.length]);

  // High-DPI ResizeObserver setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Smooth Mouse Wheel Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0015;
      setZoom((prev) => Math.min(3.2, Math.max(0.5, prev + zoomDelta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setFollowRobot(false);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCenterRobot = useCallback(() => {
    setFollowRobot(true);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Precomputed blueprint background grid Path2D
  const gridPath2D = useMemo(() => {
    const p = new Path2D();
    const size = 1200;
    const step = 45;
    for (let x = -size; x <= size; x += step) {
      p.moveTo(x, -size); p.lineTo(x, size);
    }
    for (let y = -size; y <= size; y += step) {
      p.moveTo(-size, y); p.lineTo(size, y);
    }
    return p;
  }, []);

  // Compute current navigation turn prompt based on hexapod position
  const currentNavPrompt = useMemo(() => {
    const x = hexapod.x;
    const y = hexapod.y;
    if (x < -60) {
      return { icon: '↑', text: 'Proceed straight along Main Haulage Drift', dist: `${Math.max(4, Math.round(Math.abs(-60 - x)))}m to South Junction` };
    } else if (x >= -75 && x <= -45 && y > 8) {
      return { icon: '↰', text: 'Exploring South Ventilation Incline', dist: `${Math.max(4, Math.round(105 - y))}m to Shaft Terminus` };
    } else if (x >= 25 && x <= 55 && y < 8) {
      return { icon: '↱', text: 'Surveying North Extraction Crosscut', dist: `${Math.max(4, Math.round(Math.abs(-115 - y)))}m to Stope Face` };
    } else if (x > 150 && y > 15) {
      return { icon: '↱', text: 'Mapping Sub-Level 08 Access Drift', dist: `${Math.max(4, Math.round(270 - x))}m to Heading` };
    } else {
      return { icon: '↑', text: 'Navigating Central Haulage Drift', dist: `${Math.max(4, Math.round(160 - x))}m to Sub-Level 08 Split` };
    }
  }, [hexapod.x, hexapod.y]);

  // 60FPS Hardware-Accelerated Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const centerX = w / 2;
      const centerY = h / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fast solid background clear (warm parchment)
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, w, h);

      // Camera position interpolation
      const targetX = hexapod.x * 2.2;
      const targetY = hexapod.y * 2.2;
      if (followRobot) {
        cameraPosRef.current.x += (targetX - cameraPosRef.current.x) * 0.14;
        cameraPosRef.current.y += (targetY - cameraPosRef.current.y) * 0.14;
      }

      ctx.save();
      if (followRobot) {
        ctx.translate(centerX, centerY);
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraPosRef.current.x, -cameraPosRef.current.y);
      } else {
        ctx.translate(centerX + panOffset.x, centerY + panOffset.y);
        ctx.scale(zoom, zoom);
      }

      // 1. Blueprint Coordinate Grid
      ctx.strokeStyle = 'rgba(180, 165, 145, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke(gridPath2D);

      // 2. Render Metro-Style Tunnel Corridors
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pass 1: Google Maps Road Borders (crisp light-slate boundary)
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        ctx.lineWidth = corridorPixelWidth + 4;
        ctx.strokeStyle = seg.status === 'blocked' ? '#EF4444' : '#CBD5E1';
        ctx.stroke(seg.cachedPath2D);
      });

      // Pass 2: Pure White Clean Road Surface
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        ctx.lineWidth = corridorPixelWidth;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke(seg.cachedPath2D);
      });

      // Pass 2b: Subtle Dashed Road Centerline
      ctx.save();
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.75)';
      ctx.lineWidth = 1.5;
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        ctx.stroke(seg.cachedPath2D);
      });
      ctx.restore();

      // Pass 3: Safety Regulation Overlays (if caution or blocked)
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        if (seg.status === 'blocked' || seg.status === 'critical') {
          ctx.lineWidth = corridorPixelWidth;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
          ctx.stroke(seg.cachedPath2D);
        } else if (seg.status === 'warning') {
          ctx.lineWidth = corridorPixelWidth;
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
          ctx.stroke(seg.cachedPath2D);
        }
      });

      // 3. Dimension Callouts
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      corridorModel.segments.forEach((seg) => {
        if (!seg.dimensionCallout) return;
        const cx = seg.dimensionCallout.x * 2.2;
        const cy = seg.dimensionCallout.y * 2.2;
        const tw = seg.dimensionCallout.textWidth;
        const text = `${seg.dimensionCallout.widthText} · ${seg.dimensionCallout.lengthText}`;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.strokeStyle = '#D9CFBF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2 - 5, cy - 8, tw + 10, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#8C7D6D';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - tw / 2 - 5, cy - 4); ctx.lineTo(cx - tw / 2 - 5, cy + 4);
        ctx.moveTo(cx + tw / 2 + 5, cy - 4); ctx.lineTo(cx + tw / 2 + 5, cy + 4);
        ctx.stroke();

        ctx.fillStyle = '#4A463F';
        ctx.fillText(text, cx, cy);
      });

      // 3b. CUMULATIVE SCANNED SLAM POINT CLOUD (Revealed Wall Envelope)
      if (showPointCloud && mapPoints.length > 0) {
        ctx.save();
        for (let i = 0; i < mapPoints.length; i++) {
          const pt = mapPoints[i];
          const px = pt.x * 2.2;
          const py = pt.y * 2.2;
          ctx.fillStyle = pt.gasPpm > 450
            ? 'rgba(239, 68, 68, 0.85)'
            : pt.gasPpm > 300
            ? 'rgba(245, 158, 11, 0.85)'
            : 'rgba(5, 150, 105, 0.70)';
          ctx.beginPath();
          ctx.arc(px, py, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 3c. DYNAMIC REAL-TIME 360-DEGREE LIDAR LASER BEAMS & WALL STRIKES
      if (showLidar && activeScanBeams.length > 0) {
        ctx.save();
        const baseBeamColor = hexapod.gasPpm > 450
          ? 'rgba(239, 68, 68, 0.45)'
          : hexapod.gasPpm > 300
          ? 'rgba(245, 158, 11, 0.40)'
          : 'rgba(6, 182, 212, 0.38)';

        const impactColor = hexapod.gasPpm > 450
          ? '#EF4444'
          : hexapod.gasPpm > 300
          ? '#F59E0B'
          : '#06B6D4';

        // High-Tech Laser Rays
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = baseBeamColor;
        for (let i = 0; i < activeScanBeams.length; i++) {
          const b = activeScanBeams[i];
          ctx.beginPath();
          ctx.moveTo(b.x1 * 2.2, b.y1 * 2.2);
          ctx.lineTo(b.x2 * 2.2, b.y2 * 2.2);
          ctx.stroke();
        }

        // Wall Impact Sparks (glowing dots at the ends of hit rays)
        for (let i = 0; i < activeScanBeams.length; i++) {
          const b = activeScanBeams[i];
          if (!b.hit) continue;
          const hx = b.x2 * 2.2;
          const hy = b.y2 * 2.2;

          // Glowing spark center
          ctx.fillStyle = impactColor;
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Outer halo
          ctx.fillStyle = hexapod.gasPpm > 450 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(6, 182, 212, 0.25)';
          ctx.beginPath();
          ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // High-Speed Sweeping LiDAR Radar Line
        const sweepAngle = (Date.now() / 6) % 360;
        const sweepRad = (sweepAngle * Math.PI) / 180;
        const sweepLen = 65 * 2.2;
        const hx = hexapod.x * 2.2;
        const hy = hexapod.y * 2.2;
        const sx = hx + Math.cos(sweepRad) * sweepLen;
        const sy = hy + Math.sin(sweepRad) * sweepLen;

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.restore();
      }

      // 4. GOOGLE MAPS STYLE NAVIGATION ROUTE (Double-Pass Route with Traffic Colors & Chevrons)
      if (mapPath.length > 1) {
        // Underlay Casing (Google Maps dark route outline)
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.stroke(traveledPath2D);

        // Vibrant Traffic Route Line (Google Maps blue/green traffic styling)
        ctx.lineWidth = 5.5;
        let routeColor = '#2563EB'; // Google Maps Navigation Blue
        if (hexapod.gasPpm > 450) {
          routeColor = '#EF4444';   // Traffic Heavy / Hazard Breach
        } else if (hexapod.gasPpm > 300) {
          routeColor = '#F59E0B';   // Moderate / Caution
        }

        ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = routeColor;
        ctx.stroke(traveledPath2D);
        ctx.shadowBlur = 0;

        // Directional Navigation Chevrons (Google Maps turn-by-turn arrows along path)
        if (mapPath.length > 5) {
          ctx.save();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          for (let i = 10; i < mapPath.length; i += 18) {
            const p1 = mapPath[i - 1];
            const p2 = mapPath[i];
            const angle = Math.atan2((p2.y - p1.y) * 2.2, (p2.x - p1.x) * 2.2);
            const mx = p2.x * 2.2;
            const my = p2.y * 2.2;

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-3, -3.5);
            ctx.lineTo(2.5, 0);
            ctx.lineTo(-3, 3.5);
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }
      }

      // 5. GOOGLE MAPS AUTHENTIC TEARDROP PINS
      const drawGoogleMapsPin = (x: number, y: number, letter: string, color: string, label: string) => {
        ctx.save();
        // Drop shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Teardrop pin body pointing straight down to (x, y)
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 19, 10.5, Math.PI * 0.8, Math.PI * 2.2);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner circle for letter
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y - 19, 6, 0, Math.PI * 2);
        ctx.fill();

        // Letter inside pin
        ctx.fillStyle = color;
        ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x, y - 18.5);

        // Label pill floating above pin
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2 - 5, y - 38, tw + 10, 15, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.fillText(label, x, y - 30);
        ctx.restore();
      };

      // Start Origin Pin [A]
      drawGoogleMapsPin(-180 * 2.2, 0, 'A', '#16A34A', 'START · PORTAL 01');

      // Key Terminus & Destination Pins
      drawGoogleMapsPin(40 * 2.2, -115 * 2.2, 'B', '#DC2626', 'DEST · NORTH STOPE FACE');
      drawGoogleMapsPin(-60 * 2.2, 105 * 2.2, 'C', '#D97706', 'VENT SHAFT SOUTH');
      drawGoogleMapsPin(270 * 2.2, 55 * 2.2, 'D', '#7C3AED', 'SUB-LEVEL 08 HEADING');
      drawGoogleMapsPin(240 * 2.2, 0, 'E', '#2563EB', 'MAIN HAULAGE EAST');

      // Hazard Anomaly Pin (if gas surge or fissure detected)
      if (hexapod.gasPpm > 400 || hexapod.fissureDetected) {
        const hx = 40 * 2.2;
        const hy = -60 * 2.2;
        ctx.save();
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', hx, hy);

        ctx.fillStyle = '#DC2626';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillText('⚠ GAS BREACH INCIDENT', hx, hy + 16);
        ctx.restore();
      }

      // 6. GOOGLE MAPS NAVIGATION LOCATION PUCK (White Ring + Blue Center + Heading Flashlight Cone)
      const rx = hexapod.x * 2.2;
      const ry = hexapod.y * 2.2;
      const rad = (hexapod.heading * Math.PI) / 180;

      ctx.save();
      ctx.translate(rx, ry);

      // Flashlight Heading Cone (Google Maps Directional Beam)
      const beamGradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 58);
      beamGradient.addColorStop(0, 'rgba(37, 99, 235, 0.40)');
      beamGradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 58, rad - (32 * Math.PI) / 180, rad + (32 * Math.PI) / 180);
      ctx.closePath();
      ctx.fill();

      // Outer GPS Accuracy Pulse Ring
      const pulseTime = Date.now() / 250;
      const pulse = 14 + Math.sin(pulseTime) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
      ctx.fill();

      // Location Puck Body: Crisp White Outer Ring
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Blue Navigation Dot
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563EB';
      ctx.fill();

      // Directional Heading Indicator Tip
      ctx.rotate(rad);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(2, -2.5);
      ctx.lineTo(2, 2.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      ctx.restore(); // Restore camera transform

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [corridorModel, traveledPath2D, gridPath2D, hexapod.x, hexapod.y, hexapod.heading, hexapod.gasPpm, hexapod.fissureDetected, activeScanBeams, mapPoints, showLidar, showPointCloud, zoom, followRobot, panOffset]);

  const exploredMeters = Math.round(mapPath.length * 1.4);

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-sm h-full font-['Plus_Jakarta_Sans']">
      {/* Top Map Toolbar */}
      <div className="p-3.5 px-6 border-b border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F3]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-pulse"></span>
            <span className="font-bold text-sm text-[#1F2421] tracking-tight">
              Hexapod Route Cartography // Google Maps Navigation View
            </span>
          </div>
          <span className="block text-xs text-[#6B685F] mt-0.5 font-medium">
            Autonomous Multi-Branch Route Exploration · Dynamic Turn-by-Turn Telemetry
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* LiDAR Laser Rays Toggle */}
          <button
            onClick={() => setShowLidar(s => !s)}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              showLidar
                ? 'bg-[#06B6D4]/10 border-[#06B6D4]/40 text-[#0891B2]'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
            title="Toggle 360-degree LiDAR laser beams and wall strike detection"
          >
            <span className={`w-2 h-2 rounded-full ${showLidar ? 'bg-[#06B6D4] animate-ping' : 'bg-gray-400'}`}></span>
            <span>{showLidar ? 'LiDAR Rays: 360° [ON]' : 'LiDAR Rays [OFF]'}</span>
          </button>

          {/* SLAM Point Cloud Toggle */}
          <button
            onClick={() => setShowPointCloud(s => !s)}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              showPointCloud
                ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#059669]'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
            title="Toggle revealed cave wall SLAM point cloud"
          >
            <span className={`w-2 h-2 rounded-full ${showPointCloud ? 'bg-[#10B981]' : 'bg-gray-400'}`}></span>
            <span>{showPointCloud ? `SLAM Points (${mapPoints.length})` : 'SLAM Points [OFF]'}</span>
          </button>

          <button
            onClick={handleCenterRobot}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              followRobot
                ? 'bg-[#2563EB]/10 border-[#2563EB]/40 text-[#2563EB]'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
          >
            {followRobot ? '● Recenter Navigation' : 'Center Navigation'}
          </button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E6DFD5]">
            <button
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.2).toFixed(2)))}
              className="w-7 h-7 rounded text-[#1F2421] hover:bg-[#F3EFE6] flex items-center justify-center font-bold text-sm cursor-pointer"
            >
              -
            </button>
            <span className="text-[#1F2421] text-xs min-w-[40px] text-center font-mono font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3.2, +(z + 0.2).toFixed(2)))}
              className="w-7 h-7 rounded text-[#1F2421] hover:bg-[#F3EFE6] flex items-center justify-center font-bold text-sm cursor-pointer"
            >
              +
            </button>
          </div>

          <button
            onClick={clearMap}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#E6DFD5] text-[#6B685F] hover:text-[#1F2421] hover:bg-[#F3EFE6] transition-all cursor-pointer font-medium"
          >
            Reset Route
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport with High-DPI Container */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[460px] bg-[#FAF7F0] flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full block"
        />

        {/* GOOGLE MAPS SIGNATURE TURN-BY-TURN NAVIGATION BANNER (Top-Left HUD) */}
        <div className="absolute top-4 left-4 bg-[#137333] border border-[#0d5224] rounded-2xl p-3 px-4 shadow-xl max-w-sm flex items-center gap-3.5 font-['Plus_Jakarta_Sans'] text-white">
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl font-black shadow-inner shrink-0">
            {currentNavPrompt.icon}
          </div>
          <div>
            <div className="text-[11px] font-black text-emerald-200 tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-ping"></span>
              <span>{currentNavPrompt.dist}</span>
            </div>
            <div className="text-xs font-bold text-white leading-tight mt-0.5">
              {currentNavPrompt.text}
            </div>
            <div className="text-[10px] text-emerald-100/80 font-medium mt-0.5 flex items-center gap-1.5">
              <span>Autonomous Navigation</span>
              <span>·</span>
              <span className="font-mono">{hexapod.speedMps} m/s</span>
            </div>
          </div>
        </div>

        {/* Reference Scale Bar in Top-Right Corner */}
        <div className="absolute top-4 right-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-2 px-3 flex flex-col items-center gap-1 shadow-sm backdrop-blur-xs">
          <div className="flex items-center gap-1">
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
            <span style={{ width: `${Math.round(22 * zoom)}px` }} className="h-0.5 bg-[#1F2421]"></span>
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
          </div>
          <span className="text-[10px] font-mono text-[#6B685F] font-semibold">10m SCALE</span>
        </div>

        {/* GOOGLE MAPS STYLE BOTTOM-LEFT ROUTE LEGEND */}
        <div className="absolute bottom-4 left-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-3 px-4 flex flex-wrap items-center gap-4 text-xs font-mono shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 bg-[#06B6D4] rounded"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">360° LiDAR Laser Rays</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#059669]"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">SLAM Scanned Walls</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 bg-[#2563EB] rounded"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Active Navigation Route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 bg-[#EF4444] rounded"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Hazard Incident</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-[9px] font-bold">A</span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Start</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] text-white flex items-center justify-center text-[9px] font-bold">B</span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Destination</span>
          </div>
        </div>

        {/* GOOGLE MAPS STYLE TRIP BOTTOM CARD */}
        <div className="absolute bottom-4 right-4 bg-white/95 border border-[#E6DFD5] rounded-2xl p-3 px-4 shadow-lg flex items-center gap-4 backdrop-blur-md">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-[#137333]">{Math.max(1, Math.round((mapPath.length * 0.4) / 10))} min</span>
              <span className="text-xs text-[#6B685F] font-semibold">({exploredMeters}m traversed)</span>
            </div>
            <div className="text-[11px] text-[#6B685F] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
              <span>Optimal Subterranean Route</span>
            </div>
          </div>
          <div className="h-7 w-px bg-[#E6DFD5]"></div>
          <button
            onClick={handleCenterRobot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold shadow-xs hover:bg-[#1D4ED8] transition-all cursor-pointer"
          >
            <span>🧭</span>
            <span>Recenter</span>
          </button>
        </div>
      </div>

      {/* Bottom Exploration Summary Strip */}
      <div className="p-3.5 px-6 bg-[#FAF8F3] border-t border-[#E6DFD5] grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Active Navigation</span>
          <span className="font-bold text-[#2563EB] text-sm mt-0.5 block">Autonomous Waypoints</span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Safe Route to Exit</span>
          <span className="font-bold text-[#2E7D32] text-sm mt-0.5 block">
            {evacActive ? 'Blocked by Hazard' : 'Clear Route → Portal 01'}
          </span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Atmospheric Status</span>
          <span className={`font-bold text-sm mt-0.5 block ${hexapod.gasPpm > 400 ? 'text-[#B71C1C]' : 'text-[#2E7D32]'}`}>
            {Math.round(hexapod.gasPpm)} PPM Nominal
          </span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Rover Velocity</span>
          <span className="font-bold text-[#C85A32] text-sm mt-0.5 block">
            {hexapod.speedMps} m/s ({hexapod.heading}°)
          </span>
        </div>
      </div>
    </div>
  );
};
