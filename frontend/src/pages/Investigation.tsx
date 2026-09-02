import { useState } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Zap,
  ChevronDown, ChevronUp, AlertCircle, Check,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { api, type InvestigationResult, type Alert } from '../services/api';

export default function InvestigationPage() {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [deviceFailure, setDeviceFailure] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showTestTools, setShowTestTools] = useState(true);
  const [showAuditJson, setShowAuditJson] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState('merchant_001');
  const [showConfirm, setShowConfirm] = useState(false);

  const step = !alert ? 0 : !result ? 1 : 2;

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    setApproved(false);
    try {
      const data = await api.simulateSpike({
        merchant_id: selectedMerchant,
        normal_txn_count: 120,
        spike_txn_count: 980,
        spike_duration_minutes: 5,
        suspicious_ratio: 0.15,
      });
      setAlert(data.alert);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleInvestigate = async () => {
    if (!alert) return;
    setLoading(true);
    try {
      const data = await api.investigateAlert(alert.id);
      setResult(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleToggleDeviceFailure = async () => {
    const newState = !deviceFailure;
    await api.toggleDeviceFailure(newState);
    setDeviceFailure(newState);
  };

  const handleApprove = async () => {
    if (!result) return;
    await api.approveAction(result.investigation.id);
    setApproved(true);
    setShowConfirm(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Fraud Spike Investigation</h1>
          <div className="page-subtitle">
            {step === 0 && 'Simulate a spike to begin investigation'}
            {step === 1 && 'Alert detected — run agent investigation'}
            {step === 2 && 'Investigation complete — review findings'}
          </div>
        </div>
        {alert && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge badge-${alert.risk_level}`}>
              Risk {(alert.risk_score * 100).toFixed(0)}
            </span>
            <span className="badge badge-neutral">
              {!result ? 'Pending Investigation' : approved ? 'Approved' : 'Awaiting Approval'}
            </span>
          </div>
        )}
      </div>

      {/* Test Tools (collapsible) */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'space-between', padding: '4px 0' }}
          onClick={() => setShowTestTools(!showTestTools)}
        >
          <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} />
            Test Tools
          </span>
          {showTestTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTestTools && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="select"
              value={selectedMerchant}
              onChange={(e) => setSelectedMerchant(e.target.value)}
            >
              <option value="merchant_001">merchant_001</option>
              <option value="merchant_004">merchant_004</option>
              <option value="merchant_008">merchant_008</option>
              <option value="merchant_016">merchant_016</option>
            </select>

            <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
              {loading && !alert ? 'Simulating...' : 'Simulate Spike'}
            </button>
            <button className="btn btn-secondary" onClick={handleInvestigate} disabled={!alert || loading}>
              {loading && alert && !result ? 'Investigating...' : 'Run Investigation'}
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Device failure</span>
              <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={handleToggleDeviceFailure}>
                {deviceFailure
                  ? <ToggleRight size={20} color="var(--color-danger)" />
                  : <ToggleLeft size={20} color="var(--color-text-dim)" />
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Device failure warning */}
      {deviceFailure && (
        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
          <AlertCircle size={15} />
          <span>
            <strong>Device service unavailable.</strong> Agent will fall back to available evidence and default to human review.
          </span>
        </div>
      )}

      {/* Alert Details */}
      {alert && (
        <div className="card animate-fade-in" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div className="section-title">Detected Alert</div>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{alert.id}</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            {alert.summary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            {[
              ['Risk Score', `${(alert.risk_score * 100).toFixed(0)} / 100`],
              ['Spike Ratio', `${alert.spike_ratio.toFixed(1)}×`],
              ['Current Rate', `${alert.current_txn_rate}/min`],
              ['Baseline Rate', `${alert.baseline_txn_rate}/min`],
              ['Severity', alert.risk_level.toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} style={{
                padding: '8px 10px', background: 'var(--color-surface-alt)',
                borderRadius: 'var(--radius)', border: '1px solid var(--color-border-light)',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }} className="tabular">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation Results */}
      {result && (
        <div className="animate-fade-in">
          {/* Agent Activity */}
          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="section-title">Investigation Activity</div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {result.latency_ms.toFixed(0)}ms
              </span>
            </div>

            {/* Tool execution checklist */}
            <div style={{ marginBottom: '12px' }}>
              {result.investigation.tools_called.map(tool => (
                <div key={tool} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '4px 0', fontSize: '13px',
                }}>
                  <Check size={14} color="var(--color-success)" />
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{tool}</span>
                  {result.investigation.tool_latencies[tool] !== undefined && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginLeft: 'auto' }}>
                      {(result.investigation.tool_latencies[tool] as number).toFixed(0)}ms
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Errors */}
            {result.investigation.errors.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
                <AlertTriangle size={14} />
                <div>
                  {result.investigation.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: '13px' }}>{err}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div style={{
              padding: '10px 12px', background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius)',
              fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-line',
            }}>
              {result.investigation.summary}
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Evidence sources: {result.investigation.evidence.length}
            </div>
          </div>

          {/* Evidence */}
          <div className="card" style={{ marginBottom: '12px' }}>
            <div className="section-title" style={{ marginBottom: '10px' }}>Evidence</div>

            <div className="evidence-grid">
              <div className="evidence-row header">
                <div>Signal</div>
                <div>Value</div>
                <div>Confidence</div>
                <div>Source</div>
              </div>
              {result.investigation.evidence.map((ev, i) => (
                <div key={i} className="evidence-row">
                  <div style={{ color: 'var(--color-text-secondary)' }}>{ev.field}</div>
                  <div style={{ fontWeight: 600 }}>{ev.value}</div>
                  <div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: ev.confidence > 0.5 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {ev.confidence}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {ev.source_tool}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Chain: Model → Agent → Policy → Action */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {/* Model Result */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Model Result
              </div>
              <div className="tabular" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
                {(result.investigation.risk_score * 100).toFixed(0)}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-text-muted)' }}> / 100</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Model-estimated risk
              </div>
            </div>

            {/* Agent Recommendation */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Agent Recommendation
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
                {result.investigation.recommendation}
              </div>
              <span className="badge badge-high">
                {result.investigation.recommendation_action}
              </span>
            </div>

            {/* Policy Decision */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Policy Decision
              </div>
              <span className={`badge badge-${result.policy_decision.risk_level}`} style={{ fontSize: '12px', marginBottom: '8px' }}>
                {result.policy_decision.allowed_action}
              </span>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                {result.policy_decision.reasoning}
              </div>
            </div>
          </div>

          {/* Action Gate */}
          {result.action_gate.requires_human_review && (
            <div className="card" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="section-title" style={{ marginBottom: '4px' }}>Action Authorization</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    This action requires human approval before execution.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '13px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Recommended</div>
                      <div style={{ fontWeight: 500 }}>{result.investigation.recommendation_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Policy</div>
                      <div style={{ fontWeight: 500 }}>{result.policy_decision.allowed_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Approval</div>
                      <div style={{ fontWeight: 500, color: approved ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {approved ? 'Approved' : 'Pending'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!approved ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
                    <CheckCircle size={14} />
                    Approve
                  </button>
                  <button className="btn btn-secondary">
                    Reject
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-success)', fontWeight: 500 }}>
                  <CheckCircle size={15} />
                  Approved by Mohan Kumar
                </div>
              )}
            </div>
          )}

          {/* Audit Record */}
          <div className="card">
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'space-between', padding: '4px 0' }}
              onClick={() => setShowAuditJson(!showAuditJson)}
            >
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} />
                Audit Record
              </span>
              {showAuditJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAuditJson && (
              <pre style={{
                marginTop: '10px', padding: '10px 12px',
                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius)', fontSize: '11px', overflow: 'auto',
                fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                maxHeight: '200px',
              }}>
                {JSON.stringify(result.audit, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirm Approval</div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              You are approving the recommended action: <strong>{result?.investigation.recommendation_action}</strong>.
              This will authorize the policy-gated response.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}>Confirm Approval</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
