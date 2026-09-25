import { useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildCorridorPath } from '../utils/corridorMapBuilder';

export { buildCorridorPath };

export default function MapPanel() {
  const { hexapod, mapPoints, mapPath, evacActive } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoized corridor floor plan model
  const corridorModel = useMemo(() => {
    return buildCorridorPath(mapPoints, mapPath, hexapod, evacActive);
  }, [hexapod.gasPpm > 300, hexapod.gasPpm > 500, hexapod.fissureDetected, evacActive]);

  // Precomputed blueprint background grid Path2D
  const gridPath2D = useMemo(() => {
    const p = new Path2D();
    const size = 900;
    for (let x = -size; x <= size; x += 45) {
      p.moveTo(x, -size); p.lineTo(x, size);
    }
    for (let y = -size; y <= size; y += 45) {
      p.moveTo(-size, y); p.lineTo(size, y);
    }
    return p;
  }, []);

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

  // High-DPI ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // 60FPS Hardware Accelerated Render Loop
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

      // Fast background clear
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1.0, 1.0);
      ctx.translate(-hexapod.x * 2.2, -hexapod.y * 2.2);

      // 1. Grid
      ctx.strokeStyle = 'rgba(180, 165, 145, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke(gridPath2D);

      // 2. Corridors
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const width = seg.widthMeters * 2.2 * 4.5;

        // Outer wall
        ctx.lineWidth = width + 4;
        ctx.strokeStyle = seg.status === 'blocked' ? '#B71C1C' : '#D4C5B0';
        ctx.stroke(seg.cachedPath2D);

        // Floor fill
        ctx.lineWidth = width;
        ctx.strokeStyle = '#EAE3D5';
        ctx.stroke(seg.cachedPath2D);

        // Safety tint
        let tint = 'rgba(46, 125, 50, 0.22)';
        if (seg.status === 'blocked' || seg.status === 'critical') tint = 'rgba(183, 28, 28, 0.35)';
        else if (seg.status === 'warning') tint = 'rgba(184, 134, 11, 0.26)';

        ctx.lineWidth = width;
        ctx.strokeStyle = tint;
        ctx.stroke(seg.cachedPath2D);
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

        ctx.fillStyle = '#4A463F';
        ctx.fillText(text, cx, cy);
      });

      // 4. Exits & Portals
      corridorModel.exits.forEach((exit) => {
        const ex = exit.x * 2.2;
        const ey = exit.y * 2.2;
        const isBlocked = exit.status === 'blocked';
        const color = isBlocked ? '#B71C1C' : '#2E7D32';

        ctx.fillStyle = isBlocked ? 'rgba(254, 242, 242, 0.96)' : 'rgba(240, 253, 244, 0.96)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(ex - 8, ey - 22, 105, 20, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(isBlocked ? '✕ EXIT BLOCKED' : exit.label, ex + 6, ey - 12);
      });

      // 5. Centerline Traveled Path
      if (mapPath.length > 1) {
        ctx.shadowColor = '#FF441A';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#FF441A';
        ctx.lineWidth = 3.5;
        ctx.stroke(traveledPath2D);
        ctx.shadowBlur = 0;
      }

      // 6. Pulsing Heading Triangle Marker
      const rx = hexapod.x * 2.2;
      const ry = hexapod.y * 2.2;
      const rad = (hexapod.heading * Math.PI) / 180;
      const pulse = 14 + Math.sin(Date.now() / 240) * 3.5;

      ctx.save();
      ctx.translate(rx, ry);

      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 68, 26, 0.20)';
      ctx.fill();

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

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [corridorModel, traveledPath2D, gridPath2D, hexapod.x, hexapod.y, hexapod.heading]);

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-sm h-full font-['Plus_Jakarta_Sans']">
      <div className="p-3.5 px-6 border-b border-[#E6DFD5] flex items-center justify-between bg-[#FAF8F3]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]"></span>
          <span className="font-bold text-sm text-[#1F2421]">
            Hexapod Scout LiDAR Floor Plan
          </span>
        </div>
        <span className="text-xs text-[#6B685F] font-mono">SECTOR 09</span>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-[440px] bg-[#FAF7F0] flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Scale Bar */}
        <div className="absolute top-4 right-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-2 px-3 flex flex-col items-center gap-1 shadow-sm">
          <div className="flex items-center gap-1">
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
            <span className="w-6 h-0.5 bg-[#1F2421]"></span>
            <span className="w-1 h-2.5 bg-[#1F2421]"></span>
          </div>
          <span className="text-[10px] font-mono text-[#6B685F] font-semibold">10m SCALE</span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/95 border border-[#E6DFD5] rounded-xl p-3 px-4 flex flex-wrap items-center gap-3 text-xs font-mono shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#2E7D32]/30 border border-[#2E7D32]"></span>
            <span className="text-[11px] text-[#1F2421]">Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#B8860B]/30 border border-[#B8860B]"></span>
            <span className="text-[11px] text-[#1F2421]">Warn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#B71C1C]/40 border border-[#B71C1C]"></span>
            <span className="text-[11px] text-[#1F2421]">Crit/Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 bg-[#FF441A] rounded"></span>
            <span className="text-[11px] text-[#FF441A] font-bold">Path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FAF7F0] border border-[#D4C5B0]"></span>
            <span className="text-[11px] text-[#6B685F]">Unexplored</span>
          </div>
        </div>
      </div>
    </div>
  );
}
