# Airports

Airport lookup and distance tools with two front ends:

- A Python CLI for offline airport lookup and great-circle distance calculations.
- An Electron desktop app that searches AirportGap, compares two airports, and plots the route on a Leaflet map.

## Features

### Python CLI

- Look up an airport by IATA or ICAO code.
- Calculate distance between two airports in kilometers or miles.
- Calculate total distance for a multi-leg route.
- Use the included CSV data file or pass a custom airport CSV.

### Electron App

- Searchable From and To airport selectors.
- Live airport details from AirportGap.
- Distance results from AirportGap, including kilometers, miles, and nautical miles.
- Interactive Leaflet map with origin and destination markers.
- Animated great-circle route line with a distance tooltip.
- Optional plotting of all airports retrieved into the local cache.
- Hover popups for airport markers.
- Auto-show mode that recomputes when an airport is clicked.
- Cache status panel with crawl progress, hit/miss counts, and search request counts.
- Disk-backed AirportGap airport cache in Electron's user data directory.

## Requirements

- Python 3.10+
- Node.js 18+
- npm
- Internet access for the Electron app's AirportGap API calls and OpenStreetMap tiles
- `pytest` if you want to run the Python tests

## Quick Start

Run the Python CLI from the repository root:

```bash
python -m src lookup JFK
python -m src distance JFK LHR
python -m src distance JFK LHR --miles
python -m src route JFK LHR CDG
python -m src route JFK LHR CDG --miles
```

Run the Electron desktop app:

```bash
cd electron-airports
npm install
npm start
```

Run tests:

```bash
pytest -q
```

## CLI Data Format

The CLI reads CSV data from `data/airports_sample.csv` by default. Pass another file with `--db`:

```bash
python -m src --db data/airports_sample.csv lookup DXB
```

Required CSV columns:

- `iata`
- `icao`
- `name`
- `city`
- `country`
- `lat`
- `lon`

## Project Layout

```text
.
|-- data/                  # Sample CSV and AirportGap API snapshots
|-- docs/                  # Architecture, quickstart, and review notes
|-- electron-airports/     # Electron desktop app
|   |-- airportgapClient.js # AirportGap API client and response normalization
|   |-- airportStore.js    # Airport cache, crawl, search, and persistence service
|   |-- ipcHandlers.js     # Electron IPC handler registration
|   |-- main.js            # Electron app bootstrap and lifecycle
|   |-- preload.js         # Safe renderer API bridge
|   `-- renderer/          # HTML, CSS, and browser-side JavaScript
|-- src/                   # Python CLI package
`-- tests/                 # Python tests
```

## Documentation

- [Developer Quickstart](docs/DEVELOPER_QUICKSTART.md)
- [Codebase Overview](docs/CODEBASE_OVERVIEW.md)
- [Code Review Report](docs/CODE_REVIEW.md)

## Current Limitations

- The Python CLI is offline-only and does not call AirportGap.
- Python tests currently cover distance math only.
- The Electron app does not currently have dedicated lint or test scripts.
- AirportGap and map tile availability affect the desktop app at runtime.
