"""Heuristic matching — need-it titles against active listings. OWNER: B-side.

Keyword + category scoring; deterministic, no AI.
"""
from __future__ import annotations

import re

_STOPWORDS = {
    "the", "and", "for", "with", "from", "this", "that", "need", "wanted",
    "buy", "please", "semester", "end", "campus", "hostel", "student",
}

_TOKEN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if len(t) >= 3 and t not in _STOPWORDS]


def match_reason(tokens: list[str], listing_title: str, category: str) -> str | None:
    for token in tokens:
        if token in listing_title.lower():
            return f"Keyword '{token}' matched title in {category} category."
    return None
