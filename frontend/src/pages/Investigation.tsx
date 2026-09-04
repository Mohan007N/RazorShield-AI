import { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, Zap,
  ChevronDown, ChevronUp, AlertCircle, Check,
  ToggleLeft, ToggleRight, Sparkles, UserCheck, ShieldCheck, Download
} from 'lucide-react';
import { api, type InvestigationResult, type Alert } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AttackScenario {
  id: string;
  name: string;
  desc: string;
  normalCount: number;
  spikeCount: number;
  durationMins: number;
  suspiciousRatio: number;
}

const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: 'card_testing',
    name: 'Botnet Card-Testing Attack',
    desc: 'High velocity micro-transactions with rotating spoofed card numbers and device IDs.',
    normalCount: 120,
    spikeCount: 980,
    durationMins: 5,
    suspiciousRatio: 0.18,
  },
  {
    id: 'cred_stuffing',
    name: 'Credential Stuffing Surge',
    desc: 'Rapid spikes of failed login/UPI pins followed by elevated payment declines.',
    normalCount: 120,
    spikeCount: 540,
    durationMins: 3,
    suspiciousRatio: 0.32,
  },
  {
    id: 'high_ticket',
    name: 'Sudden High-Ticket Rush',
    desc: 'Surge of high-value transactions from unfamiliar geo-locations.',
    normalCount: 120,
    spikeCount: 320,
    durationMins: 4,
    suspiciousRatio: 0.12,
  },
];

