import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { api, type ModelMetrics } from '../services/api';

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = () => {
    setLoading(true);
    setError('');
    api.getModelMetrics()
      .then(data => {
        if ('error' in data) {
          setError((data as any).error);
        } else {
          setMetrics(data);
        }
      })
      .catch(() => setError('Failed to fetch metrics.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMetrics(); }, []);

  const best = metrics?.results?.find(r => r.model_name === metrics.best_model);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title" style={{ marginBottom: '16px' }}>Model Performance</h1>
        <div className="card" style={{ padding: '24px' }}>
          <div className="skeleton skeleton-text" style={{ width: '200px' }} />
          <div className="skeleton skeleton-text" style={{ width: '160px' }} />
          <div className="skeleton skeleton-box" style={{ marginTop: '12px' }} />
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title" style={{ marginBottom: '16px' }}>Model Performance</h1>
        <div className="alert alert-warning">
          <AlertCircle size={16} />
          <div>
            <strong>Evaluation data unavailable.</strong>
            <div style={{ marginTop: '2px' }}>
              {error || 'Run the evaluation pipeline to generate metrics.'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadMetrics} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const f1Data = metrics.results.map(r => ({
    name: r.model_name,
    f1: +(r.f1 * 100).toFixed(1),
    precision: +(r.precision * 100).toFixed(1),
    recall: +(r.recall * 100).toFixed(1),
  }));

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Model Performance</h1>
          <div className="page-subtitle">
            Model {metrics.model_version} · Evaluated {new Date(metrics.evaluation_date).toLocaleDateString()}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={loadMetrics}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Synthetic benchmark callout */}
      {metrics.is_synthetic_benchmark && (
        <div className="alert alert-info" style={{ marginBottom: '12px' }}>
          <AlertCircle size={15} />
          <span style={{ fontSize: '13px' }}>
            <strong>Synthetic benchmark.</strong> Results reflect model performance on engineered evaluation data, not live production traffic.
          </span>
        </div>
      )}

      {/* KPIs */}
      {best && (
        <div className="kpi-strip" style={{ marginBottom: '16px' }}>
          <div className="kpi-item">
            <div className="kpi-label">F1 Score</div>
            <div className="kpi-value">{(best.f1 * 100).toFixed(1)}</div>
            <div className="kpi-sub">{best.model_name}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Precision</div>
            <div className="kpi-value">{(best.precision * 100).toFixed(1)}</div>
            <div className="kpi-sub">True positive accuracy</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Recall</div>
            <div className="kpi-value">{(best.recall * 100).toFixed(1)}</div>
            <div className="kpi-sub">Fraud detection rate</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">PR-AUC</div>
            <div className="kpi-value">{(best.pr_auc * 100).toFixed(1)}</div>
            <div className="kpi-sub">Area under PR curve</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">FP Rate</div>
            <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
              {(best.false_positive_rate * 100).toFixed(2)}%
            </div>
            <div className="kpi-sub">${best.false_positive_cost.toLocaleString()} estimated cost</div>
          </div>
        </div>
      )}

      {/* Two-column: Chart + Confusion Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '12px', marginBottom: '16px' }}>
        {/* F1 Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: '12px' }}>Model Comparison (F1)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={f1Data} layout="vertical" margin={{ top: 0, right: 10, left: 50, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} fontSize={11} tickLine={false} />
              <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip
                contentStyle={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
                formatter={(val: any) => [`${val}%`]}
              />
              <Bar dataKey="f1" radius={[0, 3, 3, 0]} barSize={16}>
                {f1Data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.name === metrics.best_model ? '#1d4ed8' : '#d1d5db'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Confusion Matrix */}
        {best && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: '12px' }}>Confusion Matrix</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', color: 'var(--color-text-muted)' }}></th>
                  <th style={{ padding: '6px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Pred. Legit</th>
                  <th style={{ padding: '6px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Pred. Fraud</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '6px', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actual Legit</td>
                  <td style={{
                    padding: '10px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
                    fontWeight: 700, fontSize: '14px',
                  }}>
                    {best.true_negatives.toLocaleString()}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-success)' }}>TN</div>
                  </td>
                  <td style={{
                    padding: '10px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
                    fontWeight: 700, fontSize: '14px',
                  }}>
                    {best.false_positives.toLocaleString()}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-danger)' }}>FP</div>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actual Fraud</td>
                  <td style={{
                    padding: '10px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)',
                    fontWeight: 700, fontSize: '14px',
                  }}>
                    {best.false_negatives.toLocaleString()}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-warning)' }}>FN</div>
                  </td>
                  <td style={{
                    padding: '10px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
                    fontWeight: 700, fontSize: '14px',
                  }}>
                    {best.true_positives.toLocaleString()}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-success)' }}>TP</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Set Info + Cost */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: '8px' }}>Held-out Test Set</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            {[
              ['Total samples', metrics.test_set.size.toLocaleString()],
              ['Positive (fraud)', metrics.test_set.positive.toLocaleString()],
              ['Negative (legit)', metrics.test_set.negative.toLocaleString()],
              ['Date range', metrics.test_set.date_range],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{k}</div>
                <div style={{ fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-title" style={{ marginBottom: '8px' }}>Cost Assumptions</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            FP review cost: <strong>${metrics.cost_assumption.false_positive_review_cost}</strong> per case<br />
            {metrics.cost_assumption.note}
          </div>
        </div>
      </div>

      {/* Full Results Table */}
      <div className="card-flush">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div className="section-title">All Model Results</div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>F1</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>PR-AUC</th>
                <th>TP</th>
                <th>FP</th>
                <th>FN</th>
                <th>TN</th>
                <th>FP Rate</th>
                <th>FP Cost</th>
              </tr>
            </thead>
            <tbody>
              {metrics.results.map(r => (
                <tr key={r.model_name} style={{ fontWeight: r.model_name === metrics.best_model ? 600 : 400 }}>
                  <td style={{ fontWeight: 600, color: r.model_name === metrics.best_model ? 'var(--color-primary)' : 'var(--color-text)' }}>
                    {r.model_name}
                    {r.model_name === metrics.best_model && (
                      <span className="badge badge-info" style={{ marginLeft: '6px' }}>Best</span>
                    )}
                  </td>
                  <td className="tabular">{(r.f1 * 100).toFixed(1)}</td>
                  <td className="tabular">{(r.precision * 100).toFixed(1)}</td>
                  <td className="tabular">{(r.recall * 100).toFixed(1)}</td>
                  <td className="tabular">{(r.pr_auc * 100).toFixed(1)}</td>
                  <td className="tabular">{r.true_positives.toLocaleString()}</td>
                  <td className="tabular" style={{ color: 'var(--color-danger)' }}>{r.false_positives.toLocaleString()}</td>
                  <td className="tabular" style={{ color: 'var(--color-warning)' }}>{r.false_negatives.toLocaleString()}</td>
                  <td className="tabular">{r.true_negatives.toLocaleString()}</td>
                  <td className="tabular">{(r.false_positive_rate * 100).toFixed(2)}%</td>
                  <td className="tabular">${r.false_positive_cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
