import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2, Zap, UserCheck } from 'lucide-react';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginAsPersona } = useAuth();

  const [email, setEmail] = useState('mohan.k@abcelectronics.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your merchant email address.');
      return;
    }
    setError('');
    setLoading(true);

    setTimeout(() => {
      login(email, password);
      setLoading(false);
      navigate('/');
    }, 450);
  };

  const handlePersonaClick = (personaId: string) => {
    setLoading(true);
    setTimeout(() => {
      loginAsPersona(personaId);
      setLoading(false);
      navigate('/');
    }, 250);
  };

  return (
    <div className="login-container">
      {/* Dynamic Background Glow */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className="login-card-wrapper animate-fade-in">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-badge">
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <div className="login-brand-title">RazorShield</div>
            <div className="login-brand-subtitle">AI Risk Manager</div>
          </div>
          <div className="login-status-pill">
            <span className="status-dot status-dot-success pulse-dot" />
            <span>XGBoost v1.0 Online</span>
          </div>
        </div>

        {/* Card */}
        <div className="card login-card">
          <div className="login-form-intro">
            <h1 className="login-heading">Merchant Risk Portal</h1>
            <p className="login-subheading">
              Sign in to monitor live transactions, inspect velocity anomalies, and authorize autonomous fraud defense actions.
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">
                Merchant Email
              </label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="email-input"
                  type="email"
                  className="input-field"
                  placeholder="name@merchant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="password-input">
                  Password
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Demo environment: Simply click Sign In or choose a 1-Click Demo Persona below.'); }} style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="custom-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember this workspace</span>
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                Session: 30 days
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ padding: '10px 16px', fontSize: '14px', fontWeight: 600 }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner" /> Authenticating...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Sign in to Risk Dashboard <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="login-persona-section">
            <div className="login-divider">
              <span>OR 1-CLICK DEMO LOGIN (FOR JUDGES)</span>
            </div>

            <div className="persona-grid">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  className="persona-card"
                  onClick={() => handlePersonaClick(persona.id)}
                  disabled={loading}
                >
                  <div className="persona-avatar">{persona.initials}</div>
                  <div className="persona-info">
                    <div className="persona-name">{persona.name}</div>
                    <div className="persona-role">{persona.role}</div>
                    <div className="persona-merchant">{persona.merchantName}</div>
                  </div>
                  <UserCheck size={16} className="persona-icon" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Trust Badges */}
        <div className="login-trust-footer">
          <div className="trust-item">
            <CheckCircle2 size={13} color="var(--color-success)" />
            <span>256-bit TLS Encrypted</span>
          </div>
          <div className="trust-item">
            <Zap size={13} color="var(--color-primary)" />
            <span>XGBoost & SHAP Explainability</span>
          </div>
          <div className="trust-item">
            <Shield size={13} color="#6366f1" />
            <span>SOC-2 Type II Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
