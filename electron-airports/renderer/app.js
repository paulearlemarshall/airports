const fromFilter = document.getElementById('fromFilter');
const toFilter = document.getElementById('toFilter');
const fromSelect = document.getElementById('fromSelect');
const toSelect = document.getElementById('toSelect');
const fromClear = document.getElementById('fromClear');
const toClear = document.getElementById('toClear');
const fromPanel = document.getElementById('fromPanel');
const toPanel = document.getElementById('toPanel');
const compareBtn = document.getElementById('compareBtn');
const autoShowToggle = document.getElementById('autoShowToggle');
const plotAllToggle = document.getElementById('plotAllToggle');
const statusEl = document.getElementById('status');
const cacheStatusEl = document.getElementById('cacheStatus');
const fromInfoEl = document.getElementById('fromInfo');
const toInfoEl = document.getElementById('toInfo');
const fromCountEl = document.getElementById('fromCount');
const toCountEl = document.getElementById('toCount');
const distanceInfoEl = document.getElementById('distanceInfo');

const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let mapLayerGroup = L.layerGroup().addTo(map);
let arcAnimationFrameId = null;
let arcAnimationToken = 0;
let syncingPanels = false;
let autoShowTimerId = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function renderCacheStatus(meta) {
  if (!cacheStatusEl) return;
  if (!meta) {
    cacheStatusEl.textContent = 'Cache status unavailable.';
    return;
  }

  const stats = meta.stats || {};
  const lastPageLabel = meta.lastPage ?? '?';
  const progressLabel = `${meta.crawlProgressPage ?? 0}/${lastPageLabel}`;

  cacheStatusEl.textContent = [
    `Cache: ${meta.totalAirports ?? 0} airports | ${meta.pagesCached ?? 0} pages | crawl ${progressLabel}${meta.crawlInProgress ? ' (running)' : ''}`,
    `Disk cache loaded: ${meta.diskCacheLoaded ? 'yes' : 'no'} | full crawl: ${meta.fullyCrawled ? 'yes' : 'no'}`,
    `Hits/Misses => pages ${stats.pageHits ?? 0}/${stats.pageMisses ?? 0}, code ${stats.codeHits ?? 0}/${stats.codeMisses ?? 0}, total ${stats.totalHits ?? 0}/${stats.totalMisses ?? 0}`,
    `Search requests: ${stats.searchRequests ?? 0}`,
  ].join('\n');
}

async function refreshCacheStatus() {
  try {
    const meta = await window.airportApi.cacheStatus();
    renderCacheStatus(meta);
  } catch {
    renderCacheStatus(null);
  }
}

function optionLabel(a) {
  return `${a.name} - ${a.city}, ${a.country} (${a.iata || a.icao || 'N/A'})`;
}

function pickAirportCode(a) {
  return (a.iata || a.icao || '').toUpperCase();
}

function selectedCode(selectEl) {
  const opt = selectEl?.selectedOptions?.[0];
  return opt?.dataset?.code || '';
}

function setSelectedByCode(selectEl, code) {
  const target = String(code || '').toUpperCase();
  if (!target) return false;

  for (let i = 0; i < selectEl.options.length; i += 1) {
    if ((selectEl.options[i].dataset.code || '').toUpperCase() === target) {
      selectEl.selectedIndex = i;
      return true;
    }
  }
  return false;
}

function updateCountLabel(selectEl, optionsCount) {
  const labelEl = selectEl === fromSelect ? fromCountEl : toCountEl;
  if (!labelEl) return;
  labelEl.textContent = `Showing ${optionsCount} airports`;
}

function populateSelect(selectEl, options, preferredCode = '') {
  const prev = selectedCode(selectEl);
  const preferred = preferredCode || prev;

  selectEl.replaceChildren();

  for (const airport of options) {
    const code = pickAirportCode(airport);
    const option = document.createElement('option');
    option.dataset.code = code;
    option.value = code;
    option.textContent = optionLabel(airport);
    selectEl.appendChild(option);
  }

  updateCountLabel(selectEl, options.length);

  if (selectEl.options.length === 0) return;

  if (!setSelectedByCode(selectEl, preferred)) {
    selectEl.selectedIndex = 0;
  }
}

async function refreshSelect(query, selectEl, preferredCode = '') {
  const options = await window.airportApi.searchOptions(query);
  populateSelect(selectEl, options || [], preferredCode);
  await refreshCacheStatus();
}

