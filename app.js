// app.js — ULTIMATE Enhanced Garage Sale Admin v8.0
// City of Portland, Texas - ALL ISSUES FIXED + ADDRESS AUTOCOMPLETE + BUILDING FOOTPRINTS

/* ================ Wait for DOM and Dependencies ================ */
document.addEventListener('DOMContentLoaded', function() {
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet not loaded!');
        showError('Map library failed to load. Please refresh the page.');
        return;
    }

    if (typeof CONFIG === 'undefined') {
        console.error('❌ Configuration not loaded!');
        showError('Configuration failed to load. Please refresh the page.');
        return;
    }

    console.log('🚀 Starting Ultimate Garage Sale Admin...');
    init();
});

/* ================ Global State ================ */
const FIELDS = { 
    address: "Address", 
    description: "Description", 
    start: "Date_1", 
    end: "EndDate" 
};

let map, featureLayer, buildingsLayer, editMarker;
let selectedFeature = null, objectIdField = "OBJECTID";
let inNewMode = false, _featureCount = 0;
let garageSalesData = [];
let isOnline = navigator.onLine;
let addressSuggestions = [];
let suggestionsDropdown = null;

/* ================ Utility Functions ================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 9999; color: white; text-align: center;
    `;
    errorDiv.innerHTML = `
        <div>
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px;">Refresh Page</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

function toast(msg, type = "info", duration = 4000) {
    console.log(`📢 Toast [${type.toUpperCase()}]: ${msg}`);

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    el.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        padding: 12px 24px; border-radius: 8px; font-weight: 600;
        z-index: 1000; backdrop-filter: blur(8px); color: white;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    `;

    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, duration);
}

function setStatus(text, type = 'info') {
    console.log(`📊 Status [${type.toUpperCase()}]: ${text}`);
    const el = $("#status");
    if (el) {
        el.textContent = text;
        el.className = `status ${type}`;
    }
    updateConnectionStatus();
}

function updateConnectionStatus() {
    const statusEl = $("#connectionStatus");
    if (statusEl) {
        statusEl.textContent = isOnline ? "Connected" : "Offline";
        statusEl.className = isOnline ? "stat-value online" : "stat-value offline";
    }
}

// Data conversion utilities
function toEpochMaybe(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    const d1 = new Date(v); 
    return !isNaN(d1) ? d1.getTime() : null;
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

function composeDescription() {
    const details = $("#details")?.value?.trim() || "";
    const sH = parseInt($("#timeStartHour")?.value || "7");
    const sM = parseInt($("#timeStartMin")?.value || "0");
    const sAP = $("#timeStartAmPm")?.value || "AM";
    const eH = parseInt($("#timeEndHour")?.value || "2");
    const eM = parseInt($("#timeEndMin")?.value || "0");
    const eAP = $("#timeEndAmPm")?.value || "PM";

    const startTime = `${sH}:${String(sM).padStart(2,"0")} ${sAP}`;
    const endTime = `${eH}:${String(eM).padStart(2,"0")} ${eAP}`;
    const timeStr = `${startTime} - ${endTime}`;
    return details ? `${timeStr}: ${details}` : timeStr;
}

function updateDescriptionPreview() {
    const preview = $("#descriptionPreview");
    if (preview) preview.value = composeDescription();
}

/* ================ Enhanced Address Autocomplete System ================ */
async function setupAddressAutocomplete() {
    const addressField = $("#address");
    const searchField = $("#addressSearch");

    if (!addressField && !searchField) return;

    // Create suggestions dropdown
    suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.className = 'address-suggestions';
    suggestionsDropdown.style.cssText = `
        position: absolute;
        background: rgba(30, 41, 59, 0.95);
        border: 2px solid #3cf0d4;
        border-radius: 8px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Add autocomplete to both fields
    if (addressField) setupFieldAutocomplete(addressField);
    if (searchField) setupFieldAutocomplete(searchField);

    console.log("✅ Address autocomplete system initialized");
}

function setupFieldAutocomplete(field) {
    let timeout;

    field.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();

        if (query.length < 3) {
            hideSuggestions();
            return;
        }

        // Debounce the search
        timeout = setTimeout(() => {
            searchAddressSuggestions(query, field);
        }, 300);
    });

    field.addEventListener('blur', (e) => {
        // Delay hiding to allow clicks on suggestions
        setTimeout(() => hideSuggestions(), 200);
    });

    field.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectNextSuggestion(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectNextSuggestion(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = suggestionsDropdown.querySelector('.suggestion-selected');
            if (selected) {
                selected.click();
            } else if (field.value.trim()) {
                geocodeAddress(field.value.trim());
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });
}

async function searchAddressSuggestions(query, field) {
    try {
        // Enhanced search for Portland, TX area
        const searchQuery = query.includes('TX') || query.includes('Texas') ? 
            query : `${query}, Portland, TX`;

        const url = `${CONFIG.GEOCODING_SERVICE}/suggest?` +
            `text=${encodeURIComponent(searchQuery)}&` +
            `f=json&` +
            `maxSuggestions=8&` +
            `searchExtent=-97.5,27.7,-97.1,28.1&` +
            `location=-97.323,27.876`; // Portland, TX center

        const response = await fetch(url);
        const data = await response.json();

        if (data.suggestions && data.suggestions.length > 0) {
            showSuggestions(data.suggestions, field);
        } else {
            hideSuggestions();
        }

    } catch (error) {
        console.warn("⚠️ Address suggestions failed:", error);
        hideSuggestions();
    }
}

function showSuggestions(suggestions, field) {
    // Position dropdown below the field
    const rect = field.getBoundingClientRect();
    suggestionsDropdown.style.left = rect.left + 'px';
    suggestionsDropdown.style.top = (rect.bottom + 2) + 'px';
    suggestionsDropdown.style.width = rect.width + 'px';

    // Create suggestion items
    suggestionsDropdown.innerHTML = suggestions.map((suggestion, index) => `
        <div class="suggestion-item" data-index="${index}" style="
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            color: #f1f5f9;
            transition: all 0.2s ease;
        " 
        onmouseover="this.style.background='rgba(60,240,212,0.2)'"
        onmouseout="this.style.background='transparent'"
        onclick="selectSuggestion('${suggestion.text.replace(/'/g, "\'")}', '${suggestion.magicKey}')">
            <div style="font-weight: 600;">${suggestion.text}</div>
        </div>
    `).join('');

    suggestionsDropdown.style.display = 'block';
    document.body.appendChild(suggestionsDropdown);

    addressSuggestions = suggestions;
}

function hideSuggestions() {
    if (suggestionsDropdown) {
        suggestionsDropdown.style.display = 'none';
        if (suggestionsDropdown.parentNode) {
            suggestionsDropdown.parentNode.removeChild(suggestionsDropdown);
        }
    }
}

function selectNextSuggestion(direction) {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    const current = suggestionsDropdown.querySelector('.suggestion-selected');
    let newIndex = 0;

    if (current) {
        current.classList.remove('suggestion-selected');
        current.style.background = 'transparent';
        const currentIndex = parseInt(current.dataset.index);
        newIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
    }

    if (items[newIndex]) {
        items[newIndex].classList.add('suggestion-selected');
        items[newIndex].style.background = 'rgba(60,240,212,0.3)';
        items[newIndex].scrollIntoView({ block: 'nearest' });
    }
}

window.selectSuggestion = async function(text, magicKey) {
    console.log("🏠 Selected suggestion:", text);

    // Fill the active field
    const activeField = document.activeElement;
    if (activeField && (activeField.id === 'address' || activeField.id === 'addressSearch')) {
        activeField.value = text;
    }

    hideSuggestions();

    // Geocode to get coordinates and zoom
    try {
        const url = `${CONFIG.GEOCODING_SERVICE}/findAddressCandidates?` +
            `singleLine=${encodeURIComponent(text)}&` +
            `magicKey=${magicKey}&` +
            `f=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const latlng = [candidate.location.y, candidate.location.x];

            // Zoom to location
            map.flyTo(latlng, 17, { duration: 1.0 });

            // Show temporary marker
            if (window.searchMarker) {
                map.removeLayer(window.searchMarker);
            }

            window.searchMarker = L.marker(latlng, {
                icon: L.divIcon({
                    html: '<div style="background: #3b82f6; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 1s infinite;">📍</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map);

            setTimeout(() => {
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                    window.searchMarker = null;
                }
            }, 3000);

            toast(`Found: ${candidate.address}`, "success");
        }
    } catch (error) {
        console.warn("⚠️ Geocoding failed for suggestion:", error);
        toast("Address found but couldn't get location", "warning");
    }
};

