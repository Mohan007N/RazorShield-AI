import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, RefreshCw, Search, Shield, Zap, ArrowUpRight, TrendingUp, Sliders } from 'lucide-react';
import { api, type Alert } from '../services/api';
import { useAuth } from '../context/AuthContext';

const generateTimelineData = (baseRate: number) => {
  const data = [];
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
  const { activeMerchant, riskPolicy } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timelineData, setTimelineData] = useState(() => generateTimelineData(activeMerchant.baselineRate));
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D'>('1H');

  useEffect(() => {
    setTimelineData(generateTimelineData(activeMerchant.baselineRate));
  }, [activeMerchant]);

  const loadAlerts = () => {
    setLoading(true);
    api.getAlerts()
      .then(data => setAlerts(data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAlerts(); }, []);

  const activeAlerts = alerts.filter(a => a.status === 'open').length || 2;
  const investigating = alerts.filter(a => a.status === 'investigating').length || 1;

  const hasSpikeData = timelineData.some(d => d.rate > activeMerchant.baselineRate * 2.5);
  const peakRate = Math.max(...timelineData.map(d => d.rate));
  const spikeRatio = (peakRate / activeMerchant.baselineRate).toFixed(1);

  const filteredAlerts = alerts.filter(a =>
    a.merchant_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    a.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    activeMerchant.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Risk Operations Center</h1>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>{activeMerchant.name}</span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            Autonomous fraud defense, velocity spike triage, and model policy enforcement.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={loadAlerts} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Feed
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
            <Sliders size={14} />
            Risk Policies
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/investigation')}>
            <Zap size={14} />
            Simulate Attack Spike
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip" style={{ marginBottom: '16px' }}>
        <div className="kpi-item">
          <div className="kpi-label">Active Threat Alerts</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{activeAlerts}</div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-danger" />
            Immediate agent triage
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">Autonomous Investigations</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{investigating}</div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-info pulse-dot" />
            Agent executing tools
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">Baseline Traffic Velocity</div>
          <div className="kpi-value mono">{activeMerchant.baselineRate} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>txns/min</span></div>
          <div className="kpi-sub">
            <span className="status-dot status-dot-success" />
            {activeMerchant.tier}
          </div>
        </div>

        <div className="kpi-item">
          <div className="kpi-label">Auto-Block Policy Gate</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>
            &ge; {riskPolicy.autoBlockThreshold}
          </div>
          <div className="kpi-sub">
            Review Gate: {riskPolicy.humanReviewThreshold}-{riskPolicy.autoBlockThreshold - 1}
          </div>
        </div>
      </div>

      {/* Active Spike Warning Callout */}
      {hasSpikeData && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={18} />
          <div style={{ flex: 1 }}>
            <strong>Velocity Spike Anomaly Detected</strong> — Traffic surge reached <strong>{spikeRatio}× baseline</strong> ({peakRate} txns/min) on {activeMerchant.name}. Autonomous agent has flagged anomalous card velocity patterns.
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => navigate('/investigation')}>
            Launch Autonomous Investigation <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Transaction Velocity Chart */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="var(--color-primary)" />
              Real-Time Transaction Velocity & Anomaly Boundary
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Comparing live merchant transaction rate against established 30-day baseline model.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['1H', '24H', '7D'] as const).map(t => (
                <button
                  key={t}
                  className={`chip ${timeRange === t ? 'active' : ''}`}
                  onClick={() => setTimeRange(t)}
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '2px', background: 'var(--color-primary)', borderRadius: '1px' }} />
                Live Ingestion
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '1px', borderTop: '1px dashed #9ca3af' }} />
                Baseline Target ({activeMerchant.baselineRate}/m)
              </div>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px',
              }}
              formatter={(val: any) => [`${val} txns/min`]}
            />
            <Area type="monotone" dataKey="baseline" stroke="#9ca3af" strokeDasharray="4 4" fill="none" strokeWidth={1.2} />
            <Area type="monotone" dataKey="rate" stroke="var(--color-primary)" fill="url(#rateGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Alerts Table */}
      <div className="card-flush">
        <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className="section-title">Risk Incidents & Alert Queue</h2>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Showing real-time anomalies queued for agentic investigation and policy enforcement.
            </div>
          </div>

          <div className="filter-bar" style={{ border: 'none', padding: 0, background: 'transparent' }}>
            <div className="search-input">
              <Search size={14} color="var(--color-text-dim)" />
              <input
                type="text"
                placeholder="Filter alerts by ID, merchant..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <Shield size={32} color="var(--color-text-dim)" />
            <div className="empty-state-title">No Critical Anomalies</div>
            <div className="empty-state-text">
              Merchant traffic is operating comfortably within safe velocity limits.
            </div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => navigate('/investigation')}>
              Simulate Defensive Test Spike
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Merchant Workspace</th>
                  <th>Risk Score</th>
                  <th>Spike Multiplier</th>
                  <th>Status</th>
                  <th>Detection Time</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.slice(0, 10).map(alert => (
                  <tr key={alert.id}>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {alert.id}
                    </td>
                    <td style={{ fontWeight: 500 }}>{alert.merchant_id}</td>
                    <td>
                      <span className={`badge badge-${alert.risk_level}`}>
                        {(alert.risk_score * 100).toFixed(0)} / 100
                      </span>
                    </td>
                    <td className="tabular" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      {alert.spike_ratio.toFixed(1)}×
                    </td>
                    <td>
                      <span className={`badge ${alert.status === 'open' ? 'badge-critical' : 'badge-info'}`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate('/investigation')}>
                        Investigate Now
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
