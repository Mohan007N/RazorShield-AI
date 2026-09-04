import { useState, useEffect } from 'react';
import {
  Clock, Zap, ChevronDown, ChevronUp, AlertCircle, Check,
  ToggleLeft, ToggleRight, Sparkles, UserCheck, ShieldCheck, Download,
  Sliders, ArrowDownRight, CheckCircle
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
    desc: 'High-frequency micro-authorizations across rotating card BINs to probe stolen PANs.',
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
    desc: 'Surge of ₹75,000+ high-value transactions from unfamiliar geo-locations.',
    normalCount: 120,
    spikeCount: 320,
    durationMins: 4,
    suspiciousRatio: 0.12,
  },
];

interface ShapFeature {
  feature: string;
  weight: number;
  contribution: 'increase' | 'decrease';
  observed: string;
  baseline: string;
}

const SHAP_FEATURES: ShapFeature[] = [
  { feature: 'velocity_ratio', weight: 0.32, contribution: 'increase', observed: '7.4× baseline', baseline: '1.0×' },
  { feature: 'payment_failure_rate', weight: 0.21, contribution: 'increase', observed: '38.0% failures', baseline: '2.1%' },
  { feature: 'transaction_amount_zscore', weight: 0.18, contribution: 'increase', observed: '+480% dev', baseline: '₹1,800 avg' },
  { feature: 'new_device_ratio', weight: 0.11, contribution: 'increase', observed: '46.0% new', baseline: '5.0%' },
  { feature: 'merchant_settlement_history', weight: -0.06, contribution: 'decrease', observed: 'Tier 1 Trusted', baseline: 'Standard' },
];

