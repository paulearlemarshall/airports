from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0088
KM_TO_MILES = 0.621371


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = radians(lat1)
    phi2 = radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * asin(sqrt(a))
    return EARTH_RADIUS_KM * c


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return haversine_km(lat1, lon1, lat2, lon2) * KM_TO_MILES


def route_distance(coords: list[tuple[float, float]], miles: bool = False) -> float:
    if len(coords) < 2:
        return 0.0

    total = 0.0
    for (lat1, lon1), (lat2, lon2) in zip(coords, coords[1:]):
        if miles:
            total += haversine_miles(lat1, lon1, lat2, lon2)
        else:
            total += haversine_km(lat1, lon1, lat2, lon2)
    return total
