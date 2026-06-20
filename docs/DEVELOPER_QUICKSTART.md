# Developer Quickstart

Use this guide to install, run, test, and smoke-check the project locally.

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Internet access for the Electron app

Optional:

- `pytest` for Python tests

Install `pytest` if needed:

```bash
python -m pip install pytest
```

## Python CLI

Run commands from the repository root.

Lookup:

```bash
python -m src lookup JFK
```

Distance:

```bash
python -m src distance JFK LHR
python -m src distance JFK LHR --miles
```

Route:

```bash
python -m src route JFK LHR CDG
python -m src route JFK LHR CDG --miles
```

Custom CSV:

```bash
python -m src --db data/airports_sample.csv lookup DXB
```

Run tests:

```bash
pytest -q
```

## Electron Desktop App

Install dependencies and start the app:

```bash
cd electron-airports
npm install
npm start
```

The app opens an Electron window. It needs network access for AirportGap API calls, Leaflet assets, and OpenStreetMap tiles.

## Manual Smoke Check

1. Start the Electron app.
2. Confirm the app loads with From and To selectors.
3. Confirm the default comparison runs or select two airports manually.
4. Click `Show info + distance`.
5. Confirm both airport panels show JSON details.
6. Confirm the distance panel shows kilometers, miles, and nautical miles.
7. Confirm the map shows two markers and an animated great-circle route.
8. Hover over the route and markers to confirm tooltips/popups.
9. Toggle `Auto show on airport click`, then change a selector and confirm the comparison refreshes.
10. Toggle `Plot all airports retrieved from API cache` and confirm the cache crawl completes and extra airport markers appear.
11. Confirm the cache status panel updates while searching or crawling.

## Development Notes

- The Python CLI and Electron app are independent runtime surfaces.
- The CLI uses local CSV data only.
- The Electron app uses AirportGap at runtime and keeps a disk cache in Electron's user data directory.
- `electron-airports/main.js` handles app bootstrap and lifecycle.
- `electron-airports/airportgapClient.js` owns AirportGap requests and response normalization.
- `electron-airports/airportStore.js` owns cache, crawl, search, and persistence behavior.
- `electron-airports/ipcHandlers.js` wires the store/client to Electron IPC.
- `electron-airports/preload.js` is the only renderer bridge.
- The renderer should call `window.airportApi`; it should not assume Node.js APIs are available.

## Before Opening A Pull Request

- Run `pytest -q`.
- Launch the Electron app with `npm start`.
- Complete the manual smoke check for any UI, API, cache, or map change.
- Update `README.md` and `docs/CODEBASE_OVERVIEW.md` when behavior, commands, file layout, or architecture changes.
- Mention any manual checks that could not be completed.

## Troubleshooting

### `python` is not found

Use your platform's Python launcher or add Python to `PATH`. On Windows, `py -m src lookup JFK` may work if the Python launcher is installed.

### `pytest` is not found

Install it:

```bash
python -m pip install pytest
```

### Electron does not launch

Reinstall dependencies from the Electron app directory:

```bash
cd electron-airports
npm install
npm start
```

Also confirm Node.js 18+ is available:

```bash
node --version
npm --version
```

### Airport search or distance calls fail

Confirm internet access and retry. The app depends on AirportGap for live airport details and distance calculations.

### Map tiles do not load

Confirm internet access to OpenStreetMap tile servers and the Leaflet CDN assets referenced in `electron-airports/renderer/index.html`.
