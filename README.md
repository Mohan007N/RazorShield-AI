# RazorShield AI 🛡️
### Agentic Fraud-Spike Investigation & Risk Response for Razorpay Merchants

> **Razorpay AI Buildathon — Track 02 (AI Risk Manager)**  
> *Prototype evaluated on a synthetic benchmark dataset.*

---

## 1. Problem Statement & Overview
Modern e-commerce and digital merchants integrated with Razorpay often face sudden, coordinated bursts of fraudulent payments (card testing, credential abuse, bot automated attacks). A single merchant may transition from a steady 100 txns/minute with a 2% failure rate to 900+ txns/minute with high failure and new-device concentration in seconds.

Generic fraud detection platforms attempt to solve chargebacks, returns, account takeover, and disputes simultaneously with opaque rules. **RazorShield AI** focuses on **one critical class of loss: abnormal fraud spikes and suspicious transaction bursts**.

---

## 2. Track 02 Alignment
RazorShield AI acts as an autonomous yet strictly bounded **AI Risk Manager**:
1. **Quantitative Detection Layer**: Statistical Anomaly Detection (EWMA + Rolling Z-Scores) coupled with Supervised Gradient Boosted Decision Trees (XGBoost).
2. **Agentic AI Investigator**: LangGraph-orchestrated multi-step investigation agent with tool-calling capabilities.
3. **Evidence-Grounded Reasoning**: SHAP feature attribution and verifiable database/tool citations.
4. **Deterministic Policy Gating**: No autonomous financial movements by the LLM; all high-risk actions are policy-bounded and routed for human approval.
5. **Complete Auditability**: Immutable audit trail of alerts, tool executions, latencies, decisions, and approvals.

---

## 3. High-Level Architecture

```
                 RAZORPAY TEST MODE / SYNTHETIC WEBHOCK EVENTS
                                      │
                                      ▼
                                API GATEWAY / NGINX
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                     FASTAPI-1    FASTAPI-2    FASTAPI-3 (Stateless)
                         │            │            │
                         └────────────┬────────────┘
                                      ▼
                           KAFKA (Event Streaming)
                           [Optional / Fallback Mode]
                                      │
                                      ▼
                        FEATURE ENGINEERING PIPELINE
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                 REDIS (Real-Time)          POSTGRESQL (Truth)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                                 RISK ENGINE
                         ┌────────────┴────────────┐
                         ▼                         ▼
                      XGBOOST              ANOMALY DETECTOR
                  (Supervised ML)        (Rolling Z-Score/EWMA)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                               RISK AGGREGATOR
                                      │
                                      ▼
                              FRAUD SPIKE ALERT
                                      │
                                      ▼
                         LANGGRAPH AGENT ORCHESTRATOR
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                      BASELINE    ACTIVITY      DEVICE
                        TOOL        TOOL         TOOL
                         │            │            │
                         └────────────┼────────────┘
                                      ▼
                               EVIDENCE ENGINE
                               (SHAP + Metrics)
                                      │
                                      ▼
                            POLICY ENGINE & GATE
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                      MONITOR              HUMAN APPROVAL GATE
                                                   │
                                                   ▼
                                           AUDIT LOG & TRAIL
                                                   │
                                                   ▼
                                       REACT RISK DASHBOARD
```

---

## 4. Agentic AI Investigation Workflow & Controlled Tools
When a high-risk spike is flagged, the agent initiates an investigation:
* `get_merchant_baseline(merchant_id)`: Historical txn rate, normal failure rate, average basket value.
* `get_recent_activity(merchant_id)`: Sliding-window txn rates (1m, 5m, 10m), current velocity ratio.
* `get_device_activity(merchant_id)`: Device diversity, new-device ratio, concentration. *(Supports simulated graceful failure testing)*.
* `get_transaction_patterns(merchant_id)`: Geographies, payment method breakdown, amount distribution.
* `get_model_explanation(merchant_id, alert_id)`: TreeExplainer SHAP contributions.
* `get_merchant_policy(merchant_id)`: Merchant-specific thresholds and allowed defensive actions.

