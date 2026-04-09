const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const AIRPORTGAP_BASE = 'https://airportgap.com/api';
const CACHE_VERSION = 1;

const PAGE_CACHE = new Map();
const AIRPORTS = [];
const AIRPORT_KEY_INDEX = new Map();

let NEXT_PAGE_TO_FETCH = 1;
let LAST_PAGE = null;
let CRAWL_IN_PROGRESS = null;
let DISK_CACHE_PATH = '';
let DISK_CACHE_LOADED = false;

const CACHE_STATS = {
  searchRequests: 0,
  pageHits: 0,
  pageMisses: 0,
  codeHits: 0,
  codeMisses: 0,
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function fetchJson(url, options = {}) {
  const timeoutMs = Number.isFinite(options?.timeoutMs) ? options.timeoutMs : 10000;
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;

  let controller;
  let timeoutId;

  if (!fetchOptions.signal) {
    controller = new AbortController();
    fetchOptions.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      const message = body?.error || body?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeAirport(attr) {
  return {
    iata: String(attr?.iata || '').trim().toUpperCase(),
    icao: String(attr?.icao || '').trim().toUpperCase(),
    name: String(attr?.name || '').trim(),
    city: String(attr?.city || '').trim(),
    country: String(attr?.country || '').trim(),
    latitude: Number(attr?.latitude),
    longitude: Number(attr?.longitude),
    altitude: Number(attr?.altitude),
    timezone: String(attr?.timezone || '').trim(),
  };
}

function addAirportToCache(airport) {
  const key = `${airport.iata}|${airport.icao}|${airport.name}|${airport.city}|${airport.country}`;
  if (AIRPORT_KEY_INDEX.has(key)) return;

  AIRPORT_KEY_INDEX.set(key, airport);
  AIRPORTS.push(airport);

  if (airport.iata) AIRPORT_KEY_INDEX.set(`IATA:${airport.iata}`, airport);
  if (airport.icao) AIRPORT_KEY_INDEX.set(`ICAO:${airport.icao}`, airport);
}

function parseLastPage(links) {
  const last = links?.last;
  if (!last) return null;
  try {
    const url = new URL(last);
    const page = Number(url.searchParams.get('page'));
    return Number.isFinite(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

async function fetchAirportPage(page) {
  if (PAGE_CACHE.has(page)) {
    CACHE_STATS.pageHits += 1;
    return PAGE_CACHE.get(page);
  }

  CACHE_STATS.pageMisses += 1;
  const payload = await fetchJson(`${AIRPORTGAP_BASE}/airports?page=${page}`);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const options = rows.map((row) => normalizeAirport(row?.attributes));

  PAGE_CACHE.set(page, options);
  for (const airport of options) addAirportToCache(airport);

  const parsedLastPage = parseLastPage(payload?.links);
  if (parsedLastPage) LAST_PAGE = parsedLastPage;

  return options;
}

function sortAirportsAlpha(list) {
  return [...list].sort((a, b) => {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    if (an !== bn) return an.localeCompare(bn);
    return (a.iata || a.icao || '').localeCompare(b.iata || b.icao || '');
  });
}

function filterCachedAirports(query, limit) {
  const q = query.toLowerCase();
  const filtered = q
    ? AIRPORTS.filter(
        (a) =>
          a.iata.toLowerCase().includes(q) ||
          a.icao.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      )
    : AIRPORTS;

  const sorted = sortAirportsAlpha(filtered);
  return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

async function fetchSingleByCodeMaybe(query) {
  const code = String(query || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;

  const cached = AIRPORT_KEY_INDEX.get(`IATA:${code}`) || AIRPORT_KEY_INDEX.get(`ICAO:${code}`);
  if (cached) {
    CACHE_STATS.codeHits += 1;
    return cached;
  }

  CACHE_STATS.codeMisses += 1;
  try {
    const payload = await fetchJson(`${AIRPORTGAP_BASE}/airports/${encodeURIComponent(code)}`);
    const airport = normalizeAirport(payload?.data?.attributes || {});
    if (airport.iata || airport.icao || airport.name) {
      addAirportToCache(airport);
      return airport;
    }
  } catch {
    return null;
  }

  return null;
}

function cacheMeta() {
  return {
    totalAirports: AIRPORTS.length,
    pagesCached: PAGE_CACHE.size,
    nextPageToFetch: NEXT_PAGE_TO_FETCH,
    lastPage: LAST_PAGE,
    crawlProgressPage: Math.max(0, NEXT_PAGE_TO_FETCH - 1),
    fullyCrawled: LAST_PAGE !== null && NEXT_PAGE_TO_FETCH > LAST_PAGE,
    crawlInProgress: Boolean(CRAWL_IN_PROGRESS),
    diskCachePath: DISK_CACHE_PATH,
    diskCacheLoaded: DISK_CACHE_LOADED,
    stats: {
      ...CACHE_STATS,
      totalHits: CACHE_STATS.pageHits + CACHE_STATS.codeHits,
      totalMisses: CACHE_STATS.pageMisses + CACHE_STATS.codeMisses,
    },
  };
}

async function saveDiskCache() {
  if (!DISK_CACHE_PATH) return;

  const payload = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    meta: {
      nextPageToFetch: NEXT_PAGE_TO_FETCH,
      lastPage: LAST_PAGE,
    },
    airports: AIRPORTS,
    pages: Object.fromEntries(PAGE_CACHE),
  };

  await fs.mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
  await fs.writeFile(DISK_CACHE_PATH, JSON.stringify(payload), 'utf-8');
}

async function loadDiskCache() {
  if (!DISK_CACHE_PATH) return false;

  try {
    const raw = await fs.readFile(DISK_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CACHE_VERSION) return false;

    const airports = Array.isArray(parsed.airports) ? parsed.airports : [];
    const pages = parsed.pages && typeof parsed.pages === 'object' ? parsed.pages : {};

    AIRPORTS.length = 0;
    AIRPORT_KEY_INDEX.clear();
    PAGE_CACHE.clear();

    for (const a of airports) addAirportToCache(normalizeAirport(a));
    for (const [pageKey, rows] of Object.entries(pages)) {
      const page = Number(pageKey);
      if (!Number.isFinite(page)) continue;
      const normalizedRows = Array.isArray(rows) ? rows.map((r) => normalizeAirport(r)) : [];
      PAGE_CACHE.set(page, normalizedRows);
    }

    LAST_PAGE = Number.isFinite(parsed?.meta?.lastPage) ? Number(parsed.meta.lastPage) : null;
    NEXT_PAGE_TO_FETCH = Number.isFinite(parsed?.meta?.nextPageToFetch)
      ? Number(parsed.meta.nextPageToFetch)
      : (LAST_PAGE ? LAST_PAGE + 1 : 1);

    DISK_CACHE_LOADED = true;
    return true;
  } catch {
    DISK_CACHE_LOADED = false;
    return false;
  }
}

async function crawlAllAirports() {
  if (CRAWL_IN_PROGRESS) return CRAWL_IN_PROGRESS;

  CRAWL_IN_PROGRESS = (async () => {
    if (AIRPORTS.length === 0) {
      await fetchAirportPage(1);
      NEXT_PAGE_TO_FETCH = Math.max(NEXT_PAGE_TO_FETCH, 2);
      await saveDiskCache();
    }

    if (LAST_PAGE === null) {
      await fetchAirportPage(1);
      NEXT_PAGE_TO_FETCH = Math.max(NEXT_PAGE_TO_FETCH, 2);
    }

    while (LAST_PAGE !== null && NEXT_PAGE_TO_FETCH <= LAST_PAGE) {
      await fetchAirportPage(NEXT_PAGE_TO_FETCH);
      NEXT_PAGE_TO_FETCH += 1;

      // periodic persistence
      if (NEXT_PAGE_TO_FETCH % 10 === 0) {
        await saveDiskCache();
      }
    }

    await saveDiskCache();
    return cacheMeta();
  })();

  try {
    return await CRAWL_IN_PROGRESS;
  } finally {
    CRAWL_IN_PROGRESS = null;
  }
}

async function searchAirportOptions(query) {
  CACHE_STATS.searchRequests += 1;

  const q = String(query || '').trim();

  // For empty filter, return quickly using currently cached data.
  // Keep a full crawl running in the background so the list improves over time.
  if (!q) {
    if (AIRPORTS.length === 0) {
      await fetchAirportPage(1);
      NEXT_PAGE_TO_FETCH = Math.max(NEXT_PAGE_TO_FETCH, 2);
      await saveDiskCache();
    }

    if (!CRAWL_IN_PROGRESS && (LAST_PAGE === null || NEXT_PAGE_TO_FETCH <= LAST_PAGE)) {
      void crawlAllAirports().catch(() => {
        // Keep search responsive even if full crawl fails.
      });
    }

    return filterCachedAirports('', undefined);
  }

  const limit = 500;

  if (AIRPORTS.length === 0) {
    await fetchAirportPage(1);
    NEXT_PAGE_TO_FETCH = Math.max(NEXT_PAGE_TO_FETCH, 2);
    await saveDiskCache();
  }

  const codeCandidate = await fetchSingleByCodeMaybe(q);

  let matches = filterCachedAirports(q, limit);
  if (
    codeCandidate &&
    !matches.some((m) => (m.iata && m.iata === codeCandidate.iata) || (m.icao && m.icao === codeCandidate.icao))
  ) {
    matches = [codeCandidate, ...matches].slice(0, limit);
  }

  // If full crawl hasn't happened yet, keep pulling pages until we have strong matches.
  const maxPageFetchesPerQuery = 20;
  let fetched = 0;

  while (
    matches.length < limit &&
    fetched < maxPageFetchesPerQuery &&
    (LAST_PAGE === null || NEXT_PAGE_TO_FETCH <= LAST_PAGE)
  ) {
    await fetchAirportPage(NEXT_PAGE_TO_FETCH);
    NEXT_PAGE_TO_FETCH += 1;
    fetched += 1;
    matches = filterCachedAirports(q, limit);
  }

  if (fetched > 0) await saveDiskCache();

  return matches;
}

ipcMain.handle('airports:searchOptions', async (_event, query) => {
  return searchAirportOptions(query);
});

ipcMain.handle('airports:getDetails', async (_event, code) => {
  const airportCode = String(code || '').trim().toUpperCase();
  if (!airportCode) {
    throw new Error('Airport code is required');
  }

  const url = `${AIRPORTGAP_BASE}/airports/${encodeURIComponent(airportCode)}`;
  return fetchJson(url);
});

ipcMain.handle('airports:getRetrievedAirports', async () => {
  if (AIRPORTS.length === 0) {
    await fetchAirportPage(1);
    NEXT_PAGE_TO_FETCH = Math.max(NEXT_PAGE_TO_FETCH, 2);
    await saveDiskCache();
  }
  return sortAirportsAlpha(AIRPORTS);
});

ipcMain.handle('airports:crawlAll', async () => {
  return crawlAllAirports();
});

ipcMain.handle('airports:cacheStatus', async () => {
  return cacheMeta();
});

ipcMain.handle('airports:getDistance', async (_event, fromCode, toCode) => {
  const from = String(fromCode || '').trim().toUpperCase();
  const to = String(toCode || '').trim().toUpperCase();

  if (!from || !to) {
    throw new Error('Both airport codes are required');
  }

  const body = new URLSearchParams({ from, to }).toString();
  return fetchJson(`${AIRPORTGAP_BASE}/airports/distance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
});

app.whenReady().then(async () => {
  DISK_CACHE_PATH = path.join(app.getPath('userData'), 'airportgap-airports-cache.json');

  await loadDiskCache();

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('tile.openstreetmap.org')) {
      details.requestHeaders['Referer'] = 'https://airportgap.com/';
      details.requestHeaders['User-Agent'] =
        details.requestHeaders['User-Agent'] || 'airport-distance-desktop/1.0 (+https://airportgap.com/)';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Non-blocking background crawl for complete list.
  void crawlAllAirports().catch(() => {
    // Keep app usable even if full crawl fails.
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function isBrokenPipeError(err) {
  return err && (err.code === 'EPIPE' || String(err.message || '').toLowerCase().includes('broken pipe'));
}

if (process.stdout) {
  process.stdout.on('error', (err) => {
    if (!isBrokenPipeError(err)) {
      console.error('stdout error:', err);
    }
  });
}

if (process.stderr) {
  process.stderr.on('error', (err) => {
    if (!isBrokenPipeError(err)) {
      console.error('stderr error:', err);
    }
  });
}

process.on('uncaughtException', (err) => {
  if (!isBrokenPipeError(err)) {
    console.error('uncaught exception:', err);
  }
});

app.on('before-quit', () => {
  // Best-effort cache persistence on exit.
  void saveDiskCache().catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
