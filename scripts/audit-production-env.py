#!/usr/bin/env python3
"""
I5 — Audit API environment before production/staging deploy.

Exits 0 when safe; 1 when AUTH_DISABLED is enabled with FLASK_ENV=production
or required SSO variables are missing.

Usage:
  python scripts/audit-production-env.py
  python scripts/audit-production-env.py --env-file /path/to/.env
  FLASK_ENV=production python scripts/audit-production-env.py
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _truthy(value: str | None) -> bool:
    if not value:
        return False
    return value.strip().lower() in ("1", "true", "yes")


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def audit(env: dict[str, str]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    flask_env = env.get("FLASK_ENV", os.environ.get("FLASK_ENV", "")).strip().lower()
    auth_disabled = _truthy(env.get("AUTH_DISABLED")) or _truthy(
        os.environ.get("AUTH_DISABLED")
    )

    if flask_env == "production":
        if auth_disabled:
            errors.append(
                "AUTH_DISABLED is enabled but FLASK_ENV=production. "
                "Remove AUTH_DISABLED from the deploy environment."
            )
        for name in ("SSO_ISSUER", "SSO_AUDIENCE", "SSO_JWKS_URL"):
            if not (env.get(name) or os.environ.get(name) or "").strip():
                errors.append(
                    f"{name} must be set when AUTH_DISABLED is off (production SSO)."
                )
        if not (env.get("SECRET_KEY") or os.environ.get("SECRET_KEY") or "").strip():
            warnings.append(
                "SECRET_KEY is not set; the app will generate one at startup (not ideal for prod)."
            )
    elif auth_disabled:
        warnings.append(
            "AUTH_DISABLED is set — acceptable for local dev only, not for public staging/prod."
        )

    if auth_disabled and flask_env not in ("", "development"):
        warnings.append(
            f"AUTH_DISABLED with FLASK_ENV={flask_env or '(unset)'} — use only for local development."
        )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Minos production env audit (I5)")
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(".env"),
        help="Env file to check (default: .env in cwd)",
    )
    args = parser.parse_args()

    merged = {**load_env_file(args.env_file), **os.environ}
    errors, warnings = audit(merged)

    for msg in warnings:
        print(f"WARNING: {msg}", file=sys.stderr)

    if errors:
        print("Production environment audit FAILED:", file=sys.stderr)
        for msg in errors:
            print(f"  - {msg}", file=sys.stderr)
        return 1

    print("Production environment audit OK (AUTH_DISABLED off for production; SSO vars present).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
