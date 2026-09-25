import { useState, useEffect } from 'react';

const initialAlerts = [
  { id: 1, time: new Date(Date.now() - 1000 * 60 * 5).toISOString(), severity: 'warning', source: 'gas', msg: 'Elevated CO levels detected in Sector B' },
  { id: 2, time: new Date(Date.now() - 1000 * 60 * 12).toISOString(), severity: 'critical', source: 'vitals', msg: 'SpO2 below 90% for W03 (T. Johnson)' },
  { id: 3, time: new Date(Date.now() - 1000 * 60 * 45).toISOString(), severity: 'warning', source: 'helmet', msg: 'Helmet removed: W01 (J. Miller)' },
];

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState(initialAlerts);

  // Auto-add an alert for demo
  useEffect(() => {
    const timer = setTimeout(() => {
      setAlerts(prev => [{
        id: Date.now(),
        time: new Date().toISOString(),
        severity: 'critical',
        source: 'gas',
        msg: 'Methane breakthrough at Hexapod location'
      }, ...prev]);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="glass-panel" style={{ minHeight: '300px' }}>
      <div className="panel-header">
        <span>SYSTEM ALERTS</span>
        <div style={{ display: 'flex', gap: '8px' }}>
           <span className="status-pill warning">{alerts.filter(a => a.severity === 'warning').length} WARN</span>
           <span className="status-pill critical">{alerts.filter(a => a.severity === 'critical').length} CRIT</span>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              display: 'flex',
              gap: '12px',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              borderLeft: `3px solid var(--${alert.severity === 'critical' ? 'error' : 'primary'})`,
              borderRadius: '0 8px 8px 0'
            }}>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '11px', 
                color: 'var(--text-muted)',
                minWidth: '65px' 
              }}>
                {new Date(alert.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 600, 
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  marginBottom: '4px'
                }}>
                  {alert.msg}
                </div>
                <div style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '10px', 
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  SOURCE: {alert.source}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
