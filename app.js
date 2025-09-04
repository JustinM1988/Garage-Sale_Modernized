// app.js — GitHub Pages Optimized Garage Sale Admin v8.0
// City of Portland, Texas - Production Ready

/* ================ Wait for DOM and Dependencies ================ */
document.addEventListener('DOMContentLoaded', function() {
    // Check if all dependencies are loaded
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet not loaded! Cannot initialize map.');
        showError('Map library failed to load. Please refresh the page.');
        return;
    }

    if (typeof CONFIG === 'undefined') {
        console.error('❌ Configuration not loaded!');
        showError('Configuration failed to load. Please refresh the page.');
        return;
    }

    // All dependencies loaded, start the app
    APP_LOG.info('🚀 Starting Garage Sale Admin...');
    init();
});

/* ================ Configuration & Globals ================ */
const FIELDS = { 
    address: "Address", 
    description: "Description", 
    start: "Date_1", 
    end: "EndDate" 
};

/* ================ Global State ================ */
let map, featureLayer, editMarker;
let selectedFeature = null, objectIdField = "OBJECTID";
let inNewMode = false, _featureCount = 0;
let multiDayData = [];
let garageSalesData = [];
let isOnline = navigator.onLine;
let autoSaveTimer = null;

/* ================ Utility Functions ================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Show error messages
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()" class="btn btn-secondary">Refresh Page</button>
        </div>
    `;
    errorDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        text-align: center;
    `;
    document.body.appendChild(errorDiv);
}

// Enhanced toast notifications
function toast(msg, type = "info", duration = CONFIG.TOAST_DURATION) {
    const el = document.createElement("div");
    el.className = `toast glass toast-${type}`;
    el.innerHTML = msg;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    document.body.appendChild(el);

    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
        }
    }, duration);

    APP_LOG.info(`Toast [${type.toUpperCase()}]:`, msg);
}

// Enhanced status updates
function setStatus(text, type = 'info') {
    const el = $("#status");
    if (el) {
        el.textContent = text;
        el.className = `status ${type}`;
        el.setAttribute('aria-live', 'polite');
    }

    updateConnectionStatus();
    APP_LOG.info(`Status [${type.toUpperCase()}]:`, text);
}

// Connection status monitoring
function updateConnectionStatus() {
    const statusEl = $("#connectionStatus");
    if (statusEl) {
        if (isOnline) {
            statusEl.textContent = "Connected";
            statusEl.className = "stat-value online";
        } else {
            statusEl.textContent = "Offline";
            statusEl.className = "stat-value offline";
        }
    }
}

// Data conversion utilities
function toEpochMaybe(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    const d1 = new Date(v); 
    if (!isNaN(d1)) return d1.getTime();
    return null;
}

function fromEpoch(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d)) return "";
    const M = String(d.getMonth()+1).padStart(2,"0");
    const D = String(d.getDate()).padStart(2,"0");
    const Y = d.getFullYear();
    return `${Y}-${M}-${D}`;
}

// Enhanced description composition
function composeDescription() {
    const details = $("#details")?.value?.trim() || "";

    if ($("#chkMultiDay")?.checked && multiDayData.length > 0) {
        // Multi-day format
        const dayStrings = multiDayData.map(day => {
            const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day.dayOfWeek];
            const startTime = formatTime(day.startHour, day.startMin, day.startAmPm);
            const endTime = formatTime(day.endHour, day.endMin, day.endAmPm);
            return `${dayName} ${startTime} - ${endTime}`;
        });
        const timeStr = dayStrings.join(' & ');
        return details ? `${timeStr}: ${details}` : timeStr;
    } else {
        // Single day format
        const sH = parseInt($("#timeStartHour")?.value || "7");
        const sM = parseInt($("#timeStartMin")?.value || "0");
        const sAP = $("#timeStartAmPm")?.value || "AM";
        const eH = parseInt($("#timeEndHour")?.value || "2");
        const eM = parseInt($("#timeEndMin")?.value || "0");
        const eAP = $("#timeEndAmPm")?.value || "PM";

        const startTime = formatTime(sH, sM, sAP);
        const endTime = formatTime(eH, eM, eAP);
        const timeStr = `${startTime} - ${endTime}`;
        return details ? `${timeStr}: ${details}` : timeStr;
    }
}

function formatTime(hour, minute, ampm) {
    return `${hour}:${String(minute).padStart(2,"0")} ${ampm}`;
}

function updateDescriptionPreview() {
    const preview = $("#descriptionPreview");
    if (preview) {
        const description = composeDescription();
        preview.value = description;
    }
}

/* ================ Map Implementation ================ */
async function initMap() {
    APP_LOG.info("🗺️ Initializing map system...");

    try {
        // Show loading
        showLoadingOverlay("Initializing map...");

        // Verify Leaflet is available
        if (typeof L === 'undefined') {
            throw new Error('Leaflet library not available');
        }

        // Create Leaflet map with proper coordinates
        map = L.map('map', {
            center: CONFIG.CENTER, // [lat, lng]
            zoom: CONFIG.ZOOM,
            minZoom: CONFIG.MIN_ZOOM,
            maxZoom: CONFIG.MAX_ZOOM,
            zoomControl: true,
            attributionControl: true
        });

        // Add base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Custom garage sale icon
        window.garageSaleIcon = L.divIcon({
            className: 'garage-sale-icon',
            html: '<div class="garage-sale-marker">🏷️</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Map event handlers
        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);

        // Load garage sales data
        await loadGarageSales();

        hideLoadingOverlay();

        APP_LOG.success("✅ Map initialized successfully");
        setStatus("Map loaded successfully. Ready to manage garage sales.", 'success');

    } catch (error) {
        hideLoadingOverlay();
        APP_LOG.error("❌ Map initialization failed:", error);
        setStatus("Failed to initialize map. Please refresh the page.", 'error');
        throw error;
    }
}

function showLoadingOverlay(message = "Loading...") {
    const overlay = $("#loading-overlay");
    const text = overlay?.querySelector(".loading-text");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.setAttribute('aria-hidden', 'false');
    }
    if (text) text.textContent = message;
}

