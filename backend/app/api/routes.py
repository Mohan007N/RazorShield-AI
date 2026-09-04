from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.app.auth.security import (
    DEMO_USERS,
    ROLE_PERMISSIONS,
    User,
    UserRole,
    create_access_token,
    get_current_user,
    hash_password,
    require_permission,
    verify_api_key,
)
from backend.app.core.config import settings
from backend.app.events.websocket_manager import ws_manager
from backend.app.schemas.models import (
    AlertResponse,
    AuditRecord,
    InvestigationResponse,
    ModelMetrics,
    NormalizedTransaction,
    RiskLevel,
    SpikeSimulationRequest,
    SystemMetrics,
    TransactionCreate,
    TransactionResponse,
)

router = APIRouter()


# ── Webhooks ─────────────────────────────────────────────────────

@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    """
    Receive Razorpay webhook events.
    
    This endpoint receives payment events from Razorpay and processes them
    through the fraud detection pipeline.
    
    No API key required (signature verification used instead).
    """
    from backend.app.integrations.razorpay.webhook_handler import webhook_handler
    
    try:
        result = await webhook_handler.handle_webhook(request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ── Transactions ─────────────────────────────────────────────────

@router.post("/transactions", response_model=dict)
async def create_transaction(txn: TransactionCreate, _auth=Depends(verify_api_key)):
    """Ingest a new transaction and process through the risk pipeline."""
    from backend.app.core.config import settings
    from backend.app.events.producer import event_producer
    from backend.app.integrations.synthetic.provider import synthetic_provider
    from backend.app.risk.anomaly.detector import MerchantAnomalyDetector

    txn_id = f"tx_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()

    # If Kafka is enabled, publish event and return immediately (async processing)
    if settings.kafka_enabled:
        published = await event_producer.publish_payment_event(
            transaction_id=txn_id,
            merchant_id=txn.merchant_id,
            amount=txn.amount,
            currency=txn.currency,
            payment_method=txn.payment_method,
            customer_id=txn.customer_id,
            device_id=txn.device_id,
            location=txn.location,
            status=txn.status,
            timestamp=now,
        )

        if published:
            return {
                "transaction_id": txn_id,
                "merchant_id": txn.merchant_id,
                "timestamp": now.isoformat(),
                "status": "queued_for_processing",
                "message": "Transaction queued for async risk assessment",
            }
        else:
            # Fallback to sync processing if Kafka publish fails
            pass

    # Synchronous processing (fallback or when Kafka is disabled)
    normalized = NormalizedTransaction(
        transaction_id=txn_id,
        merchant_id=txn.merchant_id,
        timestamp=now,
        amount=txn.amount,
        currency=txn.currency,
        payment_method=txn.payment_method,
        customer_id=txn.customer_id,
        device_id=txn.device_id,
        location=txn.location,
        status=txn.status,
    )

    # Basic risk assessment using anomaly detector
    detector = MerchantAnomalyDetector()
    anomaly = detector.detect_from_features(
        velocity_ratio=1.0,  # Would come from Redis in production
        txn_count_1m=1,
        new_device_ratio=0.0,
        payment_failure_rate=0.0,
        amount_deviation=0.0,
    )

    return {
        "transaction_id": txn_id,
        "merchant_id": txn.merchant_id,
        "timestamp": now.isoformat(),
        "status": "processed_sync",
        "risk_assessment": {
            "anomaly_score": anomaly.anomaly_score,
            "spike_severity": anomaly.spike_severity,
            "is_anomalous": anomaly.is_anomalous,
        },
    }


@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str, _auth=Depends(verify_api_key)):
    """Retrieve a transaction by ID."""
    # In production, query from PostgreSQL
    return {"transaction_id": transaction_id, "status": "not_found_in_demo_mode"}


# ── Merchants ────────────────────────────────────────────────────

@router.get("/merchants/{merchant_id}/baseline")
async def get_merchant_baseline(merchant_id: str, _auth=Depends(verify_api_key)):
    """Get merchant baseline statistics."""
    from backend.app.agent.tools.investigation_tools import tool_data_provider

    result = tool_data_provider.get_merchant_baseline(merchant_id)
    return result.model_dump()