/* ================ Building Footprints System ================ */
async function loadBuildingFootprints(bounds) {
    if (!buildingsLayer) {
        buildingsLayer = L.layerGroup().addTo(map);
        console.log("✅ Buildings layer created");
    }

    // Clear existing buildings
    buildingsLayer.clearLayers();

    try {
        console.log("🏠 Loading building footprints...");

        // Get map bounds
        const mapBounds = bounds || map.getBounds();
        const bbox = `${mapBounds.getSouth()},${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()}`;

        // Overpass API query for buildings
        const overpassQuery = `
            [out:json][timeout:15];
            (
                way["building"](${bbox});
                relation["building"](${bbox});
            );
            out geom;
        `;

        const overpassUrl = 'https://overpass-api.de/api/interpreter';

        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: overpassQuery,
            headers: { 'Content-Type': 'text/plain' }
        });

        if (!response.ok) throw new Error('Overpass API request failed');

        const data = await response.json();
        console.log(`🏠 Found ${data.elements.length} buildings`);

        let buildingsAdded = 0;

        data.elements.forEach(element => {
            if (element.type === 'way' && element.geometry) {
                try {
                    const coords = element.geometry.map(node => [node.lat, node.lon]);

                    if (coords.length > 2) {
                        const polygon = L.polygon(coords, {
                            color: '#3cf0d4',
                            weight: 1,
                            opacity: 0.8,
                            fillColor: '#3cf0d4',
                            fillOpacity: 0.1,
                            className: 'building-footprint'
                        });

                        // Add popup with building info
                        const tags = element.tags || {};
                        const buildingType = tags.building || 'Building';
                        const address = tags['addr:full'] || tags['addr:street'] || 'No address';

                        polygon.bindPopup(`
                            <div style="padding: 8px;">
                                <h4 style="margin: 0 0 4px 0; color: #3cf0d4;">🏠 ${buildingType}</h4>
                                <p style="margin: 2px 0; font-size: 12px;">${address}</p>
                            </div>
                        `);

                        polygon.addTo(buildingsLayer);
                        buildingsAdded++;
                    }
                } catch (buildingError) {
                    console.warn("⚠️ Failed to add building:", buildingError);
                }
            }
        });

        console.log(`✅ Added ${buildingsAdded} building footprints to map`);

        if (buildingsAdded > 0) {
            toast(`Loaded ${buildingsAdded} building footprints`, "info");
        }

    } catch (error) {
        console.warn("⚠️ Failed to load building footprints:", error);
        toast("Building footprints unavailable", "warning");
    }
}

