import { useState, useEffect } from 'react';
import { Activity, ArrowUp } from 'lucide-react';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  method: string;
  status: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  time: string;
}

const METHODS = ['UPI', 'Card', 'Netbanking', 'Wallet'];
const MERCHANTS = ['merchant_001', 'merchant_004', 'merchant_008', 'merchant_016'];

function randomTxn(): Transaction {
  const isRisky = Math.random() > 0.85;
  return {
    id: `tx_${Math.random().toString(36).slice(2, 10)}`,
    merchant: MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)],
    amount: isRisky
      ? Math.round(Math.random() * 150000 + 50000)
      : Math.round(Math.random() * 8000 + 200),
    method: METHODS[Math.floor(Math.random() * METHODS.length)],
    status: Math.random() > (isRisky ? 0.3 : 0.02) ? 'success' : 'failed',
    risk: isRisky ? (Math.random() > 0.5 ? 'high' : 'critical') : (Math.random() > 0.7 ? 'medium' : 'low'),
    time: new Date().toLocaleTimeString(),
  };
}

export default function LiveActivity() {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    Array.from({ length: 20 }, randomTxn)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTransactions(prev => [randomTxn(), ...prev.slice(0, 49)]);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={24} color="var(--color-primary)" />
          Live Transaction Stream
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Real-time transaction feed with risk indicators · Simulated data
        </p>
      </div>

      {/* Stream Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div className="badge badge-info" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          <Activity size={14} /> {transactions.length} txns visible
        </div>
        <div className="badge badge-high" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          <ArrowUp size={14} /> {transactions.filter(t => t.risk === 'high' || t.risk === 'critical').length} flagged
        </div>
        <div className="badge badge-low" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          {transactions.filter(t => t.status === 'success').length} success
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr key={txn.id + i} className={i === 0 ? 'animate-slide-in' : ''}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{txn.id}</td>
                <td>{txn.merchant}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  ₹{txn.amount.toLocaleString('en-IN')}
                </td>
                <td>{txn.method}</td>
                <td>
                  <span style={{
                    color: txn.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 600, fontSize: '0.8rem',
                  }}>
                    {txn.status === 'success' ? '✓' : '✗'} {txn.status}
                  </span>
                </td>
                <td><span className={`badge badge-${txn.risk}`}>{txn.risk}</span></td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{txn.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