export default function InvestigationPage() {
  const { user, activeMerchant } = useAuth();

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [deviceFailure, setDeviceFailure] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showTestTools, setShowTestTools] = useState(true);
  const [showAuditJson, setShowAuditJson] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(activeMerchant.id);
  const [selectedScenario, setSelectedScenario] = useState<AttackScenario>(ATTACK_SCENARIOS[0]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setSelectedMerchant(activeMerchant.id);
  }, [activeMerchant]);

  const step = !alert ? 0 : !result ? 1 : 2;

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    setApproved(false);
    try {
      const data = await api.simulateSpike({
        merchant_id: selectedMerchant,
        normal_txn_count: selectedScenario.normalCount,
        spike_txn_count: selectedScenario.spikeCount,
        spike_duration_minutes: selectedScenario.durationMins,
        suspicious_ratio: selectedScenario.suspiciousRatio,
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

  const exportInvestigationJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `razorshield-investigation-${result.investigation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Autonomous Fraud Spike Investigation</h1>
            <span className="badge badge-neutral mono" style={{ fontSize: '11px' }}>{selectedMerchant}</span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            {step === 0 && 'Simulate an anomalous fraud surge or select an active alert to trigger agent reasoning.'}
            {step === 1 && 'Anomaly alert detected — execute multi-tool agent graph to gather evidence.'}
            {step === 2 && 'Autonomous investigation completed — review evidence, SHAP attribution, and policy authorization.'}
          </div>
        </div>

        {alert && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge badge-${alert.risk_level}`}>
              Risk {(alert.risk_score * 100).toFixed(0)} / 100
            </span>
            <span className="badge badge-neutral">
              {!result ? 'Pending Investigation' : approved ? 'Human Signed & Approved' : 'Awaiting Sign-off'}
            </span>
            {result && (
              <button className="btn btn-secondary btn-sm" onClick={exportInvestigationJson}>
                <Download size={13} />
                Export
              </button>
            )}
          </div>
        )}
      </div>

      {/* Test Attack Presets & Tools (Collapsible) */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'space-between', padding: '4px 0' }}
          onClick={() => setShowTestTools(!showTestTools)}
        >
          <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} color="var(--color-primary)" />
            Simulation & Agent Testbed
          </span>
          {showTestTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTestTools && (
          <div style={{ marginTop: '14px' }}>
            {/* Scenario Preset Buttons */}
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Select Attack Simulation Profile
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '14px' }}>
              {ATTACK_SCENARIOS.map(sc => (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${selectedScenario.id === sc.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: selectedScenario.id === sc.id ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: selectedScenario.id === sc.id ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      {sc.name}
                    </span>
                    {selectedScenario.id === sc.id && <Check size={13} color="var(--color-primary)" />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.35 }}>
                    {sc.desc}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {sc.spikeCount} txns · {(sc.suspiciousRatio * 100).toFixed(0)}% suspicious
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
              <select
                className="select"
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                <option value="merchant_001">merchant_001 (ABC Electronics)</option>
                <option value="merchant_004">merchant_004 (Apex Luxury)</option>
                <option value="merchant_008">merchant_008 (CloudScale SaaS)</option>
                <option value="merchant_016">merchant_016 (BharatMart UPI)</option>
              </select>

              <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
                <Sparkles size={14} />
                {loading && !alert ? 'Injecting Spike...' : 'Simulate Spike Attack'}
              </button>
              <button className="btn btn-secondary" onClick={handleInvestigate} disabled={!alert || loading}>
                <Zap size={14} />
                {loading && alert && !result ? 'Agent Running Multi-Tool Graph...' : 'Run Agent Investigation'}
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Simulate Device Service Failure</span>
                <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={handleToggleDeviceFailure}>
                  {deviceFailure
                    ? <ToggleRight size={22} color="var(--color-danger)" />
                    : <ToggleLeft size={22} color="var(--color-text-dim)" />
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device failure warning */}
      {deviceFailure && (
        <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
          <AlertCircle size={16} />
          <span>
            <strong>Device fingerprinting service unavailable (Graceful Degradation Mode).</strong> Autonomous agent falls back to IP subnet and payment velocity heuristics, automatically enforcing human-in-the-loop sign-off.
          </span>
        </div>
      )}

      {/* Detected Alert Banner */}
      {alert && (
        <div className="card animate-fade-in" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div className="section-title">Detected Velocity & Anomaly Alert</div>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{alert.id}</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            {alert.summary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {[
              ['Risk Score', `${(alert.risk_score * 100).toFixed(0)} / 100`],
              ['Spike Ratio', `${alert.spike_ratio.toFixed(1)}× baseline`],
              ['Spike Rate', `${alert.current_txn_rate} txns/min`],
              ['Normal Baseline', `${alert.baseline_txn_rate} txns/min`],
              ['Model Verdict', alert.risk_level.toUpperCase()],
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
          {/* Agent Activity & Tool Execution Trace */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="section-title">Autonomous Agent Tool Execution Trace</div>
              <span className="badge badge-neutral mono" style={{ fontSize: '11px' }}>
                Latency: {result.latency_ms.toFixed(0)}ms
              </span>
            </div>

            {/* Tool execution checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: '14px' }}>
              {result.investigation.tools_called.map(tool => (
                <div key={tool} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', background: 'var(--color-surface-alt)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--color-border-light)',
                }}>
                  <CheckCircle size={15} color="var(--color-success)" />
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    {tool}
                  </span>
                  {result.investigation.tool_latencies[tool] !== undefined && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                      {(result.investigation.tool_latencies[tool] as number).toFixed(0)}ms
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Summary Box */}
            <div style={{
              padding: '12px 14px', background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius)',
              fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-line',
            }}>
              {result.investigation.summary}
            </div>
          </div>

          {/* Evidence Grid */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div className="section-title" style={{ marginBottom: '10px' }}>Extracted Evidence & SHAP Attributions</div>

            <div className="evidence-grid">
              <div className="evidence-row header">
                <div>Signal / Feature</div>
                <div>Observed Value</div>
                <div>Confidence / SHAP Weight</div>
                <div>Source Inspection Tool</div>
              </div>
              {result.investigation.evidence.map((ev, i) => (
                <div key={i} className="evidence-row">
                  <div style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{ev.field}</div>
                  <div style={{ fontWeight: 600 }}>{ev.value}</div>
                  <div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: ev.confidence > 0.5 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {(ev.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {ev.source_tool}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Chain: Model → Agent → Policy Gate */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            {/* Model Result */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                XGBoost Ensemble Score
              </div>
              <div className="tabular" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px', color: 'var(--color-danger)' }}>
                {(result.investigation.risk_score * 100).toFixed(0)}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--color-text-muted)' }}> / 100</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Anomaly severity: {(result.investigation.risk_score > 0.8 ? 'CRITICAL' : 'HIGH')}
              </div>
            </div>

            {/* Agent Recommendation */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Autonomous Agent Advice
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                {result.investigation.recommendation}
              </div>
              <span className="badge badge-high">
                {result.investigation.recommendation_action?.toUpperCase()}
              </span>
            </div>

            {/* Policy Decision */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Policy Guardrail Evaluation
              </div>
              <span className={`badge badge-${result.policy_decision.risk_level}`} style={{ fontSize: '12px', marginBottom: '8px' }}>
                {result.policy_decision.allowed_action}
              </span>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                {result.policy_decision.reasoning}
              </div>
            </div>
          </div>

          {/* Action Gate & Human-in-the-Loop Review */}
          {result.action_gate.requires_human_review && (
            <div className="card" style={{ marginBottom: '14px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="var(--color-primary)" />
                    Human-in-the-Loop Action Gate
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
                    Autonomous policy requires verified Risk Officer sign-off prior to enforcing merchant holds.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Recommended Action</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{result.investigation.recommendation_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Policy Permitted</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{result.policy_decision.allowed_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Review Status</div>
                      <div style={{ fontWeight: 600, color: approved ? 'var(--color-success)' : 'var(--color-warning)', marginTop: '2px' }}>
                        {approved ? 'Authorized & Signed' : 'Pending Authorization'}
                      </div>
                    </div>
                  </div>
                </div>

                {!approved ? (
                  <div style={{ display: 'flex', gap: '8px', alignSelf: 'center' }}>
                    <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
                      <CheckCircle size={15} />
                      Authorize & Sign
                    </button>
                    <button className="btn btn-secondary">
                      Decline Action
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '6px',
                    background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
                    color: 'var(--color-success)', fontWeight: 600, fontSize: '13px',
                  }}>
                    <UserCheck size={16} />
                    Digitally Authorized by {user?.name || 'Mohan Kumar'} ({user?.role || 'Risk Lead'})
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cryptographic Audit Record */}
          <div className="card">
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'space-between', padding: '4px 0' }}
              onClick={() => setShowAuditJson(!showAuditJson)}
            >
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} />
                Cryptographic Audit Log (HMAC-SHA256)
              </span>
              {showAuditJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAuditJson && (
              <pre style={{
                marginTop: '10px', padding: '10px 12px',
                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius)', fontSize: '11px', overflow: 'auto',
                fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
                maxHeight: '220px',
              }}>
                {JSON.stringify(result.audit, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Authorize Defense Action</div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '10px 0 16px' }}>
              You are authorizing <strong>{result?.investigation.recommendation_action}</strong> for merchant <strong>{selectedMerchant}</strong>.
              This will enforce autonomous velocity dampening and record your risk officer credentials into the immutable audit trail.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove}>Confirm & Sign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
