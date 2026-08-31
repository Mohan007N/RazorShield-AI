import { useState } from 'react';
import {
  AlertTriangle, ToggleLeft, ToggleRight, CheckCircle,
  XCircle, Clock, Zap, Shield, Search, FileText, Cpu, Wrench, Eye
} from 'lucide-react';
import { api, type InvestigationResult, type Alert } from '../services/api';

export default function InvestigationPage() {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [deviceFailure, setDeviceFailure] = useState(false);
  const [approved, setApproved] = useState(false);
  const [step, setStep] = useState(0); // 0=idle, 1=spike, 2=investigating, 3=done

  const handleSimulate = async () => {
    setLoading(true);
    setStep(1);
    setResult(null);
    setApproved(false);
    try {
      const data = await api.simulateSpike({
        merchant_id: 'merchant_001',
        normal_txn_count: 120,
        spike_txn_count: 980,
        spike_duration_minutes: 5,
        suspicious_ratio: 0.15,
      });
      setAlert(data.alert);
      setStep(1);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleInvestigate = async () => {
    if (!alert) return;
    setLoading(true);
    setStep(2);
    try {
      const data = await api.investigateAlert(alert.id);
      setResult(data);
      setStep(3);
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
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={24} color="var(--color-warning)" />
          Fraud Spike Investigation
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Simulate a spike → Detect → Investigate → Evidence → Recommendation → Approval
        </p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
            <Zap size={16} />
            {loading && step === 1 ? 'Simulating...' : '1. Simulate Fraud Spike'}
          </button>

          <button
            className="btn btn-primary"
            onClick={handleInvestigate}
            disabled={!alert || loading}
            style={{ opacity: alert ? 1 : 0.4 }}
          >
            <Search size={16} />
            {loading && step === 2 ? 'Investigating...' : '2. Run Agent Investigation'}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Device Failure Demo:
            </span>
            <button
              className="btn btn-ghost"
              onClick={handleToggleDeviceFailure}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {deviceFailure ? (
                <><ToggleRight size={16} color="var(--color-danger)" /> ON</>
              ) : (
                <><ToggleLeft size={16} /> OFF</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Step 1: Alert */}
      {alert && (
        <div className="card animate-fade-in" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span className="badge badge-critical" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                  🚨 FRAUD SPIKE DETECTED
                </span>
                <span className={`badge badge-${alert.risk_level}`}>
                  {alert.risk_level.toUpperCase()}
                </span>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '600px' }}>
                {alert.summary}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
                {alert.spike_ratio.toFixed(1)}x
              </div>
              <div className="stat-label">ABOVE BASELINE</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px' }}>
            <MiniStat label="Risk Score" value={`${(alert.risk_score * 100).toFixed(0)}%`} color="var(--color-danger)" />
            <MiniStat label="Current Rate" value={`${alert.current_txn_rate}/min`} color="var(--color-warning)" />
            <MiniStat label="Baseline Rate" value={`${alert.baseline_txn_rate}/min`} color="var(--color-text-secondary)" />
            <MiniStat label="Alert ID" value={alert.id.slice(0, 16)} color="var(--color-text-muted)" mono />
          </div>
        </div>
      )}

      {/* Step 2-3: Investigation Result */}
      {result && (
        <div className="animate-fade-in">
          {/* Investigation Summary */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="var(--color-accent)" />
              Agent Investigation Report
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                Completed in {result.latency_ms.toFixed(0)}ms
              </span>
            </h3>

            {/* Tools Called */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tools Invoked
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.investigation.tools_called.map(tool => (
                  <div key={tool} className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                    <Wrench size={12} /> {tool}
                  </div>
                ))}
              </div>
            </div>

            {/* Tool Latencies */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tool Execution Latency
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {Object.entries(result.investigation.tool_latencies).map(([tool, ms]) => (
                  <span key={tool} style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {tool}: <strong>{(ms as number).toFixed(1)}ms</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Errors */}
            {result.investigation.errors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  ⚠️ Failures / Incomplete Evidence
                </div>
                {result.investigation.errors.map((err, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', marginBottom: '4px',
                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5',
                  }}>
                    <XCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    {err}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div style={{
              padding: '16px', background: 'var(--color-surface-elevated)',
              borderRadius: '8px', border: '1px solid var(--color-border)',
              whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: 1.7,
            }}>
              {result.investigation.summary}
            </div>
          </div>

          {/* Evidence Chain */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="var(--color-info)" />
              Evidence Chain
            </h3>
            <div className="evidence-chain">
              {result.investigation.evidence.map((ev, i) => (
                <div key={i} className={`evidence-node ${ev.confidence === 0 ? 'error' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {ev.source_tool}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                      background: ev.confidence > 0.5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: ev.confidence > 0.5 ? '#34d399' : '#f87171',
                    }}>
                      conf: {ev.confidence}
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{ev.field}:</span>{' '}
                    <strong>{ev.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation + Policy + Action Gate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Recommendation */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--color-accent)" />
                Agent Recommendation
              </h3>
              <div style={{
                padding: '12px', background: 'var(--color-surface-elevated)',
                borderRadius: '8px', fontSize: '0.85rem', lineHeight: 1.6,
                whiteSpace: 'pre-line',
              }}>
                {result.investigation.recommendation}
              </div>
              <div style={{ marginTop: '12px' }}>
                <span className="badge badge-high">
                  Action: {result.investigation.recommendation_action}
                </span>
                {result.investigation.confidence !== null && (
                  <span className="badge badge-info" style={{ marginLeft: '8px' }}>
                    Confidence: {(result.investigation.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* Policy + Gate */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--color-warning)" />
                Policy Gate
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Policy Decision</div>
                <div className={`badge badge-${result.policy_decision.risk_level}`}>
                  {result.policy_decision.allowed_action}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                {result.policy_decision.reasoning}
              </div>

              {result.action_gate.requires_human_review && (
                <div style={{
                  padding: '12px', background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', marginBottom: '8px' }}>
                    ⚠️ Human Approval Required
                  </div>
                  {!approved ? (
                    <button className="btn btn-primary" onClick={handleApprove}>
                      <CheckCircle size={16} /> Approve Action
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                      <CheckCircle size={18} />
                      <span style={{ fontWeight: 600 }}>Approved by admin</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Audit */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--color-text-muted)" />
              Audit Record
            </h3>
            <pre style={{
              background: 'var(--color-surface-elevated)', padding: '16px',
              borderRadius: '8px', fontSize: '0.75rem', overflow: 'auto',
              fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}>
              {JSON.stringify(result.audit, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color, mono }: {
  label: string; value: string; color: string; mono?: boolean;
}) {
  return (
    <div style={{
      padding: '12px', background: 'var(--color-surface-elevated)',
      borderRadius: '8px', border: '1px solid var(--color-border)',
    }}>
      <div style={{
        fontWeight: 700, color,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        fontSize: mono ? '0.75rem' : '1.2rem',
      }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