function hideLoadingOverlay() {
    const overlay = $("#loading-overlay");
    if (overlay) {
        overlay.style.display = "none";
        overlay.setAttribute('aria-hidden', 'true');
    }
}

// Load garage sales from ArcGIS
async function loadGarageSales(retryCount = 0) {
    try {
        showLoadingOverlay("Loading garage sales...");

        const url = `${CONFIG.LAYER_URL}/query?where=1=1&outFields=*&returnGeometry=true&f=json`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(url, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "Failed to load garage sales");
        }

        // Store data globally
        garageSalesData = data.features || [];

        // Create feature layer
        if (featureLayer) {
            map.removeLayer(featureLayer);
        }
        featureLayer = L.layerGroup();

        // Add markers
        garageSalesData.forEach((feature, index) => {
            try {
                addGarageSaleMarker(feature, index);
            } catch (markerError) {
                APP_LOG.warn("Failed to add marker:", markerError, feature);
            }
        });

        featureLayer.addTo(map);
        _featureCount = garageSalesData.length;

        // Update stats
        updateStats();

        hideLoadingOverlay();

        APP_LOG.success(`✅ Loaded ${_featureCount} garage sales`);

        if (_featureCount === 0) {
            setStatus("No garage sales found. Click 'New Sale' to add the first one.", 'info');
        } else {
            setStatus(`${_featureCount} garage sales loaded successfully.`, 'success');
        }

    } catch (error) {
        hideLoadingOverlay();

        if (error.name === 'AbortError') {
            error.message = 'Request timed out. Please check your connection.';
        }

        // Retry logic
        if (retryCount < CONFIG.MAX_RETRIES) {
            APP_LOG.warn(`Load failed, retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
            toast(`Loading failed, retrying... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, "warning");

            setTimeout(() => {
                loadGarageSales(retryCount + 1);
            }, 1000 * (retryCount + 1));

            return;
        }

        APP_LOG.error("❌ Failed to load garage sales:", error);
        setStatus("Failed to load garage sales. Please refresh the page.", 'error');
        toast(`Failed to load garage sales: ${error.message}`, "error");
    }
}

function addGarageSaleMarker(feature, index) {
    const geom = feature.geometry;
    const attrs = feature.attributes;

    if (!geom || typeof geom.y !== 'number' || typeof geom.x !== 'number') {
        throw new Error('Invalid geometry data');
    }

    const marker = L.marker([geom.y, geom.x], { 
        icon: window.garageSaleIcon,
        title: attrs[FIELDS.address] || `Garage Sale ${index + 1}`
    })
        .bindPopup(() => createPopupContent(attrs))
        .on('click', () => loadForEdit(feature));

    marker.featureData = feature;
    featureLayer.addLayer(marker);
}