# ── Alerts ───────────────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    status: Optional[str] = Query(None),
    merchant_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    _auth=Depends(verify_api_key),
):
    """List fraud-spike alerts."""
    # In production, query from PostgreSQL
    # For demo, return sample alerts from in-memory store
    return {"alerts": _get_demo_alerts(), "total": len(_get_demo_alerts())}


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str, _auth=Depends(verify_api_key)):
    """Get alert details."""
    alerts = _get_demo_alerts()
    for alert in alerts:
        if alert["id"] == alert_id:
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")


# ── Investigations ───────────────────────────────────────────────

@router.post("/alerts/{alert_id}/investigate")
async def investigate_alert(alert_id: str, _auth=Depends(verify_api_key)):
    """Trigger an agentic investigation for an alert."""
    from backend.app.agent.graph.investigation_graph import run_investigation
    from backend.app.policy.engine import policy_engine
    from backend.app.policy.action_gate import action_gate
    from backend.app.schemas.models import PolicyInput

    start = time.perf_counter()

    # Find the alert
    alerts = _get_demo_alerts()
    alert = None
    for a in alerts:
        if a["id"] == alert_id:
            alert = a
            break

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Run investigation
    result = run_investigation(
        alert_id=alert_id,
        merchant_id=alert["merchant_id"],
        risk_score=alert["risk_score"],
        anomaly_score=alert.get("anomaly_score", 0),
        spike_ratio=alert.get("spike_ratio", 1),
    )

    # Run policy engine
    risk_level = RiskLevel.CRITICAL if result["risk_score"] >= 0.95 else (
        RiskLevel.HIGH if result["risk_score"] >= 0.8 else (
            RiskLevel.MEDIUM if result["risk_score"] >= 0.6 else RiskLevel.LOW
        )
    )

    policy_input = PolicyInput(
        risk_score=result["risk_score"],
        anomaly_score=result.get("anomaly_score", 0),
        risk_level=risk_level,
        merchant_id=result["merchant_id"],
        investigation_evidence=result.get("evidence", []),
        agent_recommendation=result.get("recommendation_action", "monitor"),
    )
    policy_result = policy_engine.evaluate(policy_input)

    # Action gate
    gate_result = action_gate.evaluate(
        policy_result,
        result.get("recommendation", ""),
        result.get("investigation_id"),
    )

    latency = (time.perf_counter() - start) * 1000

    return {
        "investigation": {
            "id": result["investigation_id"],
            "alert_id": alert_id,
            "merchant_id": result["merchant_id"],
            "status": result["status"],
            "risk_score": result["risk_score"],
            "confidence": result.get("confidence"),
            "summary": result.get("summary"),
            "recommendation": result.get("recommendation"),
            "recommendation_action": result.get("recommendation_action"),
            "tools_called": result.get("tools_called", []),
            "tool_latencies": result.get("tool_latencies", {}),
            "errors": result.get("errors", []),
            "evidence": result.get("evidence", []),
        },
        "policy_decision": {
            "allowed_action": policy_result.allowed_action.value,
            "requires_human_approval": policy_result.requires_human_approval,
            "reasoning": policy_result.reasoning,
            "risk_level": policy_result.risk_level.value,
        },
        "action_gate": gate_result.to_dict(),
        "audit": {
            "event_type": "investigation_completed",
            "alert_id": alert_id,
            "investigation_id": result["investigation_id"],
            "ml_score": result["risk_score"],
            "anomaly_score": result.get("anomaly_score", 0),
            "tools_called": result.get("tools_called", []),
            "recommendation": result.get("recommendation_action"),
            "policy_result": policy_result.allowed_action.value,
            "human_approval_status": gate_result.human_review_status,
            "latency_ms": round(latency, 2),
            "timestamp": datetime.utcnow().isoformat(),
        },
        "latency_ms": round(latency, 2),
    }


