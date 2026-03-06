var map = L.map('map', {
  center: [25.276987, 55.296249],
  zoom: 8,
  minZoom: 2.299,
  maxZoom: 19
});

// ===============================
// API STATUS + LAST UPDATE
// ===============================
const lastUpdEl = document.getElementById("lastUpd");
const apiStatusEl = document.getElementById("connectedStatus");

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setLastUpdated() {
  if (!lastUpdEl) return;
  lastUpdEl.textContent = "Last Update: " + formatTime();
}

function setApiStatus(ok) {
  if (!apiStatusEl) return;

  apiStatusEl.textContent = "API Status: " + (ok ? "Connected" : "Disconnected");

  apiStatusEl.classList.remove("connected", "disconnected");
  apiStatusEl.classList.add(ok ? "connected" : "disconnected");
}

// ✅ World bounds lock (prevents panning above/beside the map)
const worldBounds = L.latLngBounds(
  L.latLng(-85, -180),
  L.latLng(85, 180)
);

map.setMaxBounds(worldBounds);
map.options.maxBoundsViscosity = 1.0;

// Dark Base Map (better for radar UI)
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19,
    noWrap: true,
    bounds: worldBounds
  }
).addTo(map);

// Day/Night Layer using Leaflet Terminator Plugin
const dayNightLayer = L.terminator({
  fillColor: "#ffffff",
  fillOpacity: 0.2,
  color: "#ffffff",
  weight: 0.5
}).addTo(map);

// DAY / NIGHT TOGGLE
const dayNightToggle = document.getElementById("dayNightToggle");

// Start enabled only if checked
if (!dayNightToggle.checked) {
  map.removeLayer(dayNightLayer);
}

dayNightToggle.addEventListener("change", function () {
  if (this.checked) {
    dayNightLayer.addTo(map);
  } else {
    map.removeLayer(dayNightLayer);
  }
});

// Weather Layer(clounds)
const cloudsLayer = L.tileLayer(
  'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=7379ab9c5e4ad29769cb06aeb1f9853e',
  {
    attribution: '&copy; OpenWeatherMap',
    opacity: 0.1,
    noWrap: true,
    bounds: worldBounds
  }
);

// Weather Layer (precipitation)
const precipitationLayer = L.tileLayer(
  'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=7379ab9c5e4ad29769cb06aeb1f9853e',
  {
    attribution: '&copy; OpenWeatherMap',
    opacity: 0.9,
    noWrap: true,
    bounds: worldBounds
  }
);

// Weather Layer (Wind)
const windLayer = L.tileLayer(
  'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=7379ab9c5e4ad29769cb06aeb1f9853e',
  {
    attribution: '&copy; OpenWeatherMap',
    opacity: 0.8,
    noWrap: true,
    bounds: worldBounds
  }
);

// Toggle Logic
const weatherToggle = document.getElementById("weatherToggle");

if (weatherToggle.checked) {
  cloudsLayer.addTo(map);
  precipitationLayer.addTo(map);
  windLayer.addTo(map);
}

weatherToggle.addEventListener("change", function () {
  if (this.checked) {
    cloudsLayer.addTo(map);
    precipitationLayer.addTo(map);
    windLayer.addTo(map);
  } else {
    map.removeLayer(cloudsLayer);
    map.removeLayer(precipitationLayer);
    map.removeLayer(windLayer);
  }
});

// ✅ Extra safety: if any interaction pushes it, snap back inside bounds
map.on("drag", () => map.panInsideBounds(worldBounds, { animate: false }));
map.on("zoomend", () => map.panInsideBounds(worldBounds, { animate: false }));

// --- Airports Layer ---
const airportToggle = document.getElementById("airportToggle");
const airportsLayer = L.layerGroup().addTo(map);

