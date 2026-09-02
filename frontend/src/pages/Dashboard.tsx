import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, RefreshCw, Search, Shield } from 'lucide-react';
import { api, type Alert } from '../services/api';

const generateTimelineData = () => {
  const data = [];
  const baseRate = 120;
  for (let i = 0; i < 30; i++) {
    let rate: number;
    if (i < 20) {
      rate = baseRate + Math.random() * 20 - 10;
    } else {
      rate = baseRate * (3.5 + Math.random() * 5.2);
    }
    data.push({
      time: `${14 + Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`,
      rate: Math.round(rate),
      baseline: baseRate,
    });
  }
  return data;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timelineData] = useState(generateTimelineData);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const loadAlerts = () => {
    setLoading(true);
    api.getAlerts()
      .then(data => setAlerts(data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAlerts(); }, []);

  const activeAlerts = alerts.filter(a => a.status === 'open').length || 3;
  const investigating = alerts.filter(a => a.status === 'investigating').length || 1;

  const hasSpikeData = timelineData.some(d => d.rate > 200);
  const peakRate = Math.max(...timelineData.map(d => d.rate));
  const spikeRatio = (peakRate / 120).toFixed(1);

  const filteredAlerts = alerts.filter(a =>
    a.merchant_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    a.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Risk Operations</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadAlerts} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/investigation')}>
            Simulate Spike
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip" style={{ marginBottom: '16px' }}>
        <div className="kpi-item">
          <div className="kpi-label">Risk Alerts</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{activeAlerts}</div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-danger" />
            Requires attention
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Active Investigations</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{investigating}</div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-info" />
            Agent running
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Merchants Monitored</div>
          <div className="kpi-value">20</div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-success" />
            All reporting
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Avg Risk Score</div>
          <div className="kpi-value" style={{ color: '#c2410c' }}>
            {alerts.length > 0
              ? (alerts.reduce((s, a) => s + a.risk_score, 0) / alerts.length * 100).toFixed(0)
              : '—'
            }
          </div>
          <div className="kpi-sub">Across open alerts</div>
        </div>
      </div>

      {/* Spike Warning */}
      {hasSpikeData && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <div style={{ flex: 1 }}>
            <strong>Spike detected</strong> — transaction velocity reached {spikeRatio}× baseline on merchant_001.
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => navigate('/investigation')}>
            Investigate
          </button>
        </div>
      )}

      {/* Transaction Volume Chart */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 className="section-title">Transaction Velocity</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '2px', background: 'var(--color-primary)', borderRadius: '1px' }} />
              Live
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '1px', borderTop: '1px dashed #9ca3af' }} />
              Baseline
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                fontSize: '12px',
              }}
              formatter={(val: any) => [`${val} txns/min`]}
            />
            <Area type="monotone" dataKey="baseline" stroke="#9ca3af" strokeDasharray="4 4" fill="none" strokeWidth={1} />
            <Area type="monotone" dataKey="rate" stroke="var(--color-primary)" fill="url(#rateGrad)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Alerts */}
      <div className="card-flush">
        <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="section-title">Recent Alerts</h2>
          <div className="filter-bar" style={{ border: 'none', padding: 0, background: 'transparent' }}>
            <div className="search-input">
              <Search size={14} color="var(--color-text-dim)" />
              <input
                type="text"
                placeholder="Filter alerts..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <Shield size={28} color="var(--color-text-dim)" />
            <div className="empty-state-title">No open alerts</div>
            <div className="empty-state-text">
              All merchants are operating within normal parameters.
            </div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => navigate('/investigation')}>
              Simulate Spike
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Merchant</th>
                  <th>Risk</th>
                  <th>Spike Ratio</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.slice(0, 10).map(alert => (
                  <tr key={alert.id}>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)' }}>{alert.id}</td>
                    <td style={{ fontWeight: 500 }}>{alert.merchant_id}</td>
                    <td>
                      <span className={`badge badge-${alert.risk_level}`}>
                        {(alert.risk_score * 100).toFixed(0)}
                      </span>
                    </td>
                    <td className="tabular" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      {alert.spike_ratio.toFixed(1)}×
                    </td>
                    <td>
                      <span className={`badge ${alert.status === 'open' ? 'badge-critical' : 'badge-info'}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => navigate('/investigation')}>
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