/* ================ Map Implementation ================ */
async function initMap() {
    console.log("🗺️ Initializing enhanced map system...");

    try {
        showLoadingOverlay("Initializing enhanced map...");

        if (typeof L === 'undefined') {
            throw new Error('Leaflet library not available');
        }

        // Create enhanced map
        map = L.map('map', {
            center: [27.876, -97.323], // Portland, TX
            zoom: 15, // Closer zoom to see buildings better
            minZoom: 10,
            maxZoom: 19, // Higher max zoom for building details
            zoomControl: true,
            attributionControl: true
        });

        console.log("✅ Map created at:", map.getCenter());

        // Enhanced base layers
        const baseLayers = {
            "Street View": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri, DigitalGlobe, GeoEye',
                maxZoom: 19
            }),
            "Hybrid": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri, DigitalGlobe, GeoEye',
                maxZoom: 19
            })
        };

        // Add default layer
        baseLayers["Street View"].addTo(map);

        // Add layer control
        const layerControl = L.control.layers(baseLayers);

        // Add buildings toggle
        const overlays = {
            "Building Footprints": buildingsLayer = L.layerGroup()
        };

        layerControl.addOverlay(overlays["Building Footprints"], "Building Footprints");
        layerControl.addTo(map);

        console.log("✅ Enhanced layers added");

        // Custom garage sale icon
        window.garageSaleIcon = L.divIcon({
            className: 'garage-sale-icon',
            html: '<div style="background: linear-gradient(135deg, #3cf0d4, #7c89ff); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 1000;">🏷️</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Enhanced map event handlers
        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);
        map.on('zoomend', onMapZoom);
        map.on('moveend', onMapMove);

        console.log("✅ Map event handlers added");

        // Load initial data
        await Promise.all([
            loadGarageSales(),
            loadBuildingFootprints()
        ]);

        // Setup address autocomplete
        await setupAddressAutocomplete();

        hideLoadingOverlay();

        console.log("✅ Enhanced map initialized successfully");
        setStatus("Enhanced map ready with building footprints and address autocomplete!", 'success');

    } catch (error) {
        hideLoadingOverlay();
        console.error("❌ Map initialization failed:", error);
        setStatus("Failed to initialize map. Please refresh the page.", 'error');
        toast("Map initialization failed", "error");
    }
}

