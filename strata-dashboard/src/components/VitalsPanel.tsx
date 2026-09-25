import { useState, useEffect } from 'react';
import { Heart, Thermometer, Wind } from 'lucide-react';

const workers = [
  { id: 'W01', name: 'J. Miller', zone: 'LEVEL 4, SEC B' },
  { id: 'W02', name: 'S. Patel', zone: 'LEVEL 4, SEC B' },
  { id: 'W03', name: 'T. Johnson', zone: 'LEVEL 3, SEC A' },
];

export default function VitalsPanel() {
  const [data, setData] = useState(workers.map(w => ({
    ...w,
    bpm: 75 + Math.floor(Math.random() * 15),
    spo2: 97 + Math.floor(Math.random() * 3),
    temp: 36.8 + Math.random() * 0.5,
    helmet: true
  })));

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => prev.map(w => ({
        ...w,
        bpm: Math.max(60, Math.min(140, w.bpm + Math.floor(Math.random() * 5 - 2))),
        spo2: Math.max(88, Math.min(100, w.spo2 + (Math.random() > 0.8 ? -1 : 0.5))),
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel" style={{ minHeight: '300px' }}>
      <div className="panel-header">
        <span>ACTIVE WORKER VITALS</span>
        <span className="text-mono text-muted" style={{ fontSize: '12px' }}>{workers.length} DEPLOYED</span>
      </div>
      
      <div className="vitals-scroll">
        {data.map(worker => {
          const isCriticalSpO2 = worker.spo2 < 90;
          const isWarningBpm = worker.bpm > 110 || worker.bpm < 60;
          
          return (
            <div key={worker.id} style={{ 
              minWidth: '280px', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid var(--border)`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '18px' }}>{worker.name}</div>
                  <div className="text-mono text-muted" style={{ fontSize: '10px' }}>{worker.id} | {worker.zone}</div>
                </div>
                <div title="Helmet Status" style={{ 
                  background: worker.helmet ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                  padding: '4px',
                  borderRadius: '4px',
                  height: 'fit-content'
                }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: worker.helmet ? 'var(--success)' : 'var(--error)' }}></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* BPM */}
                <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    <Heart size={14} className={isWarningBpm ? 'text-primary' : ''} />
                    <span className="text-mono" style={{ fontSize: '10px' }}>HEART RATE</span>
                  </div>
                  <div className={`telemetry-metric ${isWarningBpm ? 'text-primary' : ''}`}>
                    {worker.bpm} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>BPM</span>
                  </div>
                </div>

                {/* SpO2 */}
                <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    <Wind size={14} className={isCriticalSpO2 ? 'text-error' : ''} />
                    <span className="text-mono" style={{ fontSize: '10px' }}>O2 SAT</span>
                  </div>
                  <div className={`telemetry-metric ${isCriticalSpO2 ? 'text-error' : ''}`}>
                    {Math.round(worker.spo2)}%
                  </div>
                </div>
                
                {/* Temp */}
                <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    <Thermometer size={14} />
                    <span className="text-mono" style={{ fontSize: '10px' }}>CORE TEMP</span>
                  </div>
                  <div className="telemetry-metric">
                    {worker.temp.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>°C</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