function createPopupContent(attributes) {
    const address = attributes[FIELDS.address] || "No address";
    const description = attributes[FIELDS.description] || "No description";
    const startDate = attributes[FIELDS.start] ? 
        new Date(attributes[FIELDS.start]).toLocaleDateString() : "No date";

    return `
        <div class="popup-content">
            <h4>${escapeHtml(address)}</h4>
            <p><strong>When:</strong> ${escapeHtml(startDate)}</p>
            <p><strong>Details:</strong> ${escapeHtml(description)}</p>
            <button onclick="editSale(${attributes[objectIdField]})" class="btn btn-small">
                ✏️ Edit Sale
            </button>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global function for popup buttons
window.editSale = function(objectId) {
    const marker = featureLayer.getLayers().find(layer => 
        layer.featureData.attributes[objectIdField] === objectId
    );
    if (marker) {
        loadForEdit(marker.featureData);
        map.closePopup();
    }
};

// Map event handlers
function onMapClick(e) {
    if (!inNewMode) {
        toast("Click 'New Sale' first to add a garage sale at a location", "info");
        return;
    }

    placeNewSale(e.latlng);
}

function onMapMouseMove(e) {
    $("#coordinates").textContent = 
        `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
}

function placeNewSale(latlng) {
    if (editMarker) {
        map.removeLayer(editMarker);
    }

    editMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'edit-marker',
            html: '<div class="edit-marker-icon new">📍</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        }),
        title: 'New garage sale location'
    }).addTo(map);

    setTimeout(() => {
        $("#address")?.focus();
    }, 100);

    setStatus("Sale location placed. Fill out the form and click Save.", 'info');

    // Try reverse geocoding
    reverseGeocode(latlng);
}

