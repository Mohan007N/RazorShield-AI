"""
RazorShield AI — Real-time WebSocket Event Manager.

Broadcasts live transactions, alerts, investigation updates, and
system throughput telemetry to connected React dashboard clients.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages real-time WebSocket connections and broadcasts events."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._telemetry_task: Optional[asyncio.Task] = None
        self._simulator_task: Optional[asyncio.Task] = None
        self.simulator_state: Dict[str, Any] = {
            "is_running": False,
            "attack_type": "card_testing",
            "tps": 1200,
            "fraud_rate": 0.15,
            "merchant_id": "merchant_001",
            "total_sent": 0,
            "flagged_count": 0,
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

        # Send initial status & telemetry
        await websocket.send_json({
            "type": "connection_ack",
            "connected_at": time.time(),
            "simulator": self.simulator_state,
        })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast JSON message to all connected clients."""
        if not self.active_connections:
            return

        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.add(connection)

        for dead in dead_connections:
            self.active_connections.discard(dead)

    async def broadcast_transaction(self, txn_data: dict):
        await self.broadcast({
            "type": "transaction_stream",
            "data": txn_data,
            "timestamp": time.time(),
        })

    async def broadcast_alert(self, alert_data: dict):
        await self.broadcast({
            "type": "new_alert",
            "data": alert_data,
            "timestamp": time.time(),
        })

    async def broadcast_telemetry(self, telemetry_data: dict):
        await self.broadcast({
            "type": "telemetry_update",
            "data": telemetry_data,
            "timestamp": time.time(),
        })

    def start_background_telemetry(self):
        """Start periodic telemetry broadcaster if not running."""
        if self._telemetry_task is None or self._telemetry_task.done():
            self._telemetry_task = asyncio.create_task(self._telemetry_loop())

    async def _telemetry_loop(self):
        while True:
            try:
                base_tps = 1200 if not self.simulator_state["is_running"] else self.simulator_state["tps"]
                jitter = random.randint(-40, 60)
                telemetry = {
                    "events_per_sec": max(100, base_tps + jitter),
                    "alerts_per_min": 32 if not self.simulator_state["is_running"] else int(base_tps * self.simulator_state["fraud_rate"] * 0.4),
                    "high_risk_count": 11 if not self.simulator_state["is_running"] else int(base_tps * self.simulator_state["fraud_rate"] * 0.25),
                    "active_investigations": 7,
                    "kafka_lag_ms": round(random.uniform(12.0, 24.0), 1),
                    "model_inference_ms": round(random.uniform(6.5, 9.8), 2),
                    "active_clients": len(self.active_connections),
                }
                await self.broadcast_telemetry(telemetry)
            except Exception as e:
                logger.error(f"Telemetry loop error: {e}")
            await asyncio.sleep(1.8)

    def start_simulator(self, attack_type: str, tps: int, fraud_rate: float, merchant_id: str = "merchant_001"):
        """Start streaming synthetic attack events."""
        self.simulator_state.update({
            "is_running": True,
            "attack_type": attack_type,
            "tps": tps,
            "fraud_rate": fraud_rate,
            "merchant_id": merchant_id,
        })
        if self._simulator_task is None or self._simulator_task.done():
            self._simulator_task = asyncio.create_task(self._simulator_loop())

    def stop_simulator(self):
        """Stop attack simulation."""
        self.simulator_state["is_running"] = False
        if self._simulator_task:
            self._simulator_task.cancel()

    async def _simulator_loop(self):
        while self.simulator_state["is_running"]:
            try:
                is_fraud = random.random() < self.simulator_state["fraud_rate"]
                attack = self.simulator_state["attack_type"]
                amount = random.randint(35000, 120000) if is_fraud and attack == "amount_spike" else (
                    random.randint(10, 80) if is_fraud and attack == "card_testing" else random.randint(250, 4500)
                )
                risk_score = (0.75 + random.random() * 0.24) if is_fraud else random.random() * 0.28
                risk_level = "critical" if risk_score > 0.85 else "high" if risk_score > 0.6 else "low"

                txn = {
                    "id": f"TX-SIM-{random.randint(10000, 99999)}",
                    "merchant": self.simulator_state["merchant_id"],
                    "amount": amount,
                    "method": random.choice(["UPI", "Card", "Netbanking"]),
                    "customer": f"CUS-{random.randint(100, 999)}",
                    "status": "failed" if is_fraud and random.random() > 0.4 else "success",
                    "risk": risk_level,
                    "riskScore": round(risk_score, 3),
                    "device": "Unknown Device (Spoofed Canvas)" if is_fraud else "Verified iPhone 15 Pro",
                    "velocity": round(random.uniform(4.5, 9.2), 1) if is_fraud else round(random.uniform(0.8, 1.4), 1),
                    "time": time.strftime("%H:%M:%S"),
                }

                self.simulator_state["total_sent"] += 1
                if is_fraud:
                    self.simulator_state["flagged_count"] += 1

                await self.broadcast_transaction(txn)

                if is_fraud and risk_score > 0.85:
                    alert = {
                        "id": f"ALT-SIM-{random.randint(1000, 9999)}",
                        "merchant_id": self.simulator_state["merchant_id"],
                        "risk_score": round(risk_score, 2),
                        "spike_ratio": round(random.uniform(3.5, 8.5), 1),
                        "risk_level": risk_level,
                        "summary": f"Autonomous trigger: {attack.replace('_', ' ').title()} anomaly detected at {amount} INR velocity surge.",
                        "status": "open",
                        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                    }
                    await self.broadcast_alert(alert)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Simulator stream error: {e}")

            # Sleep interval inversely proportional to TPS
            sleep_time = max(0.2, min(1.2, 1200 / max(self.simulator_state["tps"], 100)))
            await asyncio.sleep(sleep_time)


# Global WebSocket Manager singleton
ws_manager = WebSocketManager()
