import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { buildCorridorPath } from '../utils/corridorMapBuilder';

export const ReconPage: React.FC = () => {
  const { hexapod, mapPoints, mapPath, evacActive, sendRobotCommand, triggerHazard } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1.2);
  const [thermalMode, setThermalMode] = useState<boolean>(false);
  const [opticalOverlay, setOpticalOverlay] = useState<boolean>(true);

  // Camera position lerp
  const cameraPosRef = useRef<{ x: number; y: number }>({ x: hexapod.x * 2.2, y: hexapod.y * 2.2 });

  // Memoized corridor model
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

  // Render Real-time HTML5 Canvas LiDAR Map (Metro / Architectural Blueprint Style)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const renderMap = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fast background clear
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, width, height);

      // Smooth camera interpolation
      const targetX = hexapod.x * 2.2;
      const targetY = hexapod.y * 2.2;
      cameraPosRef.current.x += (targetX - cameraPosRef.current.x) * 0.14;
      cameraPosRef.current.y += (targetY - cameraPosRef.current.y) * 0.14;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraPosRef.current.x, -cameraPosRef.current.y);

      // 1. Grid
      ctx.strokeStyle = 'rgba(180, 165, 145, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke(gridPath2D);

      // 2. Corridors
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      corridorModel.segments.forEach((seg) => {
        if (!seg.cachedPath2D) return;
        const corridorPixelWidth = seg.widthMeters * 2.2 * 4.5;

        // Outer wall
        ctx.lineWidth = corridorPixelWidth + 4;
        ctx.strokeStyle = seg.status === 'blocked' ? '#B71C1C' : '#D4C5B0';
        ctx.stroke(seg.cachedPath2D);

        // Floor fill
        ctx.lineWidth = corridorPixelWidth;
        ctx.strokeStyle = '#EAE3D5';
        ctx.stroke(seg.cachedPath2D);

        // Safety Tint Overlay
        let tint = 'rgba(46, 125, 50, 0.22)';
        if (seg.status === 'blocked' || seg.status === 'critical') tint = 'rgba(183, 28, 28, 0.35)';
        else if (seg.status === 'warning') tint = 'rgba(184, 134, 11, 0.26)';

        ctx.lineWidth = corridorPixelWidth;
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

      // 5. Glowing Coral Traveled Path (#FF441A)
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

      animId = requestAnimationFrame(renderMap);
    };

    renderMap();
    return () => cancelAnimationFrame(animId);
  }, [corridorModel, traveledPath2D, gridPath2D, hexapod.x, hexapod.y, hexapod.heading, zoom]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-['Plus_Jakarta_Sans']">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-white rounded-2xl border border-[#E6DFD5] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]"></span>
            <h1 className="font-bold text-sm text-[#1F2421]">
              Autonomous Rover Control &amp; Recon Studio
            </h1>
          </div>
          <p className="text-xs text-[#6B685F] mt-0.5 font-medium">
            Live Optical Stream &amp; Directional SLAM Cartography
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerHazard('fissure')}
            className="px-3.5 py-1.5 bg-[#B71C1C]/10 border border-[#B71C1C]/30 text-[#B71C1C] rounded-lg text-xs font-semibold hover:bg-[#B71C1C] hover:text-white transition-all cursor-pointer"
          >
            Trigger Fissure Anomaly
          </button>
        </div>
      </div>

      {/* Grid: Camera Feed + SLAM Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Video Feed */}
        <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-[#E6DFD5] flex items-center justify-between bg-[#FAF8F3]">
            <span className="font-bold text-sm text-[#1F2421]">
              Live Optical Camera Stream
            </span>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setThermalMode(!thermalMode)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                  thermalMode ? 'bg-[#C85A32] text-white border-[#C85A32]' : 'bg-white text-[#6B685F] border-[#E6DFD5] hover:bg-[#F3EFE6]'
                }`}
              >
                {thermalMode ? 'IR Thermal: On' : 'IR Thermal: Off'}
              </button>
              <button
                onClick={() => setOpticalOverlay(!opticalOverlay)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                  opticalOverlay ? 'bg-[#C85A32]/10 border-[#C85A32]/40 text-[#C85A32] font-semibold' : 'bg-white text-[#6B685F] border-[#E6DFD5]'
                }`}
              >
                AI Crack HUD
              </button>
            </div>
          </div>

          <div className="relative aspect-video w-full bg-[#111317] flex items-center justify-center overflow-hidden">
            <div
              className={`absolute inset-0 transition-all duration-300 ${
                thermalMode
                  ? 'bg-gradient-to-tr from-[#1b004b] via-[#8e24aa] to-[#fb8c00] opacity-90'
                  : 'bg-gradient-to-b from-[#1E232B] via-[#151920] to-[#0D1015]'
              }`}
            ></div>

            {opticalOverlay && hexapod.fissureDetected && (
              <div className="absolute top-[28%] left-[42%] w-36 h-28 border-2 border-[#B71C1C] bg-[#B71C1C]/20 rounded-xl flex flex-col justify-between p-2.5 animate-pulse shadow-lg">
                <div className="flex justify-between items-center text-[10px] font-bold text-white bg-[#B71C1C] px-2 py-0.5 rounded">
                  <span>CRACK HAZARD</span>
                  <span>96.2%</span>
                </div>
                <div className="text-[10px] font-mono text-white font-bold text-right bg-black/75 px-1.5 py-0.5 rounded">
                  APERTURE: 14mm
                </div>
              </div>
            )}

            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-white/95 border border-[#E6DFD5] text-[#1F2421] text-xs font-semibold shadow-xs">
              ● Live 1080p Stream
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs">
              <div className="px-3.5 py-2 bg-white/95 rounded-xl border border-[#E6DFD5] text-[#1F2421] font-medium shadow-xs">
                Heading: <span className="font-bold text-[#C85A32]">{hexapod.heading}°</span>
              </div>
              <div className="px-3.5 py-2 bg-white/95 rounded-xl border border-[#E6DFD5] font-bold text-[#2E7D32] shadow-xs">
                Methane: {Math.round(hexapod.gasPpm)} PPM
              </div>
            </div>
          </div>

          {/* D-Pad Steering Controls */}
          <div className="p-4 px-6 bg-[#FAF8F3] border-t border-[#E6DFD5] flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-[#6B685F] font-semibold">
              Manual Actuation:
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => sendRobotCommand('left')}
                className="w-10 h-10 rounded-xl bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-sm"
              >
                ◀
              </button>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => sendRobotCommand('forward')}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-sm"
                >
                  ▲
                </button>
                <button
                  onClick={() => sendRobotCommand('backward')}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-sm"
                >
                  ▼
                </button>
              </div>
              <button
                onClick={() => sendRobotCommand('right')}
                className="w-10 h-10 rounded-xl bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-sm"
              >
                ▶
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => sendRobotCommand('scan')}
                className="px-4 py-2 bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] rounded-xl font-bold hover:bg-[#C85A32] hover:text-white transition-all cursor-pointer"
              >
                360° Scan
              </button>
              <button
                onClick={() => sendRobotCommand('stop')}
                className="px-4 py-2 bg-[#B71C1C]/10 border border-[#B71C1C]/30 text-[#B71C1C] rounded-xl font-bold hover:bg-[#B71C1C] hover:text-white transition-all cursor-pointer"
              >
                Hold Position
              </button>
            </div>
          </div>
        </div>

        {/* Right: LiDAR Map */}
        <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-xs">
          <div className="p-4 px-6 border-b border-[#E6DFD5] flex items-center justify-between bg-[#FAF8F3]">
            <div>
              <span className="font-bold text-sm text-[#1F2421]">
                LiDAR SLAM Occupancy Grid
              </span>
              <span className="block text-xs text-[#6B685F] mt-0.5">
                Continuous Sub-Surface Mapping
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
                className="w-7 h-7 rounded bg-white border border-[#E6DFD5] text-[#1F2421] flex items-center justify-center cursor-pointer font-bold"
              >
                -
              </button>
              <span className="text-[#1F2421] font-mono text-xs min-w-[36px] text-center font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2.8, z + 0.2))}
                className="w-7 h-7 rounded bg-white border border-[#E6DFD5] text-[#1F2421] flex items-center justify-center cursor-pointer font-bold"
              >
                +
              </button>
              <button
                onClick={() => setZoom(1.2)}
                className="px-2.5 py-1 rounded bg-white border border-[#E6DFD5] text-[#6B685F] hover:text-[#1F2421] text-xs cursor-pointer font-medium"
              >
                Reset
              </button>
            </div>
          </div>

          <div ref={containerRef} className="relative aspect-video w-full bg-[#FAF7F0] flex items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
          </div>

          <div className="p-4 px-6 bg-[#FAF8F3] border-t border-[#E6DFD5] grid grid-cols-4 gap-3 text-center text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5]">
              <div className="text-xs text-[#6B685F]">Battery</div>
              <div className="font-bold text-[#2E7D32] mt-0.5">{Math.round(hexapod.battery)}%</div>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5]">
              <div className="text-xs text-[#6B685F]">RF Signal</div>
              <div className="font-bold text-[#0284C7] mt-0.5">{hexapod.signalDbm} dBm</div>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5]">
              <div className="text-xs text-[#6B685F]">Speed</div>
              <div className="font-bold text-[#1F2421] mt-0.5">{hexapod.speedMps} m/s</div>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5]">
              <div className="text-xs text-[#6B685F]">Points</div>
              <div className="font-bold text-[#C85A32] mt-0.5">{mapPoints.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
