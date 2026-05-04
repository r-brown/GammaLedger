"""Small auth primitives used by the Phase 5 scaffold.

The API surface is intentionally compatible with the JWT/password pieces that
FastAPI-Users wires together, while avoiding an additional dependency until the
hosted adapter is enabled.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from ... import config


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210_000)
    return f"pbkdf2_sha256$210000${salt}${digest.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password hash produced by hash_password."""
    try:
        algorithm, iterations, salt, digest = hashed_password.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), int(iterations)
    ).hex()
    return hmac.compare_digest(candidate, digest)


def create_token(*, subject: str, token_type: str, expires_delta: timedelta) -> str:
    """Create a signed compact JWT."""
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "typ": token_type,
        "jti": secrets.token_hex(16),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = f"{_b64_json(header)}.{_b64_json(payload)}"
    signature = _b64_bytes(
        hmac.new(config.JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    return f"{signing_input}.{signature}"


def decode_token(token: str, *, expected_type: str) -> dict[str, Any]:
    """Decode and validate a signed compact JWT."""
    try:
        header_b64, payload_b64, signature = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("invalid token") from exc
    signing_input = f"{header_b64}.{payload_b64}"
    expected_signature = _b64_bytes(
        hmac.new(config.JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("invalid token signature")
    payload = json.loads(_unb64(payload_b64))
    if payload.get("typ") != expected_type:
        raise ValueError("invalid token type")
    if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
        raise ValueError("token expired")
    return payload


def hash_token(token: str) -> str:
    """Hash a token for server-side refresh-token storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def access_delta() -> timedelta:
    return timedelta(minutes=config.JWT_ACCESS_TTL_MINUTES)


def refresh_delta() -> timedelta:
    return timedelta(days=config.JWT_REFRESH_TTL_DAYS)


def _b64_json(value: dict[str, Any]) -> str:
    return _b64_bytes(json.dumps(value, separators=(",", ":")).encode())


def _b64_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
