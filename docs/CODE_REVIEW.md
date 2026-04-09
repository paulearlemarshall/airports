# Code Review Report

## Executive Summary

The repository is organized clearly and separates concerns between a Python CLI (`src/`) and an Electron desktop app (`electron-airports/`). Core distance math is clean and covered by tests. The largest quality risks are around validation defaults in CSV parsing, test coverage gaps outside distance math, and maintainability of the large Electron main-process module.

## Strengths

- Clear project split between CLI and desktop app.
- Python distance logic is small, readable, and deterministic (`src/distance.py`).
- CLI argument design is straightforward and user-friendly (`src/cli.py`).
- Electron preload uses context isolation and a narrow IPC surface (`electron-airports/preload.js`).
- Electron app includes practical caching and background crawling behavior (`electron-airports/main.js`).

## Issues by Severity

### High

- **No high-severity issues identified in this quick review.**

### Medium

1. **Silent fallback of invalid coordinates to `0.0` can produce incorrect results**  
   - File: `src/airports_db.py` (`_parse_float`, `load_airports`)  
   - Why it matters: malformed `lat/lon` values become valid-looking coordinates at `(0,0)`, which can corrupt lookup and route calculations without obvious errors.  
   - Recommendation: validate coordinates strictly; either skip invalid rows with warnings or raise a data validation error.

2. **Electron main process is doing too much in one file**  
   - File: `electron-airports/main.js`  
   - Why it matters: one large module handles window bootstrap, API client, caching, crawling, persistence, and IPC, making future changes riskier.  
   - Recommendation: extract modules (e.g., `apiClient.js`, `cacheStore.js`, `crawlService.js`, `ipcHandlers.js`).

3. **Runtime resilience for external API could be stronger**  
   - File: `electron-airports/main.js` (`fetchJson`, crawl/search paths)  
   - Why it matters: there is timeout handling, but no retry/backoff strategy for transient failures while crawling or searching.  
   - Recommendation: add bounded retry (e.g., 1–3 attempts with jittered backoff) for retry-safe GET requests.

### Low

1. **Potential startup overhead from immediate background crawl**  
   - File: `electron-airports/main.js` (`app.whenReady` -> `crawlAllAirports`)  
   - Recommendation: delay/condition crawl based on user interaction or cache staleness.

2. **No dedicated JS lint/test scripts in Electron package**  
   - File: `electron-airports/package.json`  
   - Recommendation: add `lint` and `test` scripts to improve confidence for renderer/main changes.

## Test Coverage Gaps

Current tests cover only geodesic math (`tests/test_distance.py`). Missing coverage areas:

- CSV parsing/validation edge cases (`src/airports_db.py`)
- CLI command behavior and error handling (`src/cli.py`)
- IPC handler behavior and cache state transitions (`electron-airports/main.js`)
- Renderer interaction flows (`electron-airports/renderer/app.js`)

Also note: test execution could not be performed in this environment because `pytest` is not installed.

## Prioritized Recommendations

1. **Harden CSV validation** in `load_airports` (stop silent `0.0` fallback for invalid coordinates).
2. **Add CLI and DB unit tests** for lookup/distance/route command paths and invalid input handling.
3. **Modularize `electron-airports/main.js`** into smaller services and IPC router.
4. **Add retry/backoff for API GETs** and clearer error classification (network vs data vs API errors).
5. **Add JS lint/test tooling** for Electron code and include commands in docs/CI.