/* ================ Address Search & Geocoding ================ */
async function reverseGeocode(latlng) {
    try {
        const url = `${CONFIG.GEOCODING_SERVICE}/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            const address = data.address.Match_addr;
            $("#address").value = address;
            APP_LOG.debug("Reverse geocoded address:", address);
        }
    } catch (error) {
        APP_LOG.warn("Reverse geocoding failed:", error);
    }
}

async function geocodeAddress(address) {
    if (!address.trim()) {
        toast("Please enter an address to search", "warning");
        return;
    }

    try {
        showLoadingOverlay("Searching for address...");

        const searchAddress = address.includes('TX') || address.includes('Texas') ? 
            address : `${address}, Portland, TX`;

        const url = `${CONFIG.GEOCODING_SERVICE}/findAddressCandidates?` +
            `singleLine=${encodeURIComponent(searchAddress)}&` +
            `f=json&maxLocations=5&` +
            `bbox=-97.5,27.7,-97.1,28.1`;

        const response = await fetch(url);
        const data = await response.json();

        hideLoadingOverlay();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const latlng = [candidate.location.y, candidate.location.x];

            map.flyTo(latlng, 16, {
                duration: 1.5
            });

            if (window.searchMarker) {
                map.removeLayer(window.searchMarker);
            }

            window.searchMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'search-marker',
                    html: '<div class="search-marker-icon">🔍</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(map);

            setTimeout(() => {
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                    window.searchMarker = null;
                }
            }, 5000);

            const foundAddress = candidate.address;
            toast(`Found: ${foundAddress}`, "success");

        } else {
            toast("Address not found. Try a more specific address.", "warning");
        }
    } catch (error) {
        hideLoadingOverlay();
        APP_LOG.error("Address search failed:", error);
        toast("Address search failed", "error");
    }
}

/* ================ Stats & Other Functions ================ */
function updateStats() {
    try {
        const totalSales = garageSalesData.length;
        const now = new Date();
        const thisWeekend = garageSalesData.filter(sale => {
            const saleDate = new Date(sale.attributes[FIELDS.start]);
            const dayOfWeek = saleDate.getDay();
            return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        }).length;

        $("#totalSales").textContent = totalSales.toString();
        $("#weekendSales").textContent = thisWeekend.toString();

    } catch (error) {
        APP_LOG.warn("Stats update failed:", error);
    }
}

// Save operation
async function onSave() {
    try {
        const address = $("#address").value.trim();
        const startDate = $("#dateStart").value;

        if (!address) {
            toast("Address is required.", "warning");
            $("#address").focus();
            return;
        }

        if (!startDate) {
            toast("Start date is required.", "warning");
            $("#dateStart").focus();
            return;
        }

        if (!editMarker) {
            toast("Please place a location on the map first.", "warning");
            return;
        }

        showLoadingOverlay("Saving garage sale...");

        const description = composeDescription();
        const latlng = editMarker.getLatLng();

        const attributes = {
            [FIELDS.address]: address,
            [FIELDS.description]: description,
            [FIELDS.start]: toEpochMaybe(startDate),
            [FIELDS.end]: toEpochMaybe($("#dateEnd").value)
        };

        const geometry = {
            x: latlng.lng,
            y: latlng.lat,
            spatialReference: { wkid: 4326 }
        };

        let edits;
        if (selectedFeature) {
            attributes[objectIdField] = selectedFeature.attributes[objectIdField];
            edits = {
                updates: [{
                    attributes: attributes,
                    geometry: geometry
                }]
            };
        } else {
            edits = {
                adds: [{
                    attributes: attributes,
                    geometry: geometry
                }]
            };
        }

        const url = `${CONFIG.LAYER_URL}/applyEdits`;

        const formData = new FormData();
        formData.append('f', 'json');
        if (edits.adds) formData.append('adds', JSON.stringify(edits.adds));
        if (edits.updates) formData.append('updates', JSON.stringify(edits.updates));

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "Save operation failed");
        }

        const success = (result.addResults?.[0]?.success || result.updateResults?.[0]?.success);
        if (!success) {
            const error = result.addResults?.[0]?.error || result.updateResults?.[0]?.error;
            throw new Error(error?.description || "Save operation failed");
        }

        hideLoadingOverlay();

        const successMessage = selectedFeature ? "Garage sale updated!" : "Garage sale added!";
        toast(successMessage, "success");

        await loadGarageSales();
        cancelEditing();

    } catch (error) {
        hideLoadingOverlay();
        APP_LOG.error("Save failed:", error);
        toast(`Save failed: ${error.message}`, "error");
    }
}

// Other core functions
function enterAddMode() {
    inNewMode = true;
    $("#btnCancel")?.style.setProperty("display", "inline-block");
    $("#modeChip")?.style.setProperty("display", "block");

    if (editMarker) {
        map.removeLayer(editMarker);
    }

    setStatus("Click on the map where you want to place the garage sale.", 'info');
    $("#coordinates").textContent = "Click map to place garage sale";
}

function cancelEditing() {
    inNewMode = false;
    selectedFeature = null;
    $("#btnCancel")?.style.setProperty("display", "none");
    $("#modeChip")?.style.setProperty("display", "none");

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
    }

    clearForm();
    setStatus("Ready to manage garage sales. Click 'New Sale' to add a location.", 'info');
}

function clearForm() {
    $("#address").value = "";
    $("#details").value = "";
    $("#dateStart").value = "";
    $("#dateEnd").value = "";

    const chk = $("#chkMultiDay");
    if (chk) chk.checked = false;

    multiDayData = [];

    updateDescriptionPreview();
}

function loadForEdit(feature) {
    selectedFeature = feature;
    inNewMode = false;
    $("#btnCancel")?.style.setProperty("display", "inline-block");
    $("#modeChip")?.style.setProperty("display", "none");

    const attrs = feature.attributes;
    const geom = feature.geometry;

    $("#address").value = attrs[FIELDS.address] || "";
    $("#dateStart").value = fromEpoch(attrs[FIELDS.start]) || "";
    $("#dateEnd").value = fromEpoch(attrs[FIELDS.end]) || "";

    const description = attrs[FIELDS.description] || "";
    $("#details").value = description;

    if (editMarker) {
        map.removeLayer(editMarker);
    }

    editMarker = L.marker([geom.y, geom.x], {
        icon: L.divIcon({
            className: 'edit-marker',
            html: '<div class="edit-marker-icon edit">✏️</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        })
    }).addTo(map);

    map.flyTo([geom.y, geom.x], 16);

    const address = attrs[FIELDS.address] || "Unknown location";
    setStatus(`Editing: ${address}. Make changes and click Save.`, 'info');

    updateDescriptionPreview();
}

function cycleTheme() {
    const themes = ["dark", "dim", "light"];
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const currentIndex = themes.indexOf(current);
    const next = themes[(currentIndex + 1) % themes.length];

    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem('preferred_theme', next);

    toast(`Theme: ${next}`, "info");
}

function showGuide() {
    const content = document.createElement("div");
    content.innerHTML = `
        <div class="guide-content">
            <h3>🏷️ Garage Sale Manager Guide</h3>

            <div class="guide-section">
                <h4>🎯 Getting Started</h4>
                <ol>
                    <li><strong>Add Sale:</strong> Click "New Sale", then click on the map</li>
                    <li><strong>Fill Form:</strong> Enter address, dates, and items</li>
                    <li><strong>Save:</strong> Click "Save Sale" to add to database</li>
                </ol>
            </div>

            <div class="guide-section">
                <h4>🔍 Finding Locations</h4>
                <ul>
                    <li><strong>Address Search:</strong> Type address to zoom</li>
                    <li><strong>Map Navigation:</strong> Click and drag to move</li>
                    <li><strong>Edit Sales:</strong> Click markers to edit</li>
                </ul>
            </div>

            <div class="guide-footer">
                <p><strong>Contact:</strong> ${CONFIG.ORGANIZATION.contact}</p>
                <p><strong>Version:</strong> 8.0 - GitHub Pages Ready</p>
            </div>
        </div>
    `;

    showModal("User Guide", content);
}

function showModal(title, bodyElement) {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
        <div class="modal glass">
            <div class="modal-header">
                <div class="modal-title">${escapeHtml(title)}</div>
                <button class="modal-close">✕</button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;

    wrap.querySelector(".modal-body").appendChild(bodyElement);
    document.body.appendChild(wrap);

    const closeModal = () => wrap.remove();
    wrap.querySelector(".modal-close").addEventListener("click", closeModal);
    wrap.querySelector(".modal-actions .btn").addEventListener("click", closeModal);
}

/* ================ Network Status ================ */
function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        toast("Connection restored", "success");
        loadGarageSales();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        toast("Connection lost", "warning");
    });

    updateConnectionStatus();
}

/* ================ Initialization ================ */
async function init() {
    APP_LOG.info("🏛️ City of Portland Garage Sale Admin v8.0");
    APP_LOG.info("Initializing GitHub Pages optimized system...");

    try {
        // Load saved theme
        const savedTheme = localStorage.getItem('preferred_theme');
        if (savedTheme) {
            document.documentElement.setAttribute("data-theme", savedTheme);
        }

        // Setup network monitoring
        setupNetworkMonitoring();

        // Initialize map
        await initMap();

        // Set up form handlers
        ["timeStartHour", "timeStartMin", "timeStartAmPm", "timeEndHour", "timeEndMin", "timeEndAmPm", "details"]
            .forEach(id => {
                const el = $("#" + id);
                if (el) el.addEventListener("change", updateDescriptionPreview);
            });

        // Button handlers
        $("#btnSave")?.addEventListener("click", onSave);
        $("#btnNew")?.addEventListener("click", enterAddMode);
        $("#btnCancel")?.addEventListener("click", cancelEditing);
        $("#btnTheme")?.addEventListener("click", cycleTheme);
        $("#btnGuide")?.addEventListener("click", showGuide);

        // Address search
        $("#btnSearch")?.addEventListener("click", () => {
            const address = $("#addressSearch").value.trim();
            if (address) {
                geocodeAddress(address);
            }
        });

        $("#addressSearch")?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const address = e.target.value.trim();
                if (address) {
                    geocodeAddress(address);
                }
            }
        });

        // Initial state
        updateDescriptionPreview();

        APP_LOG.success("✅ Application initialized successfully");
        setStatus("✅ System ready. Click 'New Sale' to add garage sales.", 'success');

    } catch (error) {
        APP_LOG.error("❌ Initialization failed:", error);
        setStatus("❌ Initialization failed. Please refresh the page.", 'error');
        toast("Application failed to start. Please refresh the page.", "error");
    }
}

// Global error handling
window.addEventListener('error', (event) => {
    APP_LOG.error("Global error:", event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    APP_LOG.error("Unhandled promise rejection:", event.reason);
});

APP_LOG.info("🏛️ Garage Sale Admin script loaded - waiting for DOM");