---

## 5. Defense-in-Depth & Policy Gating
* **No Direct LLM Fund Execution**: The LLM output is strictly an investigation recommendation.
* **Deterministic Policy Engine**: Maps aggregated risk levels to allowable actions (`MONITOR`, `INVESTIGATE`, `ESCALATE_FOR_REVIEW`, `ENHANCED_VERIFICATION`).
* **Action Gate & Human Review**: Sensitive operations (e.g. enhanced verification or merchant review escalations) require human authorization before dispatch.

---

## 6. Failure Handling & Graceful Degradation
* **Demonstrated Resilience**: Toggle the Device Service failure in the dashboard (`/test/toggle-device-failure`).
* **Graceful Fallback**: The agent receives structured error responses, logs `DEVICE SERVICE UNAVAILABLE`, continues investigating with remaining telemetry, discounts confidence, and defaults to human escalation rather than fabricating missing device data.

---

## 7. Machine Learning & Anomaly Evaluation Methodology
* **Dataset**: 50,000 synthetic transaction records spanning 20 distinct merchant archetypes.
* **Split**: Chronological time-based split (70% Train, 15% Validation, 15% untouched Held-out Test).
* **Models Compared**:
  1. Simple Threshold Baseline (`velocity_ratio > 3.0x`)
  2. Statistical Anomaly Detector (Z-Score + EWMA)
  3. Supervised XGBoost Classifier
  4. Combined Risk Engine
* **Evaluation Metrics (Held-Out Test Set)**:
  * Precision, Recall, F1-Score, PR-AUC
  * False Positive Rate and Estimated False-Positive Cost ($\text{FPs} \times \text{Cost per Review}$)

> **Disclaimer**: All metrics are calculated on synthetic benchmark data to demonstrate pipeline mechanics. Performance does not represent real-world production metrics.

---

## 8. Quickstart & Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* Docker & Docker Compose (Optional)

### Running Backend
```bash
# 1. Setup virtual environment
python -m venv venv
source venv/bin/activate  # Or on Windows: .\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Generate synthetic data & train models
python -m scripts.generate_data
python -m scripts.train_model
python -m ml.evaluate

# 4. Start FastAPI server
uvicorn backend.app.main:app --reload --port 8000
```

### Running Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Docker Compose
```bash
# Standard Dev/Demo Mode (PostgreSQL + Redis + FastAPI + Frontend)
docker compose up --build

# Scalable Mode (Adds Kafka + Nginx Load Balancer)
docker compose --profile scalable up --build
```

---

## 9. API Reference Summary
* `POST /api/v1/transactions`: Ingest payment transaction.
* `GET /api/v1/alerts`: List active fraud spike alerts.
* `POST /api/v1/alerts/{alert_id}/investigate`: Trigger agentic investigation graph.
* `GET /api/v1/metrics/model`: Retrieve true held-out evaluation results.
* `POST /api/v1/test/simulate-spike`: Defensive simulation of burst payment traffic.
* `POST /api/v1/test/toggle-device-failure`: Toggle graceful degradation testing mode.
* `GET /health` & `GET /ready`: Health check & dependency verification endpoints.

---

## 10. Repository Structure
```
├── backend/               # FastAPI core, SQLAlchemy models, LangGraph agent & tools
├── frontend/              # React 19 + TypeScript + Tailwind CSS + Recharts UI
├── ml/                    # Feature engineering, XGBoost training, SHAP, held-out evaluation
├── scripts/               # Synthetic data generation, training, evaluation, demo scripts
├── infrastructure/        # Dockerfiles & Nginx load balancer configs
├── docker-compose.yml     # Multi-container orchestration (Postgres, Redis, Kafka, API, UI)
├── .env.example           # Environment template (No secrets committed)
└── README.md              # Project documentation
```

---

## License & Attribution
Developed for the **Razorpay AI Buildathon (Track 02: AI Risk Manager)**.
Built with safety, explainability, and enterprise risk standards in mind.