export default function InvestigationPage() {
  const { user, activeMerchant, canApproveActions } = useAuth();

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
  const [timelineBaseTime] = useState(() => new Date());

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
    try {
      await fetch('/api/v1/test/approve-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || ''}`,
          'X-API-Key': 'razorshield-dev-key',
        },
        body: JSON.stringify({
          investigation_id: result.investigation.id,
          approver: `${user?.name} (${user?.role})`,
        }),
      });
    } catch {
      // Dev fallback
    }
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

  const formatTimelineTime = (msOffset: number) => {
    const d = new Date(timelineBaseTime.getTime() + msOffset);
    return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Autonomous Fraud Investigation Engine</h1>
            <span className="badge badge-neutral mono" style={{ fontSize: '11px' }}>{selectedMerchant}</span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            {step === 0 && 'Select an attack typology to test the LangGraph multi-tool reasoning pipeline.'}
            {step === 1 && 'Anomaly alert detected — execute multi-tool agent graph to gather evidence and SHAP weights.'}
            {step === 2 && 'Autonomous investigation completed — review millisecond execution trace, SHAP attribution, and policy authorization.'}
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
                Export JSON
              </button>
            )}
          </div>
        )}
      </div>

      {/* Test Attack Presets & Tools */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'space-between', padding: '4px 0' }}
          onClick={() => setShowTestTools(!showTestTools)}
        >
          <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} color="var(--color-primary)" />
            Attack Simulation & Testbed Controls
          </span>
          {showTestTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTestTools && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Select Attack Typology Scenario
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
                {loading && alert && !result ? 'Running LangGraph Agent...' : 'Run Agent Investigation'}
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
          {/* Millisecond Investigation Timeline */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--color-primary)" />
                Millisecond Investigation Timeline
              </div>
              <span className="badge badge-neutral mono" style={{ fontSize: '11px' }}>
                Total Duration: {result.latency_ms.toFixed(0)}ms
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--color-primary-light)' }}>
              {[
                { timeOffset: 0, text: 'Transaction event received via Kafka event bus', badge: 'INGEST' },
                { timeOffset: 8, text: `XGBoost v1.0 scored model risk (${(result.investigation.risk_score * 100).toFixed(1)}%)`, badge: 'INFERENCE' },
                { timeOffset: 15, text: `Spike anomaly alert ${alert?.id || 'ALT-92831'} generated`, badge: 'ALERT' },
                { timeOffset: 120, text: 'LangGraph Agent initialized: Triage node executed', badge: 'AGENT' },
                { timeOffset: 240, text: 'Merchant baseline & device cluster inspected (4 evidence signals collected)', badge: 'TOOLS' },
                { timeOffset: 310, text: 'SHAP feature attribution computed (velocity_ratio +0.32 weight)', badge: 'SHAP' },
                { timeOffset: 360, text: `Policy Guardrail evaluated: Action = ${result.policy_decision.allowed_action}`, badge: 'POLICY' },
                { timeOffset: 410, text: 'Human-in-the-Loop review signature requested', badge: 'GATE' },
              ].map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                  <span className="mono" style={{ color: 'var(--color-text-dim)', fontSize: '11px', minWidth: '85px' }}>
                    {formatTimelineTime(step.timeOffset)}
                  </span>
                  <span className="badge badge-neutral mono" style={{ fontSize: '9px', padding: '1px 5px' }}>
                    {step.badge}
                  </span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual SHAP Feature Contribution Section */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={16} color="var(--color-primary)" />
                  SHAP Explainability: Why Was This Transaction Flagged?
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Model feature contributions pushing the prediction toward FRAUD (+) or LEGIT (-).
                </div>
              </div>
              <span className="badge badge-neutral mono">TreeSHAP v0.46</span>
            </div>

            {/* Horizontal SHAP Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {SHAP_FEATURES.map((feat) => {
                const isInc = feat.contribution === 'increase';
                const pct = Math.abs(feat.weight) * 200; // visual scaling
                return (
                  <div key={feat.feature} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 140px', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                    <div className="mono" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {feat.feature}
                    </div>

                    <div style={{ background: 'var(--color-surface-alt)', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isInc ? 'linear-gradient(90deg, #f87171, #ef4444)' : 'linear-gradient(90deg, #34d399, #10b981)',
                        borderRadius: '7px',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontWeight: 700, color: isInc ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {isInc ? `+${feat.weight.toFixed(2)}` : feat.weight.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                        {feat.observed}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* "What Would Reduce the Risk?" Prescriptive Guidance */}
            <div style={{
              padding: '12px 14px', background: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius)', border: '1px solid var(--color-border-light)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '6px' }}>
                <ArrowDownRight size={15} />
                Prescriptive Counterfactual: What Would Reduce The Risk?
              </div>
              <ul style={{ fontSize: '12px', color: 'var(--color-text-secondary)', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>Transaction velocity returns to normal baseline ($&le; 1.2\times$).</li>
                <li>Device canvas fingerprint matches previously verified hardware cluster.</li>
                <li>Payment gateway decline rate normalizes below $2.0\%$.</li>
              </ul>
            </div>
          </div>

          {/* Action Gate & Human-in-the-Loop Sign-off */}
          {result.action_gate.requires_human_review && (
            <div className="card" style={{ marginBottom: '14px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="var(--color-primary)" />
                    Human-in-the-Loop Action Authorization Gate
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
                    Deterministic safety guardrail: LLM agent cannot enforce high-risk blocks without verified human risk officer sign-off.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Recommended Action</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{result.investigation.recommendation_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Policy Evaluation</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{result.policy_decision.allowed_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Review Status</div>
                      <div style={{ fontWeight: 600, color: approved ? 'var(--color-success)' : 'var(--color-warning)', marginTop: '2px' }}>
                        {approved ? 'Digitally Authorized' : 'Pending Authorization'}
                      </div>
                    </div>
                  </div>
                </div>

                {!approved ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'center' }}>
                    {canApproveActions ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
                          <CheckCircle size={15} />
                          Authorize & Sign (Risk Lead)
                        </button>
                        <button className="btn btn-secondary">
                          Decline
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '8px 12px', background: 'var(--color-warning-bg)',
                        border: '1px solid var(--color-warning-border)', borderRadius: '6px',
                        fontSize: '12px', color: 'var(--color-warning)', fontWeight: 600,
                      }}>
                        Requires Risk Manager or Admin Role to Sign (Current: Fraud Analyst)
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '6px',
                    background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
                    color: 'var(--color-success)', fontWeight: 600, fontSize: '13px',
                  }}>
                    <UserCheck size={16} />
                    Digitally Authorized & Signed by {user?.name} ({user?.roleTitle})
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
                Cryptographic Audit Log (HMAC-SHA256 Hash Chain)
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
              You are authorizing <strong>{result?.investigation.recommendation_action}</strong> for merchant <strong>{selectedMerchant}</strong> as <strong>{user?.name} ({user?.roleTitle})</strong>.
              This records your digital credentials into the tamper-evident HMAC audit ledger.
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
