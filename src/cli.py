from __future__ import annotations

from pathlib import Path
import argparse
import sys

from src.airports_db import Airport, load_airports, lookup_airport
from src.distance import haversine_km, haversine_miles, route_distance


def _default_db_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "airports_sample.csv"


def _require_airport(code: str, airports: list[Airport]) -> Airport:
    airport = lookup_airport(code, airports)
    if airport is None:
        raise ValueError(f"Unknown airport code: {code}")
    return airport


def cmd_lookup(args: argparse.Namespace, airports: list[Airport]) -> int:
    airport = _require_airport(args.code, airports)
    print(
        f"{airport.iata}/{airport.icao} | {airport.name} | "
        f"{airport.city}, {airport.country} | ({airport.lat}, {airport.lon})"
    )
    return 0


def cmd_distance(args: argparse.Namespace, airports: list[Airport]) -> int:
    a1 = _require_airport(args.code1, airports)
    a2 = _require_airport(args.code2, airports)

    if args.miles:
        dist = haversine_miles(a1.lat, a1.lon, a2.lat, a2.lon)
        unit = "miles"
    else:
        dist = haversine_km(a1.lat, a1.lon, a2.lat, a2.lon)
        unit = "km"

    print(f"{a1.iata} -> {a2.iata}: {dist:.2f} {unit}")
    return 0


def cmd_route(args: argparse.Namespace, airports: list[Airport]) -> int:
    points = [_require_airport(code, airports) for code in args.codes]
    coords = [(a.lat, a.lon) for a in points]
    dist = route_distance(coords, miles=args.miles)
    unit = "miles" if args.miles else "km"
    labels = " -> ".join(a.iata for a in points)
    print(f"{labels}: {dist:.2f} {unit}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="airports",
        description="Airport code lookup and flight distance calculator",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=_default_db_path(),
        help="Path to airports CSV (default: data/airports_sample.csv)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    p_lookup = subparsers.add_parser("lookup", help="Lookup airport by IATA or ICAO")
    p_lookup.add_argument("code", help="Airport code (IATA or ICAO)")

    p_distance = subparsers.add_parser("distance", help="Distance between two airports")
    p_distance.add_argument("code1", help="Origin code")
    p_distance.add_argument("code2", help="Destination code")
    p_distance.add_argument("--miles", action="store_true", help="Output in miles")

    p_route = subparsers.add_parser("route", help="Distance for a multi-leg route")
    p_route.add_argument("codes", nargs="+", help="Airport codes in route order")
    p_route.add_argument("--miles", action="store_true", help="Output in miles")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        airports = load_airports(args.db)

        if args.command == "lookup":
            return cmd_lookup(args, airports)
        if args.command == "distance":
            return cmd_distance(args, airports)
        if args.command == "route":
            if len(args.codes) < 2:
                raise ValueError("Route requires at least 2 airport codes")
            return cmd_route(args, airports)

        parser.error("Unknown command")
        return 2
    except FileNotFoundError:
        print(f"Database file not found: {args.db}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
