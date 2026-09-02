import { useState, useEffect } from 'react';
import { Pause, Play, Search, X } from 'lucide-react';

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
const MERCHANTS = ['merchant_001', 'merchant_004', 'merchant_008', 'merchant_016'];
const DEVICES = ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Pixel 8', 'OnePlus 12', 'Unknown Device'];

function randomTxn(): Transaction {
  const isRisky = Math.random() > 0.82;
  const riskScore = isRisky ? 0.6 + Math.random() * 0.35 : Math.random() * 0.3;
  return {
    id: `TX-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    merchant: MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)],
    amount: isRisky
      ? Math.round(Math.random() * 120000 + 35000)
      : Math.round(Math.random() * 6500 + 150),
    method: METHODS[Math.floor(Math.random() * METHODS.length)],
    customer: `CUS-${Math.floor(Math.random() * 999 + 100)}`,
    status: Math.random() > (isRisky ? 0.35 : 0.02) ? 'success' : 'failed',
    risk: riskScore > 0.8 ? 'critical' : riskScore > 0.6 ? 'high' : riskScore > 0.3 ? 'medium' : 'low',
    time: new Date().toLocaleTimeString(),
    riskScore,
    device: DEVICES[Math.floor(Math.random() * DEVICES.length)],
    velocity: isRisky ? +(3 + Math.random() * 7).toFixed(1) : +(0.5 + Math.random() * 1.5).toFixed(1),
  };
}

export default function LiveActivity() {
  const [isPaused, setIsPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    Array.from({ length: 25 }, randomTxn)
  );

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setTransactions(prev => [randomTxn(), ...prev.slice(0, 49)]);
    }, 1400);
    return () => clearInterval(interval);
  }, [isPaused]);

  const filtered = transactions.filter(t => {
    const matchMethod = methodFilter === 'ALL' || t.method === methodFilter;
    const matchSearch = !search || t.id.toLowerCase().includes(search.toLowerCase()) || t.merchant.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchSearch;
  });

  const highCount = transactions.filter(t => t.risk === 'high' || t.risk === 'critical').length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 className="page-title">Live Transactions</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {transactions.length} visible · {highCount} flagged
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: '12px' }}>
        <div className="search-input">
          <Search size={14} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['ALL', 'UPI', 'Card', 'Netbanking', 'Wallet'].map(m => (
            <button
              key={m}
              className={`chip ${methodFilter === m ? 'active' : ''}`}
              onClick={() => setMethodFilter(m)}
            >
              {m === 'ALL' ? 'All' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-flush">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Customer</th>
                <th>Risk</th>
                <th>Status</th>
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
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 500 }}>
                    {txn.id}
                  </td>
                  <td className="tabular" style={{ fontWeight: 500 }}>
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td>{txn.method}</td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{txn.customer}</td>
                  <td>
                    <span className={`badge badge-${txn.risk}`}>{txn.risk}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 500,
                      color: txn.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      <span className={`status-dot ${txn.status === 'success' ? 'status-dot-success' : 'status-dot-danger'}`} />
                      {txn.status === 'success' ? 'Authorized' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div className="section-title">{selected.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Transaction Detail
                </div>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="drawer-body">
              {/* Transaction Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  ['Amount', `₹${selected.amount.toLocaleString('en-IN')}`],
                  ['Status', selected.status],
                  ['Risk Level', selected.risk.toUpperCase()],
                  ['Risk Score', `${(selected.riskScore * 100).toFixed(0)} / 100`],
                  ['Payment Method', selected.method],
                  ['Customer', selected.customer],
                  ['Device', selected.device],
                  ['Merchant', selected.merchant],
                  ['Time', selected.time],
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

              {/* Risk Signals */}
              <div style={{ marginBottom: '20px' }}>
                <div className="section-title" style={{ marginBottom: '8px' }}>Risk Signals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    ['Transaction velocity', `${selected.velocity}× baseline`, selected.velocity > 3],
                    ['Amount deviation', selected.amount > 10000 ? `+${((selected.amount / 1800 - 1) * 100).toFixed(0)}%` : 'Normal', selected.amount > 10000],
                    ['New device', selected.device === 'Unknown Device' ? 'Yes' : 'No', selected.device === 'Unknown Device'],
                    ['Payment method', selected.method, false],
                  ].map(([label, value, flagged]) => (
                    <div
                      key={label as string}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', borderRadius: '4px',
                        background: flagged ? 'var(--color-danger-bg)' : 'var(--color-surface-alt)',
                        border: `1px solid ${flagged ? 'var(--color-danger-border)' : 'var(--color-border-light)'}`,
                        fontSize: '13px',
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

              {/* Recommended Action */}
              <div>
                <div className="section-title" style={{ marginBottom: '6px' }}>Recommended Action</div>
                <span className={`badge badge-${selected.risk === 'critical' || selected.risk === 'high' ? 'high' : 'low'}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  {selected.risk === 'critical' || selected.risk === 'high' ? 'REVIEW' : 'ALLOW'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
