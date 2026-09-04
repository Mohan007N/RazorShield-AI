import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Shield, Activity, AlertTriangle, BarChart3, FileText, ChevronDown,
  Bell, LayoutDashboard, Sliders, LogOut, Check,
  Sparkles, ExternalLink, Zap
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import LiveActivity from './pages/LiveActivity';
import InvestigationPage from './pages/Investigation';
import ModelPerformance from './pages/ModelPerformance';
import AuditTrail from './pages/AuditTrail';
import Settings from './pages/Settings';
import Login from './pages/Login';
import './App.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Overview' },
  { path: '/activity', icon: Activity, label: 'Live Transactions' },
  { path: '/investigation', icon: AlertTriangle, label: 'Investigations' },
  { path: '/model', icon: BarChart3, label: 'Model Performance' },
  { path: '/audit', icon: FileText, label: 'Audit Trail' },
  { path: '/settings', icon: Sliders, label: 'Profile & Settings' },
];

function Breadcrumb() {
  const location = useLocation();
  const titles: Record<string, string> = {
    '/': 'Overview',
    '/activity': 'Live Transactions',
    '/investigation': 'Investigations',
    '/model': 'Model Performance',
    '/audit': 'Audit Trail',
    '/settings': 'Merchant Profile & Risk Settings',
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
  const navigate = useNavigate();
  const { user, activeMerchant, allMerchants, switchMerchant, logout } = useAuth();

  const [showMerchantMenu, setShowMerchantMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'notif_1',
      title: 'Velocity spike detected (6.8× baseline)',
      merchant: 'merchant_001',
      time: '2m ago',
      severity: 'critical',
      unread: true,
    },
    {
      id: 'notif_2',
      title: 'Device spoofing pattern flagged on UPI',
      merchant: 'merchant_001',
      time: '14m ago',
      severity: 'high',
      unread: true,
    },
    {
      id: 'notif_3',
      title: 'Settlement batch automatically protected',
      merchant: 'merchant_004',
      time: '1h ago',
      severity: 'info',
      unread: false,
    },
  ]);

  const merchantRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (merchantRef.current && !merchantRef.current.contains(event.target as Node)) {
        setShowMerchantMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="top-navbar">
      <Breadcrumb />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Real-time Engine Status Pill */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '3px 8px', borderRadius: '12px', fontSize: '11px',
            background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)', fontWeight: 500,
          }}
        >
          <Zap size={12} color="var(--color-primary)" />
          <span>8.4ms Inference</span>
        </div>

        {/* Test Mode Badge */}
        <span
          style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
            fontWeight: 600, letterSpacing: '0.03em',
            background: 'var(--color-warning-bg)', color: 'var(--color-warning)',
            border: '1px solid var(--color-warning-border)',
          }}
        >
          SANDBOX
        </span>

        {/* Notifications Popover */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px', position: 'relative' }}
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: 'var(--color-danger)', border: '2px solid var(--color-surface)',
                }}
              />
            )}
          </button>

          {showNotifMenu && (
            <div className="dropdown-menu notifications-popover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontWeight: 700, fontSize: '12px' }}>Live Anomaly Alerts ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', padding: '2px 6px', height: 'auto' }}
                    onClick={markAllRead}
                  >
                    Mark read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.unread ? 'unread' : ''}`}
                    onClick={() => {
                      setShowNotifMenu(false);
                      navigate('/investigation');
                    }}
                  >
                    <span className={`status-dot status-dot-${n.severity === 'critical' ? 'danger' : n.severity === 'high' ? 'warning' : 'info'}`} style={{ marginTop: '5px' }} />
                    <div style={{ flex: 1 }}>
                      <div className="notif-title">{n.title}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                        <span className="mono">{n.merchant}</span>
                        <span>{n.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="dropdown-footer" style={{ textAlign: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
                  onClick={() => {
                    setShowNotifMenu(false);
                    navigate('/investigation');
                  }}
                >
                  View All Investigations <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Merchant Switcher Dropdown */}
        <div ref={merchantRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            style={{ gap: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600 }}
            onClick={() => setShowMerchantMenu(!showMerchantMenu)}
          >
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeMerchant.name}
            </span>
            <ChevronDown size={13} />
          </button>

          {showMerchantMenu && (
            <div className="dropdown-menu">
              <div className="dropdown-header">Switch Merchant Workspace</div>
              {allMerchants.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`dropdown-item ${m.id === activeMerchant.id ? 'active' : ''}`}
                  onClick={() => {
                    switchMerchant(m.id);
                    setShowMerchantMenu(false);
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.id} · {m.tier}</div>
                  </div>
                  {m.id === activeMerchant.id && <Check size={14} color="var(--color-primary)" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '3px 8px 3px 4px', borderRadius: '16px',
              border: '1px solid var(--color-border)', cursor: 'pointer',
              background: 'var(--color-surface)',
            }}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div
              style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
              }}
            >
              {user?.initials || 'MK'}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
              {user?.name?.split(' ')[0] || 'Risk Lead'}
            </span>
            <ChevronDown size={12} color="var(--color-text-dim)" />
          </div>

          {showUserMenu && (
            <div className="dropdown-menu" style={{ width: '240px' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-light)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{user?.email}</div>
                <div style={{ marginTop: '6px' }}>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{user?.role}</span>
                </div>
              </div>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
              >
                <Sliders size={14} />
                <span>Profile & Risk Settings</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/login');
                }}
              >
                <Sparkles size={14} />
                <span>Switch Persona (Demo)</span>
              </button>

              <div className="dropdown-footer">
                <button
                  type="button"
                  className="dropdown-item"
                  style={{ color: 'var(--color-danger)', padding: '4px 0' }}
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MainLayout() {
  const { isAuthenticated, activeMerchant } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              borderRadius: '6px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
            }}>
              <Shield size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.2 }}>
                RazorShield
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                AI Risk Operations
              </div>
            </div>
          </div>
        </div>

        {/* Active Merchant Workspace Mini-badge */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-surface-alt)' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Workspace
          </div>
          <div className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginTop: '1px' }}>
            {activeMerchant.name}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontWeight: 600, fontSize: '12px' }}>
            <span className="status-dot status-dot-success pulse-dot" />
            XGBoost Engine Online
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
            v1.0-prod · Zero False Positives
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
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
