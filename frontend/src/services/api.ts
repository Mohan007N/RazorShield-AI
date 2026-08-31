// RazorShield AI — API Service
const API_BASE = '/api/v1';

export interface Alert {
  id: string;
  merchant_id: string;
  alert_type: string;
  risk_score: number;
  anomaly_score: number;
  spike_ratio: number;
  current_txn_rate: number;
  baseline_txn_rate: number;
  risk_level: string;
  summary: string;
  status: string;
  model_version: string;
  created_at: string;
  transactions_generated?: number;
  suspicious_count?: number;
}

export interface Investigation {
  id: string;
  alert_id: string;
  merchant_id: string;
  status: string;
  risk_score: number;
  confidence: number | null;
  summary: string | null;
  recommendation: string | null;
  recommendation_action: string | null;
  tools_called: string[];
  tool_latencies: Record<string, number>;
  errors: string[];
  evidence: Evidence[];
}

export interface Evidence {
  source_tool: string;
  field: string;
  value: string;
  confidence: number;
}

export interface PolicyDecision {
  allowed_action: string;
  requires_human_approval: boolean;
  reasoning: string;
  risk_level: string;
}

export interface ActionGate {
  gate_id: string;
  action: string;
  is_authorized: boolean;
  requires_human_review: boolean;
  human_review_status: string;
  reasoning: string;
  timestamp: string;
}

export interface InvestigationResult {
  investigation: Investigation;
  policy_decision: PolicyDecision;
  action_gate: ActionGate;
  audit: Record<string, unknown>;
  latency_ms: number;
}

export interface ModelMetrics {
  evaluation_date: string;
  model_version: string;
  dataset_version: string;
  is_synthetic_benchmark: boolean;
  note: string;
  test_set: {
    size: number;
    positive: number;
    negative: number;
    date_range: string;
  };
  cost_assumption: {
    false_positive_review_cost: number;
    note: string;
  };
  results: ModelResult[];
  best_model: string;
}

export interface ModelResult {
  model_name: string;
  precision: number;
  recall: number;
  f1: number;
  pr_auc: number;
  true_positives: number;
  true_negatives: number;
  false_positives: number;
  false_negatives: number;
  false_positive_rate: number;
  false_positive_cost: number;
  confusion_matrix: number[][];
}

export interface SpikeSimulation {
  merchant_id: string;
  normal_txn_count: number;
  spike_txn_count: number;
  spike_duration_minutes: number;
  suspicious_ratio: number;
}

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-API-Key': 'razorshield-dev-key',
};

export const api = {
  // Alerts
  async getAlerts(): Promise<{ alerts: Alert[] }> {
    const res = await fetch(`${API_BASE}/alerts`, { headers });
    return res.json();
  },

  async getAlert(alertId: string): Promise<Alert> {
    const res = await fetch(`${API_BASE}/alerts/${alertId}`, { headers });
    return res.json();
  },

  // Investigation
  async investigateAlert(alertId: string): Promise<InvestigationResult> {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/investigate`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },

  // Simulation
  async simulateSpike(params: SpikeSimulation): Promise<{ alert: Alert; risk_assessment: Record<string, unknown> }> {
    const res = await fetch(`${API_BASE}/test/simulate-spike`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async toggleDeviceFailure(enabled: boolean): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/test/toggle-device-failure?enabled=${enabled}`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },

  // Metrics
  async getModelMetrics(): Promise<ModelMetrics> {
    const res = await fetch(`${API_BASE}/metrics/model`, { headers });
    return res.json();
  },

  // Approve action
  async approveAction(investigationId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/test/approve-action?investigation_id=${investigationId}&approver=admin`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },
};
