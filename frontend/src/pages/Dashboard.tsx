import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, TrendingUp, Shield, Users, Zap } from 'lucide-react';
import { api, type Alert } from '../services/api';

// Demo time-series data for the spike visualization
const generateTimelineData = () => {
  const data = [];
  const baseRate = 120;
  for (let i = 0; i < 30; i++) {
    const minute = i;
    let rate: number;
    let isSpiking = false;
    if (i < 20) {
      rate = baseRate + Math.random() * 20 - 10;
    } else {
      rate = baseRate * (3 + Math.random() * 6);
      isSpiking = true;
    }
    data.push({
      time: `${10 + Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`,
      rate: Math.round(rate),
      baseline: baseRate,
      isSpiking,
    });
  }
  return data;
};

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timelineData] = useState(generateTimelineData);

  useEffect(() => {
    api.getAlerts().then(data => setAlerts(data.alerts || [])).catch(() => {});
  }, []);

  const activeAlerts = alerts.filter(a => a.status === 'open').length;
  const avgRisk = alerts.length > 0
    ? (alerts.reduce((s, a) => s + a.risk_score, 0) / alerts.length * 100).toFixed(0)
    : '0';

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Risk Operations Dashboard</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Real-time fraud spike monitoring · Prototype with synthetic benchmark data
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px', marginBottom: '24px',
      }}>
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Active Alerts"
          value={String(activeAlerts)}
          color="var(--color-danger)"
          bgColor="rgba(239, 68, 68, 0.1)"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Avg Risk Score"
          value={`${avgRisk}%`}
          color="var(--color-warning)"
          bgColor="rgba(245, 158, 11, 0.1)"
        />
        <StatCard
          icon={<Shield size={20} />}
          label="Investigations"
          value={String(alerts.filter(a => a.status === 'investigating').length)}
          color="var(--color-primary)"
          bgColor="rgba(59, 130, 246, 0.1)"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Merchants Monitored"
          value="20"
          color="var(--color-success)"
          bgColor="rgba(16, 185, 129, 0.1)"
        />
      </div>

      {/* Spike Timeline */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px',
        }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Transaction Volume Timeline</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              Merchant baseline vs. current activity
            </p>
          </div>
          {timelineData.some(d => d.isSpiking) && (
            <div className="spike-indicator">
              <Zap size={24} color="#ef4444" />
              <div>
                <div className="multiplier">
                  {(timelineData.filter(d => d.isSpiking).reduce((s, d) => s + d.rate, 0) /
                    Math.max(timelineData.filter(d => d.isSpiking).length, 1) / 120).toFixed(1)}x
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  ABOVE BASELINE
                </div>
              </div>
              <div className="badge badge-critical">🚨 FRAUD SPIKE DETECTED</div>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={timelineData}>
            <defs>
              <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="spikeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: '#1a2332', border: '1px solid #1e293b',
                borderRadius: '8px', fontSize: '12px',
              }}
            />
            <Area
              type="monotone" dataKey="baseline" stroke="#64748b"
              strokeDasharray="5 5" fill="none" strokeWidth={1}
            />
            <Area
              type="monotone" dataKey="rate" stroke="#3b82f6"
              fill="url(#rateGradient)" strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Recent Alerts
        </h2>
        {alerts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)',
          }}>
            <Shield size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No alerts yet. Use the Investigation page to simulate a fraud spike.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Merchant</th>
                <th>Risk</th>
                <th>Spike</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 10).map(alert => (
                <tr key={alert.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {alert.id}
                  </td>
                  <td>{alert.merchant_id}</td>
                  <td>
                    <span className={`badge badge-${alert.risk_level}`}>
                      {(alert.risk_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                    {alert.spike_ratio.toFixed(1)}x
                  </td>
                  <td>
                    <span className={`badge badge-${alert.status === 'open' ? 'high' : 'info'}`}>
                      {alert.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }: {
  icon: React.ReactNode; label: string; value: string;
  color: string; bgColor: string;
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px',
        background: bgColor, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color,
      }}>
        {icon}
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
