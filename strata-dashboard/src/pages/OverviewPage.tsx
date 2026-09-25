import React from 'react';
import { LiveCameraHero } from '../components/LiveCameraHero';
import { RealtimeMapHero } from '../components/RealtimeMapHero';

export const OverviewPage: React.FC = () => {
  return (
    <div className="h-[calc(100vh-146px)] min-h-[580px] w-full flex flex-col">
      {/* Primary Dashboard Grid: Video Feed & Real-time Map as ONLY Major Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 h-full">
        {/* Major Component 1: Video Feed */}
        <div className="h-full flex flex-col min-h-0">
          <LiveCameraHero />
        </div>

        {/* Major Component 2: Created Map in Real-Time */}
        <div className="h-full flex flex-col min-h-0">
          <RealtimeMapHero />
        </div>
      </div>
    </div>
  );
};
