"""Timestamp + shared shaping helpers. OWNER: shared."""
from __future__ import annotations


def rfc3339(value: str | None) -> str:
    """PocketBase timestamps ('2026-10-09 20:16:36.968Z') -> RFC3339 ('T'-joined)."""
    if not value:
        return ""
    return value.replace(" ", "T", 1)
