import { useEffect, useState, useRef, useCallback } from 'react';

export interface TelemetryData {
  events_per_sec: number;
  alerts_per_min: number;
  high_risk_count: number;
  active_investigations: number;
  kafka_lag_ms: number;
  model_inference_ms: number;
  active_clients: number;
}

export interface StreamTransaction {
  id: string;
  merchant: string;
  amount: number;
  method: string;
  customer: string;
  status: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  device: string;
  velocity: number;
  time: string;
}

export interface StreamAlert {
  id: string;
  merchant_id: string;
  risk_score: number;
  spike_ratio: number;
  risk_level: string;
  summary: string;
  status: string;
  created_at: string;
}

const DEFAULT_TELEMETRY: TelemetryData = {
  events_per_sec: 1248,
  alerts_per_min: 32,
  high_risk_count: 11,
  active_investigations: 7,
  kafka_lag_ms: 18.2,
  model_inference_ms: 8.4,
  active_clients: 1,
};

export function useWebSocket(
  onTransaction?: (txn: StreamTransaction) => void,
  onAlert?: (alert: StreamAlert) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryData>(DEFAULT_TELEMETRY);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const onTxnRef = useRef(onTransaction);
  onTxnRef.current = onTransaction;

  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const connect = useCallback(() => {
    try {
      const isSecure = window.location.protocol === 'https:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${host}/api/v1/ws/stream`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'telemetry_update' && msg.data) {
            setTelemetry(msg.data);
          } else if (msg.type === 'transaction_stream' && msg.data) {
            if (onTxnRef.current) {
              onTxnRef.current(msg.data);
            }
          } else if (msg.type === 'new_alert' && msg.data) {
            if (onAlertRef.current) {
              onAlertRef.current(msg.data);
            }
          }
        } catch {
          // Ignored
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect in 3s
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Fallback
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, telemetry };
}
