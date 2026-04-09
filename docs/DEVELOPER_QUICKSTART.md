# Developer Quickstart

## Prerequisites

- Python 3.10+
- Node.js 18+ (recommended for modern Electron toolchains)
- npm

## Project Layout (at a glance)

- Python CLI: `src/`
- Python tests: `tests/`
- Offline data: `data/`
- Electron app: `electron-airports/`

---

## 1) Python CLI

### Run common commands

From repository root:

```bash
python -m src lookup JFK
python -m src distance JFK LHR
python -m src distance JFK LHR --miles
python -m src route JFK LHR CDG
python -m src route JFK LHR CDG --miles
```

Use a specific CSV file:

```bash
python -m src --db data/airports_sample.csv lookup DXB
```

### Run tests

```bash
pytest -q
```

If `pytest` is missing:

```bash
python -m pip install pytest
```

---

## 2) Electron Desktop App

```bash
cd electron-airports
npm install
npm start
```

App behavior notes:

- Searches AirportGap airports with local cache + background crawl.
- Persists cache to Electron user-data directory.
- Shows crawl/cache stats in the UI.

---

## 3) High-Value Dev Workflows

### Quick sanity pass

1. Run Python CLI lookup/distance commands.
2. Run Python tests (`pytest -q`).
3. Launch Electron app and compare two airports.
4. Toggle "plot all cached airports" and confirm map updates.

### Before opening a PR

- Re-run manual smoke checks above.
- Update docs if commands, architecture, or file layout changed.
- Include screenshots/GIFs for renderer/UI changes.

---

## 4) Troubleshooting

- **`pytest: command not found`**: install pytest via pip.
- **Electron launch failures**: verify Node/npm versions and rerun `npm install`.
- **No airport results initially**: app may still be crawling; check cache status panel.
- **Map tile issues**: confirm internet connectivity to OpenStreetMap tile servers.
