import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

export const CrewPage: React.FC = () => {
  const { workers, triggerHazard } = useDashboard();
  const [search, setSearch] = useState<string>('');
  const [filterZone, setFilterZone] = useState<string>('all');

  const filtered = workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
                        w.id.toLowerCase().includes(search.toLowerCase()) ||
                        w.role.toLowerCase().includes(search.toLowerCase());
    const matchZone = filterZone === 'all' || w.zone.includes(filterZone);
    return matchSearch && matchZone;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-['Plus_Jakarta_Sans']">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-white rounded-2xl border border-[#E6DFD5] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]"></span>
            <h1 className="font-bold text-sm text-[#1F2421]">
              Personnel Roster &amp; Underground Telemetry
            </h1>
          </div>
          <p className="text-xs text-[#6B685F] mt-0.5 font-medium">
            Smart Helmet Proximity Sensors &amp; Biometric Link (10 Active Miners)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerHazard('helmet_off')}
            className="px-3.5 py-1.5 bg-[#B8860B]/10 border border-[#B8860B]/30 text-[#B8860B] rounded-lg text-xs font-semibold hover:bg-[#B8860B] hover:text-white transition-all cursor-pointer"
          >
            Simulate Helmet Removal
          </button>
          <button
            onClick={() => triggerHazard('cardiac')}
            className="px-3.5 py-1.5 bg-[#B71C1C]/10 border border-[#B71C1C]/30 text-[#B71C1C] rounded-lg text-xs font-semibold hover:bg-[#B71C1C] hover:text-white transition-all cursor-pointer"
          >
            Simulate Cardiac Spike
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 px-6 bg-white rounded-2xl border border-[#E6DFD5] shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by worker name, badge ID, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF8F3] border border-[#E6DFD5] rounded-xl px-4 py-2.5 text-xs text-[#1F2421] placeholder-slate-400 focus:outline-none focus:border-[#C85A32]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="bg-[#FAF8F3] border border-[#E6DFD5] rounded-xl px-4 py-2.5 text-[#1F2421] focus:outline-none cursor-pointer font-medium"
          >
            <option value="all">All Mine Sectors</option>
            <option value="Zone A">Zone A (Stope 4)</option>
            <option value="Zone B">Zone B (Decline 2)</option>
            <option value="Zone C">Zone C (Level 6)</option>
            <option value="Zone D">Zone D (Sub-Lvl 8)</option>
          </select>
        </div>
      </div>

      {/* Grid of Workers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((w) => {
          const isCritical = w.status === 'critical' || w.spo2 < 90 || w.bpm > 140;
          const isWarning = w.status === 'warning' || !w.helmetOn || w.bpm > 105;

          return (
            <div
              key={w.id}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all duration-200 shadow-xs ${
                isCritical
                  ? 'bg-[#B71C1C]/5 border-[#B71C1C]/40'
                  : isWarning
                  ? 'bg-[#B8860B]/5 border-[#B8860B]/40'
                  : 'bg-white border-[#E6DFD5] hover:border-[#C85A32]/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between pb-3.5 border-b border-[#E6DFD5]">
                  <div>
                    <div className="font-bold text-base text-[#1F2421]">
                      {w.name}
                    </div>
                    <div className="text-xs text-[#6B685F] mt-0.5 font-medium">
                      {w.role} · <span className="text-[#C85A32] font-semibold">{w.zone}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    w.helmetOn
                      ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/25'
                      : 'bg-[#B71C1C] text-white animate-pulse'
                  }`}>
                    {w.helmetOn ? 'Helmet Secured' : 'Helmet Detached!'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 my-5 text-center">
                  <div className="p-3 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5]">
                    <span className="text-[11px] text-[#6B685F] block font-medium">Heart Rate</span>
                    <span className={`font-bold text-lg mt-0.5 block ${w.bpm > 115 ? 'text-[#B71C1C]' : 'text-[#1F2421]'}`}>
                      {w.bpm} <span className="text-xs font-normal text-[#6B685F]">BPM</span>
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5]">
                    <span className="text-[11px] text-[#6B685F] block font-medium">SpO₂ O₂</span>
                    <span className={`font-bold text-lg mt-0.5 block ${w.spo2 < 90 ? 'text-[#B71C1C]' : 'text-[#2E7D32]'}`}>
                      {w.spo2}%
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAF8F3] rounded-xl border border-[#E6DFD5]">
                    <span className="text-[11px] text-[#6B685F] block font-medium">Core Temp</span>
                    <span className="font-bold text-lg mt-0.5 block text-[#1F2421]">
                      {w.temp}°C
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-[#E6DFD5] flex items-center justify-between text-xs">
                <span className="text-[#6B685F] truncate max-w-[190px] font-medium">
                  Evac: <span className="text-[#1F2421] font-semibold">{w.assignedEvacRoute}</span>
                </span>

                <button
                  onClick={() => alert(`Direct beacon ping sent to ${w.name}`)}
                  className="px-3 py-1 rounded-lg bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/25 hover:bg-[#C85A32] hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Ping Helmet
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
