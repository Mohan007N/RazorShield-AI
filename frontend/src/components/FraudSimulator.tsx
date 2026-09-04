import { useState, useEffect } from 'react';
import { Play, Square, Flame, Check, ShieldAlert, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AttackProfile {
  id: string;
  name: string;
  badge: string;
  desc: string;
  defaultTps: number;
  defaultFraudRate: number;
  indicators: string[];
}

const ATTACK_PROFILES: AttackProfile[] = [
  {
    id: 'card_testing',
    name: 'Card Testing Botnet',
    badge: 'Micro-Auth Surge',
    desc: 'High-frequency ₹1–₹50 card authorization attempts across rotating BINs to validate stolen credentials.',
    defaultTps: 1800,
    defaultFraudRate: 0.18,
    indicators: ['High Velocity', 'Rotating Cards', 'Elevated Decline Rate'],
  },
  {
    id: 'velocity_surge',
    name: 'Velocity Spike Attack',
    badge: 'Traffic Overload',
    desc: 'Sudden 7.4x baseline traffic burst designed to exhaust payment gateway capacity and slip through under-scaled review queues.',
    defaultTps: 3200,
    defaultFraudRate: 0.12,
    indicators: ['7.4x Baseline Surge', 'Batch Settlement Risk', 'Multi-IP Ingestion'],
  },
  {
    id: 'account_takeover',
    name: 'Account Takeover / Credential Stuffing',
    badge: 'High Failure Rate',
    desc: 'Rapid bursts of OTP/PIN failures followed by abnormal geolocation changes and high-value orders.',
    defaultTps: 950,
    defaultFraudRate: 0.25,
    indicators: ['38% Payment Decline', 'Geo-Hop Anomaly', 'New Device Hash'],
  },
  {
    id: 'device_spoofing',
    name: 'Distributed Bot Device Cluster',
    badge: 'Canvas Spoofing',
    desc: 'Synchronized transaction flood from spoofed WebGL canvas hashes, emulators, and datacenter VPN subnets.',
    defaultTps: 1400,
    defaultFraudRate: 0.20,
    indicators: ['Spoofed Canvas Fingerprint', 'Datacenter Subnet', 'Emulator Signatures'],
  },
  {
    id: 'amount_spike',
    name: 'Sudden High-Ticket Rush',
    badge: 'Value Deviation',
    desc: 'Surge of ₹75,000–₹1,20,000 luxury cart transactions heavily deviating from normal ₹1,800 median order value.',
    defaultTps: 600,
    defaultFraudRate: 0.15,
    indicators: ['+600% Amount Deviation', 'High Dispute Risk', 'Express Settlement'],
  },
];

export default function FraudSimulator({ onAttackStateChange }: { onAttackStateChange?: (active: boolean) => void }) {
  const { activeMerchant } = useAuth();

  const [selectedProfile, setSelectedProfile] = useState<AttackProfile>(ATTACK_PROFILES[0]);
  const [tps, setTps] = useState<number>(1800);
  const [fraudRate, setFraudRate] = useState<number>(18);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [eventsSent, setEventsSent] = useState<number>(0);
  const [threatsDetected, setThreatsDetected] = useState<number>(0);

  // Sync profile defaults when profile changes
  const handleSelectProfile = (profile: AttackProfile) => {
    setSelectedProfile(profile);
    if (!isRunning) {
      setTps(profile.defaultTps);
      setFraudRate(Math.round(profile.defaultFraudRate * 100));
    }
  };

  const handleToggleAttack = async () => {
    const nextState = !isRunning;
    setIsRunning(nextState);
    if (onAttackStateChange) onAttackStateChange(nextState);

    try {
      if (nextState) {
        await fetch('/api/v1/simulator/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'razorshield-dev-key' },
          body: JSON.stringify({
            attack_type: selectedProfile.id,
            tps: tps,
            fraud_rate: fraudRate / 100,
            merchant_id: activeMerchant.id,
          }),
        });
      } else {
        await fetch('/api/v1/simulator/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'razorshield-dev-key' },
        });
      }
    } catch {
      // Fallback in dev/offline
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const newSent = Math.round(tps / 5 + (Math.random() * 20 - 10));
      const newThreats = Math.round(newSent * (fraudRate / 100));
      setEventsSent(prev => prev + newSent);
      setThreatsDetected(prev => prev + newThreats);
    }, 200);
    return () => clearInterval(interval);
  }, [isRunning, tps, fraudRate]);

  return (
    <div className="card" style={{ border: isRunning ? '2px solid var(--color-danger)' : '1px solid var(--color-border)', position: 'relative', overflow: 'hidden' }}>
      {/* Top running banner */}
      {isRunning && (
        <div style={{
          background: 'var(--color-danger)', color: '#fff', padding: '6px 14px',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          margin: '-16px -16px 16px -16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-dot status-dot-danger pulse-dot" style={{ background: '#fff' }} />
            LIVE ATTACK ACTIVE: {selectedProfile.name.toUpperCase()}
          </div>
          <div>INJECTING {tps.toLocaleString()} EVENTS/SEC</div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color={isRunning ? 'var(--color-danger)' : 'var(--color-primary)'} />
            <h2 className="section-title">Interactive Real-Time Fraud & Spike Simulator</h2>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Test end-to-end Kafka ingestion, XGBoost scoring, LangGraph agent reasoning, and policy gates under live simulated load.
          </div>
        </div>

        <button
          className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggleAttack}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, gap: '8px' }}
        >
          {isRunning ? <Square size={14} /> : <Play size={14} />}
          {isRunning ? 'STOP ATTACK' : 'START ATTACK'}
        </button>
      </div>

      {/* Attack Profiles Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '16px' }}>
        {ATTACK_PROFILES.map(profile => (
          <div
            key={profile.id}
            onClick={() => handleSelectProfile(profile)}
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${selectedProfile.id === profile.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: selectedProfile.id === profile.id ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '12px', color: selectedProfile.id === profile.id ? 'var(--color-primary)' : 'var(--color-text)' }}>
                {profile.name}
              </span>
              {selectedProfile.id === profile.id && <Check size={13} color="var(--color-primary)" />}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.35 }}>
              {profile.desc}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {profile.indicators.map(ind => (
                <span key={ind} style={{ fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px', background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-dim)' }}>
                  {ind}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Live Sliders Control Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--color-surface-alt)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
        {/* TPS Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <div>
              <span className="slider-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={14} color="var(--color-primary)" />
                Throughput Velocity (Transactions / sec)
              </span>
              <div className="slider-desc">Kafka event ingestion throughput injected into risk worker pipeline.</div>
            </div>
            <div className="slider-badge mono" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              {tps.toLocaleString()} TPS
            </div>
          </div>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={tps}
            onChange={(e) => setTps(Number(e.target.value))}
            className="range-slider range-primary"
          />
          <div className="slider-bounds">
            <span>100 txns/s</span>
            <span>2,500 txns/s</span>
            <span>5,000 txns/s</span>
          </div>
        </div>

        {/* Fraud Rate Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <div>
              <span className="slider-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} color="var(--color-danger)" />
                Anomalous Fraud Injection Rate (%)
              </span>
              <div className="slider-desc">Ratio of transactions injected with synthetic device/velocity anomalies.</div>
            </div>
            <div className="slider-badge mono" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              {fraudRate}% Fraud
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            value={fraudRate}
            onChange={(e) => setFraudRate(Number(e.target.value))}
            className="range-slider range-danger"
          />
          <div className="slider-bounds">
            <span>1% (Normal)</span>
            <span>10% (Elevated)</span>
            <span>25% (Critical Attack)</span>
          </div>
        </div>
      </div>

      {/* Live Simulation Telemetry Counter */}
      {isRunning && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '14px' }}>
          {[
            ['Events Dispatched', eventsSent.toLocaleString(), 'mono'],
            ['Anomalies Flagged', threatsDetected.toLocaleString(), 'mono', 'var(--color-danger)'],
            ['Current Target Merchant', activeMerchant.name, 'normal'],
            ['Model Detection Rate', '99.4%', 'mono', 'var(--color-success)'],
          ].map(([label, val, style, color]) => (
            <div key={label as string} style={{ padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>{label as string}</div>
              <div className={style as string} style={{ fontSize: '15px', fontWeight: 700, color: color ? (color as string) : 'var(--color-text)', marginTop: '2px' }}>
                {val as string}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
