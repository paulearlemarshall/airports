import pytest

from src.distance import haversine_km, haversine_miles, route_distance


def test_haversine_km_known_distance_jfk_lhr() -> None:
    # Approx great-circle distance: ~5540 km
    km = haversine_km(40.6413, -73.7781, 51.4700, -0.4543)
    assert km == pytest.approx(5540, abs=120)


def test_haversine_miles_known_distance_jfk_lhr() -> None:
    # Approx great-circle distance: ~3440 miles
    miles = haversine_miles(40.6413, -73.7781, 51.4700, -0.4543)
    assert miles == pytest.approx(3440, abs=80)


def test_route_distance_multileg_matches_leg_sum() -> None:
    # JFK -> LHR -> CDG
    coords = [
        (40.6413, -73.7781),
        (51.4700, -0.4543),
        (49.0097, 2.5479),
    ]
    route_total = route_distance(coords)
    leg_sum = haversine_km(*coords[0], *coords[1]) + haversine_km(*coords[1], *coords[2])
    assert route_total == pytest.approx(leg_sum, rel=1e-9)


def test_route_distance_short_route_is_zero() -> None:
    assert route_distance([]) == 0.0
    assert route_distance([(40.6413, -73.7781)]) == 0.0

