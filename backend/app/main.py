"""
RazorShield AI — FastAPI Application.

Stateless API server designed for horizontal scaling.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    # Startup
    print(f"[*] Starting {settings.app_name} in {settings.app_mode.value} mode")

    # Initialize database (dev convenience)
    try:
        from backend.app.db.database import init_db
        await init_db()
        print("[+] Database tables initialized")
    except Exception as e:
        print(f"[-] Database init skipped: {e}")

    # Load ML model
    try:
        from backend.app.risk.inference.engine import risk_engine
        risk_engine.load()
        print(f"[+] ML model loaded: {risk_engine.model_version}")
    except Exception as e:
        print(f"[-] ML model not loaded: {e}")

    # Start Kafka event producer
    if settings.kafka_enabled:
        try:
            from backend.app.events.producer import event_producer
            await event_producer.start()
            print(f"[+] Kafka producer started: {settings.kafka_bootstrap_servers}")
        except Exception as e:
            print(f"[-] Kafka producer not started: {e}")
    # Start WebSocket background telemetry
    try:
        from backend.app.events.websocket_manager import ws_manager
        ws_manager.start_background_telemetry()
        print("[+] WebSocket background telemetry broadcaster active")
    except Exception as e:
        print(f"[-] WebSocket telemetry broadcaster not started: {e}")

    yield

    # Shutdown
    if settings.kafka_enabled:
        try:
            from backend.app.events.producer import event_producer
            await event_producer.stop()
        except Exception:
            pass

    try:
        from backend.app.db.database import close_db
        await close_db()
    except Exception:
        pass
    print(f"[*] {settings.app_name} shut down")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Agentic Fraud-Spike Investigation & Risk Response for Razorpay Merchants. "
        "Prototype evaluated on synthetic benchmark data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    latency = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{latency:.2f}"
    return response


# Health endpoints
@app.get("/health")
async def health():
    """Basic health check."""
    return {"status": "healthy", "service": settings.app_name, "mode": settings.app_mode.value}


@app.get("/ready")
async def readiness():
    """Readiness check — verifies dependencies."""
    checks = {"api": True}

    # Check DB
    try:
        from backend.app.db.database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False

    # Check ML model
    try:
        from backend.app.risk.inference.engine import risk_engine
        checks["ml_model"] = risk_engine._loaded
    except Exception:
        checks["ml_model"] = False

    # Overall readiness — don't fail on optional services
    is_ready = checks["api"]
    return {
        "status": "ready" if is_ready else "not_ready",
        "checks": checks,
    }


# Import text for raw SQL (used in readiness check)
from sqlalchemy import text

# Mount API routes
app.include_router(api_router, prefix="/api/v1")
