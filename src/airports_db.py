from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import csv


@dataclass(frozen=True, slots=True)
class Airport:
    iata: str
    icao: str
    name: str
    city: str
    country: str
    lat: float
    lon: float


def _parse_float(value: str | None, default: float = 0.0) -> float:
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return default


def load_airports(csv_path: str | Path) -> list[Airport]:
    path = Path(csv_path)
    airports: list[Airport] = []

    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            airports.append(
                Airport(
                    iata=(row.get("iata") or "").strip().upper(),
                    icao=(row.get("icao") or "").strip().upper(),
                    name=(row.get("name") or "").strip(),
                    city=(row.get("city") or "").strip(),
                    country=(row.get("country") or "").strip(),
                    lat=_parse_float(row.get("lat"), 0.0),
                    lon=_parse_float(row.get("lon"), 0.0),
                )
            )

    return airports


def lookup_airport(code: str, airports: list[Airport]) -> Airport | None:
    target = code.strip().upper()
    for airport in airports:
        if airport.iata == target or airport.icao == target:
            return airport
    return None


def search_airports(query: str, airports: list[Airport], limit: int = 10) -> list[Airport]:
    q = query.strip().lower()
    if not q:
        return []

    matches = [
        airport
        for airport in airports
        if q in airport.city.lower() or q in airport.name.lower()
    ]
    return matches[: max(0, limit)]


def list_airports(airports: list[Airport]) -> list[Airport]:
    return list(airports)
