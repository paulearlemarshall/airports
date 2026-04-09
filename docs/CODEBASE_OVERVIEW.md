# Codebase Overview

## Repository Structure

- `src/` — Python CLI implementation
  - `airports_db.py` — CSV loading, airport model, search helpers
  - `distance.py` — Haversine math + route aggregation
  - `cli.py` — argparse CLI entrypoints (`lookup`, `distance`, `route`)
- `tests/` — Python tests (currently distance-focused)
- `data/` — sample/offline airport data and API snapshots
- `electron-airports/` — Electron desktop app
  - `main.js` — main process, API/crawl/cache/IPC orchestration
  - `preload.js` — secure renderer API bridge
  - `renderer/` — UI (HTML/CSS/JS)

## Python CLI Architecture

### Flow

1. `python -m src ...` enters via `src/__main__.py` and CLI `main()` in `src/cli.py`.
2. Parser resolves command + options (`lookup`, `distance`, `route`, optional `--db`).
3. Airport CSV is loaded through `load_airports()` in `src/airports_db.py`.
4. Command-specific handlers resolve airport codes and call distance helpers from `src/distance.py`.
5. Result is printed in human-readable format.

### Key Components

- `Airport` dataclass (`airports_db.py`): normalized airport record.
- `lookup_airport()`: resolves IATA/ICAO code by linear scan.
- `haversine_km()` / `haversine_miles()` (`distance.py`): great-circle distance.
- `route_distance()`: sums sequential legs for multi-stop routes.

## Electron App Architecture

### Main Process (`electron-airports/main.js`)

Responsibilities:

- Create BrowserWindow and secure webPreferences.
- Provide API request helper (`fetchJson`) with timeout and error shaping.
- Maintain in-memory cache:
  - `PAGE_CACHE` (paged airport list)
  - `AIRPORTS` + key index for fast lookups
- Persist and restore cache from disk (`app.getPath('userData')`).
- Crawl AirportGap pages in background.
- Register IPC handlers for search/details/distance/cache status.

### Preload (`electron-airports/preload.js`)

Exposes a constrained `window.airportApi` surface to renderer:

- `searchOptions(query)`
- `getDetails(code)`
- `getDistance(from, to)`
- `getRetrievedAirports()`
- `crawlAllAirports()`
- `cacheStatus()`

### Renderer (`electron-airports/renderer/app.js`)

- Manages dual airport selectors and filtering.
- Calls preload APIs for search/details/distance.
- Renders airport JSON details and distance JSON output.
- Uses Leaflet to show markers and animated great-circle path.
- Displays cache/crawl telemetry and supports plotting cached airports.

## Data Files and Formats

- Primary offline CLI input: `data/airports_sample.csv`
- Required CSV fields:
  - `iata`, `icao`, `name`, `city`, `country`, `lat`, `lon`
- Electron cache file (runtime-generated):
  - `airportgap-airports-cache.json` in Electron user data directory

## Run and Test

### Python CLI

```bash
python -m src lookup JFK
python -m src distance JFK LHR
python -m src route JFK LHR CDG --miles
pytest -q
```

### Electron App

```bash
cd electron-airports
npm install
npm start
```

## Extension Points

- **CLI data enrichment**: add API fallback when code not found locally.
- **Validation hardening**: reject invalid/missing lat/lon rows early.
- **Performance**: replace linear scan with prebuilt IATA/ICAO dict index.
- **Electron modularity**: split `main.js` into API/cache/crawl/IPC modules.
- **Testing**: add CLI behavior tests and Electron IPC/renderer tests.