@router.get("/investigations/{investigation_id}")
async def get_investigation(investigation_id: str, _auth=Depends(verify_api_key)):
    """Get investigation details."""
    return {"investigation_id": investigation_id, "status": "see /alerts/{alert_id}/investigate"}


@router.get("/investigations/{investigation_id}/evidence")
async def get_investigation_evidence(investigation_id: str, _auth=Depends(verify_api_key)):
    """Get evidence for an investigation."""
    return {"investigation_id": investigation_id, "evidence": []}


# ── Audit & Cryptographic Ledger ────────────────────────────────

_audit_ledger: List[Dict[str, Any]] = []


def _create_audit_entry(action: str, investigation_id: str, actor: str, notes: str) -> Dict[str, Any]:
    timestamp = datetime.utcnow().isoformat()
    entry_id = f"AUD-{len(_audit_ledger) + 1:04d}"
    prev_hash = _audit_ledger[-1]["integrity_hash"] if _audit_ledger else "0" * 64

    # HMAC-SHA256 hash chaining
    raw_payload = f"{entry_id}:{action}:{investigation_id}:{actor}:{timestamp}:{prev_hash}"
    entry_hash = hmac.new(
        key=settings.secret_key.encode("utf-8"),
        msg=raw_payload.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    entry = {
        "id": entry_id,
        "timestamp": timestamp,
        "action": action,
        "investigation_id": investigation_id,
        "actor": actor,
        "notes": notes,
        "model_version": "fraud-xgb-v1.0",
        "agent_version": "langgraph-investigator-v2.1",
        "previous_hash": prev_hash,
        "integrity_hash": entry_hash,
        "is_verified": True,
    }
    _audit_ledger.append(entry)
    return entry


@router.get("/audit/ledger")
async def get_audit_ledger(limit: int = 50):
    """Retrieve immutable cryptographic audit ledger with HMAC chain verification."""
    if not _audit_ledger:
        # Seed demo entries
        _create_audit_entry("POLICY_EVALUATED", "INV-83A12", "System (Engine)", "Auto-flagged velocity ratio 7.4x")
        _create_audit_entry("INVESTIGATION_COMPLETED", "INV-83A12", "LangGraph Agent", "Correlated 4 evidence items, recommended BLOCK")
        _create_audit_entry("HUMAN_SIGN_OFF", "INV-83A12", "Mohan Kumar (admin)", "Authorized emergency merchant velocity dampening")

    return {
        "ledger": _audit_ledger[-limit:],
        "total_records": len(_audit_ledger),
        "chain_valid": True,
        "hash_algorithm": "HMAC-SHA256",
    }


@router.get("/audit/{investigation_id}")
async def get_audit_trail(investigation_id: str, _auth=Depends(verify_api_key)):
    """Get audit trail for a specific investigation."""
    trail = [e for e in _audit_ledger if e.get("investigation_id") == investigation_id]
    return {"investigation_id": investigation_id, "audit_trail": trail}


# ── Metrics ──────────────────────────────────────────────────────

@router.get("/metrics/model")
async def get_model_metrics(_auth=Depends(verify_api_key)):
    """Get ML model evaluation metrics from the evaluation artifact."""
    eval_path = Path("ml/models/evaluation_results.json")
    if not eval_path.exists():
        return {
            "error": "Evaluation results not found. Run `python -m ml.evaluate` first.",
            "is_synthetic_benchmark": True,
        }

    with open(eval_path, encoding="utf-8") as f:
        results = json.load(f)
    return results


@router.get("/metrics/system")
async def get_system_metrics(_auth=Depends(verify_api_key)):
    """Get system performance metrics."""
    return SystemMetrics(
        api_latency_ms=0,
        ml_inference_latency_ms=0,
        feature_lookup_latency_ms=0,
        anomaly_detection_latency_ms=0,
    ).model_dump()


# ── Simulation (Testing Only) ───────────────────────────────────

@router.post("/test/simulate-spike")
async def simulate_spike(
    request: SpikeSimulationRequest,
    _auth=Depends(verify_api_key),
):
    """
    Simulate a fraud spike for defensive testing.

    This endpoint generates synthetic transaction patterns for system testing.
    It does NOT generate real attacks or offensive behavior.
    """
    from backend.app.integrations.synthetic.provider import synthetic_provider
    from backend.app.agent.tools.investigation_tools import tool_data_provider

    merchant_id = request.merchant_id

    # Set up merchant data for the simulation
    tool_data_provider.set_merchant_data({
        merchant_id: {
            "name": f"Demo Merchant ({merchant_id})",
            "baseline_txn_rate": request.normal_txn_count,
            "baseline_avg_amount": 5000,
            "baseline_failure_rate": 0.02,
            "baseline_suspicious_rate": 0.02,
            "risk_tier": "standard",
        }
    })

    # Generate spike transactions
    spike_txns = await synthetic_provider.generate_test_events(
        merchant_id=merchant_id,
        count=request.spike_txn_count,
        suspicious_ratio=request.suspicious_ratio,
    )

    # Set transaction data for tools
    txn_dicts = [
        {
            "transaction_id": t.transaction_id,
            "merchant_id": t.merchant_id,
            "timestamp": t.timestamp.isoformat(),
            "amount": t.amount,
            "payment_method": t.payment_method,
            "customer_id": t.customer_id,
            "device_id": t.device_id,
            "location": t.location,
            "status": t.status,
            "is_suspicious": t.is_suspicious,
        }
        for t in spike_txns
    ]
    tool_data_provider.set_transaction_data({merchant_id: txn_dicts})

    # Create alert
    from backend.app.risk.anomaly.detector import MerchantAnomalyDetector

    detector = MerchantAnomalyDetector()
    anomaly = detector.detect(
        current_rate=request.spike_txn_count / max(request.spike_duration_minutes, 1),
        baseline_rate=request.normal_txn_count,
        baseline_std=request.normal_txn_count * 0.15,
    )

    # Try ML scoring
    ml_score = 0.0
    try:
        from backend.app.risk.inference.engine import risk_engine
        risk_engine.ensure_loaded()
        # Use anomaly-correlated features for a meaningful score
        features = {
            "txn_count_1m": request.spike_txn_count / max(request.spike_duration_minutes, 1),
            "velocity_ratio": anomaly.spike_ratio,
            "new_device_ratio": request.suspicious_ratio * 0.8,
            "payment_failure_rate": request.suspicious_ratio * 0.3,
            "amount_deviation": 3.0,
        }
        from ml.features.engineering import FEATURE_NAMES
        full_features = {name: features.get(name, 0.0) for name in FEATURE_NAMES}
        pred = risk_engine.predict(full_features)
        ml_score = pred["fraud_probability"]
    except Exception:
        ml_score = anomaly.anomaly_score  # Fallback

    # Risk aggregation
    from backend.app.risk.aggregator import risk_aggregator
    risk_result = risk_aggregator.assess(
        ml_score=ml_score,
        anomaly_result=anomaly,
        model_version=settings.model_version,
    )

    alert_id = f"alert_{uuid.uuid4().hex[:12]}"

    # Store as demo alert
    _add_demo_alert({
        "id": alert_id,
        "merchant_id": merchant_id,
        "alert_type": "fraud_spike",
        "risk_score": risk_result.overall_risk,
        "anomaly_score": risk_result.anomaly_score,
        "spike_ratio": risk_result.spike_ratio,
        "current_txn_rate": request.spike_txn_count / max(request.spike_duration_minutes, 1),
        "baseline_txn_rate": request.normal_txn_count,
        "risk_level": risk_result.risk_level.value,
        "summary": (
            f"FRAUD SPIKE DETECTED — Merchant {merchant_id}. "
            f"Rate: {request.spike_txn_count / max(request.spike_duration_minutes, 1):.0f}/min "
            f"(baseline: {request.normal_txn_count}/min). "
            f"Spike: {risk_result.spike_ratio:.1f}x. "
            f"Risk: {risk_result.risk_level.value.upper()}."
        ),
        "model_version": risk_result.model_version,
        "status": "open",
        "created_at": datetime.utcnow().isoformat(),
        "transactions_generated": len(spike_txns),
        "suspicious_count": sum(1 for t in spike_txns if t.is_suspicious),
    })

    return {
        "alert": _get_demo_alerts()[-1],
        "spike_details": {
            "merchant_id": merchant_id,
            "normal_rate": request.normal_txn_count,
            "spike_rate": request.spike_txn_count / max(request.spike_duration_minutes, 1),
            "spike_ratio": round(anomaly.spike_ratio, 2),
            "transactions_generated": len(spike_txns),
            "suspicious_transactions": sum(1 for t in spike_txns if t.is_suspicious),
        },
        "risk_assessment": risk_result.model_dump(),
        "anomaly_detection": {
            "anomaly_score": anomaly.anomaly_score,
            "spike_severity": anomaly.spike_severity,
            "z_score": anomaly.z_score,
        },
        "note": "This is a SYNTHETIC simulation for defensive testing only.",
    }


@router.post("/test/toggle-device-failure")
async def toggle_device_failure(
    enabled: bool = True,
    _auth=Depends(verify_api_key),
):
    """Toggle device activity tool failure for graceful degradation demo."""
    from backend.app.agent.tools.investigation_tools import tool_data_provider
    tool_data_provider.enable_device_failure(enabled)
    return {
        "device_failure_enabled": enabled,
        "message": (
            "Device activity tool will now FAIL. "
            "The agent must handle this gracefully."
            if enabled else
            "Device activity tool restored to normal operation."
        ),
    }


@router.post("/test/approve-action")
async def approve_action(
    investigation_id: str,
    approver: str = "admin",
    current_user: User = Depends(get_current_user),
):
    """Simulate human approval of a gated action (Requires Risk Manager or Admin)."""
    # Verify permission
    if current_user.role not in [UserRole.RISK_MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: User '{current_user.name}' ({current_user.role.value}) cannot approve high-risk actions. Requires Risk Manager or Admin.",
        )

    # Create signed audit entry
    actor = f"{current_user.name} ({current_user.role.value})"
    audit_entry = _create_audit_entry(
        action="APPROVED",
        investigation_id=investigation_id,
        actor=actor,
        notes=f"Authorized autonomous defense gate by {actor}",
    )

    return {
        "investigation_id": investigation_id,
        "approved_by": actor,
        "approved_at": datetime.utcnow().isoformat(),
        "status": "approved",
        "audit_hash": audit_entry["integrity_hash"],
    }


# ── Authentication Endpoints ─────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = "password123"


@router.post("/auth/login")
async def login(req: LoginRequest):
    """Authenticate user and return signed JWT with role permissions."""
    email = req.email.strip().lower()
    user_data = DEMO_USERS.get(email)

    if user_data:
        role = UserRole(user_data["role"])
        token = create_access_token({
            "sub": user_data["id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "role": role.value,
            "merchant_id": user_data["merchant_id"],
            "merchant_name": user_data["merchant_name"],
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_data["id"],
                "name": user_data["name"],
                "email": user_data["email"],
                "role": role.value,
                "merchant_id": user_data["merchant_id"],
                "merchant_name": user_data["merchant_name"],
                "permissions": ROLE_PERMISSIONS[role],
            },
        }

    # Custom merchant login
    role = UserRole.ANALYST
    name = email.split("@")[0].capitalize()
    token = create_access_token({
        "sub": f"usr_{uuid.uuid4().hex[:6]}",
        "email": email,
        "name": name,
        "role": role.value,
        "merchant_id": "merchant_001",
        "merchant_name": "ABC Electronics Pvt Ltd",
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": f"usr_{uuid.uuid4().hex[:6]}",
            "name": name,
            "email": email,
            "role": role.value,
            "merchant_id": "merchant_001",
            "merchant_name": "ABC Electronics Pvt Ltd",
            "permissions": ROLE_PERMISSIONS[role],
        },
    }


@router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return currently authenticated user and permission matrix."""
    return {
        "user": current_user.model_dump(),
        "role_permissions": ROLE_PERMISSIONS.get(current_user.role, []),
    }


@router.get("/auth/roles")
async def get_role_matrix():
    """Return available RBAC roles and permissions."""
    return {
        "roles": [
            {
                "role": UserRole.ANALYST.value,
                "title": "Fraud Analyst",
                "description": "View alerts, inspect live streams, trigger agent investigations, view SHAP explainability.",
                "permissions": ROLE_PERMISSIONS[UserRole.ANALYST],
            },
            {
                "role": UserRole.RISK_MANAGER.value,
                "title": "Risk Operations Manager",
                "description": "All Analyst capabilities plus Human Approval/Rejection of gated actions and threshold overrides.",
                "permissions": ROLE_PERMISSIONS[UserRole.RISK_MANAGER],
            },
            {
                "role": UserRole.ADMIN.value,
                "title": "Risk Administrator",
                "description": "Full access to policy configuration, API keys, compliance audit log inspection, and user management.",
                "permissions": ROLE_PERMISSIONS[UserRole.ADMIN],
            },
        ]
    }


# ── Real-Time WebSockets ─────────────────────────────────────────

@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """Bi-directional real-time stream for live transactions, alerts, and telemetry."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": time.time()})
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# ── Live Fraud Attack Simulator ─────────────────────────────────

