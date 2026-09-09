import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, RefreshCw, Search, Zap, ArrowUpRight,
  TrendingUp, Radio, Activity, Server, Clock
} from 'lucide-react';
import { api, type Alert } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type StreamTransaction, type StreamAlert } from '../services/useWebSocket';
import FraudSimulator from '../components/FraudSimulator';

const generateTimelineData = (baseRate: number, multiplier = 1) => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    let rate: number;
    if (i < 20) {
      rate = baseRate + Math.random() * 20 - 10;
    } else {
      rate = baseRate * (multiplier > 1 ? multiplier : 3.5 + Math.random() * 5.2);
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
  const [showSimulator, setShowSimulator] = useState(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);

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

  // Real-time WebSocket Event Handlers
  const handleIncomingAlert = useCallback((newAlert: StreamAlert) => {
    const formatted: Alert = {
      id: newAlert.id,
      merchant_id: newAlert.merchant_id || activeMerchant.id,
      alert_type: 'velocity_spike',
      risk_score: newAlert.risk_score,
      anomaly_score: +(newAlert.risk_score * 0.95).toFixed(3),
      spike_ratio: newAlert.spike_ratio,
      current_txn_rate: 850,
      baseline_txn_rate: activeMerchant.baselineRate,
      risk_level: newAlert.risk_level,
      summary: newAlert.summary,
      status: newAlert.status || 'open',
      model_version: 'fraud-xgb-v1.0',
      created_at: newAlert.created_at || new Date().toISOString(),
    };
    setAlerts(prev => [formatted, ...prev]);
    setLiveToast(`🚨 Real-Time Threat Detected: ${newAlert.id} (Score: ${(newAlert.risk_score * 100).toFixed(0)}%)`);
    setTimeout(() => setLiveToast(null), 4000);
  }, [activeMerchant]);

  const handleIncomingTxn = useCallback((txn: StreamTransaction) => {
    setTimelineData(prev => {
      const newPoint = {
        time: txn.time || new Date().toLocaleTimeString().slice(0, 5),
        rate: Math.round((txn.velocity || 1.0) * activeMerchant.baselineRate),
        baseline: activeMerchant.baselineRate,
      };
      return [...prev.slice(1), newPoint];
    });
  }, [activeMerchant]);

  const { isConnected, telemetry } = useWebSocket(handleIncomingTxn, handleIncomingAlert);

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
      {/* Real-time Alert Toast */}
      {liveToast && (
        <div style={{
          position: 'fixed', top: '70px', right: '24px', zIndex: 1000,
          background: '#7f1d1d', color: '#ffffff', padding: '12px 20px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px',
          border: '1px solid #ef4444',
        }} className="animate-fade-in">
          <AlertTriangle size={16} color="#fca5a5" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Real-time Production Telemetry HUD */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={14} color={isConnected ? 'var(--color-success)' : 'var(--color-warning)'} className={isConnected ? 'pulse-dot' : ''} />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>STREAM FEED</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isConnected ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {isConnected ? 'LIVE WEBSOCKET' : 'CONNECTING...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '10px' }}>
          <Activity size={14} color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>THROUGHPUT</div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
              {telemetry.events_per_sec.toLocaleString()} txns/s
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '10px' }}>
          <AlertTriangle size={14} color="var(--color-danger)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>ALERTS / MIN</div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-danger)' }}>
              {telemetry.alerts_per_min}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '10px' }}>
          <Server size={14} color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>KAFKA LAG</div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
              {telemetry.kafka_lag_ms}ms
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '10px' }}>
          <Clock size={14} color="var(--color-success)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>MODEL INFERENCE</div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-success)' }}>
              {telemetry.model_inference_ms}ms (XGBoost)
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Risk Operations Center</h1>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>{activeMerchant.name}</span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            Real-time fraud spike triage, SHAP explainability, and deterministic policy enforcement.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={loadAlerts} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Feed
          </button>
          <button
            className={`btn ${showSimulator ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowSimulator(!showSimulator)}
          >
            <Zap size={14} />
            {showSimulator ? 'Hide Attack Simulator' : 'Interactive Attack Simulator'}
          </button>
        </div>
      </div>

      {/* Embedded Fraud Simulator */}
      {showSimulator && (
        <div style={{ marginBottom: '16px' }}>
          <FraudSimulator onAttackStateChange={(active) => {
            if (active) {
              setTimelineData(generateTimelineData(activeMerchant.baselineRate, 7.4));
            } else {
              setTimelineData(generateTimelineData(activeMerchant.baselineRate, 1));
            }
          }} />
        </div>
      )}

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
              Comparing live Kafka stream against established 30-day baseline model.
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

        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--color-text-dim)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-dim)' }} unit=" /m" />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                name="Current Velocity"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#rateGradient)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="baseline"
                name="Baseline Target"
                stroke="#9ca3af"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                fill="none"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Alerts Table */}
      <div className="card-flush">
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
        }}>
          <div>
            <h2 className="section-title">Active Anomaly & Threat Ledger</h2>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Live alerts awaiting risk investigator triage and autonomous policy execution.
            </div>
          </div>

          <div className="search-input" style={{ width: '220px' }}>
            <Search size={13} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Search active alerts..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Merchant</th>
                <th>Anomaly Pattern</th>
                <th>Risk Score</th>
                <th>Spike Velocity</th>
                <th>Status</th>
                <th>Time (UTC)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    No active threat alerts matching filter.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map(alert => (
                  <tr key={alert.id} className="clickable" onClick={() => navigate('/investigation')}>
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {alert.id}
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>{alert.merchant_id}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>
                        {alert.alert_type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '280px' }} className="truncate">
                        {alert.summary}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${alert.risk_level}`} style={{ fontSize: '11px' }}>
                        {(alert.risk_score * 100).toFixed(0)}% ({alert.risk_level.toUpperCase()})
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 600, color: alert.spike_ratio > 3 ? 'var(--color-danger)' : 'inherit' }}>
                      {alert.spike_ratio}× baseline
                    </td>
                    <td>
                      <span className={`badge ${alert.status === 'open' ? 'badge-danger' : alert.status === 'investigating' ? 'badge-warning' : 'badge-success'}`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/investigation');
                        }}
                      >
                        Investigate <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
