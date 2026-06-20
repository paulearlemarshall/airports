const AIRPORTGAP_BASE = 'https://airportgap.com/api';

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

async function getAirportPage(page) {
  const payload = await fetchJson(`${AIRPORTGAP_BASE}/airports?page=${page}`);
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return {
    airports: rows.map((row) => normalizeAirport(row?.attributes)),
    lastPage: parseLastPage(payload?.links),
  };
}

async function getAirportDetails(code) {
  const airportCode = String(code || '').trim().toUpperCase();
  if (!airportCode) {
    throw new Error('Airport code is required');
  }

  return fetchJson(`${AIRPORTGAP_BASE}/airports/${encodeURIComponent(airportCode)}`);
}

async function getAirportByCode(code) {
  const payload = await getAirportDetails(code);
  return normalizeAirport(payload?.data?.attributes || {});
}

async function getDistance(fromCode, toCode) {
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
}

module.exports = {
  AIRPORTGAP_BASE,
  getAirportByCode,
  getAirportDetails,
  getAirportPage,
  getDistance,
  normalizeAirport,
};
