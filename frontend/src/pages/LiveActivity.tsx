import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Search, X, ArrowUpRight, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  method: string;
  customer: string;
  status: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  time: string;
  riskScore: number;
  device: string;
  velocity: number;
}

const METHODS = ['UPI', 'Card', 'Netbanking', 'Wallet'];
const DEVICES = ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Pixel 8', 'OnePlus 12', 'Unknown Device (Spoofed Canvas)'];

function randomTxn(defaultMerchantId: string): Transaction {
  const isRisky = Math.random() > 0.82;
  const riskScore = isRisky ? 0.65 + Math.random() * 0.32 : Math.random() * 0.28;
  return {
    id: `TX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    merchant: Math.random() > 0.3 ? defaultMerchantId : 'merchant_004',
    amount: isRisky
      ? Math.round(Math.random() * 85000 + 15000)
      : Math.round(Math.random() * 4500 + 120),
    method: METHODS[Math.floor(Math.random() * METHODS.length)],
    customer: `CUS-${Math.floor(Math.random() * 999 + 100)}`,
    status: Math.random() > (isRisky ? 0.4 : 0.02) ? 'success' : 'failed',
    risk: riskScore > 0.85 ? 'critical' : riskScore > 0.6 ? 'high' : riskScore > 0.3 ? 'medium' : 'low',
    time: new Date().toLocaleTimeString(),
    riskScore,
    device: isRisky ? 'Unknown Device (Spoofed Canvas)' : DEVICES[Math.floor(Math.random() * (DEVICES.length - 1))],
    velocity: isRisky ? +(3.5 + Math.random() * 6.5).toFixed(1) : +(0.6 + Math.random() * 1.2).toFixed(1),
  };
}

export default function LiveActivity() {
  const navigate = useNavigate();
  const { activeMerchant } = useAuth();

  const [isPaused, setIsPaused] = useState(false);
  const [streamSpeed, setStreamSpeed] = useState<number>(1400);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    Array.from({ length: 25 }, () => randomTxn(activeMerchant.id))
  );

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setTransactions(prev => [randomTxn(activeMerchant.id), ...prev.slice(0, 49)]);
    }, streamSpeed);
    return () => clearInterval(interval);
  }, [isPaused, streamSpeed, activeMerchant]);

  const injectSuspiciousTxn = () => {
    const injected: Transaction = {
      id: `TX-ANOMALY-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      merchant: activeMerchant.id,
      amount: 94500,
      method: 'UPI',
      customer: 'CUS-SUSPECT-99',
      status: 'failed',
      risk: 'critical',
      time: new Date().toLocaleTimeString(),
      riskScore: 0.94,
      device: 'Unknown Device (Spoofed Canvas)',
      velocity: 8.4,
    };
    setTransactions(prev => [injected, ...prev.slice(0, 49)]);
    setSelected(injected);
  };

  const filtered = transactions.filter(t => {
    const matchMethod = methodFilter === 'ALL' || t.method === methodFilter;
    const matchRisk = riskFilter === 'ALL' || (riskFilter === 'FLAGGED' ? (t.risk === 'high' || t.risk === 'critical') : t.risk === riskFilter.toLowerCase());
    const matchSearch = !search || t.id.toLowerCase().includes(search.toLowerCase()) || t.merchant.toLowerCase().includes(search.toLowerCase()) || t.customer.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchRisk && matchSearch;
  });

  const highCount = transactions.filter(t => t.risk === 'high' || t.risk === 'critical').length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Live Transaction Stream</h1>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>
              <span className="status-dot status-dot-success pulse-dot" style={{ marginRight: '4px' }} />
              Live Ingestion
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            Real-time webhook and API transaction processing with millisecond-level XGBoost inference.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={injectSuspiciousTxn}>
            <PlusCircle size={13} color="var(--color-danger)" />
            Inject Test Anomaly
          </button>

          {/* Speed selector */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
            {[
              { label: '1x', speed: 1400 },
              { label: '2x', speed: 700 },
              { label: '5x', speed: 300 },
            ].map(s => (
              <button
                key={s.label}
                className={`chip ${streamSpeed === s.speed ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                onClick={() => { setStreamSpeed(s.speed); setIsPaused(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: '14px' }}>
        <div className="search-input">
          <Search size={14} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Search by transaction ID, customer, merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Method Chips */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['ALL', 'UPI', 'Card', 'Netbanking', 'Wallet'].map(m => (
            <button
              key={m}
              className={`chip ${methodFilter === m ? 'active' : ''}`}
              onClick={() => setMethodFilter(m)}
            >
              {m === 'ALL' ? 'All Methods' : m}
            </button>
          ))}
        </div>

        {/* Risk Level Chips */}
        <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--color-border)', paddingLeft: '8px' }}>
          {['ALL', 'FLAGGED', 'CRITICAL', 'LOW'].map(r => (
            <button
              key={r}
              className={`chip ${riskFilter === r ? 'active' : ''}`}
              onClick={() => setRiskFilter(r)}
            >
              {r === 'ALL' ? 'All Risk' : r === 'FLAGGED' ? `Flagged (${highCount})` : r}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card-flush">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Customer / VPA</th>
                <th>Risk Assessment</th>
                <th>Gateway Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn, i) => (
                <tr
                  key={txn.id + i}
                  className={`clickable ${i === 0 ? 'animate-slide-in' : ''}`}
                  onClick={() => setSelected(txn)}
                >
                  <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{txn.time}</td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    {txn.id}
                  </td>
                  <td className="tabular" style={{ fontWeight: 600 }}>
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{txn.method}</span>
                  </td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{txn.customer}</td>
                  <td>
                    <span className={`badge badge-${txn.risk}`}>
                      {(txn.riskScore * 100).toFixed(0)} · {txn.risk.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', fontWeight: 600,
                      color: txn.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      <span className={`status-dot ${txn.status === 'success' ? 'status-dot-success' : 'status-dot-danger'}`} />
                      {txn.status === 'success' ? 'Authorized' : 'Failed / Blocked'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer animate-slide-in">
            <div className="drawer-header">
              <div>
                <div className="section-title" style={{ fontFamily: 'var(--font-mono)' }}>{selected.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Live Transaction Explainability & Risk Breakdown
                </div>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Top Score Banner */}
              <div style={{
                padding: '12px', borderRadius: '8px', marginBottom: '16px',
                background: selected.risk === 'critical' || selected.risk === 'high' ? 'var(--color-danger-bg)' : 'var(--color-surface-alt)',
                border: `1px solid ${selected.risk === 'critical' || selected.risk === 'high' ? 'var(--color-danger-border)' : 'var(--color-border-light)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>ML Risk Score</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: selected.risk === 'critical' || selected.risk === 'high' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {(selected.riskScore * 100).toFixed(0)} / 100
                  </div>
                </div>
                <span className={`badge badge-${selected.risk}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                  {selected.risk.toUpperCase()} RISK
                </span>
              </div>

              {/* Transaction Properties */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  ['Amount', `₹${selected.amount.toLocaleString('en-IN')}`],
                  ['Gateway Status', selected.status === 'success' ? 'Authorized' : 'Failed / Blocked'],
                  ['Payment Method', selected.method],
                  ['Customer Identifier', selected.customer],
                  ['Device Fingerprint', selected.device],
                  ['Merchant MID', selected.merchant],
                  ['Time of Ingestion', selected.time],
                  ['Velocity Factor', `${selected.velocity}× Baseline`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explainability Radar Signals */}
              <div style={{ marginBottom: '20px' }}>
                <div className="section-title" style={{ marginBottom: '8px' }}>Feature Signals & SHAP Importance</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    ['Transaction Velocity Surge', `${selected.velocity}× normal baseline`, selected.velocity > 3],
                    ['Amount Deviation from Median', selected.amount > 15000 ? `+${((selected.amount / 2200 - 1) * 100).toFixed(0)}% elevated` : 'Normal range', selected.amount > 15000],
                    ['Device Spoofing / Canvas Anomaly', selected.device.includes('Unknown') ? 'Spoofed Canvas Detected' : 'Known Device Hash', selected.device.includes('Unknown')],
                    ['Payment Routing Reliability', selected.method === 'UPI' ? 'UPI Fast Lane' : 'Standard 3DS', false],
                  ].map(([label, value, flagged]) => (
                    <div
                      key={label as string}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: '4px',
                        background: flagged ? 'var(--color-danger-bg)' : 'var(--color-surface-alt)',
                        border: `1px solid ${flagged ? 'var(--color-danger-border)' : 'var(--color-border-light)'}`,
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ color: 'var(--color-text-secondary)' }}>{label as string}</span>
                      <span style={{ fontWeight: 600, color: flagged ? 'var(--color-danger)' : 'var(--color-text)' }}>
                        {value as string}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Action & Triage button */}
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="section-title" style={{ fontSize: '13px' }}>Autonomous Recommendation</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {selected.riskScore > 0.85 ? 'Block transaction and hold settlement' : selected.riskScore > 0.6 ? 'Route to Human Review Gate' : 'Auto-Allow transaction'}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelected(null);
                      navigate('/investigation');
                    }}
                  >
                    Investigate Spike <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