function renderAirportDetails(container, payload) {
  const attr = payload?.data?.attributes;
  if (!attr) {
    container.textContent = 'No data';
    return;
  }

  container.textContent = JSON.stringify(
    {
      name: attr.name,
      city: attr.city,
      country: attr.country,
      iata: attr.iata,
      icao: attr.icao,
      latitude: attr.latitude,
      longitude: attr.longitude,
      timezone: attr.timezone,
      altitude: attr.altitude,
    },
    null,
    2
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function airportDetailHtml(attr) {
  const iata = escapeHtml(attr.iata || 'N/A');
  const icao = escapeHtml(attr.icao || 'N/A');
  const name = escapeHtml(attr.name || 'Unknown airport');
  const city = escapeHtml(attr.city || 'Unknown city');
  const country = escapeHtml(attr.country || 'Unknown country');
  const latitude = escapeHtml(attr.latitude);
  const longitude = escapeHtml(attr.longitude);
  const timezone = escapeHtml(attr.timezone || 'N/A');
  const altitude = escapeHtml(attr.altitude ?? 'N/A');

  return `
    <div style="min-width:260px;line-height:1.35">
      <div><strong>${iata}/${icao}</strong></div>
      <div>${name}</div>
      <div>${city}, ${country}</div>
      <div>Lat/Lon: ${latitude}, ${longitude}</div>
      <div>Timezone: ${timezone}</div>
      <div>Altitude: ${altitude}</div>
    </div>
  `;
}

function bindHoverDetail(marker, html) {
  marker.bindPopup(html);
  marker.on('mouseover', () => marker.openPopup());
  marker.on('mouseout', () => marker.closePopup());
}

function stopArcAnimation() {
  arcAnimationToken += 1;
  if (arcAnimationFrameId !== null) {
    cancelAnimationFrame(arcAnimationFrameId);
    arcAnimationFrameId = null;
  }
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function buildGreatCirclePoints(fromLatLng, toLatLng, steps = 160) {
  const [lat1Deg, lon1Deg] = fromLatLng;
  const [lat2Deg, lon2Deg] = toLatLng;

  const lat1 = toRad(lat1Deg);
  const lon1 = toRad(lon1Deg);
  const lat2 = toRad(lat2Deg);
  const lon2 = toRad(lon2Deg);

  const sinDLat = Math.sin((lat2 - lat1) / 2);
  const sinDLon = Math.sin((lon2 - lon1) / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (!Number.isFinite(d) || d === 0) {
    return [fromLatLng, toLatLng];
  }

  const points = [];
  let prevLon = null;

  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    let lonDeg = toDeg(Math.atan2(y, x));

    if (prevLon !== null) {
      while (lonDeg - prevLon > 180) lonDeg -= 360;
      while (lonDeg - prevLon < -180) lonDeg += 360;
    }

    prevLon = lonDeg;
    points.push([toDeg(lat), lonDeg]);
  }

  return points;
}

function animateArc(points, style, hoverLabel = '') {
  stopArcAnimation();
  const token = ++arcAnimationToken;

  const polyline = L.polyline([points[0]], style).addTo(mapLayerGroup);
  if (hoverLabel) {
    polyline.bindTooltip(hoverLabel, { sticky: true, direction: 'top', opacity: 0.95 });
    polyline.on('mouseover', () => polyline.openTooltip());
  }

  const total = points.length;
  const durationMs = 1700;
  const start = performance.now();

  function tick(now) {
    if (token !== arcAnimationToken) return;

    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const count = Math.max(2, Math.floor(eased * (total - 1)) + 1);
    polyline.setLatLngs(points.slice(0, count));

    if (progress < 1) {
      arcAnimationFrameId = requestAnimationFrame(tick);
    } else {
      arcAnimationFrameId = null;
    }
  }

  arcAnimationFrameId = requestAnimationFrame(tick);
}

function drawGreatCircle(fromAttr, toAttr, extraAirports = [], arcHoverLabel = '') {
  stopArcAnimation();
  mapLayerGroup.clearLayers();

  const fromLatLng = [Number(fromAttr.latitude), Number(fromAttr.longitude)];
  const toLatLng = [Number(toAttr.latitude), Number(toAttr.longitude)];

  const fromMarker = L.circleMarker(fromLatLng, {
    radius: 9,
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 0.95,
    weight: 2,
  }).addTo(mapLayerGroup);

  const toMarker = L.circleMarker(toLatLng, {
    radius: 9,
    color: '#ef4444',
    fillColor: '#ef4444',
    fillOpacity: 0.95,
    weight: 2,
  }).addTo(mapLayerGroup);

  bindHoverDetail(fromMarker, airportDetailHtml(fromAttr));
  bindHoverDetail(toMarker, airportDetailHtml(toAttr));

  for (const airport of extraAirports) {
    const lat = Number(airport.latitude);
    const lon = Number(airport.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const marker = L.circleMarker([lat, lon], {
      radius: 3,
      color: '#94a3b8',
      fillColor: '#94a3b8',
      fillOpacity: 0.6,
      weight: 1,
    }).addTo(mapLayerGroup);

    bindHoverDetail(marker, airportDetailHtml(airport));
  }

  const arcPoints = buildGreatCirclePoints(fromLatLng, toLatLng, 180);
  animateArc(
    arcPoints,
    {
      color: '#0077ff',
      weight: 3,
      opacity: 0.95,
    },
    arcHoverLabel
  );

  const bounds = L.latLngBounds([fromLatLng, toLatLng]);
  map.fitBounds(bounds.pad(0.5));
}

function syncPanels(source, target) {
  if (!source || !target) return;
  if (syncingPanels) return;
  syncingPanels = true;
  target.open = source.open;
  syncingPanels = false;
}

function requestAutoShowCompare() {
  if (!autoShowToggle?.checked) return;

  if (autoShowTimerId !== null) {
    clearTimeout(autoShowTimerId);
  }

  autoShowTimerId = setTimeout(() => {
    autoShowTimerId = null;

    if (selectedCode(fromSelect) && selectedCode(toSelect)) {
      void runCompare();
    }
  }, 120);
}

async function runCompare() {
  try {
    setStatus('Loading airport data...');

    const fromCode = selectedCode(fromSelect);
    const toCode = selectedCode(toSelect);

    if (!fromCode || !toCode) {
      throw new Error('Please choose both airports first.');
    }

    const [fromDetails, toDetails, distancePayload] = await Promise.all([
      window.airportApi.getDetails(fromCode),
      window.airportApi.getDetails(toCode),
      window.airportApi.getDistance(fromCode, toCode),
    ]);

    renderAirportDetails(fromInfoEl, fromDetails);
    renderAirportDetails(toInfoEl, toDetails);

    const d = distancePayload?.data?.attributes;
    distanceInfoEl.textContent = JSON.stringify(
      {
        from: d?.from_airport?.iata,
        to: d?.to_airport?.iata,
        kilometers: d?.kilometers,
        miles: d?.miles,
        nautical_miles: d?.nautical_miles,
      },
      null,
      2
    );

    let extraAirports = [];
    if (plotAllToggle?.checked) {
      setStatus('Crawling AirportGap pages for full airport list...');
      await window.airportApi.crawlAllAirports();
      await refreshCacheStatus();
      const cached = await window.airportApi.getRetrievedAirports();
      extraAirports = (cached || []).map((a) => ({
        ...a,
        latitude: a.latitude,
        longitude: a.longitude,
      }));
    }

    const km = Number(d?.kilometers);
    const miles = Number(d?.miles);
    const arcHoverLabel = Number.isFinite(km) && Number.isFinite(miles) ? `${km.toFixed(2)} km | ${miles.toFixed(2)} mi` : '';

    drawGreatCircle(fromDetails.data.attributes, toDetails.data.attributes, extraAirports, arcHoverLabel);
    setStatus(
      plotAllToggle?.checked
        ? `Done. Great-circle path + ${extraAirports.length} cached airports plotted.`
        : 'Done. Airports plotted with great-circle path.'
    );
  } catch (error) {
    setStatus(error.message || 'Failed to fetch airport data.', true);
  }
}

fromFilter?.addEventListener('input', async () => {
  await refreshSelect(fromFilter.value, fromSelect);
});

toFilter?.addEventListener('input', async () => {
  await refreshSelect(toFilter.value, toSelect);
});

fromClear?.addEventListener('click', async () => {
  fromFilter.value = '';
  await refreshSelect('', fromSelect);
  fromFilter.focus();
});

toClear?.addEventListener('click', async () => {
  toFilter.value = '';
  await refreshSelect('', toSelect);
  toFilter.focus();
});

compareBtn.addEventListener('click', runCompare);

fromSelect?.addEventListener('click', requestAutoShowCompare);
toSelect?.addEventListener('click', requestAutoShowCompare);
fromSelect?.addEventListener('change', requestAutoShowCompare);
toSelect?.addEventListener('change', requestAutoShowCompare);

autoShowToggle?.addEventListener('change', () => {
  if (autoShowToggle.checked) {
    requestAutoShowCompare();
  }
});

plotAllToggle?.addEventListener('change', () => {
  if (selectedCode(fromSelect) && selectedCode(toSelect)) {
    void runCompare();
  }
});

fromPanel?.addEventListener('toggle', () => syncPanels(fromPanel, toPanel));
toPanel?.addEventListener('toggle', () => syncPanels(toPanel, fromPanel));

(async function init() {
  try {
    await refreshCacheStatus();
    await Promise.all([refreshSelect('', fromSelect, 'KIX'), refreshSelect('', toSelect, 'NRT')]);

    if (!selectedCode(fromSelect) && fromSelect.options.length > 0) fromSelect.selectedIndex = 0;
    if (!selectedCode(toSelect) && toSelect.options.length > 1) toSelect.selectedIndex = 1;
    else if (!selectedCode(toSelect) && toSelect.options.length > 0) toSelect.selectedIndex = 0;

    await runCompare();
  } catch {
    setStatus('Ready. Filter/select airports and click compare.');
  }

  setInterval(() => {
    void refreshCacheStatus();
  }, 3000);
})();
