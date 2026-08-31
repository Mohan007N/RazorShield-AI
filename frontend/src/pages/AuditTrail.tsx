import { useState } from 'react';
import { FileText, CheckCircle, Clock, AlertTriangle, Search, Filter } from 'lucide-react';

interface AuditItem {
  id: string;
  eventType: string;
  alertId: string;
  investigationId: string;
  merchantId: string;
  riskScore: number;
  toolsCalled: string[];
  recommendation: string;
  policyResult: string;
  humanApproval: string;
  timestamp: string;
}

const mockAuditLogs: AuditItem[] = [
  {
    id: 'audit_01a8f9c2d3e4',
    eventType: 'INVESTIGATION_COMPLETED',
    alertId: 'alert_9a8b7c6d5e4f',
    investigationId: 'inv_3c4d5e6f7a8b',
    merchantId: 'merchant_001',
    riskScore: 0.94,
    toolsCalled: [
      'get_merchant_baseline',
      'get_recent_activity',
      'get_device_activity',
      'get_transaction_patterns',
      'get_model_explanation',
      'get_merchant_policy'
    ],
    recommendation: 'escalate_for_review',
    policyResult: 'ESCALATE_FOR_REVIEW',
    humanApproval: 'APPROVED',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'audit_02b9f8e3c4d5',
    eventType: 'ACTION_GATED',
    alertId: 'alert_8b7c6d5e4f3a',
    investigationId: 'inv_2b3c4d5e6f7a',
    merchantId: 'merchant_004',
    riskScore: 0.88,
    toolsCalled: [
      'get_merchant_baseline',
      'get_recent_activity',
      'get_transaction_patterns'
    ],
    recommendation: 'enhanced_verification',
    policyResult: 'ENHANCED_VERIFICATION',
    humanApproval: 'PENDING',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'audit_03c8e7d4b5a6',
    eventType: 'TOOL_FAILURE_HANDLED',
    alertId: 'alert_7c6d5e4f3a2b',
    investigationId: 'inv_1a2b3c4d5e6f',
    merchantId: 'merchant_008',
    riskScore: 0.82,
    toolsCalled: [
      'get_merchant_baseline',
      'get_recent_activity',
      'get_device_activity (FAILED - GRACEFUL DEGRADATION)'
    ],
    recommendation: 'escalate_for_review',
    policyResult: 'ESCALATE_FOR_REVIEW',
    humanApproval: 'APPROVED',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  }
];

export default function AuditTrail() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const filteredLogs = mockAuditLogs.filter(log => {
    const matchesSearch = log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.merchantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.alertId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || log.eventType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={24} color="var(--color-primary)" />
          Investigation Audit Trail
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Immutable record of every agent action, tool invocation, risk score, and human approval decision.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-elevated)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', flex: 1, minWidth: '240px' }}>
            <Search size={16} color="var(--color-text-muted)" />
            <input
              type="text"
              placeholder="Search by Audit ID, Merchant, or Alert ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--color-text-muted)" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="ALL">All Event Types</option>
              <option value="INVESTIGATION_COMPLETED">Investigation Completed</option>
              <option value="ACTION_GATED">Action Gated</option>
              <option value="TOOL_FAILURE_HANDLED">Tool Failure Handled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Audit Records ({filteredLogs.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLogs.map(log => (
            <div
              key={log.id}
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                      {log.id}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {log.eventType}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Merchant: <strong>{log.merchantId}</strong> | Alert: <span style={{ fontFamily: 'var(--font-mono)' }}>{log.alertId}</span> | Inv: <span style={{ fontFamily: 'var(--font-mono)' }}>{log.investigationId}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`badge badge-${log.riskScore >= 0.9 ? 'critical' : log.riskScore >= 0.8 ? 'high' : 'medium'}`}>
                      Risk {(log.riskScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Tools Invoked</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {log.toolsCalled.map((t, idx) => (
                      <span key={idx} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Agent Recommendation</span>
                  <strong style={{ color: 'var(--color-text)' }}>{log.recommendation}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Policy Evaluation</span>
                  <strong style={{ color: 'var(--color-warning)' }}>{log.policyResult}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Human Approval</span>
                  <span style={{ color: log.humanApproval === 'APPROVED' ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    {log.humanApproval === 'APPROVED' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {log.humanApproval}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
