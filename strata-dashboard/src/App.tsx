import React from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomTelemetryStrip } from './components/BottomTelemetryStrip';
import { OverviewPage } from './pages/OverviewPage';
import { CrewPage } from './pages/CrewPage';
import { HazardSimPage } from './pages/HazardSimPage';

const DashboardContent: React.FC = () => {
  const { activeTab } = useDashboard();

  return (
    <div className="bg-[#F8F6F0] text-[#1F2421] min-h-screen antialiased flex flex-col font-['Plus_Jakarta_Sans'] selection:bg-[#C85A32] selection:text-white">
      {/* Top Fixed Header (68px) */}
      <Header />

      {/* Main Container Layout */}
      <div className="pt-[68px] pb-[58px] flex min-h-screen">
        {/* Left Persistent Sidebar (w-64 = 256px) */}
        <Sidebar />

        {/* Dynamic Main Viewport */}
        <main className="ml-64 flex-1 p-5 lg:p-6 bg-[#F8F6F0] min-h-[calc(100vh-126px)] overflow-x-hidden flex flex-col justify-between">
          {activeTab === 'overview' && <OverviewPage />}
          {activeTab === 'crew' && <CrewPage />}
          {activeTab === 'hazard_sim' && <HazardSimPage />}
        </main>
      </div>

      {/* Bottom Compact Telemetry Ribbon (58px) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 ml-64">
        <BottomTelemetryStrip />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
