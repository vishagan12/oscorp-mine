import React from 'react';
import { useDashboard } from '../context/DashboardContext';

export const BottomTelemetryStrip: React.FC = () => {
  const { workers, safetyScore, evacActive, triggerHazard, resetSystem } = useDashboard();

  const nominalCount = workers.filter(w => w.status === 'nominal').length;
  const helmetOffCount = workers.filter(w => !w.helmetOn).length;

  return (
    <footer className="h-[58px] bg-white border-t border-[#E6DFD5] px-6 flex items-center justify-between shadow-xs z-40 text-xs font-['Plus_Jakarta_Sans']">
      {/* Left: Quick System Readouts */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-[#6B685F] font-medium">DGMS Safety Score:</span>
          <span className={`font-bold font-mono text-sm ${
            safetyScore >= 85 ? 'text-[#2E7D32]' : safetyScore >= 60 ? 'text-[#B8860B]' : 'text-[#B71C1C]'
          }`}>
            {safetyScore} / 100
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[#1F2421] font-medium">
          <span className="text-[#6B685F]">Underground Crew:</span>
          <span className="font-bold">{workers.length} Active</span>
          <span className="text-[#6B685F]">({nominalCount} Nominal, {helmetOffCount} Helmet Detached)</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[#1F2421] font-medium">
          <span className="text-[#6B685F]">Shaft Pressure:</span>
          <span className="font-bold">104.2 kPa</span>
          <span className="text-[#2E7D32] font-semibold">· Fan 88%</span>
        </div>
      </div>

      {/* Right: Quick Tactical Triggers */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => triggerHazard('methane')}
          className="px-3 py-1.5 rounded-lg bg-[#FAF8F3] border border-[#E6DFD5] text-[#1F2421] hover:text-[#B71C1C] hover:border-[#B71C1C]/40 text-xs font-medium transition-all cursor-pointer"
        >
          Test Gas Breach
        </button>

        <button
          onClick={() => triggerHazard('evacuate')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border ${
            evacActive
              ? 'bg-[#B71C1C] text-white border-[#B71C1C] animate-pulse'
              : 'bg-[#B71C1C]/10 text-[#B71C1C] border-[#B71C1C]/30 hover:bg-[#B71C1C] hover:text-white'
          }`}
        >
          {evacActive ? 'Cancel Evac' : 'Trigger Evac'}
        </button>

        <button
          onClick={resetSystem}
          className="px-3.5 py-1.5 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] hover:bg-[#C85A32] hover:text-white text-xs font-bold transition-all cursor-pointer"
        >
          ↺ Reset System
        </button>
      </div>
    </footer>
  );
};