// ✅ Create icon once (performance improvement)
const airportIcon = L.icon({
  iconUrl: "../images/airport-Icon.png",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// Load airports inside current view
async function loadAirportsInView() {
  if (!airportToggle.checked) return;

  const b = map.getBounds();
  const minLat = b.getSouth();
  const maxLat = b.getNorth();
  const minLon = b.getWest();
  const maxLon = b.getEast();

  try {
    airportsLayer.clearLayers();

    const url =
      `${API_BASE}/api/airports?minLat=${minLat}&maxLat=${maxLat}&minLon=${minLon}&maxLon=${maxLon}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Airports API failed: ${res.status}`);

    const airports = await res.json();

    airports.forEach((a) => {
      const lat = Number(a.latidude);
      const lon = Number(a.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const marker = L.marker([lat, lon], { icon: airportIcon });

      const title = `${a.Name || "Airport"} (${a.IATA || "-"} / ${a.ICAO || "-"})`;
      const subtitle = `${a.City || ""}${a.City ? ", " : ""}${a.Country || ""}`;

      marker.bindPopup(
        `
        <div class="airport-popup-card">
          <div class="airport-popup-title">${title}</div>
          <div class="airport-popup-subtitle">${subtitle}</div>
        </div>
        `,
        {
          className: "airport-popup-theme leaflet-popup",
          closeButton: false,
          autoPan: true
        }
      );

      marker.addTo(airportsLayer);
    });
  } catch (err) {
    console.error(err);
  }
}

map.on("moveend", loadAirportsInView);

airportToggle.addEventListener("change", () => {
  if (airportToggle.checked) {
    airportsLayer.addTo(map);
    loadAirportsInView();
  } else {
    map.removeLayer(airportsLayer);
    airportsLayer.clearLayers();
  }
});

loadAirportsInView();

// --- Aircraft Layer ---
const aircraftToggle = document.getElementById("aircraftToggle");
const aircraftLayer = L.layerGroup().addTo(map);

// ✅ Store latest aircraft + marker lookup for search jump
let aircraftList = [];
const aircraftMarkers = new Map();

// simple plane icon (no rotation plugin needed)
function makePlaneDivIcon(deg = 0) {
  const safeDeg = Number.isFinite(deg) ? deg : 0;

  return L.divIcon({
    className: "plane-icon-wrap",
    html: `
      <img
        src="../images/plane.png"
        class="plane-icon"
        style="transform: rotate(${safeDeg - 45}deg);"
      />
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
}

// ===============================
// FILTERS (Squawk exact, Altitude min ft, Speed min kt)
// ===============================
function getFilterValues() {
  const category = document.getElementById("choices")?.value || "0";
  const squawk = (document.getElementById("sqwak")?.value || "").trim();
  const altitudeFt = (document.getElementById("altitude")?.value || "").trim();
  const speedKt = (document.getElementById("speed")?.value || "").trim();

  return {
    category,
    squawk: squawk || null,
    altitudeFt: altitudeFt ? Number(altitudeFt) : null,
    speedKt: speedKt ? Number(speedKt) : null
  };
}

function matchesFilters(a, f) {
  const altM = Number(a.baro_altitude);
  const altFt = Number.isFinite(altM) ? altM * 3.28084 : null;

  const vMs = Number(a.velocity);
  const vKt = Number.isFinite(vMs) ? vMs * 1.94384 : null;

  if (f.squawk && String(a.squawk || "").trim() !== f.squawk) return false;

  if (Number.isFinite(f.altitudeFt)) {
    if (!Number.isFinite(altFt)) return false;
    if (altFt < f.altitudeFt) return false;
  }

  if (Number.isFinite(f.speedKt)) {
    if (!Number.isFinite(vKt)) return false;
    if (vKt < f.speedKt) return false;
  }

  return true;
}

async function loadAircraftInView() {
  if (!aircraftToggle.checked) return;

  const b = map.getBounds();
  const minLat = b.getSouth();
  const maxLat = b.getNorth();
  const minLon = b.getWest();
  const maxLon = b.getEast();

  try {
    aircraftLayer.clearLayers();
    aircraftMarkers.clear();

    const url =
      `${API_BASE}/api/aircraft?minLat=${minLat}&maxLat=${maxLat}&minLon=${minLon}&maxLon=${maxLon}`;

    const res = await fetch(url);
    setApiStatus(res.ok);
    
    if (!res.ok) throw new Error(`Aircraft API failed: ${res.status}`);

    const data = await res.json();
    setLastUpdated();
    const states = data.states || [];

    aircraftList = states;

    const filters = getFilterValues();

    states.forEach((a) => {
      const lat = Number(a.latitude);
      const lon = Number(a.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      if (!matchesFilters(a, filters)) return;

      const heading = Number(a.true_track);
      const icon = makePlaneDivIcon(heading);

      const marker = L.marker([lat, lon], { icon });

      const callsign = (a.callsign || "").trim() || "Unknown";
      const altM = a.baro_altitude;
      const altFt = Number.isFinite(Number(altM)) ? Math.round(Number(altM) * 3.28084) : null;
      const speed = a.velocity;
      const speedKt = Number.isFinite(Number(speed)) ? Math.round(Number(speed) * 1.94384) : null;

      marker.bindPopup(`
        <div class="aircraft-popup-card">
          <div class="aircraft-popup-title">${callsign}</div>
          <div class="aircraft-popup-subtitle">
            ICAO24: ${a.icao24 || "-"}<br/>
            Country: ${a.origin_country || "-"}<br/>
            Alt: ${altFt ?? "-"} ft<br/>
            Speed: ${speedKt ?? "-"} kt<br/>
            Squawk: ${a.squawk || "-"}
          </div>
        </div>
      `, { closeButton: false, autoPan: true, className: "aircraft-popup-theme leaflet-popup" });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showTrack(a.icao24);
        drawHeadingLine(a.latitude, a.longitude, a.true_track, 50);
      });

      marker.addTo(aircraftLayer);

      if (a.icao24) aircraftMarkers.set(String(a.icao24).trim(), marker);
    });

  } catch (err) {
    console.error(err);
    setApiStatus(false);
  }
}

// reload on pan/zoom
map.on("moveend", loadAircraftInView);

// refresh every 10s while toggle is ON
let aircraftTimer = null;

function startAircraftRefresh() {
  if (aircraftTimer) clearInterval(aircraftTimer);
  aircraftTimer = setInterval(loadAircraftInView, 10000);
}

function stopAircraftRefresh() {
  if (aircraftTimer) clearInterval(aircraftTimer);
  aircraftTimer = null;
}

aircraftToggle.addEventListener("change", () => {
  if (aircraftToggle.checked) {
    aircraftLayer.addTo(map);
    loadAircraftInView();
    startAircraftRefresh();
  } else {
    map.removeLayer(aircraftLayer);
    aircraftLayer.clearLayers();
    aircraftMarkers.clear();
    stopAircraftRefresh();
  }
});

// initial
if (aircraftToggle.checked) startAircraftRefresh();
loadAircraftInView();

// ✅ Make filters live: changing inputs updates the map
["choices", "sqwak", "altitude", "speed"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const evt = el.tagName === "SELECT" ? "change" : "input";
  el.addEventListener(evt, () => loadAircraftInView());
});

// ===============================
// SEARCH (Aircraft + Airports)
// ===============================
const searchInput = document.getElementById("sidebarSearch");
const resultsWrap = document.getElementById("searchResultsWrap");
const sidebarCards = document.querySelectorAll(".sidebar-card");

let searchAirportMarker = null;

function hideOtherCards() {
  sidebarCards.forEach(card => card.classList.add("sidebar-hidden"));
}

function showOtherCards() {
  sidebarCards.forEach(card => card.classList.remove("sidebar-hidden"));
}

function filterAircraftByCallsign(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return aircraftList
    .filter(a => {
      const callsign = (a.callsign || "").trim().toLowerCase();
      return callsign.includes(q);
    })
    .slice(0, 10)
    .map(a => ({
      type: "aircraft",
      callsign: (a.callsign || "").trim() || "Unknown",
      country: a.origin_country || "-",
      icao24: (a.icao24 || "").trim()
    }));
}

async function searchAirports(query) {
  const q = query.trim();
  if (!q) return [];

  const res = await fetch(`${API_BASE}/api/airports/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Airport search failed: ${res.status}`);

  const airports = await res.json();

  return airports.map(a => ({
    type: "airport",
    name: a.Name || "Airport",
    city: a.City || "",
    country: a.Country || "",
    iata: a.IATA || "",
    icao: a.ICAO || "",
    lat: Number(a.latidude),
    lon: Number(a.Longitude)
  }));
}

function renderSearchResults(list) {
  if (!list.length) {
    resultsWrap.innerHTML = `
      <div class="flight-card">
        <div class="flight-title">No results</div>
        <div class="flight-sub">Try an airport like DXB or a flight like EK403</div>
      </div>
    `;
    return;
  }

  resultsWrap.innerHTML = list.map(item => {
    if (item.type === "aircraft") {
      return `
        <div class="flight-card search-result" data-type="aircraft" data-icao="${item.icao24}">
          <div class="flight-title">${item.callsign}</div>
          <div class="flight-sub">Aircraft • ICAO24: ${item.icao24 || "-"} • ${item.country}</div>
        </div>
      `;
    }

    return `
      <div
        class="flight-card search-result"
        data-type="airport"
        data-lat="${item.lat}"
        data-lon="${item.lon}"
        data-name="${item.name}"
        data-city="${item.city}"
        data-country="${item.country}"
        data-iata="${item.iata}"
        data-icao="${item.icao}"
      >
        <div class="flight-title">${item.name}</div>
        <div class="flight-sub">
          Airport • ${item.city || "-"}${item.city && item.country ? ", " : ""}${item.country || "-"} • ${item.iata || "-"} / ${item.icao || "-"}
        </div>
      </div>
    `;
  }).join("");
}

async function runSearch() {
  const q = searchInput.value.trim();

  if (!q) {
    showOtherCards();
    resultsWrap.classList.add("hidden");
    resultsWrap.innerHTML = "";
    return;
  }

  hideOtherCards();
  resultsWrap.classList.remove("hidden");

  try {
    const aircraftMatches = filterAircraftByCallsign(q);
    const airportMatches = await searchAirports(q);

    const combined = [...aircraftMatches, ...airportMatches].slice(0, 20);
    renderSearchResults(combined);
  } catch (err) {
    console.error(err);
    resultsWrap.innerHTML = `
      <div class="flight-card">
        <div class="flight-title">Search failed</div>
        <div class="flight-sub">Could not load search results.</div>
      </div>
    `;
  }
}

if (searchInput && resultsWrap) {
  searchInput.addEventListener("input", runSearch);

  resultsWrap.addEventListener("click", (e) => {
    const card = e.target.closest(".search-result");
    if (!card) return;

    const type = card.dataset.type;

    if (type === "aircraft") {
      const icao = card.dataset.icao;
      const marker = aircraftMarkers.get(icao);

      if (!marker) {
        alert("That aircraft is not currently visible on the map. Try clearing filters or moving the map.");
        return;
      }

      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10), { animate: true });
      marker.openPopup();
      return;
    }

    if (type === "airport") {
      const lat = Number(card.dataset.lat);
      const lon = Number(card.dataset.lon);
      const name = card.dataset.name || "Airport";
      const city = card.dataset.city || "-";
      const country = card.dataset.country || "-";
      const iata = card.dataset.iata || "-";
      const icao = card.dataset.icao || "-";

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      map.setView([lat, lon], Math.max(map.getZoom(), 10), { animate: true });

      if (searchAirportMarker) {
        map.removeLayer(searchAirportMarker);
      }

      searchAirportMarker = L.marker([lat, lon], { icon: airportIcon }).addTo(map);

      searchAirportMarker.bindPopup(
        `
        <div class="airport-popup-card">
          <div class="airport-popup-title">${name} (${iata} / ${icao})</div>
          <div class="airport-popup-subtitle">${city}${city && country ? ", " : ""}${country}</div>
        </div>
        `,
        {
          className: "airport-popup-theme leaflet-popup",
          closeButton: false,
          autoPan: true
        }
      ).openPopup();
    }
  });
}

// ===== Mobile sidebar toggle =====
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");

function openSidebar() {
  document.body.classList.add("sidebar-open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  if (document.body.classList.contains("sidebar-open")) closeSidebar();
  else openSidebar();
}

if (menuBtn && sidebar && overlay) {
  menuBtn.addEventListener("click", toggleSidebar);
  overlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}

if (sidebar) {
  sidebar.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
      const t = e.target;
      if (t && (t.tagName === "A" || t.tagName === "BUTTON")) closeSidebar();
    }
  });
}

// Aircraft Past positions on click
let currentTrack = null;

async function showTrack(icao) {
  const res = await fetch(`${API_BASE}/api/aircraft/${icao}/track`);
  if (!res.ok) {
    alert("Failed to load track data");
    return;
  }

  const points = await res.json();
  const coords = points.map(p => [p.lat, p.lon]);

  if (currentTrack) {
    map.removeLayer(currentTrack);
    currentTrack = null;
  }

  if (!coords.length) return;

  currentTrack = L.polyline(coords, {
    weight: 3
  }).addTo(map);
}

// Aircraft Flight Path Prediction
let headingLine = null;
const EARTH_RADIUS_KM = 6371;

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/**
 * Returns [lat2, lon2] that is `distanceKm` away from (lat, lon)
 * in the direction `bearingDeg` (0=N, 90=E).
 */
function destinationPoint(lat, lon, bearingDeg, distanceKm) {
  const brng = toRad(bearingDeg);
  const dByR = distanceKm / EARTH_RADIUS_KM;

  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
    Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );

  const lon2Deg = ((toDeg(lon2) + 540) % 360) - 180;

  return [toDeg(lat2), lon2Deg];
}

function drawHeadingLine(lat, lon, headingDeg, distanceKm = 50) {
  if (headingLine) {
    map.removeLayer(headingLine);
    headingLine = null;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(headingDeg)) return;

  const [lat2, lon2] = destinationPoint(lat, lon, headingDeg, distanceKm);

  headingLine = L.polyline(
    [
      [lat, lon],
      [lat2, lon2]
    ],
    {
      weight: 3,
      opacity: 0.9,
      dashArray: "8 10",
      lineCap: "round"
    }
  ).addTo(map);
}

// Click empty map to hide track + heading line
map.on("click", () => {
  if (currentTrack) {
    map.removeLayer(currentTrack);
    currentTrack = null;
  }

  if (headingLine) {
    map.removeLayer(headingLine);
    headingLine = null;
  }
});

// API health check every 30 seconds
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    setApiStatus(res.ok);
  } catch {
    setApiStatus(false);
  }
}

checkApiHealth();
setInterval(checkApiHealth, 30000);