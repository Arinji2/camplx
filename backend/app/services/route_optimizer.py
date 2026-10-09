"""Geographic clustering + TSP pickup sequencing. OWNER: B-side.

Ported from legacy backend/main.py (Step 2 algorithms):
  - Haversine distances (km)
  - nearest-neighbor TSP per zone
  - K-Means zoning (sklearn, random_state=42 for determinism)
"""
from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in km."""
    r = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
    )
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return float(r * c)


def optimize_tsp_route(locations: list[dict]) -> list[str]:
    """Nearest-neighbor sequencing. locations: [{id, lat, lon}]."""
    if not locations:
        return []
    unvisited = locations.copy()
    current = unvisited.pop(0)
    ordered_ids = [current["id"]]
    while unvisited:
        nearest = min(
            unvisited,
            key=lambda loc: haversine_distance(current["lat"], current["lon"], loc["lat"], loc["lon"]),
        )
        ordered_ids.append(nearest["id"])
        unvisited.remove(nearest)
        current = nearest
    return ordered_ids


def cluster_zones(records: list[dict], zones_needed: int) -> dict[str, int]:
    """K-Means over (latitude, longitude). Returns {record_id: zone_index}."""
    if not records:
        return {}
    zones = max(1, min(zones_needed, len(records)))
    coords = np.array([[r["latitude"], r["longitude"]] for r in records])
    kmeans = KMeans(n_clusters=zones, n_init=10, random_state=42)
    labels = kmeans.fit_predict(coords)
    return {r["id"]: int(labels[i]) for i, r in enumerate(records)}
