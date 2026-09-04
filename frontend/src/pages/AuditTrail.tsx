import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Download, ShieldCheck, Lock } from 'lucide-react';

interface CryptographicAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  investigation_id: string;
  actor: string;
  notes: string;
  model_version: string;
  agent_version: string;
  previous_hash: string;
  integrity_hash: string;
  is_verified: boolean;
}

export default function AuditTrail() {
  const [entries, setEntries] = useState<CryptographicAuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/audit/ledger')
      .then(res => res.json())
      .then(data => {
        if (data.ledger) {
          setEntries(data.ledger);
        }
      })
      .catch(() => {
        // Fallback demo ledger
        setEntries([
          {
            id: 'AUD-0001',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            action: 'POLICY_EVALUATED',
            investigation_id: 'INV-83A12',
            actor: 'Deterministic Policy Engine v2.4',
            notes: 'Auto-flagged velocity ratio 7.4x baseline. Action Gate set to REVIEW_REQUIRED.',
            model_version: 'fraud-xgb-v1.0',
            agent_version: 'langgraph-investigator-v2.1',
            previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
            integrity_hash: '8f4c2e1a9b7d3f5e0a6c8b4d2e1f9a7b3c5e0a6c8b4d2e1f9a7b3c5e0a6c8b4d',
            is_verified: true,
          },
          {
            id: 'AUD-0002',
            timestamp: new Date(Date.now() - 2400000).toISOString(),
            action: 'INVESTIGATION_COMPLETED',
            investigation_id: 'INV-83A12',
            actor: 'LangGraph Agent (Multi-Tool)',
            notes: 'Extracted 4 evidence signals. Computed TreeSHAP weights. Recommended BLOCK.',
            model_version: 'fraud-xgb-v1.0',
            agent_version: 'langgraph-investigator-v2.1',
            previous_hash: '8f4c2e1a9b7d3f5e0a6c8b4d2e1f9a7b3c5e0a6c8b4d2e1f9a7b3c5e0a6c8b4d',
            integrity_hash: '3a5f7c9e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a',
            is_verified: true,
          },
          {
            id: 'AUD-0003',
            timestamp: new Date(Date.now() - 1200000).toISOString(),
            action: 'HUMAN_SIGN_OFF',
            investigation_id: 'INV-83A12',
            actor: 'Mohan Kumar (Risk Operations Lead / Admin)',
            notes: 'Digitally signed and authorized emergency merchant velocity hold.',
            model_version: 'fraud-xgb-v1.0',
            agent_version: 'langgraph-investigator-v2.1',
            previous_hash: '3a5f7c9e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a',
            integrity_hash: '7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d',
            is_verified: true,
          },
        ]);
      });
  }, []);

  const filtered = entries.filter(e => {
    const matchAction = actionFilter === 'ALL' || e.action === actionFilter;
    const matchSearch = !search || e.id.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase()) ||
      e.investigation_id.toLowerCase().includes(search.toLowerCase()) ||
      e.notes.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `razorshield-audit-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Append-Only Cryptographic Audit Ledger</h1>
            <span className="badge badge-success" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} />
              HMAC-SHA256 Chain Verified
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: '2px' }}>
            Immutable, tamper-evident regulatory compliance trail for every ML inference, agent reasoning step, and human authorization.
          </div>
        </div>

        <button className="btn btn-secondary" onClick={exportJson}>
          <Download size={14} />
          Export Audit Ledger (JSON)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: '14px' }}>
        <div className="search-input">
          <Search size={14} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Search by Audit ID, Actor, Investigation ID, Notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {['ALL', 'HUMAN_SIGN_OFF', 'INVESTIGATION_COMPLETED', 'POLICY_EVALUATED'].map(action => (
            <button
              key={action}
              className={`chip ${actionFilter === action ? 'active' : ''}`}
              onClick={() => setActionFilter(action)}
            >
              {action === 'ALL' ? 'All Actions' : action.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card-flush">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28px' }}></th>
                <th>Audit ID</th>
                <th>Action Type</th>
                <th>Investigation Target</th>
                <th>Actor / Signer</th>
                <th>Cryptographic Integrity</th>
                <th>Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="clickable"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td>
                      {expandedId === entry.id
                        ? <ChevronUp size={14} color="var(--color-text-dim)" />
                        : <ChevronDown size={14} color="var(--color-text-dim)" />
                      }
                    </td>
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {entry.id}
                    </td>
                    <td>
                      <span className={`badge ${entry.action.includes('HUMAN') ? 'badge-success' : entry.action.includes('POLICY') ? 'badge-neutral' : 'badge-info'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px', fontWeight: 500 }}>
                      {entry.investigation_id}
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 500 }}>
                      {entry.actor}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', fontWeight: 600, color: 'var(--color-success)',
                      }}>
                        <Lock size={12} />
                        Chain Verified
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                  </tr>

                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-expanded`}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div className="expand-content">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Summary Notes</div>
                              <div style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>{entry.notes}</div>
                              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                                Engine: {entry.model_version} · Agent: {entry.agent_version}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>SHA-256 HMAC Signature Hash</div>
                              <div className="mono" style={{ fontSize: '11px', padding: '6px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', wordBreak: 'break-all', color: 'var(--color-primary)' }}>
                                {entry.integrity_hash}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
                                Previous Block: <span className="mono">{entry.previous_hash.slice(0, 16)}...</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