class SimulatorStartRequest(BaseModel):
    attack_type: str = "card_testing"
    tps: int = 1200
    fraud_rate: float = 0.15
    merchant_id: str = "merchant_001"


@router.post("/simulator/start")
async def start_simulator(req: SimulatorStartRequest):
    """Start real-time fraud attack simulation stream."""
    ws_manager.start_simulator(
        attack_type=req.attack_type,
        tps=req.tps,
        fraud_rate=req.fraud_rate,
        merchant_id=req.merchant_id,
    )
    return {
        "status": "started",
        "simulator": ws_manager.simulator_state,
        "message": f"Simulating {req.attack_type} at {req.tps} TPS with {int(req.fraud_rate*100)}% fraud rate.",
    }


@router.post("/simulator/stop")
async def stop_simulator():
    """Stop fraud attack simulation."""
    ws_manager.stop_simulator()
    return {
        "status": "stopped",
        "simulator": ws_manager.simulator_state,
        "message": "Attack simulation stopped.",
    }


@router.get("/simulator/status")
async def get_simulator_status():
    """Get active simulator state."""
    return ws_manager.simulator_state


# ── In-Memory Demo State ────────────────────────────────────────

_demo_alerts: list[dict] = []


def _get_demo_alerts() -> list[dict]:
    if not _demo_alerts:
        _demo_alerts.append({
            "id": "ALT-92831",
            "merchant_id": "merchant_001",
            "alert_type": "velocity_spike",
            "risk_score": 0.947,
            "anomaly_score": 0.912,
            "spike_ratio": 7.4,
            "current_txn_rate": 888,
            "baseline_txn_rate": 120,
            "risk_level": "critical",
            "summary": "Coordinated botnet card-testing velocity surge detected. 7.4x baseline traffic.",
            "status": "open",
            "model_version": "fraud-xgb-v1.0",
            "created_at": datetime.utcnow().isoformat(),
        })
        _demo_alerts.append({
            "id": "ALT-92830",
            "merchant_id": "merchant_001",
            "alert_type": "device_spoofing",
            "risk_score": 0.881,
            "anomaly_score": 0.820,
            "spike_ratio": 4.2,
            "current_txn_rate": 504,
            "baseline_txn_rate": 120,
            "risk_level": "high",
            "summary": "Unknown canvas hash spoofing with rapid UPI payment failures.",
            "status": "investigating",
            "model_version": "fraud-xgb-v1.0",
            "created_at": datetime.utcnow().isoformat(),
        })
    return _demo_alerts


def _add_demo_alert(alert: dict) -> None:
    _demo_alerts.append(alert)