function onMapZoom(e) {
    const zoom = map.getZoom();
    console.log("🔍 Map zoom:", zoom);

    // Load buildings at higher zoom levels
    if (zoom >= 16) {
        loadBuildingFootprints();
    } else {
        // Clear buildings at lower zoom to reduce clutter
        if (buildingsLayer) {
            buildingsLayer.clearLayers();
        }
    }
}

function onMapMove(e) {
    // Reload buildings when map moves significantly at high zoom
    if (map.getZoom() >= 16) {
        clearTimeout(window.moveTimeout);
        window.moveTimeout = setTimeout(() => {
            loadBuildingFootprints();
        }, 1000);
    }
}

function showLoadingOverlay(message = "Loading...") {
    let overlay = $("#loading-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            z-index: 500; color: white; font-size: 18px;
        `;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="text-align: center;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3cf0d4; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto 20px;"></div>
            <div>${message}</div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    overlay.style.display = "flex";
}

function hideLoadingOverlay() {
    const overlay = $("#loading-overlay");
    if (overlay) overlay.style.display = "none";
}

// FIXED garage sales loading
async function loadGarageSales() {
    console.log("🔄 Loading garage sales from ArcGIS...");

    try {
        const queryUrl = `${CONFIG.LAYER_URL}/query?where=1=1&outFields=*&returnGeometry=true&f=json`;
        console.log("🌐 Querying URL:", queryUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(queryUrl, {
            signal: controller.signal,
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);
        console.log("📡 Response status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📊 ArcGIS Response:", data);

        if (data.error) {
            console.error("❌ ArcGIS Service Error:", data.error);
            throw new Error(data.error.message || "ArcGIS service error");
        }

        garageSalesData = data.features || [];
        console.log(`📍 Found ${garageSalesData.length} garage sales`);

        if (featureLayer) map.removeLayer(featureLayer);
        featureLayer = L.layerGroup();

        let markersAdded = 0;
        garageSalesData.forEach((feature, index) => {
            try {
                const result = addGarageSaleMarker(feature, index);
                if (result) markersAdded++;
            } catch (markerError) {
                console.warn("⚠️ Failed to add marker for feature", index, ":", markerError);
            }
        });

        if (featureLayer.getLayers().length > 0) {
            featureLayer.addTo(map);
            console.log(`✅ Added ${markersAdded} garage sale markers to map`);
        }

        _featureCount = garageSalesData.length;
        updateStats();

        if (_featureCount === 0) {
            setStatus("No garage sales found. Click 'New Sale' to add the first one.", 'info');
            toast("No existing garage sales found", "info");
        } else {
            setStatus(`${_featureCount} garage sales loaded successfully.`, 'success');
            toast(`Loaded ${_featureCount} garage sales`, "success");
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            error.message = 'Request timed out. Please check your connection.';
        }

        console.error("❌ Failed to load garage sales:", error);
        setStatus("Failed to load garage sales. You can still add new ones.", 'error');
        toast(`Failed to load existing sales: ${error.message}`, "error");

        if (!featureLayer) {
            featureLayer = L.layerGroup().addTo(map);
        }
    }
}

function addGarageSaleMarker(feature, index) {
    const geom = feature.geometry;
    const attrs = feature.attributes;

    if (!geom || typeof geom.y !== 'number' || typeof geom.x !== 'number') {
        console.warn("⚠️ Feature", index, "has invalid coordinates:", geom);
        return false;
    }

    const marker = L.marker([geom.y, geom.x], { 
        icon: window.garageSaleIcon,
        title: attrs[FIELDS.address] || `Garage Sale ${index + 1}`,
        zIndexOffset: 1000 // Ensure garage sales appear above buildings
    });

    const popupContent = createPopupContent(attrs);
    marker.bindPopup(popupContent);

    marker.on('click', () => {
        console.log("📍 Clicked on garage sale:", attrs[FIELDS.address]);
        loadForEdit(feature);
    });

    marker.featureData = feature;
    featureLayer.addLayer(marker);

    console.log(`✅ Added garage sale marker ${index + 1} at [${geom.y}, ${geom.x}]`);
    return true;
}

function createPopupContent(attributes) {
    const address = attributes[FIELDS.address] || "No address";
    const description = attributes[FIELDS.description] || "No description";
    const startDate = attributes[FIELDS.start] ? 
        new Date(attributes[FIELDS.start]).toLocaleDateString() : "No date";

    return `
        <div style="padding: 10px;">
            <h4 style="margin: 0 0 8px 0; color: #3cf0d4;">${escapeHtml(address)}</h4>
            <p style="margin: 4px 0;"><strong>When:</strong> ${escapeHtml(startDate)}</p>
            <p style="margin: 4px 0;"><strong>Details:</strong> ${escapeHtml(description)}</p>
            <button onclick="editSale(${attributes[objectIdField]})" style="margin-top: 8px; padding: 6px 12px; background: #3cf0d4; color: #041311; border: none; border-radius: 4px; cursor: pointer;">
                ✏️ Edit Sale
            </button>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

window.editSale = function(objectId) {
    console.log("🖱️ Edit sale clicked for ID:", objectId);
    const marker = featureLayer.getLayers().find(layer => 
        layer.featureData.attributes[objectIdField] === objectId
    );
    if (marker) {
        loadForEdit(marker.featureData);
        map.closePopup();
    }
};

/* ================ FIXED Map Event Handlers ================ */
function onMapClick(e) {
    console.log("🖱️ Map clicked at:", e.latlng, "inNewMode:", inNewMode);

    if (!inNewMode) {
        toast("Click 'New Sale' first to add a garage sale at a location", "info");
        return;
    }

    placeNewSale(e.latlng);
}

function onMapMouseMove(e) {
    const coords = $("#coordinates");
    if (coords) {
        coords.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
}

// COMPLETELY FIXED placeNewSale function
function placeNewSale(latlng) {
    console.log("📍 Placing new sale at:", latlng);

    if (editMarker) {
        map.removeLayer(editMarker);
        console.log("🗑️ Removed previous edit marker");
    }

    // Create enhanced bouncing marker
    editMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'edit-marker',
            html: `<div style="
                background: #10b981; 
                border-radius: 50%; 
                width: 36px; 
                height: 36px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 18px; 
                border: 3px solid white; 
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                animation: bounce 1.5s infinite;
                z-index: 2000;
            ">📍</div>
            <style>
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
            </style>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        }),
        title: 'New garage sale location',
        zIndexOffset: 2000
    });

    editMarker.addTo(map);
    console.log("✅ Enhanced edit marker placed and added to map");

    setTimeout(() => {
        const addressField = $("#address");
        if (addressField) {
            addressField.focus();
            console.log("🎯 Focused address field");
        }
    }, 100);

    setStatus("Sale location placed! Fill out the form and click Save.", 'success');
    toast("📍 Location placed! Fill out the form and save.", "success");

    reverseGeocode(latlng);
}

// Other core functions (same as before but with enhancements)
async function reverseGeocode(latlng) {
    try {
        const url = `${CONFIG.GEOCODING_SERVICE}/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            const address = data.address.Match_addr;
            $("#address").value = address;
            console.log("🏠 Reverse geocoded address:", address);
            toast("Address found automatically", "info");
        }
    } catch (error) {
        console.warn("⚠️ Reverse geocoding failed:", error);
    }
}

function updateStats() {
    try {
        const totalSales = garageSalesData.length;
        $("#totalSales").textContent = totalSales.toString();
        $("#weekendSales").textContent = "0";
        console.log("📊 Stats updated - Total sales:", totalSales);
    } catch (error) {
        console.warn("⚠️ Stats update failed:", error);
    }
}

// FIXED enterAddMode function
function enterAddMode() {
    console.log("🆕 Entering add mode...");

    inNewMode = true;

    const cancelBtn = $("#btnCancel");
    if (cancelBtn) {
        cancelBtn.style.display = "inline-block";
        console.log("✅ Cancel button shown");
    }

    const modeChip = $("#modeChip");
    if (modeChip) {
        modeChip.style.display = "block";
        modeChip.textContent = "✨ Click map to place garage sale";
        console.log("✅ Mode chip shown");
    }

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
        console.log("🗑️ Cleared existing edit marker");
    }

    setStatus("Click on the map where you want to place the garage sale.", 'info');

    const coords = $("#coordinates");
    if (coords) coords.textContent = "Click map to place garage sale";

    console.log("✅ Add mode activated - inNewMode:", inNewMode);
    toast("Click anywhere on the map to place your garage sale", "info");
}

