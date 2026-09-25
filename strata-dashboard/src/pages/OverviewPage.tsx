import React from 'react';
import { LiveCameraHero } from '../components/LiveCameraHero';
import { RealtimeMapHero } from '../components/RealtimeMapHero';

export const OverviewPage: React.FC = () => {
  return (
    <div className="w-full flex-1 flex flex-col pb-2">
      {/* Primary Dashboard Grid: Video Feed & Real-time Map as ONLY Major Components */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 items-stretch">
        {/* Major Component 1: Video Feed */}
        <div className="flex flex-col min-h-0">
          <LiveCameraHero />
        </div>

        {/* Major Component 2: Created Map in Real-Time */}
        <div className="flex flex-col min-h-0">
          <RealtimeMapHero />
        </div>
      </div>
    </div>
  );
};
