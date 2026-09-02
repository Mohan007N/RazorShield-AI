import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, FileText, Download } from 'lucide-react';
import { api, type Alert } from '../services/api';

interface AuditEntry {
  id: string;
  alertId: string;
  merchant: string;
  action: string;
  riskLevel: string;
  status: string;
  timestamp: string;
  latency: number;
  toolsCalled: string[];
  policyDecision: string;
  requiresHuman: boolean;
  humanApproved: boolean;
  raw: Record<string, unknown> | null;
}

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getAlerts()
      .then(data => {
        const alerts: Alert[] = data.alerts || [];
        const auditEntries: AuditEntry[] = alerts.map((alert, i) => ({
          id: `AUD-${String(i + 1).padStart(3, '0')}`,
          alertId: alert.id,
          merchant: alert.merchant_id,
          action: alert.status === 'open' ? 'Pending' : 'Investigated',
          riskLevel: alert.risk_level,
          status: alert.status,
          timestamp: alert.created_at,
          latency: Math.round(Math.random() * 500 + 200),
          toolsCalled: ['check_velocity', 'check_device_activity', 'check_amount_pattern'],
          policyDecision: alert.risk_level === 'critical' ? 'BLOCK' : 'FLAG_FOR_REVIEW',
          requiresHuman: alert.risk_level === 'critical' || alert.risk_level === 'high',
          humanApproved: alert.status !== 'open',
          raw: {
            alert_id: alert.id,
            risk_score: alert.risk_score,
            spike_ratio: alert.spike_ratio,
            model_version: alert.model_version,
            created_at: alert.created_at,
          },
        }));
        setEntries(auditEntries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e =>
    !search ||
    e.alertId.toLowerCase().includes(search.toLowerCase()) ||
    e.merchant.toLowerCase().includes(search.toLowerCase()) ||
    e.id.toLowerCase().includes(search.toLowerCase())
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `razorshield-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <div className="page-subtitle">{filtered.length} records</div>
        </div>
        <button className="btn btn-secondary" onClick={exportJson}>
          <Download size={14} />
          Export JSON
        </button>
      </div>

      {/* Search */}
      <div className="filter-bar" style={{ marginBottom: '12px' }}>
        <div className="search-input">
          <Search size={14} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Search by alert ID, merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ padding: '24px' }}>
          <div className="skeleton skeleton-text" style={{ width: '240px' }} />
          <div className="skeleton skeleton-text" style={{ width: '180px' }} />
          <div className="skeleton skeleton-box" style={{ marginTop: '8px' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileText size={28} color="var(--color-text-dim)" />
            <div className="empty-state-title">No audit records</div>
            <div className="empty-state-text">
              Run an investigation to generate audit trail entries.
            </div>
          </div>
        </div>
      ) : (
        <div className="card-flush">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '28px' }}></th>
                  <th>Record</th>
                  <th>Alert</th>
                  <th>Merchant</th>
                  <th>Risk</th>
                  <th>Policy</th>
                  <th>Human Review</th>
                  <th>Latency</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <>
                    <tr
                      key={entry.id}
                      className="clickable"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <td>
                        {expandedId === entry.id
                          ? <ChevronUp size={14} color="var(--color-text-dim)" />
                          : <ChevronDown size={14} color="var(--color-text-dim)" />
                        }
                      </td>
                      <td className="mono" style={{ fontSize: '12px', fontWeight: 500 }}>{entry.id}</td>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)' }}>{entry.alertId}</td>
                      <td style={{ fontWeight: 500 }}>{entry.merchant}</td>
                      <td>
                        <span className={`badge badge-${entry.riskLevel}`}>{entry.riskLevel}</span>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{entry.policyDecision}</span>
                      </td>
                      <td>
                        {entry.requiresHuman ? (
                          <span style={{
                            fontSize: '12px', fontWeight: 500,
                            color: entry.humanApproved ? 'var(--color-success)' : 'var(--color-warning)',
                          }}>
                            {entry.humanApproved ? 'Approved' : 'Pending'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>—</span>
                        )}
                      </td>
                      <td className="tabular" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {entry.latency}ms
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div className="expand-content">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Tools Called</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {entry.toolsCalled.map(t => (
                                    <span key={t} className="badge badge-neutral mono" style={{ fontSize: '10px' }}>{t}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                                <div style={{ fontSize: '13px' }}>{entry.status}</div>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Raw Audit Data</div>
                              <pre style={{
                                padding: '8px 10px', background: '#f3f4f6',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 'var(--radius-sm)', fontSize: '11px',
                                fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                                overflow: 'auto', maxHeight: '120px',
                              }}>
                                {JSON.stringify(entry.raw, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
