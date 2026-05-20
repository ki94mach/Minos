"""
SSO identity and role mapping for Minos (S2).

Maps IdP JWT role claims to Minos RoleEnum values and stores the resolved
principal on flask.g for require_role / sso_required (S3).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import wraps
from typing import Any, Iterable, Optional

from flask import Flask, g, has_request_context, jsonify, session

from models.tables import RoleEnum

ADMIN = RoleEnum.ADMIN.value
USER = RoleEnum.USER.value


@dataclass(frozen=True)
class SsoPrincipal:
    sub: str
    email: str
    role: str
    raw_roles: tuple[str, ...] = ()


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
    """
    Map IdP role strings to a single Minos role.
    If the admin marker is present -> ADMIN; otherwise USER.
    """
    admin_marker = get_sso_role_admin_value().lower()
    normalized = {v.lower() for v in role_values}
    if admin_marker in normalized:
        return ADMIN
    return USER


def map_claims_to_minos_role(claims: dict[str, Any]) -> str:
    """Map validated JWT claims to ADMIN or USER."""
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
    """Fake principal for AUTH_DISABLED local dev (S2/S4)."""
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


def get_request_principal() -> Optional[SsoPrincipal]:
    if not has_request_context():
        return None

    principal = getattr(g, "current_user", None)
    if principal is not None:
        return principal

    if auth_disabled_for_dev():
        principal = get_dev_principal()
        set_request_principal(principal)
        return principal

    return _principal_from_legacy_session()


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
    """Inject dev principal on each request when AUTH_DISABLED is set."""

    @app.before_request
    def _inject_dev_principal() -> None:
        if auth_disabled_for_dev():
            set_request_principal(get_dev_principal())


def sso_required(view_callable):
    """
    Require an authenticated principal (Bearer JWT after S3, dev bypass, or legacy session).
    JWT validation is added in S3; this decorator resolves g.current_user first.
    """

    @wraps(view_callable)
    def wrapper(*args, **kwargs):
        principal = get_request_principal()
        if principal is None:
            return jsonify({"error": "Authentication required"}), 401
        set_request_principal(principal)
        return view_callable(*args, **kwargs)

    return wrapper
