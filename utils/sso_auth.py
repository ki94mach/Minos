"""
SSO identity, JWT validation, and role mapping for Minos (S2, S3).

API routes use @sso_required. Auth blueprint routes keep @login_required (Minos session).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import wraps
from typing import Any, Iterable, Optional

import jwt
from jwt import PyJWKClient
from flask import Flask, g, has_request_context, jsonify, request, session

from models.tables import RoleEnum

logger = logging.getLogger(__name__)

ADMIN = RoleEnum.ADMIN.value
USER = RoleEnum.USER.value

_jwks_client: Optional[PyJWKClient] = None


@dataclass(frozen=True)
class SsoPrincipal:
    sub: str
    email: str
    role: str
    raw_roles: tuple[str, ...] = ()


class SsoConfigError(Exception):
    """SSO environment is missing or invalid."""


def _env_bool(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes")


def is_production() -> bool:
    return os.environ.get("FLASK_ENV", "").strip().lower() == "production"


def auth_disabled_for_dev() -> bool:
    """True when local dev bypass is allowed (blocked in production)."""
    if is_production():
        return False
    return _env_bool("AUTH_DISABLED")


def get_sso_roles_claim_name() -> str:
    return os.environ.get("SSO_ROLES_CLAIM", "roles").strip() or "roles"


def get_sso_role_admin_value() -> str:
    return os.environ.get("SSO_ROLE_ADMIN", "minos-admin").strip() or "minos-admin"


def get_sso_role_user_value() -> str:
    return os.environ.get("SSO_ROLE_USER", "minos-user").strip() or "minos-user"


def get_sso_issuer() -> str:
    return os.environ.get("SSO_ISSUER", "").strip()


def get_sso_audience() -> str:
    return os.environ.get("SSO_AUDIENCE", "").strip()


def get_sso_jwks_url() -> str:
    return os.environ.get("SSO_JWKS_URL", "").strip()


def get_sso_jwt_algorithms() -> list[str]:
    raw = os.environ.get("SSO_JWT_ALGORITHMS", "RS256").strip()
    return [a.strip() for a in raw.split(",") if a.strip()] or ["RS256"]


def sso_jwt_configured() -> bool:
    return bool(get_sso_issuer() and get_sso_audience() and get_sso_jwks_url())


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = get_sso_jwks_url()
        if not jwks_url:
            raise SsoConfigError("SSO_JWKS_URL is not set")
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def extract_bearer_token() -> Optional[str]:
    if not has_request_context():
        return None
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    return token or None


def validate_access_token(token: str) -> dict[str, Any]:
    """Verify OIDC access token signature and standard claims."""
    if not sso_jwt_configured():
        raise SsoConfigError("SSO_ISSUER, SSO_AUDIENCE, and SSO_JWKS_URL must be set")

    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=get_sso_jwt_algorithms(),
        audience=get_sso_audience(),
        issuer=get_sso_issuer(),
    )


def extract_claim_value(claims: dict[str, Any], claim_path: str) -> Any:
    """Read a claim; supports dotted paths (e.g. realm_access.roles)."""
    current: Any = claims
    for part in claim_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def normalize_role_values(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        if "," in raw:
            return [v.strip() for v in raw.split(",") if v.strip()]
        return [raw.strip()] if raw.strip() else []
    if isinstance(raw, (list, tuple)):
        return [str(item).strip() for item in raw if isinstance(item, str) and item.strip()]
    return []


def map_role_values_to_minos_role(role_values: Iterable[str]) -> str:
    admin_marker = get_sso_role_admin_value().lower()
    normalized = {v.lower() for v in role_values}
    if admin_marker in normalized:
        return ADMIN
    return USER


def map_claims_to_minos_role(claims: dict[str, Any]) -> str:
    claim_name = get_sso_roles_claim_name()
    raw = extract_claim_value(claims, claim_name)
    return map_role_values_to_minos_role(normalize_role_values(raw))


def build_principal_from_claims(claims: dict[str, Any]) -> SsoPrincipal:
    email = (
        claims.get("email")
        or claims.get("preferred_username")
        or claims.get("upn")
        or ""
    )
    sub = str(claims.get("sub") or claims.get("user_id") or email or "unknown")
    raw_roles = normalize_role_values(extract_claim_value(claims, get_sso_roles_claim_name()))
    role = map_role_values_to_minos_role(raw_roles)
    return SsoPrincipal(
        sub=sub,
        email=str(email),
        role=role,
        raw_roles=tuple(raw_roles),
    )


def get_dev_principal() -> SsoPrincipal:
    role = os.environ.get("DEV_MOCK_ROLE", ADMIN).strip().upper()
    if role not in RoleEnum.all_roles():
        role = ADMIN
    raw = (get_sso_role_admin_value(),) if role == ADMIN else (get_sso_role_user_value(),)
    return SsoPrincipal(
        sub=os.environ.get("DEV_MOCK_SUB", "dev-user"),
        email=os.environ.get("DEV_MOCK_EMAIL", "dev@local"),
        role=role,
        raw_roles=raw,
    )


def set_request_principal(principal: SsoPrincipal) -> None:
    g.current_user = principal


def _principal_from_legacy_session() -> Optional[SsoPrincipal]:
    """Minos password login session — non-production only until SSO is fully live."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    role = session.get("role", USER)
    if role not in RoleEnum.all_roles():
        role = USER
    return SsoPrincipal(
        sub=str(user_id),
        email=str(session.get("email") or ""),
        role=role,
    )


def _principal_from_bearer() -> Optional[SsoPrincipal]:
    token = extract_bearer_token()
    if not token:
        return None
    try:
        claims = validate_access_token(token)
        return build_principal_from_claims(claims)
    except SsoConfigError as exc:
        logger.error("SSO configuration error: %s", exc)
        return None
    except jwt.PyJWTError as exc:
        logger.info("Bearer token rejected: %s", exc)
        return None


def resolve_authenticated_principal() -> Optional[SsoPrincipal]:
    """
    Resolve the caller for /api/* routes.

    Order: cached principal -> dev bypass -> Bearer JWT -> legacy session (non-prod only).
    """
    if not has_request_context():
        return None

    principal = getattr(g, "current_user", None)
    if principal is not None:
        return principal

    if auth_disabled_for_dev():
        return get_dev_principal()

    bearer_principal = _principal_from_bearer()
    if bearer_principal is not None:
        return bearer_principal

    if extract_bearer_token():
        return None

    if not is_production():
        return _principal_from_legacy_session()

    return None


def get_request_principal() -> Optional[SsoPrincipal]:
    principal = resolve_authenticated_principal()
    if principal is not None and has_request_context():
        set_request_principal(principal)
    return principal


def get_request_role() -> Optional[str]:
    principal = get_request_principal()
    if principal is not None:
        return principal.role
    if has_request_context():
        role = session.get("role")
        if role in RoleEnum.all_roles():
            return role
    return None


def register_dev_auth_bypass(app: Flask) -> None:
    @app.before_request
    def _inject_dev_principal() -> None:
        if auth_disabled_for_dev():
            set_request_principal(get_dev_principal())


def sso_required(view_callable):
    """Protect /api/* routes: SSO Bearer JWT, dev bypass, or legacy session in development."""

    @wraps(view_callable)
    def wrapper(*args, **kwargs):
        principal = resolve_authenticated_principal()
        if principal is None:
            return jsonify({"error": "Authentication required"}), 401
        set_request_principal(principal)
        return view_callable(*args, **kwargs)

    return wrapper
