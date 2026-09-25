import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardTab } from '../types';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, zones, evacActive, resetSystem, triggerHazard } = useDashboard();

  const navLinks: { id: DashboardTab; label: string; desc: string; icon: string }[] = [
    { id: 'overview', label: 'Mission Control', desc: 'Live Video, SLAM & Telemetry', icon: '◈' },
    { id: 'crew', label: 'Personnel Roster', desc: '10 Wearables & Helmets', icon: '☥' },
    { id: 'hazard_sim', label: 'Hazard Simulation', desc: 'Test Injections & Alerts', icon: '⚡' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E6DFD5] p-5 fixed left-0 top-[68px] bottom-0 flex flex-col justify-between z-30 overflow-y-auto">
      <div className="flex flex-col gap-6">
        {/* Navigation Index Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <span className="font-['Plus_Jakarta_Sans'] text-xs font-bold tracking-wider text-[#6B685F] uppercase">
            Navigation Index
          </span>
          <span className="flex items-center gap-1.5 font-['Plus_Jakarta_Sans'] text-xs text-[#2E7D32] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#2E7D32]"></span>
            Active
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col gap-1.5">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-150 cursor-pointer border ${
                  isActive
                    ? 'bg-[#C85A32]/10 border-[#C85A32]/30 text-[#C85A32] shadow-xs'
                    : 'bg-transparent border-transparent text-[#6B685F] hover:text-[#1F2421] hover:bg-[#F8F6F0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-tight text-[#1F2421]">
                    {link.label}
                  </span>
                  <span className={`text-sm ${isActive ? 'text-[#C85A32]' : 'text-slate-400'}`}>
                    {link.icon}
                  </span>
                </div>
                <div className="text-xs font-['Plus_Jakarta_Sans'] text-[#6B685F] mt-0.5 font-medium">
                  {link.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mine Sectors Status Card */}
        <div className="p-4 bg-[#F8F6F0] rounded-xl border border-[#E6DFD5] space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E6DFD5] font-['Plus_Jakarta_Sans'] text-[#1F2421]">
            <span className="font-bold">Sector Integrity</span>
            <span className="text-[#6B685F] text-[11px]">4 Sectors</span>
          </div>

          <div className="space-y-2.5">
            {zones.map((zone) => (
              <div key={zone.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-['Plus_Jakarta_Sans']">
                  <span className="text-[#1F2421] font-semibold truncate max-w-[130px]">
                    {zone.name.replace('Zone ', '')}
                  </span>
                  <span className={`font-bold ${
                    zone.stressIndex > 60 ? 'text-[#B71C1C]' : zone.stressIndex > 30 ? 'text-[#B8860B]' : 'text-[#2E7D32]'
                  }`}>
                    {zone.stressIndex}% Stress
                  </span>
                </div>
                <div className="w-full bg-[#E6DFD5] h-1.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${zone.stressIndex}%` }}
                    className={`h-full rounded-full ${
                      zone.stressIndex > 60 ? 'bg-[#B71C1C]' : zone.stressIndex > 30 ? 'bg-[#B8860B]' : 'bg-[#2E7D32]'
                    }`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Actions */}
        <div className="space-y-2">
          <button
            onClick={() => triggerHazard('evacuate')}
            className={`w-full py-2.5 px-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-xs tracking-wide uppercase border transition-all cursor-pointer ${
              evacActive
                ? 'bg-[#B71C1C] text-white border-[#B71C1C] animate-pulse shadow-sm'
                : 'bg-[#B71C1C]/10 text-[#B71C1C] border-[#B71C1C]/25 hover:bg-[#B71C1C] hover:text-white'
            }`}
          >
            {evacActive ? 'Cancel Evacuation' : 'Trigger Evacuation'}
          </button>

          <button
            onClick={resetSystem}
            className="w-full py-2 px-3 rounded-xl font-['Plus_Jakarta_Sans'] text-xs font-semibold text-[#6B685F] hover:text-[#1F2421] bg-[#F8F6F0] hover:bg-[#EAE4D9] border border-[#E6DFD5] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>↺</span>
            <span>Restore Nominal Baseline</span>
          </button>
        </div>
      </div>

      {/* Atmospheric Baseline Footer */}
      <div className="mt-4 pt-3 border-t border-[#E6DFD5] flex items-center justify-between text-xs font-['Plus_Jakarta_Sans'] text-[#6B685F]">
        <span>Shaft Ventilation</span>
        <span className="text-[#2E7D32] font-bold">Nominal · 88%</span>
      </div>
    </aside>
  );
};
