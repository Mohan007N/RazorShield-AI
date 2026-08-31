import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Shield, Activity, AlertTriangle, BarChart3, FileText,
  Zap
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LiveActivity from './pages/LiveActivity';
import InvestigationPage from './pages/Investigation';
import ModelPerformance from './pages/ModelPerformance';
import AuditTrail from './pages/AuditTrail';
import './App.css';

const navItems = [
  { path: '/', icon: Shield, label: 'Dashboard' },
  { path: '/activity', icon: Activity, label: 'Live Activity' },
  { path: '/investigation', icon: AlertTriangle, label: 'Investigation' },
  { path: '/model', icon: BarChart3, label: 'Model Performance' },
  { path: '/audit', icon: FileText, label: 'Audit Trail' },
];

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div style={{ padding: '0 20px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield size={20} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>RazorShield</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  AI Risk Manager
                </div>
              </div>
            </div>
          </div>

          <div style={{
            padding: '0 16px', marginBottom: '12px',
            fontSize: '0.65rem', fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Operations
          </div>

          <nav>
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={{
            position: 'absolute', bottom: '20px', left: '0', right: '0',
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.7rem', color: 'var(--color-text-muted)',
            }}>
              <Zap size={12} color="var(--color-success)" />
              System Online
            </div>
            <div style={{
              fontSize: '0.65rem', color: 'var(--color-text-muted)',
              marginTop: '4px',
            }}>
              Prototype · Synthetic Benchmark
            </div>
          </div>
        </aside>

        {/* Main Content */}
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
    </BrowserRouter>
  );
}

export default App;
