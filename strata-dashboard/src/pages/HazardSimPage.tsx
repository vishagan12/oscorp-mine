import React from 'react';
import { useDashboard } from '../context/DashboardContext';

export const HazardSimPage: React.FC = () => {
  const { simulationRunning, toggleSimulation, triggerHazard, resetSystem, evacActive, alerts, hexapod, safetyScore, workers } = useDashboard();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-['Plus_Jakarta_Sans']">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-white rounded-2xl border border-[#E6DFD5] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C85A32] animate-pulse"></span>
            <h1 className="font-bold text-sm text-[#1F2421]">
              Hazard Simulation &amp; System Demonstration Console
            </h1>
          </div>
          <p className="text-xs text-[#6B685F] mt-0.5 font-medium">
            Inject Gas Threshold Anomalies, Fissure Flags &amp; Test Evacuation Protocols
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleSimulation}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              simulationRunning
                ? 'bg-white border-[#E6DFD5] text-[#1F2421] hover:bg-[#F3EFE6]'
                : 'bg-[#2E7D32] text-white border-[#2E7D32] font-bold'
            }`}
          >
            {simulationRunning ? 'Pause Engine' : 'Resume Engine'}
          </button>

          <button
            onClick={resetSystem}
            className="px-4 py-1.5 bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] rounded-lg text-xs font-bold hover:bg-[#C85A32] hover:text-white transition-all cursor-pointer"
          >
            ↺ Restore Nominal Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tactical Injections */}
        <div className="lg:col-span-7 space-y-6">
          {/* Demo Presets */}
          <div className="bg-white rounded-2xl border border-[#E6DFD5] p-6 shadow-xs space-y-4">
            <span className="font-bold text-sm text-[#1F2421] block pb-3 border-b border-[#E6DFD5]">
              Demonstration Scenarios (One-Click Flow)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <button
                onClick={resetSystem}
                className="p-4 rounded-xl border border-[#E6DFD5] bg-[#FAF8F3] hover:border-[#2E7D32] text-left transition-all cursor-pointer shadow-xs"
              >
                <div className="text-[10px] text-[#2E7D32] font-bold uppercase tracking-wider">SCENARIO 1</div>
                <div className="text-[#1F2421] font-bold mt-1 text-sm">All Clear Nominal</div>
                <div className="text-[11px] text-[#6B685F] mt-1 font-medium">96/100 DGMS Base</div>
              </button>

              <button
                onClick={() => triggerHazard('methane')}
                className="p-4 rounded-xl border border-[#E6DFD5] bg-[#FAF8F3] hover:border-[#B71C1C] text-left transition-all cursor-pointer shadow-xs"
              >
                <div className="text-[10px] text-[#B71C1C] font-bold uppercase tracking-wider">SCENARIO 2</div>
                <div className="text-[#1F2421] font-bold mt-1 text-sm">Methane Breach</div>
                <div className="text-[11px] text-[#6B685F] mt-1 font-medium">CH₄ &gt; 1.25% VOL Alarm</div>
              </button>

              <button
                onClick={() => { triggerHazard('cardiac'); triggerHazard('helmet_off'); }}
                className="p-4 rounded-xl border border-[#E6DFD5] bg-[#FAF8F3] hover:border-[#B8860B] text-left transition-all cursor-pointer shadow-xs"
              >
                <div className="text-[10px] text-[#B8860B] font-bold uppercase tracking-wider">SCENARIO 3</div>
                <div className="text-[#1F2421] font-bold mt-1 text-sm">Crew Distress</div>
                <div className="text-[11px] text-[#6B685F] mt-1 font-medium">Helmet Off + SpO₂ Drop</div>
              </button>
            </div>
          </div>

          {/* Granular Injections */}
          <div className="bg-white rounded-2xl border border-[#E6DFD5] p-6 shadow-xs space-y-4">
            <span className="font-bold text-sm text-[#1F2421] block pb-3 border-b border-[#E6DFD5]">
              Granular Hazard Injections
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                onClick={() => triggerHazard('high_co')}
                className="p-4 bg-[#FAF8F3] border border-[#E6DFD5] hover:border-[#B8860B] rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F2421] text-xs">Carbon Monoxide Surge</span>
                  <span className="text-[11px] text-[#B8860B] font-mono font-bold">&gt; 50 PPM</span>
                </div>
                <p className="text-xs text-[#6B685F] mt-1 font-medium">
                  Triggers toxic gas warning in Zone C working face.
                </p>
              </button>

              <button
                onClick={() => triggerHazard('low_o2')}
                className="p-4 bg-[#FAF8F3] border border-[#E6DFD5] hover:border-[#0284C7] rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F2421] text-xs">Hypoxia Oxygen Drop</span>
                  <span className="text-[11px] text-[#0284C7] font-mono font-bold">&lt; 19.5%</span>
                </div>
                <p className="text-xs text-[#6B685F] mt-1 font-medium">
                  Simulates ventilation duct failure in Zone B haulway.
                </p>
              </button>

              <button
                onClick={() => triggerHazard('fissure')}
                className="p-4 bg-[#FAF8F3] border border-[#E6DFD5] hover:border-[#C85A32] rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F2421] text-xs">Optical Crack Detection</span>
                  <span className="text-[11px] text-[#C85A32] font-mono font-bold">14mm Aperture</span>
                </div>
                <p className="text-xs text-[#6B685F] mt-1 font-medium">
                  Flags shear fissure in Hanging Wall camera feed.
                </p>
              </button>

              <button
                onClick={() => triggerHazard('seismic')}
                className="p-4 bg-[#FAF8F3] border border-[#E6DFD5] hover:border-[#B71C1C] rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F2421] text-xs">Seismic Tremor</span>
                  <span className="text-[11px] text-[#B71C1C] font-mono font-bold">Mag 6.2</span>
                </div>
                <p className="text-xs text-[#6B685F] mt-1 font-medium">
                  Triggers structural collapse warning & auto-evacuation.
                </p>
              </button>

              <button
                onClick={() => triggerHazard('helmet_off')}
                className="p-4 bg-[#FAF8F3] border border-[#E6DFD5] hover:border-[#B8860B] rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F2421] text-xs">Smart Helmet Removal</span>
                  <span className="text-[11px] text-[#B8860B] font-mono font-bold">IR Sensor Flag</span>
                </div>
                <p className="text-xs text-[#6B685F] mt-1 font-medium">
                  Worker W-01 removes helmet inside active blast stope.
                </p>
              </button>
            </div>

            {/* Evacuation Button */}
            <div className="pt-2">
              <button
                onClick={() => triggerHazard('evacuate')}
                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide uppercase transition-all cursor-pointer ${
                  evacActive
                    ? 'bg-[#B71C1C] text-white shadow-md animate-pulse'
                    : 'bg-[#B71C1C]/10 text-[#B71C1C] border border-[#B71C1C]/30 hover:bg-[#B71C1C] hover:text-white'
                }`}
              >
                {evacActive ? 'Deactivate General Evacuation Strobe' : 'Activate General Mine Evacuation Order'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Ingest Event Telemetry (Executive Visual Dashboard, Zero Raw Code) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E6DFD5] flex flex-col p-6 shadow-xs space-y-4">
          {/* Header with Live Status Beacon */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#E6DFD5]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32] animate-pulse"></span>
                <span className="font-bold text-sm text-[#1F2421]">
                  Live Ingest Event Telemetry
                </span>
              </div>
              <span className="block text-xs text-[#6B685F] mt-0.5 font-medium">
                Real-Time Hardware Gateway Data Stream
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/25 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]"></span>
              <span>100 Packets / Sec</span>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[560px] pr-1">
            {/* Stream 1: Gateway Communication & Mesh Health Card */}
            <div className="p-4 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0284C7]/10 border border-[#0284C7]/20 flex items-center justify-center text-[#0284C7] font-bold text-xs">
                    ▲
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1F2421] block">
                      Subterranean Gateway Bridge
                    </span>
                    <span className="text-[11px] text-[#6B685F]">
                      Direct Mesh Network Link Active
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#2E7D32] bg-white px-2.5 py-1 rounded-lg border border-[#E6DFD5]">
                  8ms Response
                </span>
              </div>

              {/* Progress and status indicators */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[11px] text-[#6B685F] block font-medium">Signal Quality</span>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="w-1.5 h-3.5 rounded-xs bg-[#2E7D32]"></span>
                    <span className="w-1.5 h-3.5 rounded-xs bg-[#2E7D32]"></span>
                    <span className="w-1.5 h-3.5 rounded-xs bg-[#2E7D32]"></span>
                    <span className="w-1.5 h-3.5 rounded-xs bg-[#2E7D32]"></span>
                  </div>
                  <span className="text-[10px] font-bold text-[#2E7D32] mt-1 block">Excellent</span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[11px] text-[#6B685F] block font-medium">Mesh Reliability</span>
                  <span className="text-sm font-bold text-[#1F2421] mt-1 block">99.9%</span>
                  <span className="text-[10px] text-[#2E7D32] font-semibold">0% Loss</span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[11px] text-[#6B685F] block font-medium">Safety Score</span>
                  <span className="text-sm font-bold text-[#2E7D32] mt-1 block">{safetyScore} / 100</span>
                  <span className="text-[10px] text-[#6B685F]">DGMS Standard</span>
                </div>
              </div>
            </div>

            {/* Stream 2: Autonomous Hexapod Rover Telemetry Card */}
            <div className="p-4 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5] space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center text-[#C85A32] font-bold text-xs">
                    ⬡
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1F2421] block">
                      Hexapod Scout Rover
                    </span>
                    <span className="text-[11px] text-[#6B685F]">
                      Autonomous SLAM &amp; Gas Ingest
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/20">
                  {hexapod.status !== 'evacuating' ? 'Actively Scouting' : 'Alert Triggered'}
                </span>
              </div>

              {/* Graphical Visual Metric Cards */}
              <div className="space-y-2.5">
                {/* Gas PPM Visual Gauge Bar */}
                <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B685F] font-medium">Atmospheric Methane (CH₄)</span>
                    <span className={`font-bold ${hexapod.gasPpm > 400 ? 'text-[#B71C1C]' : 'text-[#2E7D32]'}`}>
                      {Math.round(hexapod.gasPpm)} Parts Per Million
                    </span>
                  </div>
                  <div className="w-full bg-[#E6DFD5] h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, (hexapod.gasPpm / 600) * 100)}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        hexapod.gasPpm > 400 ? 'bg-[#B71C1C]' : hexapod.gasPpm > 300 ? 'bg-[#B8860B]' : 'bg-[#2E7D32]'
                      }`}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#6B685F] pt-0.5">
                    <span>Safe (&lt;300 PPM)</span>
                    <span>Caution (300-500)</span>
                    <span>Hazard (&gt;500)</span>
                  </div>
                </div>

                {/* Battery & Position Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#6B685F] font-medium">Rover Power</span>
                      <span className="font-bold text-[#2E7D32]">{Math.round(hexapod.battery)}%</span>
                    </div>
                    <div className="w-full bg-[#E6DFD5] h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${hexapod.battery}%` }}
                        className="h-full bg-[#2E7D32] rounded-full"
                      ></div>
                    </div>
                    <span className="text-[10px] text-[#6B685F] block">Battery Health: Optimal</span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
                    <span className="text-[11px] text-[#6B685F] font-medium block">Spatial Orientation</span>
                    <span className="font-bold text-[#C85A32] block">
                      Heading {hexapod.heading}° Azimuth
                    </span>
                    <span className="text-[10px] text-[#6B685F] block">
                      Location: {hexapod.x.toFixed(1)}m E, {hexapod.y.toFixed(1)}m N
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream 3: Personnel Roster Telemetry Ingest */}
            <div className="p-4 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#2E7D32]/10 border border-[#2E7D32]/20 flex items-center justify-center text-[#2E7D32] font-bold text-xs">
                    ☥
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1F2421] block">
                      Personnel Biometric Telemetry
                    </span>
                    <span className="text-[11px] text-[#6B685F]">
                      Smart Wearable &amp; Helmet Ingest
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/20">
                  {workers.length} Miners Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[10px] text-[#6B685F] block font-medium">Avg Heart Rate</span>
                  <span className="font-bold text-[#1F2421] mt-0.5 block text-sm">74 BPM</span>
                  <span className="text-[10px] text-[#2E7D32]">Nominal</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[10px] text-[#6B685F] block font-medium">Blood Oxygen</span>
                  <span className="font-bold text-[#2E7D32] mt-0.5 block text-sm">98% SpO₂</span>
                  <span className="text-[10px] text-[#2E7D32]">Normal Range</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#E6DFD5]">
                  <span className="text-[10px] text-[#6B685F] block font-medium">Helmet Status</span>
                  <span className="font-bold text-[#2E7D32] mt-0.5 block text-sm">
                    {workers.filter(w => w.helmetOn).length} / {workers.length}
                  </span>
                  <span className="text-[10px] text-[#2E7D32]">Secured</span>
                </div>
              </div>
            </div>

            {/* Stream 4: Real-Time Event Audit Feed */}
            <div className="p-4 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5] space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#E6DFD5]">
                <span className="text-xs font-bold text-[#1F2421] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#B8860B]"></span>
                  Live Event Transmission Log
                </span>
                <span className="text-xs text-[#6B685F] font-semibold">{alerts.length} Events Logged</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                      alert.severity === 'critical'
                        ? 'bg-red-50/70 border-red-200 text-[#1F2421]'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-[#1F2421]'
                        : 'bg-white border-[#E6DFD5] text-[#1F2421]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${
                      alert.severity === 'critical' ? 'bg-[#B71C1C]' : alert.severity === 'warning' ? 'bg-[#B8860B]' : 'bg-[#2E7D32]'
                    }`}></span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center text-[11px] text-[#6B685F] mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-[#1F2421]">
                          {alert.source === 'gas' ? 'Atmospheric Sensor' : alert.source === 'vitals' ? 'Crew Biometrics' : alert.source === 'hexapod' ? 'Hexapod Telemetry' : 'Mission Control'}
                        </span>
                        <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      <p className="leading-snug font-medium text-xs text-[#1F2421]">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
