import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildCorridorPath } from '../utils/corridorMapBuilder';

export const RealtimeMapHero: React.FC = () => {
  const { hexapod, mapPoints, mapPath, evacActive, clearMap } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1.15);
  const [followRobot, setFollowRobot] = useState<boolean>(true);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Smooth camera position lerping (no jitter)
  const cameraPosRef = useRef<{ x: number; y: number }>({ x: hexapod.x * 2.2, y: hexapod.y * 2.2 });

  // Memoized corridor floor plan model (only recomputes when gas thresholds or hazards change)
  const corridorModel = useMemo(() => {
    return buildCorridorPath(mapPoints, mapPath, hexapod, evacActive);
  }, [hexapod.gasPpm > 300, hexapod.gasPpm > 500, hexapod.fissureDetected, evacActive]);

  // Cached Path2D for robot traveled path (only updates when new waypoints are added)
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
          const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for optimal GPU perf
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Smooth Mouse Wheel Zoom (centered zoom)
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

  // Precomputed blueprint background grid Path2D (reused across all frames)
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

  // 60FPS Hardware-Accelerated Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Disable canvas alpha for max blit speed
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const centerX = w / 2;
      const centerY = h / 2;

      // Reset transform and apply DPR scaling
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fast solid background clear
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, w, h);

      // Camera position interpolation (smooth lerp tracking)
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

      // 1. Draw Blueprint Coordinate Grid (single GPU stroke call via pre-cached Path2D)
      ctx.strokeStyle = 'rgba(180, 165, 145, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke(gridPath2D);

      // 2. Render Metro-Style Tunnel Corridors (Fast Path2D rendering)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pass 1: Outer structural wall lines
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        ctx.lineWidth = corridorPixelWidth + 4;
        ctx.strokeStyle = seg.status === 'blocked' ? '#B71C1C' : '#D4C5B0';
        ctx.stroke(seg.cachedPath2D);
      });

      // Pass 2: Solid interior corridor floor
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        ctx.lineWidth = corridorPixelWidth;
        ctx.strokeStyle = '#EAE3D5';
        ctx.stroke(seg.cachedPath2D);
      });

      // Pass 3: Safety Regulation Overlays
      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;
        let tint = 'rgba(46, 125, 50, 0.22)';
        if (seg.status === 'blocked' || seg.status === 'critical') {
          tint = 'rgba(183, 28, 28, 0.35)';
        } else if (seg.status === 'warning') {
          tint = 'rgba(184, 134, 11, 0.26)';
        }
        ctx.lineWidth = corridorPixelWidth;
        ctx.strokeStyle = tint;
        ctx.stroke(seg.cachedPath2D);
      });

      // 3. Blocked / Hazard Badges
      corridorModel.segments.forEach((seg) => {
        if (seg.status === 'blocked') {
          const mid = seg.points[Math.floor(seg.points.length / 2)];
          const mx = mid.x * 2.2;
          const my = mid.y * 2.2;

          ctx.fillStyle = '#B71C1C';
          ctx.beginPath();
          ctx.arc(mx, my, 11, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(mx - 4, my - 4); ctx.lineTo(mx + 4, my + 4);
          ctx.moveTo(mx + 4, my - 4); ctx.lineTo(mx - 4, my + 4);
          ctx.stroke();

          ctx.fillStyle = '#B71C1C';
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕ BLOCKED HAZARD', mx + 16, my);
        }
      });

      // 4. Dimension Callouts (Blueprint dimension pills with pre-measured widths)
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

      // 5. Exit Portals
      corridorModel.exits.forEach((exit) => {
        const ex = exit.x * 2.2;
        const ey = exit.y * 2.2;
        const isBlocked = exit.status === 'blocked';
        const color = isBlocked ? '#B71C1C' : '#2E7D32';

        ctx.fillStyle = isBlocked ? 'rgba(254, 242, 242, 0.96)' : 'rgba(240, 253, 244, 0.96)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(ex - 8, ey - 22, 108, 20, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ex - 1, ey - 12);
        ctx.lineTo(ex + 4, ey - 17);
        ctx.lineTo(ex + 9, ey - 12);
        ctx.closePath();
        ctx.fill();

        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(isBlocked ? '✕ EXIT BLOCKED' : exit.label, ex + 14, ey - 12);
      });

      // 6. Glowing Traveled Path (Single Path2D stroke)
      if (mapPath.length > 1) {
        ctx.shadowColor = '#FF441A';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#FF441A';
        ctx.lineWidth = 3.5;
        ctx.stroke(traveledPath2D);

        // Reset shadow for next primitives
        ctx.shadowBlur = 0;
      }

      // 7. Pulsing Coral Rover Heading Marker (#FF441A)
      const rx = hexapod.x * 2.2;
      const ry = hexapod.y * 2.2;
      const rad = (hexapod.heading * Math.PI) / 180;
      const pulseTime = Date.now() / 240;
      const pulse = 14 + Math.sin(pulseTime) * 3.5;

      ctx.save();
      ctx.translate(rx, ry);

      // Animated soft halo
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 68, 26, 0.20)';
      ctx.fill();

      // Heading directional triangle
      ctx.rotate(rad);
      ctx.shadowColor = '#FF441A';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FF441A';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-9, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.restore();

      ctx.restore(); // Restore camera transform

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [corridorModel, traveledPath2D, gridPath2D, hexapod.x, hexapod.y, hexapod.heading, zoom, followRobot, panOffset]);

  const exploredMeters = Math.round(mapPath.length * 1.2);

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-sm h-full font-['Plus_Jakarta_Sans']">
      {/* Top Map Toolbar */}
      <div className="p-3.5 px-6 border-b border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F3]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32] animate-pulse"></span>
            <span className="font-bold text-sm text-[#1F2421] tracking-tight">
              Hexapod LiDAR Floor Plan &amp; Evacuation Corridor Map
            </span>
          </div>
          <span className="block text-xs text-[#6B685F] mt-0.5 font-medium">
            Zoomed-Out Subterranean Drift Geometry // Hardware Accelerated Canvas
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleCenterRobot}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              followRobot
                ? 'bg-[#2E7D32]/10 border-[#2E7D32]/40 text-[#2E7D32]'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
          >
            {followRobot ? '● Tracking Rover' : 'Center Rover'}
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
            Reset Map
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

        {/* Reference Scale Bar in Top-Right Corner */}
        <div className="absolute top-4 right-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-2 px-3 flex flex-col items-center gap-1 shadow-sm backdrop-blur-xs">
          <div className="flex items-center gap-1">
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
            <span style={{ width: `${Math.round(22 * zoom)}px` }} className="h-0.5 bg-[#1F2421]"></span>
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
          </div>
          <span className="text-[10px] font-mono text-[#6B685F] font-semibold">10m SCALE</span>
        </div>

        {/* Compass Rose */}
        <div className="absolute top-4 left-4 bg-white/90 border border-[#E6DFD5] rounded-xl p-2 px-3 flex items-center gap-2 text-xs font-semibold text-[#1F2421] shadow-sm backdrop-blur-xs">
          <span className="text-[#C85A32] font-bold">N ↑</span>
          <span className="text-[#6B685F] text-[11px] font-mono">SECTOR 09</span>
        </div>

        {/* Fixed Legend Box in Bottom-Left Corner */}
        <div className="absolute bottom-4 left-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-3 px-4 flex flex-wrap items-center gap-4 text-xs font-mono shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#2E7D32]/30 border border-[#2E7D32]"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Safe Path (&lt;300 PPM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#B8860B]/30 border border-[#B8860B]"></span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Caution (300-500)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#B71C1C]/40 border border-[#B71C1C] flex items-center justify-center text-[9px] font-bold text-white">✕</span>
            <span className="text-[#1F2421] font-semibold text-[11px]">Critical / Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#FF441A] rounded"></span>
            <span className="text-[#FF441A] font-bold text-[11px]">Traveled Path</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#FAF7F0] border border-[#D4C5B0]"></span>
            <span className="text-[#6B685F] text-[11px]">Unexplored</span>
          </div>
        </div>

        {/* Live Exploration Readouts in Bottom-Right */}
        <div className="absolute bottom-4 right-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-2.5 px-3.5 shadow-sm text-xs flex flex-col gap-0.5 backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#6B685F]">Explored Length:</span>
            <span className="font-bold text-[#1F2421]">{exploredMeters} Meters</span>
          </div>
          <div className="text-[11px] text-[#6B685F]">
            Position: {hexapod.x.toFixed(1)}m E, {hexapod.y.toFixed(1)}m N · {hexapod.heading}°
          </div>
        </div>
      </div>

      {/* Bottom Exploration Summary Strip */}
      <div className="p-3.5 px-6 bg-[#FAF8F3] border-t border-[#E6DFD5] grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Corridor Network</span>
          <span className="font-bold text-[#1F2421] text-sm mt-0.5 block">4 Drifts Active</span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Safe Evacuation Route</span>
          <span className="font-bold text-[#2E7D32] text-sm mt-0.5 block">
            {evacActive ? 'Blocked by Hazard' : 'Clear → Portal 01'}
          </span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Atmospheric Status</span>
          <span className={`font-bold text-sm mt-0.5 block ${hexapod.gasPpm > 400 ? 'text-[#B71C1C]' : 'text-[#2E7D32]'}`}>
            {Math.round(hexapod.gasPpm)} PPM Nominal
          </span>
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] shadow-xs">
          <span className="text-xs text-[#6B685F] block font-medium">Rover Heading</span>
          <span className="font-bold text-[#C85A32] text-sm mt-0.5 block">
            {hexapod.heading}° Azimuth
          </span>
        </div>
      </div>
    </div>
  );
};
