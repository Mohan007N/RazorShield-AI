import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Shield, Activity, AlertTriangle, BarChart3, FileText, ChevronDown,
  Bell, LayoutDashboard
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LiveActivity from './pages/LiveActivity';
import InvestigationPage from './pages/Investigation';
import ModelPerformance from './pages/ModelPerformance';
import AuditTrail from './pages/AuditTrail';
import './App.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Overview' },
  { path: '/activity', icon: Activity, label: 'Live Transactions' },
  { path: '/investigation', icon: AlertTriangle, label: 'Investigations' },
  { path: '/model', icon: BarChart3, label: 'Model Performance' },
  { path: '/audit', icon: FileText, label: 'Audit Trail' },
];

function Breadcrumb() {
  const location = useLocation();
  const titles: Record<string, string> = {
    '/': 'Overview',
    '/activity': 'Live Transactions',
    '/investigation': 'Investigations',
    '/model': 'Model Performance',
    '/audit': 'Audit Trail',
  };
  const current = titles[location.pathname] || 'RazorShield';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>RazorShield</span>
      <span style={{ color: 'var(--color-text-dim)' }}>/</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{current}</span>
    </div>
  );
}

function TopNavbar() {
  return (
    <header className="top-navbar">
      <Breadcrumb />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Test Mode Badge */}
        <span
          style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
            fontWeight: 600, letterSpacing: '0.03em',
            background: 'var(--color-warning-bg)', color: 'var(--color-warning)',
            border: '1px solid var(--color-warning-border)',
          }}
        >
          TEST MODE
        </span>

        {/* Notifications */}
        <button className="btn btn-ghost" style={{ padding: '6px', position: 'relative' }}>
          <Bell size={16} />
        </button>

        {/* Merchant Selector */}
        <button className="btn btn-secondary" style={{ gap: '4px', padding: '4px 10px' }}>
          <span style={{ fontSize: '12px' }}>ABC Electronics</span>
          <ChevronDown size={13} />
        </button>

        {/* User */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 8px 3px 4px', borderRadius: '16px',
          border: '1px solid var(--color-border)', cursor: 'pointer',
        }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700,
          }}>
            MK
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Mohan
          </span>
          <ChevronDown size={12} color="var(--color-text-dim)" />
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', background: 'var(--color-primary)',
                borderRadius: '6px', display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Shield size={15} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.2 }}>
                  RazorShield
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  Risk Operations
                </div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-success)', fontWeight: 500, fontSize: '12px' }}>
              <span className="status-dot status-dot-success pulse-dot" />
              System Healthy
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
              XGBoost v1.0 · Dev
            </div>
          </div>
        </aside>

        <div className="main-wrapper">
          <TopNavbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/activity" element={<LiveActivity />} />
              <Route path="/investigation" element={<InvestigationPage />} />
              <Route path="/model" element={<ModelPerformance />} />
              <Route path="/audit" element={<AuditTrail />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
