# Codebase Overview

This repository contains an offline Python command-line tool and an Electron desktop app for richer AirportGap-powered lookup, distance, and map workflows.

## Repository Structure

- `src/` - Python CLI implementation.
  - `airports_db.py` - CSV loading, `Airport` model, lookup helpers, basic search helpers.
  - `distance.py` - Haversine distance calculations and multi-leg route aggregation.
  - `cli.py` - `argparse` commands for `lookup`, `distance`, and `route`.
  - `__main__.py` - module entry point for `python -m src`.
- `tests/` - Python tests, currently focused on distance calculations.
- `data/` - sample CLI CSV data and AirportGap API snapshots.
- `electron-airports/` - Electron desktop app.
  - `airportgapClient.js` - AirportGap API client, response parsing, and airport normalization.
  - `airportStore.js` - cache state, search, crawl, and disk persistence service.
  - `ipcHandlers.js` - IPC handler registration for the preload API surface.
  - `main.js` - Electron app bootstrap, window creation, lifecycle, and process-level handlers.
  - `preload.js` - constrained `window.airportApi` bridge.
  - `renderer/index.html` - app shell and controls.
  - `renderer/style.css` - visual styling.
  - `renderer/app.js` - renderer state, UI behavior, API calls, and Leaflet map rendering.

## Python CLI

### Runtime Flow

1. `python -m src ...` enters through `src/__main__.py`.
2. `src.cli.main()` builds and runs the `argparse` parser.
3. `load_airports()` reads the configured CSV file.
4. Command handlers resolve airport codes with `lookup_airport()`.
5. Distance commands use helpers from `src/distance.py`.
6. Results are printed as human-readable terminal output.

### Commands

- `lookup CODE` - prints airport code, name, city, country, and coordinates.
- `distance CODE1 CODE2` - prints great-circle distance in kilometers.
- `distance CODE1 CODE2 --miles` - prints great-circle distance in miles.
- `route CODE...` - prints summed great-circle distance for a multi-leg route.
- `route CODE... --miles` - prints route distance in miles.
- `--db PATH` - overrides the default CSV path.

### Data Handling

The default CSV is `data/airports_sample.csv`. Required columns are `iata`, `icao`, `name`, `city`, `country`, `lat`, and `lon`.

`airports_db.py` normalizes IATA and ICAO codes to uppercase. Invalid or missing coordinates currently fall back to `0.0`, which is called out in `docs/CODE_REVIEW.md` as a validation improvement.

## Electron Desktop App

### Main Process

The trusted Electron runtime is split across a few focused CommonJS modules:

- `main.js` creates the `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- `main.js` configures lifecycle hooks, OpenStreetMap request headers, and process-level broken-pipe handling.
- `airportgapClient.js` calls AirportGap through `fetchJson()` with timeout handling and shaped errors.
- `airportgapClient.js` normalizes AirportGap airport records into a stable internal object.
- `airportStore.js` maintains in-memory caches:
  - `pageCache` for fetched AirportGap pages.
  - `airports` for normalized airport records.
  - `airportKeyIndex` for deduplication and IATA/ICAO lookup.
- `airportStore.js` persists and restores `airportgap-airports-cache.json` in Electron's user data directory.
- `airportStore.js` crawls AirportGap pages in the background so search results improve after startup.
- `ipcHandlers.js` registers IPC handlers used by the renderer.

### Preload API

`electron-airports/preload.js` exposes this constrained API as `window.airportApi`:

- `searchOptions(query)`
- `getDetails(code)`
- `getDistance(fromCode, toCode)`
- `getRetrievedAirports()`
- `crawlAllAirports()`
- `cacheStatus()`

The renderer does not get direct Node.js access.

### Renderer

`electron-airports/renderer/app.js` manages the user workflow:

- Initializes a Leaflet map with OpenStreetMap tiles.
- Loads default selectors for `KIX` and `NRT` when available.
- Provides From and To filter inputs with clear buttons.
- Populates select lists from cached and live AirportGap search results.
- Shows count labels for each selector.
- Fetches both airport details and distance in parallel when comparing.
- Renders compact JSON for airport details and distance output.
- Draws origin and destination markers.
- Builds and animates a great-circle path between selected airports.
- Shows a distance tooltip on the route line.
- Shows airport detail popups on marker hover.
- Supports auto-show mode on airport click or selection change.
- Supports optional plotting of all cached AirportGap airports.
- Keeps From and To detail panels open or closed in sync.
- Refreshes cache telemetry every three seconds.

## Cache Behavior

The Electron app is designed to stay responsive while it gathers AirportGap data:

- On first empty search, it fetches the first AirportGap page if the cache is empty.
- It starts a non-blocking full crawl after app startup.
- Searches use cached data first.
- Exact-looking airport codes trigger a direct AirportGap code lookup if not cached.
- Non-empty searches may fetch additional pages until enough matches are found or the per-query fetch limit is reached.
- The "plot all airports retrieved from API cache" toggle forces a full crawl before plotting all cached airports.

The cache status panel reports total airports, cached pages, crawl progress, full-crawl state, hit/miss counts, and search request count.

## External Services

- AirportGap API: airport lists, airport details, and distance calculation.
- OpenStreetMap tile servers: Leaflet base map tiles.
- jsDelivr/unpkg CDNs: Leaflet assets loaded by `renderer/index.html`.

## Tests

Current automated coverage is Python-only:

- `tests/test_distance.py` verifies known JFK/LHR distance ranges, mile conversion, route summation, and short-route behavior.

There are currently no Electron unit tests, renderer tests, or lint scripts.
