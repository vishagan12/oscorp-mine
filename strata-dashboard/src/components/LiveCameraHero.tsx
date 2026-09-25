import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

export const LiveCameraHero: React.FC = () => {
  const { hexapod, mapPoints, sendRobotCommand, triggerHazard } = useDashboard();

  const [streamUrl, setStreamUrl] = useState<string>('');
  const [thermalMode, setThermalMode] = useState<boolean>(false);
  const [opticalOverlay, setOpticalOverlay] = useState<boolean>(true);
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [inputUrl, setInputUrl] = useState<string>('http://192.168.1.120:81/stream');

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFD5] flex flex-col overflow-hidden shadow-sm h-full font-['Plus_Jakarta_Sans']">
      {/* Header Bar */}
      <div className="p-3.5 px-6 border-b border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F3]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C85A32] animate-pulse"></span>
            <span className="font-bold text-sm text-[#1F2421] tracking-tight">
              Hexapod Live Optical Camera Stream
            </span>
          </div>
          <span className="block text-xs text-[#6B685F] mt-0.5 font-medium">
            ESP32-CAM MJPEG Video Stream // Sub-Level 6 Working Face
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setThermalMode(!thermalMode)}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              thermalMode
                ? 'bg-[#C85A32] text-white border-[#C85A32] shadow-xs'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
          >
            {thermalMode ? 'IR Thermal: On' : 'IR Thermal: Off'}
          </button>

          <button
            onClick={() => setOpticalOverlay(!opticalOverlay)}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              opticalOverlay
                ? 'bg-[#C85A32]/10 border-[#C85A32]/40 text-[#C85A32]'
                : 'bg-white border-[#E6DFD5] text-[#6B685F] hover:bg-[#F3EFE6]'
            }`}
          >
            {opticalOverlay ? 'AI Crack HUD: On' : 'AI Crack HUD: Off'}
          </button>

          <button
            onClick={() => setShowUrlModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-[#C85A32]/30 bg-[#C85A32]/10 text-[#C85A32] hover:bg-[#C85A32] hover:text-white font-semibold transition-all cursor-pointer"
          >
            Config Stream URL
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex-1 min-h-[460px] bg-[#111317] flex items-center justify-center overflow-hidden">
        {streamUrl ? (
          <img
            src={streamUrl}
            alt="Hexapod Video Feed"
            className={`w-full h-full object-cover ${thermalMode ? 'contrast-150 saturate-200 hue-rotate-90' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Background Sub-surface Simulation */}
            <div
              className={`absolute inset-0 transition-all duration-500 ${
                thermalMode
                  ? 'bg-gradient-to-tr from-[#1b004b] via-[#8e24aa] to-[#fb8c00] opacity-90'
                  : 'bg-gradient-to-b from-[#1E232B] via-[#151920] to-[#0D1015]'
              }`}
            ></div>

            {/* Tunnel Perspective Wireframe */}
            <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 640 360" preserveAspectRatio="none">
              <polygon points="50,25 590,25 460,95 180,95" fill="none" stroke="#D4C5B0" strokeWidth="1" strokeDasharray="3 3" />
              <polygon points="50,335 590,335 460,265 180,265" fill="none" stroke="#D4C5B0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="50" y1="25" x2="180" y2="95" stroke="#D4C5B0" strokeWidth="1.2" />
              <line x1="590" y1="25" x2="460" y2="95" stroke="#D4C5B0" strokeWidth="1.2" />
              <line x1="50" y1="335" x2="180" y2="265" stroke="#D4C5B0" strokeWidth="1.2" />
              <line x1="590" y1="335" x2="460" y2="265" stroke="#D4C5B0" strokeWidth="1.2" />
              <rect x="220" y="120" width="200" height="120" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            </svg>

            {/* Fissure Detection Bounding Box */}
            {opticalOverlay && hexapod.fissureDetected && (
              <div className="absolute top-[28%] left-[45%] w-36 h-28 border-2 border-[#B71C1C] bg-[#B71C1C]/20 rounded-xl flex flex-col justify-between p-2.5 animate-pulse shadow-lg">
                <div className="flex justify-between items-center text-[10px] font-bold text-white bg-[#B71C1C] px-2 py-0.5 rounded">
                  <span>CRACK HAZARD</span>
                  <span>96.4%</span>
                </div>
                <div className="text-[10px] font-mono text-white font-bold text-right bg-black/75 px-1.5 py-0.5 rounded">
                  APERTURE: 14mm
                </div>
              </div>
            )}

            {/* Tactical Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-24 h-24 border border-white/30 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-[#C85A32] rounded-full"></div>
                <div className="absolute top-0 w-0.5 h-3.5 bg-white/50"></div>
                <div className="absolute bottom-0 w-0.5 h-3.5 bg-white/50"></div>
                <div className="absolute left-0 h-0.5 w-3.5 bg-white/50"></div>
                <div className="absolute right-0 h-0.5 w-3.5 bg-white/50"></div>
              </div>
            </div>

            {/* Watermark Label */}
            <div className="text-center z-10 pointer-events-none select-none">
              <span className="text-xs font-bold text-white/80 tracking-wider block uppercase">
                OPTICAL STREAM ACTIVE
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                {streamUrl ? 'Connecting to remote hardware...' : 'Simulated Camera Preview Active'}
              </span>
            </div>
          </div>
        )}

        {/* Top Left Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-white/95 border border-[#E6DFD5] text-[#1F2421] text-xs flex items-center gap-1.5 shadow-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#2E7D32] animate-ping"></span>
            <span>LIVE CAM-01</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-white/95 border border-[#E6DFD5] text-[#6B685F] font-mono text-[10px] shadow-xs font-medium">
            1080p · 30 FPS
          </div>
        </div>

        {/* Top Right Status Badges */}
        <div className="absolute top-3 right-3 flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-white/95 border border-[#E6DFD5] text-[#1F2421] flex items-center gap-1.5 shadow-xs font-medium">
            <span className="text-[#2E7D32] font-bold">BAT:</span>
            <span className="font-mono font-bold">{Math.round(hexapod.battery)}%</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/95 border border-[#E6DFD5] text-[#1F2421] flex items-center gap-1.5 shadow-xs font-medium">
            <span className="text-[#0284C7] font-bold">RF:</span>
            <span className="font-mono font-bold">{hexapod.signalDbm} dBm</span>
          </div>
        </div>

        {/* Bottom Bar Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
          <div className="px-3 py-1.5 bg-white/95 rounded-xl border border-[#E6DFD5] text-[#1F2421] shadow-xs font-medium pointer-events-auto">
            Heading: <span className="font-bold text-[#C85A32]">{hexapod.heading}° Azimuth</span>
          </div>
          <div className={`px-3 py-1.5 bg-white/95 rounded-xl border shadow-xs font-bold pointer-events-auto ${
            hexapod.gasPpm > 400 ? 'border-[#B71C1C] text-[#B71C1C]' : 'border-[#2E7D32] text-[#2E7D32]'
          }`}>
            Methane (CH₄): {Math.round(hexapod.gasPpm)} PPM
          </div>
        </div>
      </div>

      {/* Integrated Rover Actuation & Telemetry Bar (Brought from Hexapod Recon) */}
      <div className="p-3.5 px-6 bg-[#FAF8F3] border-t border-[#E6DFD5] flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Manual Steering D-Pad */}
        <div className="flex items-center gap-3">
          <span className="text-[#6B685F] font-bold tracking-tight text-xs">
            Rover Controls:
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => sendRobotCommand('left')}
              className="w-8 h-8 rounded-lg bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-xs"
              title="Steer Left"
            >
              ◀
            </button>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => sendRobotCommand('forward')}
                className="w-8 h-8 rounded-lg bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-xs"
                title="Move Forward"
              >
                ▲
              </button>
              <button
                onClick={() => sendRobotCommand('backward')}
                className="w-8 h-8 rounded-lg bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-xs"
                title="Move Backward"
              >
                ▼
              </button>
            </div>
            <button
              onClick={() => sendRobotCommand('right')}
              className="w-8 h-8 rounded-lg bg-white border border-[#E6DFD5] text-[#1F2421] font-bold hover:bg-[#C85A32] hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs text-xs"
              title="Steer Right"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Action Commands */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => sendRobotCommand('scan')}
            className="px-3 py-1.5 bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] hover:bg-[#C85A32] hover:text-white rounded-lg font-bold transition-all cursor-pointer"
          >
            360° Scan
          </button>
          <button
            onClick={() => sendRobotCommand('stop')}
            className="px-3 py-1.5 bg-white border border-[#E6DFD5] text-[#1F2421] hover:bg-[#F3EFE6] rounded-lg font-semibold transition-all cursor-pointer"
          >
            Hold Position
          </button>
          <button
            onClick={() => triggerHazard('fissure')}
            className="px-3 py-1.5 bg-white border border-[#E6DFD5] text-[#6B685F] hover:text-[#B71C1C] hover:border-[#B71C1C]/40 rounded-lg font-semibold transition-all cursor-pointer"
          >
            {hexapod.fissureDetected ? '✓ Crack Flagged' : 'Test Crack Trigger'}
          </button>
        </div>

        {/* Telemetry Micro-Pill */}
        <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-[#6B685F]">
          <span>Speed: <strong className="text-[#1F2421] font-sans">{hexapod.speedMps}m/s</strong></span>
          <span>·</span>
          <span>SLAM: <strong className="text-[#059669]">{mapPoints.length}pts</strong></span>
        </div>
      </div>

      {/* Stream URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6DFD5] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
              <span className="font-bold text-base text-[#1F2421]">Configure Camera Endpoint</span>
              <button
                onClick={() => setShowUrlModal(false)}
                className="text-[#6B685F] hover:text-[#1F2421] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6B685F]">
              Enter the IP address of your ESP32-CAM or local MJPEG stream proxy:
            </p>

            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://192.168.1.120:81/stream"
              className="w-full bg-[#FAF8F3] border border-[#E6DFD5] rounded-xl p-3 text-xs font-mono text-[#1F2421] focus:outline-none focus:border-[#C85A32]"
            />

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => {
                  setStreamUrl('');
                  setShowUrlModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#F3EFE6] text-[#6B685F] hover:text-[#1F2421] font-medium"
              >
                Use Simulated Feed
              </button>
              <button
                onClick={() => {
                  setStreamUrl(inputUrl);
                  setShowUrlModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#C85A32] text-white font-semibold"
              >
                Connect Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
