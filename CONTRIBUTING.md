# Contributing

## Development Setup

Install Python and Node.js dependencies as needed:

```bash
python -m pip install pytest
cd electron-airports
npm install
```

## Checks

Run Python tests from the repository root:

```bash
pytest -q
```

Run the Electron app manually:

```bash
cd electron-airports
npm start
```

There are currently no JavaScript lint or test scripts. Use the manual smoke check in `docs/DEVELOPER_QUICKSTART.md` for Electron changes.

## Documentation

Keep documentation changes with behavior changes:

- Update `README.md` for user-facing commands, features, requirements, and limitations.
- Update `docs/CODEBASE_OVERVIEW.md` for architecture, file layout, data flow, API surface, and cache behavior.
- Update `docs/DEVELOPER_QUICKSTART.md` for setup, run, test, smoke-check, or troubleshooting changes.

## Pull Request Checklist

- Python tests pass with `pytest -q`.
- Electron app starts with `npm start` when the change touches `electron-airports/`.
- Relevant manual smoke checks were completed.
- Documentation was updated for user-visible or architectural changes.
- Known limitations or skipped checks are called out in the PR description.
