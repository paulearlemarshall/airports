# Airports Project

This repository contains:

1. **Python CLI** for airport lookup and distance calculation (offline CSV-driven)
2. **Electron desktop app** for AirportGap-powered airport search, details, distance, and map visualization

---

## Python CLI (`src/`)

### What it does

- lookup airport by IATA/ICAO code
- calculate great-circle distance between two airports
- calculate multi-leg route distance

Data source in this repo: `data/airports_sample.csv`.

### Requirements

- Python 3.10+
- `pytest` (for tests)

### Run

From project root:

```bash
python -m src lookup JFK
python -m src distance JFK LHR
python -m src distance JFK LHR --miles
python -m src route JFK LHR CDG
python -m src route JFK LHR CDG --miles
```

Use a custom CSV path:

```bash
python -m src --db data/airports_sample.csv lookup DXB
```

### Test

```bash
pytest -q
```

### CSV format

Expected columns:

- `iata`
- `icao`
- `name`
- `city`
- `country`
- `lat`
- `lon`

---

## Electron Desktop App (`electron-airports/`)

### What it does

- two searchable airport selectors (**From** / **To**)
- live airport details from AirportGap (`GET /api/airports/{code}`)
- distance from AirportGap (`POST /api/airports/distance`)
- interactive Leaflet map with airport markers and animated great-circle arc
- optional plotting of all cached/retrieved airports
- local disk caching of retrieved AirportGap airport pages
- glassmorphic UI styling

### Notes on data behavior

- The app loads quickly using cached/first-page data, then continues crawling airport pages in the background.
- Cache status (hits/misses, pages fetched, crawl progress) is visible in the UI.

### Run

```bash
cd electron-airports
npm install
npm start
```

---

## Documentation

- [Codebase Overview](docs/CODEBASE_OVERVIEW.md)
- [Developer Quickstart](docs/DEVELOPER_QUICKSTART.md)
- [Code Review Report](docs/CODE_REVIEW.md)

---

## Future API integration (CLI)

The CLI is currently fully offline. A common extension path is:

1. local CSV lookup first
2. external API fallback (Amadeus, API Ninjas, AirportDB)
3. cache enriched results locally
