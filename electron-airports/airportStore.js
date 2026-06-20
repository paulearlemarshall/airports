const fs = require('node:fs/promises');
const path = require('node:path');

const CACHE_VERSION = 1;
const SEARCH_RESULT_LIMIT = 500;
const MAX_PAGE_FETCHES_PER_QUERY = 20;

class AirportStore {
  constructor({ cachePath, client }) {
    this.cachePath = cachePath;
    this.client = client;

    this.pageCache = new Map();
    this.airports = [];
    this.airportKeyIndex = new Map();
    this.nextPageToFetch = 1;
    this.lastPage = null;
    this.crawlInProgress = null;
    this.diskCacheLoaded = false;
    this.stats = {
      searchRequests: 0,
      pageHits: 0,
      pageMisses: 0,
      codeHits: 0,
      codeMisses: 0,
    };
  }

  addAirport(airport) {
    const key = `${airport.iata}|${airport.icao}|${airport.name}|${airport.city}|${airport.country}`;
    if (this.airportKeyIndex.has(key)) return;

    this.airportKeyIndex.set(key, airport);
    this.airports.push(airport);

    if (airport.iata) this.airportKeyIndex.set(`IATA:${airport.iata}`, airport);
    if (airport.icao) this.airportKeyIndex.set(`ICAO:${airport.icao}`, airport);
  }

  cacheMeta() {
    return {
      totalAirports: this.airports.length,
      pagesCached: this.pageCache.size,
      nextPageToFetch: this.nextPageToFetch,
      lastPage: this.lastPage,
      crawlProgressPage: Math.max(0, this.nextPageToFetch - 1),
      fullyCrawled: this.lastPage !== null && this.nextPageToFetch > this.lastPage,
      crawlInProgress: Boolean(this.crawlInProgress),
      diskCachePath: this.cachePath,
      diskCacheLoaded: this.diskCacheLoaded,
      stats: {
        ...this.stats,
        totalHits: this.stats.pageHits + this.stats.codeHits,
        totalMisses: this.stats.pageMisses + this.stats.codeMisses,
      },
    };
  }