function cancelEditing() {
    console.log("❌ Cancelling edit mode...");

    inNewMode = false;
    selectedFeature = null;

    const cancelBtn = $("#btnCancel");
    if (cancelBtn) cancelBtn.style.display = "none";

    const modeChip = $("#modeChip");
    if (modeChip) modeChip.style.display = "none";

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
    }

    clearForm();
    setStatus("Ready to manage garage sales. Click 'New Sale' to add a location.", 'info');

    console.log("✅ Edit mode cancelled");
}

function clearForm() {
    $("#address").value = "";
    $("#details").value = "";
    $("#dateStart").value = "";
    $("#dateEnd").value = "";
    updateDescriptionPreview();
}

function loadForEdit(feature) {
    console.log("✏️ Loading feature for edit:", feature);

    selectedFeature = feature;
    inNewMode = false;

    $("#btnCancel").style.display = "inline-block";
    $("#modeChip").style.display = "none";

    const attrs = feature.attributes;
    const geom = feature.geometry;

    $("#address").value = attrs[FIELDS.address] || "";
    $("#dateStart").value = fromEpoch(attrs[FIELDS.start]) || "";
    $("#dateEnd").value = fromEpoch(attrs[FIELDS.end]) || "";
    $("#details").value = attrs[FIELDS.description] || "";

    if (editMarker) map.removeLayer(editMarker);

    editMarker = L.marker([geom.y, geom.x], {
        icon: L.divIcon({
            className: 'edit-marker',
            html: '<div style="background: #f59e0b; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 2000;">✏️</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    map.flyTo([geom.y, geom.x], 17);

    const address = attrs[FIELDS.address] || "Unknown location";
    setStatus(`Editing: ${address}. Make changes and click Save.`, 'info');

    updateDescriptionPreview();
    console.log("✅ Feature loaded for editing");
}

// Save operation (enhanced)
async function onSave() {
    console.log("💾 Attempting to save...");

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

    try {
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
            edits = { updates: [{ attributes, geometry }] };
        } else {
            edits = { adds: [{ attributes, geometry }] };
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

        hideLoadingOverlay();

        if (result.error) {
            throw new Error(result.error.message || "Save failed");
        }

        const success = result.addResults?.[0]?.success || result.updateResults?.[0]?.success;
        if (!success) {
            throw new Error("Save operation returned false");
        }

        const successMessage = selectedFeature ? "Garage sale updated!" : "Garage sale added!";
        toast(successMessage, "success");

        console.log("✅ Save successful");

        await loadGarageSales();
        cancelEditing();

    } catch (error) {
        hideLoadingOverlay();
        console.error("❌ Save failed:", error);
        toast(`Save failed: ${error.message}`, "error");
    }
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
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: #1e293b; border-radius: 16px; padding: 30px; max-width: 600px; color: white; max-height: 80vh; overflow-y: auto;">
            <h2 style="color: #3cf0d4; margin-bottom: 20px;">🏷️ Enhanced Garage Sale Manager</h2>

            <div style="margin-bottom: 20px;">
                <h3 style="color: #7c89ff;">✨ New Features</h3>
                <ul>
                    <li><strong>Address Autocomplete:</strong> Type 3+ characters for suggestions</li>
                    <li><strong>Building Footprints:</strong> Zoom in to see house outlines</li>
                    <li><strong>Enhanced Search:</strong> Better address finding</li>
                    <li><strong>Multiple Map Views:</strong> Street, Satellite, Hybrid</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="color: #7c89ff;">🎯 How to Use</h3>
                <ol>
                    <li>Type address for instant suggestions</li>
                    <li>Click "New Sale" then click map location</li>
                    <li>Fill form and save</li>
                    <li>Zoom in to see building footprints</li>
                </ol>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button onclick="this.closest('div').closest('div').remove()" 
                        style="padding: 10px 20px; background: #3cf0d4; color: #041311; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Close Guide
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

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

/* ================ Enhanced Initialization ================ */
async function init() {
    console.log("🏛️ City of Portland Garage Sale Admin v8.0 - ULTIMATE ENHANCED");
    console.log("🚀 Initializing with address autocomplete and building footprints...");

    try {
        const savedTheme = localStorage.getItem('preferred_theme');
        if (savedTheme) {
            document.documentElement.setAttribute("data-theme", savedTheme);
        }

        setupNetworkMonitoring();

        // Initialize enhanced map
        await initMap();

        // Set up form handlers
        const formElements = ["timeStartHour", "timeStartMin", "timeStartAmPm", "timeEndHour", "timeEndMin", "timeEndAmPm", "details"];
        formElements.forEach(id => {
            const el = $("#" + id);
            if (el) el.addEventListener("change", updateDescriptionPreview);
        });

        // Enhanced button handlers
        const btnNew = $("#btnNew");
        if (btnNew) {
            btnNew.addEventListener("click", () => {
                console.log("🆕 New Sale button clicked");
                enterAddMode();
            });
            console.log("✅ New Sale button handler added");
        }

        const btnSave = $("#btnSave");
        if (btnSave) {
            btnSave.addEventListener("click", onSave);
            console.log("✅ Save button handler added");
        }

        const btnCancel = $("#btnCancel");
        if (btnCancel) {
            btnCancel.addEventListener("click", cancelEditing);
            console.log("✅ Cancel button handler added");
        }

        const btnTheme = $("#btnTheme");
        if (btnTheme) {
            btnTheme.addEventListener("click", cycleTheme);
            console.log("✅ Theme button handler added");
        }

        const btnGuide = $("#btnGuide");
        if (btnGuide) {
            btnGuide.addEventListener("click", showGuide);
            console.log("✅ Guide button handler added");
        }

        // Enhanced address search (now with autocomplete)
        const btnSearch = $("#btnSearch");
        const addressSearch = $("#addressSearch");

        if (btnSearch && addressSearch) {
            btnSearch.addEventListener("click", () => {
                const address = addressSearch.value.trim();
                if (address) {
                    // Use the enhanced suggestion system
                    if (addressSuggestions.length > 0) {
                        selectSuggestion(addressSuggestions[0].text, addressSuggestions[0].magicKey);
                    } else {
                        geocodeAddress(address);
                    }
                } else {
                    toast("Please enter an address to search", "warning");
                }
            });
            console.log("✅ Enhanced search button handler added");
        }

        updateDescriptionPreview();

        console.log("✅ ALL ENHANCED SYSTEMS INITIALIZED SUCCESSFULLY");
        setStatus("🚀 Ultimate system ready! Address autocomplete and building footprints enabled.", 'success');
        toast("🏛️ Enhanced Garage Sale Admin ready! Try typing an address for autocomplete.", "success");

        // Enhanced debug info
        console.log("🔍 Enhanced Debug Info:");
        console.log("- Map initialized:", !!map);
        console.log("- Feature layer:", !!featureLayer);
        console.log("- Buildings layer:", !!buildingsLayer);
        console.log("- Address autocomplete:", !!suggestionsDropdown);
        console.log("- New Sale button:", !!$("#btnNew"));
        console.log("- inNewMode:", inNewMode);

    } catch (error) {
        console.error("❌ Enhanced initialization failed:", error);
        setStatus("❌ Initialization failed. Please refresh the page.", 'error');
        toast("System failed to start. Please refresh the page.", "error");
    }
}

window.addEventListener('error', (event) => {
    console.error("💥 Global error:", event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error("💥 Unhandled promise rejection:", event.reason);
});

console.log("🚀 Ultimate Enhanced Garage Sale Admin script loaded!");
