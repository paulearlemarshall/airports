# Code Review Report

## Executive Summary

The repository is organized clearly and separates concerns between a Python CLI (`src/`) and an Electron desktop app (`electron-airports/`). Core distance math is small and covered by tests. The largest quality risks are around validation defaults in CSV parsing, test coverage gaps outside distance math, and maintainability of the large Electron main-process module.

## Strengths

- Clear project split between CLI and desktop app.
- Python distance logic is readable and deterministic (`src/distance.py`).
- CLI argument design is straightforward and user-friendly (`src/cli.py`).
- Electron preload uses context isolation and a narrow IPC surface (`electron-airports/preload.js`).
- Electron app includes practical caching and background crawling behavior (`electron-airports/main.js`).

## Issues by Severity

### High

- No high-severity issues identified in this quick review.

### Medium

1. **Silent fallback of invalid coordinates to `0.0` can produce incorrect results**
   - File: `src/airports_db.py` (`_parse_float`, `load_airports`)
   - Why it matters: malformed `lat/lon` values become valid-looking coordinates at `(0,0)`, which can corrupt lookup and route calculations without obvious errors.
   - Recommendation: validate coordinates strictly; either skip invalid rows with warnings or raise a data validation error.

2. **Electron app still needs automated JavaScript checks**
   - File: `electron-airports/package.json`
   - Why it matters: Electron behavior now lives in smaller modules, but regressions still rely mainly on manual app smoke checks.
   - Recommendation: add linting and targeted tests for the API client, cache/search store, IPC registration, and renderer flows.

3. **Runtime resilience for external API could be stronger**
   - File: `electron-airports/main.js` (`fetchJson`, crawl/search paths)
   - Why it matters: there is timeout handling, but no retry/backoff strategy for transient failures while crawling or searching.
   - Recommendation: add bounded retry, such as 1-3 attempts with jittered backoff, for retry-safe GET requests.

### Low

1. **Potential startup overhead from immediate background crawl**
   - File: `electron-airports/main.js` (`app.whenReady` -> `crawlAllAirports`)
   - Recommendation: delay or condition crawling based on user interaction or cache staleness.

2. **Renderer module is still large**
   - File: `electron-airports/renderer/app.js`
   - Recommendation: split map rendering, selector state, and compare workflow if the renderer grows further.

## Test Coverage Gaps

Current tests cover only geodesic math (`tests/test_distance.py`). Missing coverage areas:

- CSV parsing and validation edge cases (`src/airports_db.py`)
- CLI command behavior and error handling (`src/cli.py`)
- IPC handler behavior and cache state transitions (`electron-airports/main.js`)
- Renderer interaction flows (`electron-airports/renderer/app.js`)

## Prioritized Recommendations

1. Harden CSV validation in `load_airports` so invalid coordinates do not silently fall back to `0.0`.
2. Add CLI and DB unit tests for lookup, distance, route command paths, and invalid input handling.
3. Add retry/backoff for API GETs and clearer error classification for network, data, and API errors.
4. Add JS lint/test tooling for Electron code and include commands in docs or CI.
5. Split renderer map/select/compare behavior if UI complexity continues to grow.
