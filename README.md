# Airports CLI

Small Python app for:

- airport code lookup (IATA/ICAO)
- great-circle distance between airports
- multi-leg route distance

Data source in this repo: `data/airports_sample.csv`.

## Requirements

- Python 3.10+
- `pytest` for tests

## Run

From project root:

```bash
python -m src lookup JFK
python -m src distance JFK LHR
python -m src distance JFK LHR --miles
python -m src route JFK LHR CDG
python -m src route JFK LHR CDG --miles
```

You can also provide a custom dataset path:

```bash
python -m src --db data/airports_sample.csv lookup DXB
```

## Test

```bash
pytest -q
```

## CSV format

Expected columns:

- `iata`
- `icao`
- `name`
- `city`
- `country`
- `lat`
- `lon`

## Notes on API integration

This app currently works fully offline with local data. A common extension is:

1. local CSV lookup first
2. external API fallback (Amadeus, API Ninjas, AirportDB)
3. cache enriched results locally

## Electron Windows desktop app

A desktop UI is included under `electron-airports/`.

Features:

- two searchable airport selectors (prefiltered from local CSV)
- live airport details from AirportGap API (`/api/airports/{code}`)
- distance from AirportGap API (`POST /api/airports/distance`)
- interactive map (Leaflet) with both airport points and a rendered great-circle arc

Run:

```bash
cd electron-airports
npm install
npm start
```