  async loadDiskCache() {
    if (!this.cachePath) return false;

    try {
      const raw = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CACHE_VERSION) return false;

      const airports = Array.isArray(parsed.airports) ? parsed.airports : [];
      const pages = parsed.pages && typeof parsed.pages === 'object' ? parsed.pages : {};

      this.airports.length = 0;
      this.airportKeyIndex.clear();
      this.pageCache.clear();

      for (const airport of airports) {
        this.addAirport(this.client.normalizeAirport(airport));
      }

      for (const [pageKey, rows] of Object.entries(pages)) {
        const page = Number(pageKey);
        if (!Number.isFinite(page)) continue;
        const normalizedRows = Array.isArray(rows)
          ? rows.map((row) => this.client.normalizeAirport(row))
          : [];
        this.pageCache.set(page, normalizedRows);
      }

      this.lastPage = Number.isFinite(parsed?.meta?.lastPage) ? Number(parsed.meta.lastPage) : null;
      this.nextPageToFetch = Number.isFinite(parsed?.meta?.nextPageToFetch)
        ? Number(parsed.meta.nextPageToFetch)
        : (this.lastPage ? this.lastPage + 1 : 1);

      this.diskCacheLoaded = true;
      return true;
    } catch {
      this.diskCacheLoaded = false;
      return false;
    }
  }

  async saveDiskCache() {
    if (!this.cachePath) return;

    const payload = {
      version: CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      meta: {
        nextPageToFetch: this.nextPageToFetch,
        lastPage: this.lastPage,
      },
      airports: this.airports,
      pages: Object.fromEntries(this.pageCache),
    };

    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify(payload), 'utf-8');
  }

  async fetchAirportPage(page) {
    if (this.pageCache.has(page)) {
      this.stats.pageHits += 1;
      return this.pageCache.get(page);
    }

    this.stats.pageMisses += 1;
    const { airports, lastPage } = await this.client.getAirportPage(page);

    this.pageCache.set(page, airports);
    for (const airport of airports) this.addAirport(airport);
    if (lastPage) this.lastPage = lastPage;

    return airports;
  }

  sortAirportsAlpha(list) {
    return [...list].sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return (a.iata || a.icao || '').localeCompare(b.iata || b.icao || '');
    });
  }

  filterCachedAirports(query, limit) {
    const q = query.toLowerCase();
    const filtered = q
      ? this.airports.filter(
          (airport) =>
            airport.iata.toLowerCase().includes(q) ||
            airport.icao.toLowerCase().includes(q) ||
            airport.name.toLowerCase().includes(q) ||
            airport.city.toLowerCase().includes(q) ||
            airport.country.toLowerCase().includes(q)
        )
      : this.airports;

    const sorted = this.sortAirportsAlpha(filtered);
    return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
  }

  async fetchSingleByCodeMaybe(query) {
    const code = String(query || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;

    const cached = this.airportKeyIndex.get(`IATA:${code}`) || this.airportKeyIndex.get(`ICAO:${code}`);
    if (cached) {
      this.stats.codeHits += 1;
      return cached;
    }

    this.stats.codeMisses += 1;
    try {
      const airport = await this.client.getAirportByCode(code);
      if (airport.iata || airport.icao || airport.name) {
        this.addAirport(airport);
        return airport;
      }
    } catch {
      return null;
    }

    return null;
  }

  async ensureFirstPage() {
    if (this.airports.length > 0) return;

    await this.fetchAirportPage(1);
    this.nextPageToFetch = Math.max(this.nextPageToFetch, 2);
    await this.saveDiskCache();
  }

  startBackgroundCrawl() {
    if (this.crawlInProgress || (this.lastPage !== null && this.nextPageToFetch > this.lastPage)) {
      return;
    }

    void this.crawlAllAirports().catch(() => {
      // Keep searches responsive even if the full crawl fails.
    });
  }

  async crawlAllAirports() {
    if (this.crawlInProgress) return this.crawlInProgress;

    this.crawlInProgress = (async () => {
      await this.ensureFirstPage();

      if (this.lastPage === null) {
        await this.fetchAirportPage(1);
        this.nextPageToFetch = Math.max(this.nextPageToFetch, 2);
      }

      while (this.lastPage !== null && this.nextPageToFetch <= this.lastPage) {
        await this.fetchAirportPage(this.nextPageToFetch);
        this.nextPageToFetch += 1;

        if (this.nextPageToFetch % 10 === 0) {
          await this.saveDiskCache();
        }
      }

      await this.saveDiskCache();
      return this.cacheMeta();
    })();

    try {
      return await this.crawlInProgress;
    } finally {
      this.crawlInProgress = null;
    }
  }

  async searchAirportOptions(query) {
    this.stats.searchRequests += 1;

    const q = String(query || '').trim();

    if (!q) {
      await this.ensureFirstPage();
      this.startBackgroundCrawl();
      return this.filterCachedAirports('', undefined);
    }

    await this.ensureFirstPage();

    const codeCandidate = await this.fetchSingleByCodeMaybe(q);
    let matches = this.filterCachedAirports(q, SEARCH_RESULT_LIMIT);

    if (
      codeCandidate &&
      !matches.some(
        (match) =>
          (match.iata && match.iata === codeCandidate.iata) ||
          (match.icao && match.icao === codeCandidate.icao)
      )
    ) {
      matches = [codeCandidate, ...matches].slice(0, SEARCH_RESULT_LIMIT);
    }

    let fetched = 0;
    while (
      matches.length < SEARCH_RESULT_LIMIT &&
      fetched < MAX_PAGE_FETCHES_PER_QUERY &&
      (this.lastPage === null || this.nextPageToFetch <= this.lastPage)
    ) {
      await this.fetchAirportPage(this.nextPageToFetch);
      this.nextPageToFetch += 1;
      fetched += 1;
      matches = this.filterCachedAirports(q, SEARCH_RESULT_LIMIT);
    }

    if (fetched > 0) await this.saveDiskCache();
    return matches;
  }

  async getRetrievedAirports() {
    await this.ensureFirstPage();
    return this.sortAirportsAlpha(this.airports);
  }
}

module.exports = {
  AirportStore,
};
