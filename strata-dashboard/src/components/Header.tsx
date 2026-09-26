import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardTab } from '../types';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, safetyScore, evacActive, sirenMuted, toggleSiren, alerts, simulationRunning, toggleSimulation } = useDashboard();
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toISOString().slice(11, 19);
      setUtcTime(`${dateStr} · ${timeStr} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: 'Mission Control' },
    { id: 'crew', label: 'Personnel Roster' },
    { id: 'hazard_sim', label: 'Hazard Simulation' },
  ];

  const unackAlerts = alerts.filter(a => !a.acknowledged && (a.severity === 'critical' || a.severity === 'warning')).length;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[68px] bg-white border-b border-[#E6DFD5] px-6 flex items-center justify-between shadow-xs">
      {/* Brand Logo & Sector Tag */}
      <div 
        className="flex items-center gap-3.5 cursor-pointer select-none"
        onClick={() => setActiveTab('overview')}
      >
        <div className="w-10 h-10 rounded-xl bg-[#C85A32] flex items-center justify-center shadow-xs">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-lg tracking-tight text-[#1F2421]">
              OSCORP
            </span>
            <span className="text-[11px] font-['Plus_Jakarta_Sans'] font-bold text-[#C85A32] px-2 py-0.5 rounded-full border border-[#C85A32]/25 bg-[#C85A32]/10 leading-none">
              Mission Control
            </span>
          </div>
          <span className="text-xs font-['Plus_Jakarta_Sans'] text-[#6B685F] font-medium">
            Sub-Level Mine Safety &amp; Telemetry
          </span>
        </div>
      </div>

      {/* Center Navigation: Professional Modern Tabs */}
      <nav className="hidden lg:flex items-center gap-1.5 bg-[#F8F6F0] p-1.5 rounded-xl border border-[#E6DFD5]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#C85A32] shadow-xs border border-[#E6DFD5]'
                  : 'text-[#6B685F] hover:text-[#1F2421] hover:bg-white/50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Live Clock, Status, Siren, Bell */}
      <div className="flex items-center gap-3">
        {/* Monospace Live Clock */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-[#F8F6F0] rounded-xl border border-[#E6DFD5] text-xs font-['Plus_Jakarta_Sans'] text-[#6B685F] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#2E7D32]"></span>
          <span className="text-[#1F2421] font-mono">{utcTime}</span>
        </div>

        {/* System Status Pill */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-['Plus_Jakarta_Sans'] text-xs font-bold tracking-wide ${
          evacActive || safetyScore < 70
            ? 'bg-[#B71C1C]/10 border-[#B71C1C]/40 text-[#B71C1C] animate-pulse'
            : 'bg-[#2E7D32]/10 border-[#2E7D32]/35 text-[#2E7D32]'
        }`}>
          <span className={`w-2 h-2 rounded-full ${evacActive ? 'bg-[#B71C1C] animate-ping' : 'bg-[#2E7D32]'}`}></span>
          <span>{evacActive ? 'EVACUATION ACTIVE' : `SYSTEM NOMINAL · ${safetyScore}%`}</span>
        </div>

        {/* Sensor Mode Toggle */}
        <button
          onClick={toggleSimulation}
          title={simulationRunning ? 'Switch to Live Sensor Mode' : 'Switch to Simulated Mode'}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-['Plus_Jakarta_Sans'] text-xs font-bold tracking-wide transition-all cursor-pointer ${
            simulationRunning 
              ? 'bg-[#F8F6F0] border-[#E6DFD5] text-[#6B685F] hover:text-[#1F2421] hover:bg-white' 
              : 'bg-[#C85A32]/10 border-[#C85A32]/35 text-[#C85A32]'
          }`}
        >
          {simulationRunning ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>SIMULATION</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/>
              </svg>
              <span>LIVE SENSORS</span>
            </>
          )}
        </button>

        {/* Siren Alert Toggle */}
        <button
          onClick={toggleSiren}
          title={sirenMuted ? 'Unmute Audio Siren' : 'Mute Audio Siren'}
          className="p-2 rounded-xl border border-[#E6DFD5] bg-[#F8F6F0] text-[#6B685F] hover:text-[#C85A32] hover:bg-white transition-all cursor-pointer"
        >
          {sirenMuted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          )}
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setActiveTab('hazard_sim')}
          className="relative p-2 rounded-xl border border-[#E6DFD5] bg-[#F8F6F0] text-[#6B685F] hover:text-[#1F2421] hover:bg-white transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unackAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B71C1C] text-white font-['Plus_Jakarta_Sans'] text-[9px] font-bold rounded-full flex items-center justify-center">
              {unackAlerts}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
