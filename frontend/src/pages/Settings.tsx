import { useState } from 'react';
import {
  Building2, Shield, Key, Bell, Check, Copy, RefreshCw,
  Sliders, Save, Lock, Smartphone, Webhook
} from 'lucide-react';
import { useAuth, type RiskPolicyConfig } from '../context/AuthContext';

type TabType = 'profile' | 'policy' | 'keys' | 'notifications';

export default function Settings() {
  const {
    user,
    activeMerchant,
    riskPolicy,
    updateRiskPolicy,
    updateMerchantProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLiveKey, setShowLiveKey] = useState(false);

  // Form states
  const [merchantName, setMerchantName] = useState(activeMerchant.name);
  const [category, setCategory] = useState(activeMerchant.category);
  const [contactName, setContactName] = useState(user?.name || 'Mohan Kumar');
  const [contactEmail, setContactEmail] = useState(user?.email || 'mohan.k@abcelectronics.com');

  // Policy Form State
  const [policyForm, setPolicyForm] = useState<RiskPolicyConfig>({ ...riskPolicy });

  // API Key States
  const [liveKey, setLiveKey] = useState('rzs_live_sk_948fbc839210aa39e4823819024c');
  const [testKey, setTestKey] = useState('rzs_test_sk_demo_772183910248aa8290123');
  const [webhookSecret] = useState('whsec_99182ab3819ff48201');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveProfile = () => {
    updateMerchantProfile({
      name: merchantName,
      category: category,
    });
    showToast('Merchant profile updated successfully');
  };

  const handleSavePolicy = () => {
    updateRiskPolicy(policyForm);
    showToast('Risk thresholds and autonomous policies saved');
  };

  const handleRegenerateKey = (type: 'live' | 'test') => {
    const newKey = `rzs_${type}_sk_${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`;
    if (type === 'live') {
      setLiveKey(newKey);
    } else {
      setTestKey(newKey);
    }
    showToast(`Regenerated ${type.toUpperCase()} API key`);
  };

  return (
    <div className="animate-fade-in settings-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="settings-header">
        <div>
          <h1 className="page-title">Merchant Settings & Risk Controls</h1>
          <div className="page-subtitle">
            Configure merchant identity, autonomous decision thresholds, webhook routing, and integration keys.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'profile' && (
            <button className="btn btn-primary" onClick={handleSaveProfile}>
              <Save size={14} />
              Save Profile
            </button>
          )}
          {activeTab === 'policy' && (
            <button className="btn btn-primary" onClick={handleSavePolicy}>
              <Save size={14} />
              Save Policies
            </button>
          )}
          {activeTab === 'notifications' && (
            <button className="btn btn-primary" onClick={handleSavePolicy}>
              <Save size={14} />
              Save Alerts
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="settings-nav-tabs">
        <button
          className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Building2 size={16} />
          <span>Merchant Profile</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'policy' ? 'active' : ''}`}
          onClick={() => setActiveTab('policy')}
        >
          <Sliders size={16} />
          <span>Risk Policy & Guardrails</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          <Key size={16} />
          <span>API Keys & Webhooks</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} />
          <span>Alert Channels & Slack</span>
        </button>
      </div>

      {/* Tab 1: Merchant Profile */}
      {activeTab === 'profile' && (
        <div className="settings-tab-content animate-fade-in">
          <div className="settings-grid">
            {/* Merchant Identity Card */}
            <div className="card">
              <div className="settings-card-header">
                <div className="section-title">Merchant Workspace</div>
                <span className="badge badge-success">Verified Active</span>
              </div>

              <div className="settings-form-body">
                <div className="form-group">
                  <label className="form-label">Merchant Trading Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Merchant ID (MID)</label>
                  <div className="mono input-readonly-field">{activeMerchant.id}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Business Category</label>
                  <input
                    type="text"
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Risk Tier</label>
                    <div className="input-readonly-field">{activeMerchant.tier}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Normal Baseline Velocity</label>
                    <div className="input-readonly-field mono">{activeMerchant.baselineRate} txns/min</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Monthly Volume</label>
                    <div className="input-readonly-field">{activeMerchant.monthlyVolume}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Settlement Bank</label>
                    <div className="input-readonly-field mono">HDFC Bank (•••• 8921)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Officer Profile */}
            <div className="card">
              <div className="settings-card-header">
                <div className="section-title">Risk Officer Identity & Access</div>
                <span className="badge badge-neutral">{user?.role || 'Risk Operations Lead'}</span>
              </div>

              <div className="settings-form-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Official Risk Email</label>
                  <input
                    type="email"
                    className="input-field"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>

                <div className="settings-feature-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="feature-icon-badge">
                      <Smartphone size={18} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>Multi-Factor Authentication (TOTP)</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Enforced for autonomous policy overrides & action approvals.
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-success">Enabled</span>
                </div>

                <div className="settings-feature-box" style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="feature-icon-badge">
                      <Lock size={18} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>Session Security Timeout</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Automatic logout after 30 minutes of analyst inactivity.
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-neutral">30 Mins</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Risk Policy & Guardrails */}
      {activeTab === 'policy' && (
        <div className="settings-tab-content animate-fade-in">
          <div className="settings-grid">
            {/* Threshold Sliders */}
            <div className="card">
              <div className="settings-card-header">
                <div>
                  <div className="section-title">Autonomous Action Gate Thresholds</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    XGBoost and Anomaly model output scores map directly to policy actions.
                  </div>
                </div>
              </div>

              <div className="settings-form-body">
                {/* Auto-Block Slider */}
                <div className="slider-group">
                  <div className="slider-header">
                    <div>
                      <span className="slider-label" style={{ color: 'var(--color-danger)' }}>
                        Autonomous Block Threshold
                      </span>
                      <div className="slider-desc">Transactions scoring above this are blocked instantly without human delay.</div>
                    </div>
                    <div className="slider-badge" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                      Score ≥ {policyForm.autoBlockThreshold}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="99"
                    value={policyForm.autoBlockThreshold}
                    onChange={(e) => setPolicyForm({ ...policyForm, autoBlockThreshold: Number(e.target.value) })}
                    className="range-slider range-danger"
                  />
                  <div className="slider-bounds">
                    <span>Aggressive (70)</span>
                    <span>Standard (85)</span>
                    <span>Conservative (99)</span>
                  </div>
                </div>

                {/* Human-in-the-Loop Review Slider */}
                <div className="slider-group" style={{ marginTop: '20px' }}>
                  <div className="slider-header">
                    <div>
                      <span className="slider-label" style={{ color: 'var(--color-warning)' }}>
                        Human-in-the-Loop Review Gate
                      </span>
                      <div className="slider-desc">Flags suspicious transactions for risk officer 1-click approval or decline.</div>
                    </div>
                    <div className="slider-badge" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                      Score {policyForm.humanReviewThreshold} - {policyForm.autoBlockThreshold - 1}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="80"
                    value={policyForm.humanReviewThreshold}
                    onChange={(e) => setPolicyForm({ ...policyForm, humanReviewThreshold: Number(e.target.value) })}
                    className="range-slider range-warning"
                  />
                  <div className="slider-bounds">
                    <span>Broad Review (40)</span>
                    <span>Balanced (60)</span>
                    <span>Narrow (80)</span>
                  </div>
                </div>

                {/* Spike Velocity Trigger */}
                <div className="slider-group" style={{ marginTop: '20px' }}>
                  <div className="slider-header">
                    <div>
                      <span className="slider-label" style={{ color: 'var(--color-primary)' }}>
                        Fraud Spike Velocity Trigger Multiplier
                      </span>
                      <div className="slider-desc">Triggers autonomous agent investigation when velocity exceeds normal baseline.</div>
                    </div>
                    <div className="slider-badge" style={{ background: 'var(--color-info-bg)', color: 'var(--color-primary)' }}>
                      {policyForm.spikeMultiplierThreshold.toFixed(1)}× Baseline
                    </div>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={policyForm.spikeMultiplierThreshold * 10}
                    onChange={(e) => setPolicyForm({ ...policyForm, spikeMultiplierThreshold: Number(e.target.value) / 10 })}
                    className="range-slider range-primary"
                  />
                  <div className="slider-bounds">
                    <span>Sensitive (2.0×)</span>
                    <span>Recommended (4.0×)</span>
                    <span>High Volume (10.0×)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Autonomous Guardrails & Safeguards */}
            <div className="card">
              <div className="settings-card-header">
                <div>
                  <div className="section-title">Autonomous Defense Guardrails</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Safety mechanisms preventing over-blocking and collateral merchant impact.
                  </div>
                </div>
              </div>

              <div className="settings-form-body">
                {/* Toggle 1 */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">Autonomous Settlement Hold</div>
                    <div className="toggle-desc">
                      Automatically places high-risk settlement batches on temporary hold during active investigation.
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.autoHoldSettlement}
                      onChange={(e) => setPolicyForm({ ...policyForm, autoHoldSettlement: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                {/* Toggle 2 */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">Strict Device Fingerprint Verification</div>
                    <div className="toggle-desc">
                      Blocks transactions from known spoofed canvas, emulators, or unrecognized device clusters.
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.strictDeviceFingerprint}
                      onChange={(e) => setPolicyForm({ ...policyForm, strictDeviceFingerprint: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                {/* Toggle 3 */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">Cross-Border Geo-Fencing</div>
                    <div className="toggle-desc">
                      Forces human approval for transactions originating outside merchant's primary operating countries.
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.geoFencingEnabled}
                      onChange={(e) => setPolicyForm({ ...policyForm, geoFencingEnabled: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                {/* Rate Limiting Input */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Circuit-Breaker Emergency Rate Limit (txns/min)</label>
                  <input
                    type="number"
                    className="input-field mono"
                    value={policyForm.rateLimitPerMinute}
                    onChange={(e) => setPolicyForm({ ...policyForm, rateLimitPerMinute: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
                    If traffic exceeds this hard threshold, dynamic throttling protects payment gateway uptime.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: API Keys & Webhooks */}
      {activeTab === 'keys' && (
        <div className="settings-tab-content animate-fade-in">
          <div className="settings-grid">
            {/* API Keys */}
            <div className="card">
              <div className="settings-card-header">
                <div>
                  <div className="section-title">RazorShield Risk API Keys</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Use these keys to ingest transactions and stream real-time events to the ML pipeline.
                  </div>
                </div>
              </div>

              <div className="settings-form-body">
                {/* Live Key */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Production Secret Key</label>
                    <span className="badge badge-critical" style={{ fontSize: '10px' }}>DO NOT SHARE</span>
                  </div>
                  <div className="api-key-container">
                    <input
                      type={showLiveKey ? 'text' : 'password'}
                      className="input-field mono"
                      value={liveKey}
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowLiveKey(!showLiveKey)}
                    >
                      {showLiveKey ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(liveKey, 'Live API Key')}
                    >
                      {copiedKey === 'Live API Key' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Regenerate Key"
                      onClick={() => handleRegenerateKey('live')}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {/* Test Key */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Sandbox / Testing API Key</label>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>TEST MODE</span>
                  </div>
                  <div className="api-key-container">
                    <input
                      type="text"
                      className="input-field mono"
                      value={testKey}
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(testKey, 'Test API Key')}
                    >
                      {copiedKey === 'Test API Key' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Regenerate Key"
                      onClick={() => handleRegenerateKey('test')}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="alert alert-info" style={{ marginTop: '16px' }}>
                  <Shield size={16} />
                  <div style={{ fontSize: '12px' }}>
                    Include in header: <code>X-API-Key: {testKey.slice(0, 16)}...</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="card">
              <div className="settings-card-header">
                <div>
                  <div className="section-title">Razorpay Webhook Ingestion</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    RazorShield automatically analyzes webhook payloads in real time.
                  </div>
                </div>
                <span className="badge badge-success">Listening</span>
              </div>

              <div className="settings-form-body">
                <div className="form-group">
                  <label className="form-label">RazorShield Ingestion URL</label>
                  <div className="api-key-container">
                    <input
                      type="text"
                      className="input-field mono"
                      value="https://api.razorshield.ai/v1/webhooks/razorpay"
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard('https://api.razorshield.ai/v1/webhooks/razorpay', 'Webhook URL')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Webhook HMAC Secret</label>
                  <div className="api-key-container">
                    <input
                      type="text"
                      className="input-field mono"
                      value={webhookSecret}
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(webhookSecret, 'Webhook Secret')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Subscribed Payment Events</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {[
                      'payment.authorized',
                      'payment.failed',
                      'order.created',
                      'refund.speed_alert',
                      'dispute.created',
                    ].map(event => (
                      <span key={event} className="chip active" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Alert Notifications */}
      {activeTab === 'notifications' && (
        <div className="settings-tab-content animate-fade-in">
          <div className="settings-grid">
            <div className="card">
              <div className="settings-card-header">
                <div>
                  <div className="section-title">Alert Routing Channels</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Where should RazorShield dispatch urgent spike alerts and human approval requests?
                  </div>
                </div>
              </div>

              <div className="settings-form-body">
                {/* Slack */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">Slack Channel Webhook</div>
                    <div className="toggle-desc">Post real-time anomaly alerts into #merchant-risk-ops.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.slackAlerts}
                      onChange={(e) => setPolicyForm({ ...policyForm, slackAlerts: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                {/* Email */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">Email Notifications to Risk Lead</div>
                    <div className="toggle-desc">Send immediate email notifications for Critical (Risk &gt; 80) anomalies.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.emailAlerts}
                      onChange={(e) => setPolicyForm({ ...policyForm, emailAlerts: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                {/* PagerDuty */}
                <div className="toggle-item">
                  <div className="toggle-info">
                    <div className="toggle-title">PagerDuty Critical Incident Escalation</div>
                    <div className="toggle-desc">Page on-call risk engineer if velocity exceeds 8.0× baseline.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={policyForm.pagerDutyAlerts}
                      onChange={(e) => setPolicyForm({ ...policyForm, pagerDutyAlerts: e.target.checked })}
                    />
                    <span className="slider-switch" />
                  </label>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Merchant Webhook Endpoint</label>
                  <input
                    type="url"
                    className="input-field mono"
                    value={policyForm.webhookUrl}
                    onChange={(e) => setPolicyForm({ ...policyForm, webhookUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Audit & Compliance Digest */}
            <div className="card">
              <div className="settings-card-header">
                <div className="section-title">Compliance & Audit Digests</div>
                <span className="badge badge-neutral">SOC 2 / PCI DSS</span>
              </div>

              <div className="settings-form-body">
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                  RazorShield generates cryptographic tamper-evident audit trails for every automated policy decision and human intervention.
                </p>

                <div className="settings-feature-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="feature-icon-badge">
                      <Webhook size={18} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>Daily Cryptographic Risk Digest</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        SHA-256 hashed daily ledger sent at 00:00 UTC to compliance officers.
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-success">Automated</span>
                </div>

                <div style={{ marginTop: '20px', padding: '12px', borderRadius: '6px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Active Compliance Version
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                    RazorShield Audit Ledger v2.4 (HMAC-SHA256 Signed)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
