"""
RazorShield AI — Authentication & RBAC Security Module.

Implements JWT authentication, role-based access control (RBAC),
and permission validation for fintech risk operations.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from backend.app.core.config import settings

# Security Bearer scheme
security_bearer = HTTPBearer(auto_error=False)


class UserRole(str, Enum):
    ANALYST = "analyst"
    RISK_MANAGER = "risk_manager"
    ADMIN = "admin"


class User(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    merchant_id: str
    merchant_name: str
    permissions: List[str]


ROLE_PERMISSIONS: Dict[UserRole, List[str]] = {
    UserRole.ANALYST: [
        "alerts:read",
        "investigate:read",
        "investigate:run",
        "evidence:read",
        "shap:read",
        "recommendation:suggest",
    ],
    UserRole.RISK_MANAGER: [
        "alerts:read",
        "investigate:read",
        "investigate:run",
        "evidence:read",
        "shap:read",
        "recommendation:suggest",
        "action:approve",
        "action:reject",
        "policy:override",
    ],
    UserRole.ADMIN: [
        "*",  # All permissions
    ],
}

DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "mohan.k@abcelectronics.com": {
        "id": "usr_mohan_001",
        "name": "Mohan Kumar",
        "email": "mohan.k@abcelectronics.com",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "role": UserRole.ADMIN,
        "merchant_id": "merchant_001",
        "merchant_name": "ABC Electronics Pvt Ltd",
    },
    "sarah.v@abcelectronics.com": {
        "id": "usr_sarah_002",
        "name": "Sarah Verma",
        "email": "sarah.v@abcelectronics.com",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "role": UserRole.RISK_MANAGER,
        "merchant_id": "merchant_001",
        "merchant_name": "ABC Electronics Pvt Ltd",
    },
    "arun.n@apexretail.in": {
        "id": "usr_arun_003",
        "name": "Arun Nair",
        "email": "arun.n@apexretail.in",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "role": UserRole.ANALYST,
        "merchant_id": "merchant_004",
        "merchant_name": "Apex Luxury Retail",
    },
}

SECRET_KEY = getattr(settings, "secret_key", "razorshield-jwt-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for demo usability


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(time.time())})

    try:
        from jose import jwt
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    except Exception:
        # Fallback pure-python JWT serialization
        import base64
        import json
        header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
        sig_input = f"{header}.{payload}".encode()
        sig = base64.urlsafe_b64encode(
            hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
        ).decode().rstrip("=")
        return f"{header}.{payload}.{sig}"


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token."""
    try:
        from jose import jwt
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        # Fallback pure-python JWT parser
        import base64
        import json
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        sig_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
        ).decode().rstrip("=")
        if not hmac.compare_digest(expected_sig, sig_b64):
            return None
        # Add back padding if needed
        padding = "=" * (4 - len(payload_b64) % 4) if len(payload_b64) % 4 else ""
        payload_data = json.loads(base64.urlsafe_b64decode(payload_b64 + padding).decode())
        if payload_data.get("exp", 0) < time.time():
            return None
        return payload_data


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_api_key: str = Header(default="", alias="X-API-Key"),
) -> User:
    """FastAPI Dependency: Authenticate JWT token or fall back to demo admin in dev mode."""
    if auth and auth.credentials:
        payload = decode_access_token(auth.credentials)
        if payload and "email" in payload:
            email = payload["email"]
            user_data = DEMO_USERS.get(email)
            if user_data:
                role = UserRole(user_data["role"])
                return User(
                    id=user_data["id"],
                    email=user_data["email"],
                    name=user_data["name"],
                    role=role,
                    merchant_id=user_data["merchant_id"],
                    merchant_name=user_data["merchant_name"],
                    permissions=ROLE_PERMISSIONS.get(role, []),
                )
            # Custom token user
            role = UserRole(payload.get("role", UserRole.ANALYST.value))
            return User(
                id=payload.get("sub", "usr_custom"),
                email=email,
                name=payload.get("name", email.split("@")[0].capitalize()),
                role=role,
                merchant_id=payload.get("merchant_id", "merchant_001"),
                merchant_name=payload.get("merchant_name", "ABC Electronics Pvt Ltd"),
                permissions=ROLE_PERMISSIONS.get(role, []),
            )

    # API key or dev fallback
    if x_api_key == "razorshield-dev-key" or settings.debug:
        # Default active demo user (Risk Operations Lead)
        return User(
            id="usr_mohan_001",
            email="mohan.k@abcelectronics.com",
            name="Mohan Kumar",
            role=UserRole.ADMIN,
            merchant_id="merchant_001",
            merchant_name="ABC Electronics Pvt Ltd",
            permissions=ROLE_PERMISSIONS[UserRole.ADMIN],
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_permission(permission: str):
    """Dependency factory: require specific permission or admin wildcard."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        if "*" in current_user.permissions or permission in current_user.permissions:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: user role '{current_user.role.value}' lacks required permission '{permission}'.",
        )
    return permission_checker


async def verify_api_key(x_api_key: str = Header(default="", alias="X-API-Key")):
    """Simple API key authentication dependency."""
    if settings.debug or x_api_key == "razorshield-dev-key":
        return True
    if x_api_key != getattr(settings, "api_key", "razorshield-dev-key"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return True

