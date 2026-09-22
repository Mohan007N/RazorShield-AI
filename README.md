# RazorShield AI

## Autonomous Fraud-Spike Detection, Investigation, and Policy-Gated Risk Mitigation Engine

RazorShield AI is an automated fraud risk management platform engineered for payment gateways and high-velocity digital merchants. It detects abnormal transaction surges, runs evidence-grounded agentic investigations using LangGraph, calculates SHAP-based model explanations, enforces deterministic policy boundaries, and logs every action to an HMAC-SHA256 cryptographic audit ledger.

---

## Table of Contents

- [1. System Architecture](#1-system-architecture)
- [2. Database Schema & ER Diagram](#2-database-schema--er-diagram)
- [3. Ingestion & Real-Time Event Processing](#3-ingestion--real-time-event-processing)
- [4. Machine Learning & Anomaly Detection Pipeline](#4-machine-learning--anomaly-detection-pipeline)
- [5. Agentic AI Investigation Framework](#5-agentic-ai-investigation-framework)
- [6. Policy Gating, Governance & RBAC](#6-policy-gating-governance--rbac)
- [7. Cryptographic Audit Ledger](#7-cryptographic-audit-ledger)
- [8. API Reference Specification](#8-api-reference-specification)
- [9. Configuration & Environment Variables](#9-configuration--environment-variables)
- [10. Installation & Deployment Guide](#10-installation--deployment-guide)
- [11. Testing & Benchmark Reproduction](#11-testing--benchmark-reproduction)
- [12. Repository Structure](#12-repository-structure)

---

## 1. System Architecture

RazorShield AI is designed with a decoupled, horizontally scalable microservice architecture. It operates in dual modes: a lightweight direct-execution mode for local development and edge deployments, and a distributed streaming mode utilizing Apache Kafka, Redis feature stores, and dedicated worker processes for high-throughput production environments.

```mermaid
flowchart TD
    subgraph Ingestion["Ingestion Layer"]
        RZP["Razorpay Webhook Events / Client Ingestion"] --> NGINX["Nginx Load Balancer / Reverse Proxy"]
        NGINX --> API1["FastAPI Instance 1"]
        NGINX --> API2["FastAPI Instance 2"]
        NGINX --> API3["FastAPI Instance N"]
    end

    subgraph Streaming["Message Bus & Buffer"]
        API1 -->|Publish Event| KAFKA["Apache Kafka Broker"]
        API2 -->|Publish Event| KAFKA
        API3 -->|Publish Event| KAFKA
        KAFKA -->|payment.events| RW["Risk Worker"]
        KAFKA -->|payment.events| AW["Analytics Worker"]
        KAFKA -->|audit.events| AUDW["Audit Worker"]
    end

    subgraph StateAndFeatures["Real-Time State & Storage"]
        RW <-->|Sliding Window Metrics| REDIS[("Redis In-Memory Feature Store")]
        AW <-->|Update Merchant Baselines| REDIS
        RW -->|Persist Transactions & Scores| PG[("PostgreSQL Database")]
        AUDW -->|Write Immutable Logs| PG
    end

    subgraph Detection["Detection & Inference Engine"]
        RW --> STATS["Statistical Anomaly Detector<br/>(Rolling Z-Score + EWMA)"]
        RW --> XGB["XGBoost Classifier<br/>(25+ Engineered Features)"]
        STATS --> AGG["Risk Aggregator"]
        XGB --> AGG
        AGG -->|Threshold Exceeded| ALERT["Fraud Spike Alert Generated"]
    end

    subgraph Investigation["Agentic Investigation Layer"]
        ALERT --> LG["LangGraph Multi-Step Agent"]
        LG --> T1["get_merchant_baseline"]
        LG --> T2["get_recent_activity"]
        LG --> T3["get_device_activity"]
        LG --> T4["get_transaction_patterns"]
        LG --> T5["get_model_explanation (SHAP)"]
        LG --> T6["get_merchant_policy"]
        T1 & T2 & T3 & T4 & T5 & T6 --> CORR["Evidence Correlation Engine"]
        CORR --> REC["Investigation Finding & Recommendation"]
    end

    subgraph Governance["Governance & Human-in-the-Loop"]
        REC --> POLICY["Deterministic Policy Engine"]
        POLICY --> GATE["Action Gate"]
        GATE -->|Low/Medium Risk| AUTO["Execute Safe Policy Action"]
        GATE -->|High/Critical Risk| HUMAN["Human Authorization Gate (RBAC)"]
        HUMAN -->|Approved / Rejected| SIGN["HMAC-SHA256 Audit Sign-Off"]
        SIGN --> PG
    end

    subgraph Presentation["Telemetry & User Interface"]
        API1 -->|WebSocket Telemetry| UI["React 19 / TypeScript Dashboard"]
        PG -->|REST API Queries| UI
    end
```

### Component Roles

- **API Gateway (FastAPI)**: Stateless HTTP and WebSocket server handling authentication, transaction ingestion, manual investigation triggers, and real-time frontend streaming.
- **Message Broker (Kafka)**: Partitioned event buffer that decouples synchronous webhook ingestion from heavy analytical processing.
- **Risk Worker**: Consumes payment events, queries Redis sliding-window counters, executes XGBoost scoring and statistical anomaly detection, and raises alerts when velocity bounds are breached.
- **Analytics Worker**: Continuously aggregates merchant velocity metrics and recalibrates baseline models on a rolling schedule.
- **Audit Worker**: Consumes audit events asynchronously and commits them with cryptographic sequence hashes to persistent storage.
- **Investigation Agent (LangGraph)**: Multi-step orchestrator that queries merchant history, recent activity, device fingerprints, transaction patterns, and SHAP explanations before synthesizing structured findings.
- **Policy Engine & Action Gate**: Enforces strict operational boundaries on autonomous agent output, preventing unauthorized financial or routing changes without verified human approval..

---

## 2. Database Schema & ER Diagram

The persistence layer is managed via SQLAlchemy ORM with support for PostgreSQL (production) and SQLite (testing/demonstration). The schema contains 11 core tables covering merchants, transactions, feature vectors, risk scores, alerts, agent runs, evidence items, policy decisions, audit logs, and model metadata.

```mermaid
erDiagram
    MERCHANT ||--o{ TRANSACTION : "processes"
    MERCHANT ||--o{ ALERT : "triggers"
    TRANSACTION ||--o| TRANSACTION_FEATURES : "computes"
    TRANSACTION ||--o| RISK_ASSESSMENT : "evaluates"
    ALERT ||--o| INVESTIGATION : "initiates"
    INVESTIGATION ||--o{ INVESTIGATION_EVIDENCE : "accumulates"
    INVESTIGATION ||--o{ AGENT_RUN : "executes"
    INVESTIGATION ||--o{ POLICY_DECISION : "governs"
    INVESTIGATION ||--o{ AUDIT_LOG : "audits"
    ALERT ||--o{ AUDIT_LOG : "references"

    MERCHANT {
        string id PK
        string name
        string category
        string risk_tier
        float baseline_txn_rate
        float baseline_avg_amount
        float baseline_failure_rate
        float baseline_suspicious_rate
        json policy_config
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    TRANSACTION {
        string id PK
        string merchant_id FK
        datetime timestamp
        float amount
        string currency
        string payment_method
        string customer_id
        string device_id
        string location
        string ip_address
        string status
        boolean is_suspicious
        string source
        json raw_payload
        datetime created_at
    }

    TRANSACTION_FEATURES {
        string id PK
        string transaction_id FK
        string merchant_id
        float txn_count_1m
        float txn_count_5m
        float txn_count_10m
        float txn_count_30m
        float txn_count_1h
        float current_amount
        float avg_amount
        float median_amount
        float amount_deviation
        float amount_ratio_to_baseline
        int unique_devices
        int new_device_count
        float new_device_ratio
        float accounts_per_device
        int unique_customers
        float new_customer_ratio
        float payment_method_entropy
        float payment_failure_rate
        float payment_method_spike
        int hour
        int day_of_week
        float time_deviation
        float velocity_ratio
        float current_txn_rate
        float current_suspicious_rate
        datetime created_at
    }

    RISK_ASSESSMENT {
        string id PK
        string transaction_id FK
        string merchant_id
        float ml_score
        float anomaly_score
        float spike_ratio
        float overall_risk
        string risk_level
        string model_version
        json feature_contributions
        datetime created_at
    }

    ALERT {
        string id PK
        string merchant_id FK
        string alert_type
        float risk_score
        float anomaly_score
        float spike_ratio
        float current_txn_rate
        float baseline_txn_rate
        string risk_level
        text summary
        json features_snapshot
        string model_version
        string status
        datetime created_at
        datetime resolved_at
    }

    INVESTIGATION {
        string id PK
        string alert_id FK
        string merchant_id
        string status
        float risk_score
        float confidence
        text summary
        text recommendation
        string recommendation_action
        json tools_called
        json errors
        datetime started_at
        datetime completed_at
    }

    INVESTIGATION_EVIDENCE {
        string id PK
        string investigation_id FK
        string source_tool
        string source_record
        string field
        text value
        string data_type
        float confidence
        datetime timestamp
    }

    AGENT_RUN {
        string id PK
        string investigation_id FK
        int step_index
        string node_name
        string tool_name
        json tool_input
        json tool_output
        boolean tool_success
        float tool_latency_ms
        text llm_reasoning
        datetime started_at
        datetime completed_at
    }

    POLICY_DECISION {
        string id PK
        string investigation_id FK
        string merchant_id
        string risk_level
        string agent_recommendation
        string policy_action
        boolean requires_human_approval
        boolean human_approved
        string human_approver
        datetime approved_at
        text reasoning
        datetime created_at
    }

    AUDIT_LOG {
        string id PK
        string event_type
        string alert_id
        string investigation_id
        string merchant_id
        float ml_score
        float anomaly_score
        string model_version
        json tools_called
        json tool_outputs
        json evidence_summary
        text agent_recommendation
        string policy_result
        string human_approval_status
        text final_result
        json metadata
        datetime timestamp
    }

    MODEL_VERSION {
        string id PK
        string version UK
        string model_type
        string file_path
        json training_data_info
        json metrics
        json hyperparameters
        json feature_names
        boolean is_active
        datetime created_at
    }
```

---

## 3. Ingestion & Real-Time Event Processing

RazorShield AI supports two transaction ingestion paths:

1. **Synchronous Ingestion (Direct Mode)**: Used in development, edge deployment, or cloud serverless environments (`NO_KAFKA=true`). Transactions are parsed, enriched with in-memory anomaly checks, and returned synchronously in under 15 milliseconds.
2. **Asynchronous Streaming (Scalable Mode)**: Incoming transactions via `POST /api/v1/transactions` or Razorpay Webhooks (`POST /api/v1/webhooks/razorpay`) are validated, assigned a unique identifier, and published to Kafka partition keys partitioned by `merchant_id`.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Razorpay Gateway / Client
    participant API as FastAPI Ingestion Gateway
    participant K as Kafka Broker (payment.events)
    participant RW as Risk Worker Process
    participant R as Redis Sliding Windows
    participant ML as XGBoost & Anomaly Detector
    participant DB as PostgreSQL Database
    participant WS as WebSocket Telemetry Manager
    actor UI as Risk Operations Dashboard

    Client->>API: POST /api/v1/transactions (Payload)
    API->>API: Verify API Key / Webhook Signature
    API->>K: Publish PaymentEvent (partition: merchant_id)
    API-->>Client: 200 OK (status: queued_for_processing)

    K->>RW: Consume PaymentEvent
    RW->>R: Increment 1m/5m/10m Velocity Windows
    RW->>R: Fetch Rolling Window Quantiles & Counts
    R-->>RW: Velocity Ratios, Failure Rates, Device Concentration
    RW->>ML: Evaluate ML Model + EWMA Z-Scores
    ML-->>RW: Risk Score: 0.947, Anomaly Z: 7.4

    alt Risk Level >= HIGH (Spike Detected)
        RW->>DB: INSERT INTO alerts (status: open)
        RW->>K: Publish FraudAlertEvent (fraud.alerts)
        RW->>WS: Broadcast Alert Event (WebSocket)
        WS-->>UI: Real-Time Alert Card Rendered
    else Standard Risk
        RW->>DB: INSERT INTO transactions & risk_assessments
    end
```

---

## 4. Machine Learning & Anomaly Detection Pipeline

The risk evaluation engine combines statistical anomaly detection with a supervised XGBoost classifier trained on multi-dimensional transaction features.

```mermaid
flowchart LR
    subgraph InputData["Raw Stream Features"]
        TXN["Incoming Transaction"]
        WIN["Redis Velocity Windows"]
        BASE["Merchant Baseline"]
    end

    subgraph FeatureEngineering["25+ Computed Real-Time Features"]
        TXN & WIN & BASE --> FE["Feature Transformation Engine"]
        FE --> F1["Velocity Ratios (1m, 5m, 10m, 30m, 1h)"]
        FE --> F2["Amount Z-Score & Baseline Deviations"]
        FE --> F3["New Device Ratios & Device Entropy"]
        FE --> F4["Payment Failure & Method Concentration"]
        FE --> F5["Temporal Deviation (Hour, Day-of-Week)"]
    end

    subgraph Inference["Dual Scoring Models"]
        F1 & F2 & F3 & F4 & F5 --> STATS["Statistical Detector<br/>Rolling EWMA + Z-Score"]
        F1 & F2 & F3 & F4 & F5 --> XGB["Supervised Model<br/>XGBoost Gradient Boosted Trees"]
    end

    subgraph Aggregation["Composite Risk Score"]
        STATS -->|Anomaly Score: [0, 1]| COMBINE["Risk Aggregator"]
        XGB -->|ML Probability: [0, 1]| COMBINE
        COMBINE --> CLASSIFY{"Overall Risk Score"}
        CLASSIFY -->|Score >= 0.95| CRIT["CRITICAL"]
        CLASSIFY -->|0.80 <= Score < 0.95| HIGH["HIGH"]
        CLASSIFY -->|0.60 <= Score < 0.80| MED["MEDIUM"]
        CLASSIFY -->|Score < 0.60| LOW["LOW"]
    end
```

### Feature Dictionary

| Feature Name | Type | Description |
|---|---|---|
| `txn_count_1m` | Float | Transaction count in the preceding 1-minute window |
| `txn_count_5m` | Float | Transaction count in the preceding 5-minute window |
| `txn_count_10m` | Float | Transaction count in the preceding 10-minute window |
| `txn_count_30m` | Float | Transaction count in the preceding 30-minute window |
| `txn_count_1h` | Float | Transaction count in the preceding 1-hour window |
| `velocity_ratio` | Float | Ratio of current transaction rate relative to historical baseline |
| `current_amount` | Float | Gross monetary value of the evaluated transaction |
| `avg_amount` | Float | Rolling average transaction amount for the merchant |
| `median_amount` | Float | Rolling median transaction amount |
| `amount_deviation` | Float | Standardized deviation of transaction amount from baseline |
| `amount_ratio_to_baseline` | Float | Ratio of current amount to typical merchant basket size |
| `unique_devices` | Integer | Count of distinct device IDs observed in current sliding window |
| `new_device_count` | Integer | Number of previously unobserved devices in current window |
| `new_device_ratio` | Float | Proportion of total transactions originating from new devices |
| `accounts_per_device` | Float | Distinct user accounts observed per unique hardware fingerprint |
| `unique_customers` | Integer | Count of distinct customer identifiers in active window |
| `new_customer_ratio` | Float | Proportion of transactions from first-time customer IDs |
| `payment_method_entropy` | Float | Shannon entropy across payment methods (detects method concentration) |
| `payment_failure_rate` | Float | Percentage of transactions resulting in decline or failure status |
| `payment_method_spike` | Float | Instantaneous acceleration in specific payment method volume |
| `hour` | Integer | Hour of day (0-23 UTC) |
| `day_of_week` | Integer | Day of week (0-6) |
| `time_deviation` | Float | Distance from merchant standard active trading hours |
| `current_txn_rate` | Float | Current instantaneous transactions per minute |
| `current_suspicious_rate` | Float | Rolling percentage of transactions flagged suspicious |

### SHAP Explainability

For every high-risk inference, the engine computes exact feature attributions using TreeExplainer SHAP. Top positive and negative contributors are formatted into the investigation context, allowing both the agent and human analysts to inspect the mathematical basis of every alert.

---

## 5. Agentic AI Investigation Framework

When an alert is flagged, the LangGraph Investigation Agent executes a multi-node investigation workflow. Rather than sending unstructured prompts directly to an LLM, the agent runs a typed state machine that queries isolated diagnostic tools, validates data structures, correlates evidence, and handles partial infrastructure failures gracefully.

```mermaid
stateDiagram-v2
    [*] --> TriageNode: Alert Received
    TriageNode --> GatherBaseline: Initialize State
    GatherBaseline --> GatherActivity: Baseline Retrieved
    GatherActivity --> GatherDevice: Recent Velocity Parsed
    
    state GatherDevice {
        [*] --> CheckAvailability
        CheckAvailability --> ToolCall: Service Operational
        CheckAvailability --> GracefulDegrade: Service Unavailable
        ToolCall --> RecordEvidence: Valid Payload
        GracefulDegrade --> LogError: Flag Missing Telemetry
        LogError --> ReduceConfidence: Confidence Penalty
    }

    GatherDevice --> GatherPatterns: Device Evidence Stored
    GatherPatterns --> GatherExplanation: Patterns Analyzed
    GatherExplanation --> GatherPolicy: SHAP Vectors Retrieved
    GatherPolicy --> CorrelateEvidence: Merchant Policy Loaded
    CorrelateEvidence --> RecommendNode: Synthesize Findings
    RecommendNode --> PolicyEngine: Pass to Deterministic Gate
    PolicyEngine --> [*]
```

### Controlled Investigation Tools

1. `get_merchant_baseline(merchant_id: str)`: Fetches baseline volume, average order values, normal dispute rates, and baseline failure rates.
2. `get_recent_activity(merchant_id: str)`: Fetches sliding-window volume across 1m, 5m, 10m intervals, velocity ratios, and recent failure spikes.
3. `get_device_activity(merchant_id: str)`: Inspects device diversity, canvas hash anomalies, and new-device concentration ratios. Includes simulated fault tolerance.
4. `get_transaction_patterns(merchant_id: str)`: Analyzes geographical anomalies, bin routing, and payment method skew.
5. `get_model_explanation(merchant_id: str, alert_id: str)`: Computes SHAP attributions for the top risk drivers from the inference pipeline.
6. `get_merchant_policy(merchant_id: str)`: Loads risk tolerance tiers, maximum auto-action caps, and allowed defense mechanisms.

### Graceful Degradation & Resilience

The agent implements resilience against partial service outages. If downstream telemetry (e.g. the device profiling service) throws a network timeout or 503 Service Unavailable, the agent:
- Does not halt the investigation workflow.
- Records structured diagnostic errors in `InvestigationState.errors`.
- Explicitly flags that device data is unavailable and prohibits hallucinatory assumptions.
- Applies a mathematical penalty factor to `confidence` (e.g., `confidence = confidence * 0.85`).
- Enforces human escalation fallback if missing data obscures critical risk indicators.

---

## 6. Policy Gating, Governance & RBAC

RazorShield AI enforces a strict boundary between autonomous AI analysis and financial execution. Large Language Models and agent graphs are structurally prohibited from executing unilateral transactions, account suspensions, or routing mutations without policy validation.

```mermaid
flowchart TD
    AGENT["LangGraph Agent Output<br/>(Recommendation + Confidence)"] --> POLICY["Deterministic Policy Engine"]
    
    subgraph Rules["Policy Matrix Evaluation"]
        POLICY --> EVAL{"Evaluate Risk & Impact"}
        EVAL -->|Low Risk & Confidence >= 0.90| P_MON["Action: MONITOR<br/>No intervention required"]
        EVAL -->|Medium Risk| P_INV["Action: INVESTIGATE<br/>Continue targeted telemetry capture"]
        EVAL -->|High Risk| P_REV["Action: ESCALATE_FOR_REVIEW<br/>Requires Human Authorization"]
        EVAL -->|Critical Risk| P_VER["Action: ENHANCED_VERIFICATION<br/>Requires Human Authorization"]
    end

    subgraph Gate["Action Gate & RBAC Verification"]
        P_MON --> EXEC_AUTO["Execute Action Automatically"]
        P_INV --> EXEC_AUTO
        P_REV --> RBAC{"Check User Role"}
        P_VER --> RBAC
        
        RBAC -->|Analyst| DENY["403 Forbidden<br/>Analyst cannot approve high-risk actions"]
        RBAC -->|Risk Manager / Admin| PROMPT["Prompt for Human Sign-Off"]
        
        PROMPT -->|Human Approves| AUDIT_APP["Log Signed Audit Entry<br/>Execute Mitigation"]
        PROMPT -->|Human Rejects| AUDIT_REJ["Log Rejection Audit Entry<br/>Revert to Safe State"]
    end
```

### Role-Based Access Control (RBAC) Matrix

| Permission Key | Description | Analyst | Risk Manager | Administrator |
|---|---|:---:|:---:|:---:|
| `alerts:read` | View active fraud spike alerts | [x] | [x] | [x] |
| `investigate:read` | Inspect investigation records and tools | [x] | [x] | [x] |
| `investigate:run` | Trigger on-demand agent investigations | [x] | [x] | [x] |
| `evidence:read` | Review extracted telemetry and citations | [x] | [x] | [x] |
| `shap:read` | View SHAP feature attribution charts | [x] | [x] | [x] |
| `recommendation:suggest`| View agent synthesis and findings | [x] | [x] | [x] |
| `action:approve` | Authorize high-risk mitigations | [ ] | [x] | [x] |
| `action:reject` | Dismiss alerts or reject mitigations | [ ] | [x] | [x] |
| `policy:override` | Modify merchant risk policy thresholds | [ ] | [x] | [x] |
| `*` (Wildcard) | Unrestricted system administrative rights | [ ] | [ ] | [x] |

---

## 7. Cryptographic Audit Ledger

Every critical state change—including alert triggers, tool executions, agent recommendations, policy evaluations, and human approvals—is appended to an immutable, HMAC-SHA256 hash-chained audit ledger.

```mermaid
flowchart LR
    subgraph Entry1["Audit Entry N-1"]
        E1_ID["ID: AUD-0001"]
        E1_ACT["Action: ALERT_TRIGGERED"]
        E1_PH["Previous Hash: 0000...0000"]
        E1_SIG["Integrity Hash: 7b2f...91a2"]
    end

    subgraph Entry2["Audit Entry N"]
        E2_ID["ID: AUD-0002"]
        E2_ACT["Action: INVESTIGATION_COMPLETED"]
        E2_PH["Previous Hash: 7b2f...91a2"]
        E2_SIG["Integrity Hash: e4c1...83d0"]
    end

    subgraph Entry3["Audit Entry N+1"]
        E3_ID["ID: AUD-0003"]
        E3_ACT["Action: HUMAN_SIGN_OFF"]
        E3_PH["Previous Hash: e4c1...83d0"]
        E3_SIG["Integrity Hash: a918...42ff"]
    end

    Entry1 -->|Hash Chained| Entry2
    Entry2 -->|Hash Chained| Entry3
```

### Signature Computation

The integrity hash for entry $i$ is generated over its canonical serialized payload using the server's secret key:

$$\text{Payload}_i = \text{EntryID}_i \parallel \text{Action}_i \parallel \text{InvestigationID}_i \parallel \text{Actor}_i \parallel \text{Timestamp}_i \parallel \text{Hash}_{i-1}$$

$$\text{Hash}_i = \text{HMAC-SHA256}(\text{SecretKey}, \text{Payload}_i)$$

Any historical mutation of an actor name, recommendation, or timestamp invalidates all subsequent hash links across the chain, making tampering immediately detectable via `GET /api/v1/audit/ledger`.

---

## 8. API Reference Specification

All endpoints are mounted under `/api/v1` unless stated otherwise.

### Core Endpoints

#### Ingestion & Webhooks

- `POST /api/v1/webhooks/razorpay`
  - Accepts standard Razorpay payment webhook payloads (`payment.authorized`, `payment.failed`, `order.paid`).
  - Validates `X-Razorpay-Signature` HMAC header.
  - Returns: `{"status": "accepted", "event_id": "evt_..."}`

- `POST /api/v1/transactions`
  - Ingests single transaction for synchronous or asynchronous evaluation.
  - Headers: `X-API-Key: <api-key>`
  - Request Body:
    ```json
    {
      "merchant_id": "merchant_001",
      "amount": 7500.00,
      "currency": "INR",
      "payment_method": "upi",
      "customer_id": "cust_8231",
      "device_id": "dev_9912",
      "location": "Mumbai, IN",
      "status": "success"
    }
    ```
  - Response (200 OK):
    ```json
    {
      "transaction_id": "tx_a93f1201",
      "merchant_id": "merchant_001",
      "timestamp": "2026-09-10T09:42:15.120Z",
      "status": "processed_sync",
      "risk_assessment": {
        "anomaly_score": 0.08,
        "spike_severity": "normal",
        "is_anomalous": false
      }
    }
    ```

#### Alerts & Investigations

- `GET /api/v1/alerts`
  - Query Parameters: `status` (string, optional), `merchant_id` (string, optional), `limit` (integer, default 50).
  - Returns paginated list of fraud spike alerts.

- `GET /api/v1/alerts/{alert_id}`
  - Retrieves specific alert metadata, snapshot features, and anomaly severity.

- `POST /api/v1/alerts/{alert_id}/investigate`
  - Triggers the multi-step LangGraph agent investigation workflow.
  - Returns full investigation report, tool citations, SHAP explanations, policy evaluation, and action gate requirements.
  - Response (200 OK):
    ```json
    {
      "investigation": {
        "id": "inv_9f821a004",
        "alert_id": "ALT-92831",
        "merchant_id": "merchant_001",
        "status": "completed",
        "risk_score": 0.947,
        "confidence": 0.92,
        "summary": "Transaction velocity is 7.4x above baseline (888/min vs 120/min). New device ratio elevated at 38%. ML model drivers: velocity_ratio (+0.42), payment_failure_rate (+0.28).",
        "recommendation_action": "enhanced_verification",
        "tools_called": [
          "get_merchant_baseline",
          "get_recent_activity",
          "get_device_activity",
          "get_transaction_patterns",
          "get_model_explanation",
          "get_merchant_policy"
        ],
        "tool_latencies": {
          "get_merchant_baseline": 1.2,
          "get_recent_activity": 2.4,
          "get_device_activity": 3.1,
          "get_transaction_patterns": 1.9,
          "get_model_explanation": 8.5,
          "get_merchant_policy": 0.8
        }
      },
      "policy_decision": {
        "allowed_action": "enhanced_verification",
        "requires_human_approval": true,
        "reasoning": "Critical risk score exceeds auto-enforcement threshold. Requires Risk Manager authorization.",
        "risk_level": "critical"
      },
      "action_gate": {
        "action_name": "ENHANCED_VERIFICATION",
        "human_review_status": "pending_approval"
      },
      "latency_ms": 42.15
    }
    ```

#### Governance & Audit

- `GET /api/v1/audit/ledger`
  - Query Parameters: `limit` (integer, default 50).
  - Returns cryptographic ledger entries with verification chain status.

- `POST /api/v1/test/approve-action`
  - Approves a gated action for a specific investigation.
  - Authentication: Requires Bearer JWT token with `UserRole.RISK_MANAGER` or `UserRole.ADMIN`.
  - Body: `{"investigation_id": "inv_9f821a004", "approver": "Sarah Verma"}`

#### Real-Time Simulation & Testing

- `POST /api/v1/simulator/start`
  - Body: `{"attack_type": "card_testing", "tps": 1200, "fraud_rate": 0.15, "merchant_id": "merchant_001"}`
  - Activates high-frequency background event generation for real-time dashboard stress testing.

- `POST /api/v1/simulator/stop`
  - Deactivates background attack simulator.

- `GET /api/v1/simulator/status`
  - Returns current simulation rate, active attack pattern, and telemetry counts.

- `POST /api/v1/test/toggle-device-failure`
  - Query Parameters: `enabled` (boolean).
  - Forces downstream device profiling tool into failure state to test graceful degradation.

#### Authentication & WebSockets

- `POST /api/v1/auth/login`
  - Body: `{"email": "mohan.k@abcelectronics.com", "password": "password123"}`
  - Returns signed JWT token with assigned role and permission array.

- `GET /api/v1/auth/me`
  - Returns details of the currently authenticated token owner.

- `GET /api/v1/auth/roles`
  - Returns system RBAC permission matrix.

- `WS /api/v1/ws/stream`
  - Bi-directional WebSocket connection delivering live transaction metrics, alert broadcasts, and simulator telemetry.

#### System Health

- `GET /` - Root status and API documentation hyperlinks.
- `GET /health` - Basic health check endpoint.
- `GET /ready` - Deep readiness verification querying database and ML model status.

---

## 9. Configuration & Environment Variables

All configuration is managed through environment variables or a root `.env` file.

| Variable Name | Type | Default Value | Description |
|---|---|---|---|
| `APP_NAME` | String | `RazorShield AI` | Application branding identifier |
| `APP_MODE` | String | `dev` | Operational mode: `dev`, `demo`, or `scalable` |
| `DEBUG` | Boolean | `true` | Enables verbose logging and interactive debug features |
| `API_HOST` | String | `0.0.0.0` | Network binding interface for API server |
| `API_PORT` | Integer | `8000` | HTTP port for API server |
| `SECRET_KEY` | String | `change-me-to-a-random-secret-key` | Secret key used for JWT signing and HMAC ledger verification |
| `DATABASE_URL` | String | `postgresql+asyncpg://razorshield:razorshield@localhost:5432/razorshield` | Async SQLAlchemy database connection URI |
| `DATABASE_SYNC_URL` | String | `postgresql://razorshield:razorshield@localhost:5432/razorshield` | Synchronous SQLAlchemy database connection URI |
| `REDIS_URL` | String | `redis://localhost:6379/0` | Connection string for Redis feature store |
| `NO_KAFKA` | Boolean | `true` | When true, runs in direct mode bypassing Kafka message broker |
| `KAFKA_BOOTSTRAP_SERVERS` | String | `localhost:9092` | Comma-delimited list of Kafka broker host/port pairs |
| `RAZORPAY_KEY_ID` | String | `None` | Optional Razorpay API Key ID (Test Mode) |
| `RAZORPAY_KEY_SECRET` | String | `None` | Optional Razorpay API Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | String | `None` | Webhook verification secret for Razorpay signature checking |
| `LLM_PROVIDER` | String | `openai` | Model provider: `openai`, `google`, or `anthropic` |
| `OPENAI_API_KEY` | String | `None` | API key for OpenAI LLM services |
| `GOOGLE_API_KEY` | String | `None` | API key for Google Gemini LLM services |
| `ANTHROPIC_API_KEY` | String | `None` | API key for Anthropic Claude services |
| `LLM_MODEL` | String | `gpt-4o` | Model name identifier |
| `LLM_TEMPERATURE` | Float | `0.1` | Temperature setting for deterministic reasoning |
| `API_KEY` | String | `razorshield-dev-key` | Default master API key for administrative endpoints |
| `CORS_ORIGINS` | String | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `MODEL_PATH` | String | `ml/models/xgboost_fraud.joblib` | Filesystem path to serialized XGBoost model artifact |
| `MODEL_VERSION` | String | `v1.0.0` | Semantic version string of active inference model |

---

## 10. Installation & Deployment Guide

### Prerequisites

- Python 3.10, 3.11, or 3.12
- Node.js 18+ and npm
- Docker and Docker Compose (optional for standalone local mode, required for scalable mode)

---

### Option A: Local Standalone Setup (Without Docker)

This mode runs the entire stack locally using SQLite and in-memory brokers. No external database or message broker installation is required.

#### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/Mohan007N/RazorShield-AI.git
cd RazorShield-AI

# Create and activate Python virtual environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Create environment file configured for SQLite standalone
cp .env.example .env

# Generate benchmark dataset and train initial ML models
python -m scripts.generate_data
python -m scripts.train_model
python -m ml.evaluate

# Launch the FastAPI backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup

```bash
# In a separate terminal window:
cd frontend
npm install
npm run dev
```

The user interface will be accessible at `http://localhost:5173`.

---

### Option B: Local Multi-Container Setup (Docker Compose)

Runs PostgreSQL 16, Redis 7, FastAPI Backend, and React Frontend in isolated Docker containers.

```bash
# Build and start all standard dev containers
docker compose up --build
```

Access the applications:
- Frontend: `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432` (User: `razorshield`, DB: `razorshield`)
- Redis: `localhost:6379`

---

### Option C: Distributed Enterprise Setup (Kafka + Workers + Nginx)

Activates the full distributed event-streaming architecture including Apache Kafka, Zookeeper, Nginx load balancing, and three isolated worker processes (`risk-worker`, `analytics-worker`, `audit-worker`).

```bash
# Edit .env and set NO_KAFKA=false and APP_MODE=scalable
# Launch scalable profile
docker compose --profile scalable up --build -d

# Verify all services and workers are active
docker compose ps
```

---

### Option D: Cloud Deployment (Vercel + Render)

```mermaid
flowchart LR
    V["Frontend on Vercel<br/>(React 19 + TypeScript)"] <-->|REST + WSS| R["Backend on Render<br/>(FastAPI + Python 3.11)"]
    RZP["Razorpay Dashboard"] -->|Live Webhooks| R
```

1. **Deploy Backend to Render**:
   - Connect repository `Mohan007N/RazorShield-AI` to Render as a Web Service.
   - Set Build Command: `pip install -r backend/requirements.txt`
   - Set Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - Configure Environment Variables: `APP_MODE=demo`, `NO_KAFKA=true`, `DATABASE_URL=sqlite+aiosqlite:///./razorshield.db`, `DATABASE_SYNC_URL=sqlite:///./razorshield.db`, `CORS_ORIGINS=*`.

2. **Deploy Frontend to Vercel**:
   - Connect repository to Vercel.
   - Set Root Directory: `frontend`
   - Set Build Command: `npm run build`
   - Set Output Directory: `dist`
   - Configure Environment Variable: `VITE_API_URL=https://<your-render-backend-url>.onrender.com`

---

## 11. Testing & Benchmark Reproduction

### Running Automated Test Suite

The test suite validates JWT authentication, role permissions, simulator activation, policy engine bounds, and cryptographic audit chain consistency.

```bash
# Execute pytest test suite with verbose output
python -m pytest tests/ -v
```

### Reproducing Benchmark Data & Model Evaluation

RazorShield AI evaluates detection accuracy across 50,000 synthetic transactions spanning 20 distinct merchant archetypes. Data splits are strictly chronological (70% Train, 15% Validation, 15% Untouched Held-Out Test).

```bash
# 1. Regenerate synthetic multi-archetype transaction stream
python -m scripts.generate_data

# 2. Train XGBoost classifier with cross-validation
python -m scripts.train_model

# 3. Evaluate models on held-out test split and output comparison metrics
python -m ml.evaluate
```

The evaluation script generates `ml/models/evaluation_results.json` comparing:
- Baseline Velocity Threshold (`velocity_ratio > 3.0x`)
- Statistical Anomaly Detector (EWMA + Rolling Z-Score)
- Supervised XGBoost Classifier
- Combined Risk Aggregator Engine

---

## 12. Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agent/                      # LangGraph investigation agent
│   │   │   ├── graph/                  # StateGraph node definitions and execution graph
│   │   │   ├── prompts/                # System and analysis prompts
│   │   │   └── tools/                  # 6 specialized investigation tools
│   │   ├── api/                        # REST and WebSocket API routes
│   │   │   └── routes.py               # Route controllers
│   │   ├── audit/                      # Cryptographic audit ledger
│   │   ├── auth/                       # JWT authentication and RBAC permissions
│   │   ├── cache/                      # Redis connection and cache wrappers
│   │   ├── core/                       # App configuration and settings
│   │   ├── db/                         # SQLAlchemy database engine and ORM models
│   │   │   ├── database.py             # Engine lifecycle and session maker
│   │   │   └── models.py               # 11 core database entity schemas
│   │   ├── events/                     # Event streaming (Kafka producers & WebSocket manager)
│   │   ├── integrations/               # External gateway integrations (Razorpay, Synthetic)
│   │   ├── policy/                     # Deterministic policy engine and action gate
│   │   ├── risk/                       # Risk engine, anomaly detector, SHAP explainability
│   │   ├── schemas/                    # Pydantic request and response models
│   │   ├── services/                   # Business logic services
│   │   ├── workers/                    # Distributed background worker implementations
│   │   └── main.py                     # FastAPI application entrypoint and lifespan
│   └── requirements.txt                # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/                 # Reusable UI components (Modals, Charts, Badges)
│   │   ├── context/                    # React Context (Auth, Theme, Live WebSocket state)
│   │   ├── pages/                      # Page views
│   │   │   ├── Dashboard.tsx           # Fleet merchant overview and active alerts
│   │   │   ├── Investigation.tsx       # LangGraph agent investigation deep-dive
│   │   │   ├── LiveActivity.tsx        # Real-time transaction stream and attack simulator
│   │   │   ├── ModelPerformance.tsx   # Held-out benchmark metrics and confusion matrix
│   │   │   ├── AuditTrail.tsx          # Cryptographic HMAC audit ledger inspector
│   │   │   ├── Settings.tsx            # Policy configuration and API keys
│   │   │   └── Login.tsx               # RBAC login screen
│   │   ├── services/                   # API and WebSocket client adapters
│   │   ├── App.tsx                     # React Router and navigation layout
│   │   └── main.tsx                    # React application mount
│   ├── package.json                    # Frontend dependencies
│   ├── tsconfig.json                   # TypeScript configuration
│   └── vite.config.ts                  # Vite bundler configuration
├── ml/
│   ├── data/                           # Data storage directories
│   ├── evaluation/                     # Metric calculators and benchmarking logic
│   ├── explainability/                 # SHAP TreeExplainer integration
│   ├── features/                       # Real-time and batch feature engineering
│   ├── models/                         # Serialized model artifacts (.joblib, .json)
│   ├── preprocessing/                  # Data cleaning and normalization
│   └── training/                       # Model training pipelines
├── infrastructure/
│   ├── docker/                         # Dockerfiles for backend and frontend
│   └── nginx/                          # Nginx reverse proxy configuration
├── scripts/                            # Operational utility and benchmark scripts
├── tests/                              # Pytest automated test suite
├── docker-compose.yml                  # Multi-container service definitions
├── render.yaml                         # Render Cloud deployment blueprint
├── .env.example                        # Template configuration file
└── README.md                           # Technical system documentation
```

---

## License & Attribution

Developed for the **Razorpay AI Buildathon (Track 02: AI Risk Manager)**.  
Built in compliance with financial risk management and AI explainability standards.
