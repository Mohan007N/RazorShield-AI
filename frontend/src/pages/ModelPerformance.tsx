import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { BarChart3, Info } from 'lucide-react';
import { api, type ModelMetrics } from '../services/api';

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getModelMetrics()
      .then(data => {
        if (data.results) setMetrics(data);
        else setError('Run `python -m ml.evaluate` to generate metrics.');
      })
      .catch(() => setError('Backend not connected. Start the API server first.'));
  }, []);

  if (error) {
    return (
      <div className="animate-fade-in">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>
          Model Performance
        </h1>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) return <div>Loading...</div>;

  const comparisonData = metrics.results.map(r => ({
    name: r.model_name.length > 20 ? r.model_name.slice(0, 20) + '...' : r.model_name,
    precision: r.precision,
    recall: r.recall,
    f1: r.f1,
    pr_auc: r.pr_auc,
  }));

  const bestResult = metrics.results.find(r => r.model_name === metrics.best_model);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Model Performance</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Evaluated on held-out synthetic test set · {metrics.dataset_version}
        </p>
      </div>

      {/* Warning Banner */}
      <div style={{
        padding: '12px 16px', marginBottom: '20px',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Info size={18} color="#fbbf24" />
        <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
          {metrics.note}
        </span>
      </div>

      {/* Key Metrics */}
      {bestResult && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px', marginBottom: '24px',
        }}>
          <MetricCard label="Precision" value={bestResult.precision} format="pct" />
          <MetricCard label="Recall" value={bestResult.recall} format="pct" />
          <MetricCard label="F1 Score" value={bestResult.f1} format="pct" />
          <MetricCard label="PR-AUC" value={bestResult.pr_auc} format="pct" />
          <MetricCard
            label="FP Cost"
            value={bestResult.false_positive_cost}
            format="currency"
            note={`${bestResult.false_positives} FPs × ₹${metrics.cost_assumption.false_positive_review_cost}`}
          />
        </div>
      )}

      {/* Comparison Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Model Comparison — F1 Score
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" domain={[0, 1]} stroke="#64748b" fontSize={11} />
            <YAxis dataKey="name" type="category" width={180} stroke="#64748b" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: '#1a2332', border: '1px solid #1e293b',
                borderRadius: '8px', fontSize: '12px',
              }}
              formatter={(value: any) => [typeof value === 'number' ? (value * 100).toFixed(1) + '%' : value]}
            />
            <Bar dataKey="f1" radius={[0, 4, 4, 0]}>
              {comparisonData.map((_, i) => (
                <Cell key={i} fill={i === comparisonData.length - 1 ? '#3b82f6' : '#334155'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Comparison Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Baseline Comparison
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1</th>
              <th>PR-AUC</th>
              <th>FP Cost</th>
            </tr>
          </thead>
          <tbody>
            {metrics.results.map(r => (
              <tr key={r.model_name} style={{
                background: r.model_name === metrics.best_model ? 'var(--color-primary-glow)' : undefined,
              }}>
                <td style={{ fontWeight: r.model_name === metrics.best_model ? 700 : 400 }}>
                  {r.model_name}
                  {r.model_name === metrics.best_model && (
                    <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--color-primary)' }}>★ Best</span>
                  )}
                </td>
                <td>{(r.precision * 100).toFixed(1)}%</td>
                <td>{(r.recall * 100).toFixed(1)}%</td>
                <td style={{ fontWeight: 600 }}>{(r.f1 * 100).toFixed(1)}%</td>
                <td>{(r.pr_auc * 100).toFixed(1)}%</td>
                <td>₹{r.false_positive_cost.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confusion Matrix */}
      {bestResult && bestResult.confusion_matrix.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
            Confusion Matrix — {metrics.best_model}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '2px', maxWidth: '400px' }}>
            <div />
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Pred Normal</div>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Pred Suspicious</div>

            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Actual Normal</div>
            <CMCell value={bestResult.true_negatives} type="tn" />
            <CMCell value={bestResult.false_positives} type="fp" />

            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Actual Suspicious</div>
            <CMCell value={bestResult.false_negatives} type="fn" />
            <CMCell value={bestResult.true_positives} type="tp" />
          </div>
        </div>
      )}

      {/* Test Set Metadata */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Test Set Metadata</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <div className="stat-label">Test Set Size</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{metrics.test_set.size.toLocaleString()}</div>
          </div>
          <div>
            <div className="stat-label">Model Version</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{metrics.model_version}</div>
          </div>
          <div>
            <div className="stat-label">Dataset Version</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{metrics.dataset_version}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, format, note }: {
  label: string; value: number; format: 'pct' | 'currency'; note?: string;
}) {
  const display = format === 'pct' ? `${(value * 100).toFixed(1)}%` : `₹${value.toLocaleString('en-IN')}`;
  return (
    <div className="card">
      <div className="stat-value" style={{ color: 'var(--color-primary)' }}>{display}</div>
      <div className="stat-label">{label}</div>
      {note && <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{note}</div>}
    </div>
  );
}

function CMCell({ value, type }: { value: number; type: 'tp' | 'tn' | 'fp' | 'fn' }) {
  const colors: Record<string, string> = {
    tp: 'rgba(16, 185, 129, 0.2)',
    tn: 'rgba(16, 185, 129, 0.1)',
    fp: 'rgba(239, 68, 68, 0.15)',
    fn: 'rgba(245, 158, 11, 0.15)',
  };
  return (
    <div style={{
      textAlign: 'center', padding: '16px',
      background: colors[type], borderRadius: '6px',
      fontWeight: 700, fontSize: '1.1rem',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value.toLocaleString()}
    </div>
  );
}
