import { useEffect, useState } from 'react';
import { Battery, Signal, Flame } from 'lucide-react';

export default function CameraPanel() {
  const [gasPpm, setGasPpm] = useState(240);
  const [battery] = useState(87);

  // Simulate changing telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setGasPpm(prev => prev + (Math.random() * 10 - 5));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const gasStatus = gasPpm < 300 ? 'safe' : gasPpm < 400 ? 'warning' : 'critical';

  return (
    <div className="glass-panel" style={{ minHeight: '400px', position: 'relative', overflow: 'hidden' }}>
      <div className="panel-header">
        <span>HEXAPOD SCOUT CAM</span>
        <div className="status-pill safe">
          <div className="pulse-dot"></div>
          LIVE
        </div>
      </div>
      
      <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
        {/* Placeholder for actual MJPEG stream */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <span className="text-mono">WAITING FOR VIDEO FEED...</span>
        </div>
        
        {/* Simulating a camera view with CSS gradient for now */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #1a202c 0%, #000000 100%)', opacity: 0.5 }}></div>
        
        {/* Overlays */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Battery size={16} color="var(--success)" />
            <span className="text-mono" style={{ fontSize: '14px' }}>{battery}%</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Signal size={16} color="var(--secondary)" />
            <span className="text-mono" style={{ fontSize: '14px' }}>-64dBm</span>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '8px' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid var(--${gasStatus === 'safe' ? 'success' : gasStatus === 'warning' ? 'primary' : 'error'})` }}>
            <Flame size={18} className={`text-${gasStatus === 'safe' ? 'success' : gasStatus === 'warning' ? 'primary' : 'error'}`} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CH4 (METHANE)</span>
              <span className="telemetry-metric" style={{ fontSize: '20px', lineHeight: 1 }}>{Math.round(gasPpm)} PPM</span>
            </div>
          </div>
        </div>
        
        {/* Crosshair Overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
           <div style={{ width: '40px', height: '1px', background: '#fff' }}></div>
           <div style={{ width: '1px', height: '40px', background: '#fff', position: 'absolute' }}></div>
        </div>
      </div>
    </div>
  );
}
