import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Search, X, Radio, Send, ShieldAlert, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type StreamTransaction } from '../services/useWebSocket';
import { API_BASE } from '../services/api';

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
  source?: string;
  event_type?: string;
}

export default function LiveActivity() {
  const navigate = useNavigate();
  const { activeMerchant } = useAuth();

  const [isPaused, setIsPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'pay_live_initial_01',
      merchant: activeMerchant.id,
      amount: 7500.0,
      method: 'UPI',
      customer: 'Rahul S',
      status: 'success',
      risk: 'low',
      riskScore: 0.12,
      device: 'iPhone 15 Pro (Verified)',
      velocity: 1.1,
      time: new Date().toLocaleTimeString(),
      source: 'live_feed',
    },
    {
      id: 'pay_live_initial_02',
      merchant: activeMerchant.id,
      amount: 88500.0,
      method: 'Card',
      customer: 'Priya M',
      status: 'failed',
      risk: 'critical',
      riskScore: 0.94,
      device: 'Unknown Device (Spoofed Canvas)',
      velocity: 7.8,
      time: new Date().toLocaleTimeString(),
      source: 'razorpay_webhook',
    },
  ]);

  // Handle incoming real-time WebSocket transactions
  const handleIncomingTxn = useCallback((txn: StreamTransaction) => {
    if (isPaused) return;

    const formattedTxn: Transaction = {
      id: txn.id,
      merchant: txn.merchant || activeMerchant.id,
      amount: txn.amount,
      method: txn.method || 'UPI',
      customer: txn.customer || 'Customer',
      status: txn.status || 'success',
      risk: txn.risk || 'low',
      riskScore: txn.riskScore || 0.1,
      device: txn.device || 'Verified Mobile Device',
      velocity: txn.velocity || 1.0,
      time: txn.time || new Date().toLocaleTimeString(),
      source: (txn as any).source || 'live_feed',
    };

    setTransactions(prev => [formattedTxn, ...prev.slice(0, 99)]);

    if ((txn as any).source === 'razorpay_webhook') {
      showToast(`⚡ Live Webhook Event Received: ${txn.id} (₹${txn.amount})`);
    }
  }, [isPaused, activeMerchant]);

  const { isConnected, telemetry } = useWebSocket(handleIncomingTxn);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Send a test Razorpay webhook event directly from the UI to test live real-time ingestion
  const sendTestWebhook = async () => {
    setSendingTest(true);
    const testId = `pay_test_${Math.random().toString(36).slice(2, 7)}`;
    const isRisky = Math.random() > 0.5;
    const amountPaise = isRisky ? 9500000 : 150000;

    try {
      const res = await fetch(`${API_BASE}/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': 'dev_test_bypass',
        },
        body: JSON.stringify({
          event: isRisky ? 'payment.failed' : 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: testId,
                amount: amountPaise,
                currency: 'INR',
                status: isRisky ? 'failed' : 'captured',
                method: isRisky ? 'card' : 'upi',
                email: 'customer.live@test.in',
                contact: '+919988776655',
                notes: { merchant_id: activeMerchant.id },
                metadata: {
                  device_id: isRisky ? 'Unknown Device (Spoofed Canvas)' : 'Samsung Galaxy S24',
                  ip_address: '103.21.244.18',
                },
              },
            },
          },
        }),
      });

      if (res.ok) {
        showToast(`✅ Webhook sent & scored: ${testId} (₹${(amountPaise / 100).toLocaleString()})`);
      }
    } catch {
      showToast('❌ Error sending webhook to backend');
    } finally {
      setSendingTest(false);
    }
  };

  const filtered = transactions.filter(t => {
    const matchMethod = methodFilter === 'ALL' || t.method.toLowerCase() === methodFilter.toLowerCase();
    const matchRisk = riskFilter === 'ALL' || (riskFilter === 'FLAGGED' ? (t.risk === 'high' || t.risk === 'critical') : t.risk === riskFilter.toLowerCase());
    const matchSearch = !search || t.id.toLowerCase().includes(search.toLowerCase()) || t.merchant.toLowerCase().includes(search.toLowerCase()) || t.customer.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchRisk && matchSearch;
  });

  const highCount = transactions.filter(t => t.risk === 'high' || t.risk === 'critical').length;

  return (
    <div className="animate-fade-in">
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '70px', right: '24px', zIndex: 1000,
          background: '#1e293b', color: '#ffffff', padding: '10px 18px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '8px',
          border: '1px solid #3b82f6',
        }} className="animate-fade-in">
          <CheckCircle size={15} color="#60a5fa" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Live Transaction Stream</h1>
            <span className={`badge ${isConnected ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Radio size={12} className={isConnected ? 'pulse-dot' : ''} />
              {isConnected ? 'Real-Time WebSocket Connected' : 'Connecting Stream...'}
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            Streaming live transactions from Razorpay webhooks and internal APIs with millisecond-level XGBoost inference.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={sendTestWebhook} disabled={sendingTest}>
            <Send size={13} />
            {sendingTest ? 'Sending Webhook...' : 'Send Live Test Webhook'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            {isPaused ? 'Resume Feed' : 'Pause Feed'}
          </button>
        </div>
      </div>

      {/* Live Stream Telemetry HUD */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>STREAM THROUGHPUT</div>
          <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
            {telemetry.events_per_sec.toLocaleString()} txns/s
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>INFERENCE LATENCY</div>
          <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
            {telemetry.model_inference_ms} ms
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>FLAGGED THREATS</div>
          <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: highCount > 0 ? 'var(--color-danger)' : 'var(--color-success)', marginTop: '2px' }}>
            {highCount} anomalies
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>TOTAL IN MEMORY</div>
          <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
            {transactions.length} captured
          </div>
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

        {/* Risk Chips */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['ALL', 'FLAGGED', 'CRITICAL', 'HIGH', 'LOW'].map(r => (
            <button
              key={r}
              className={`chip ${riskFilter === r ? 'active' : ''}`}
              onClick={() => setRiskFilter(r)}
            >
              {r}
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
                <th>Txn ID</th>
                <th>Source</th>
                <th>Merchant</th>
                <th>Amount (INR)</th>
                <th>Method</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Velocity</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => {
                const isWebhook = t.source === 'razorpay_webhook';
                return (
                  <tr
                    key={`${t.id}-${idx}`}
                    className={`clickable ${isWebhook ? 'row-webhook-highlight' : ''}`}
                    onClick={() => setSelected(t)}
                    style={{
                      background: isWebhook ? 'rgba(37, 99, 235, 0.04)' : undefined,
                    }}
                  >
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {t.id}
                    </td>
                    <td>
                      {isWebhook ? (
                        <span className="badge badge-info" style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                          ⚡ WEBHOOK
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Stream</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>{t.merchant}</td>
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                      ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td><span className="badge badge-neutral">{t.method}</span></td>
                    <td style={{ fontSize: '12px' }}>{t.customer}</td>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '160px' }} className="truncate">
                      {t.device}
                    </td>
                    <td className="mono" style={{ fontSize: '12px', color: t.velocity > 4 ? 'var(--color-danger)' : 'inherit' }}>
                      {t.velocity}×
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge badge-${t.risk}`}>
                          {t.risk.toUpperCase()}
                        </span>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {(t.riskScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>{t.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Slide-over / Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 90,
        }} onClick={() => setSelected(null)}>
          <div style={{
            width: '420px', background: 'var(--color-surface)', height: '100%',
            padding: '24px', boxShadow: 'var(--shadow-lg)', overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()} className="animate-slide-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Transaction Inspector</div>
                <h3 className="mono" style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{selected.id}</h3>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--color-surface-alt)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Risk Assessment</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span className={`badge badge-${selected.risk}`} style={{ fontSize: '13px' }}>
                    {selected.risk.toUpperCase()} RISK
                  </span>
                  <span className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>
                    {(selected.riskScore * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '10px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>AMOUNT</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                    ₹{selected.amount.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>METHOD</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{selected.method}</div>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>DEVICE & NETWORK</div>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{selected.device}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Velocity: <span className="mono" style={{ fontWeight: 600 }}>{selected.velocity}× baseline</span>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>INGESTION METADATA</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Merchant: <span className="mono">{selected.merchant}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Customer: <span>{selected.customer}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Source: <span className="mono">{selected.source || 'live_feed'}</span>
                </div>
              </div>

              {selected.riskScore > 0.6 && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px', justifyContent: 'center' }}
                  onClick={() => {
                    setSelected(null);
                    navigate('/investigation');
                  }}
                >
                  <ShieldAlert size={15} />
                  Open Deep Investigation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
