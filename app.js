// app.js — FIXED Garage Sale Admin v8.0 - SIMPLIFIED
// City of Portland, Texas - Fixed buttons, removed templates, clean design

/* =============== Wait for DOM and Dependencies =============== */
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

    console.log('🚀 Starting Garage Sale Admin...');
    init();
});

/* =============== Global State =============== */
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
let multiDayData = [];

/* =============== COORDINATE CONVERSION FIX =============== */
function webMercatorToWGS84(x, y) {
    const lng = x / 20037508.34 * 180;
    let lat = y / 20037508.34 * 180;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return [lat, lng];
}

/* =============== UI Utilities =============== */
const $ = (sel) => document.querySelector(sel);

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.9); 
        display: flex; align-items: center; justify-content: center; 
        z-index: 9999; backdrop-filter: blur(8px);
    `;
    errorDiv.innerHTML = `
        <div style="background: #ef4444; color: white; padding: 20px; border-radius: 12px; text-align: center; max-width: 400px;">
            <h3>⚠️ System Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="background: white; color: #ef4444; border: none; padding: 8px 16px; border-radius: 6px; margin-top: 12px; cursor: pointer; font-weight: bold;">
                Reload Page
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

function showToast(msg, type = "info", duration = 4000) {
    console.log(`📢 [${type.toUpperCase()}]: ${msg}`);

    // Don't show technical messages
    if (msg.includes('footprints') || msg.includes('Enhanced') || msg.includes('ready to use')) {
        return;
    }

    const colors = {
        success: { bg: '#10b981', icon: '✅' },
        error: { bg: '#ef4444', icon: '❌' },
        warning: { bg: '#f59e0b', icon: '⚠️' },
        info: { bg: '#3b82f6', icon: 'ℹ️' }
    };

    const color = colors[type] || colors.info;

    const toast = document.createElement("div");
    toast.innerHTML = `
        <span>${color.icon}</span>
        <span>${msg}</span>
    `;
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 1000;
        background: ${color.bg}; color: white; padding: 16px 20px;
        border-radius: 12px; font-weight: 500; font-size: 15px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 400px; display: flex; align-items: center; gap: 8px;
        transform: translateX(100%); transition: all 0.4s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);

    // Animate out
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 400);
    }, duration);
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
        statusEl.innerHTML = isOnline ? 
            '🌐 Connected' :
            '⚠️ Offline';
        statusEl.className = isOnline ? "connection-status online" : "connection-status offline";
    }
}

// Data utilities
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

/* =============== Enhanced Description with Multi-Day Support =============== */
function composeDescription() {
    const details = $("#details")?.value?.trim() || "";

    if ($("#chkMultiDay")?.checked && multiDayData.length > 0) {
        const dayStrings = multiDayData.map(day => {
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const dayName = dayNames[day.dayOfWeek];
            const startTime = formatTime(day.startHour, day.startMin, day.startAmPm);
            const endTime = formatTime(day.endHour, day.endMin, day.endAmPm);
            return `${dayName} ${startTime} - ${endTime}`;
        });
        const timeStr = dayStrings.join(' & ');
        return details ? `${timeStr}: ${details}` : timeStr;
    } else {
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
    if (preview) preview.value = composeDescription();
}

/* =============== Multi-Day Sales Functionality =============== */
function setupMultiDayFeature() {
    const checkbox = $("#chkMultiDay");
    const singleDayTimes = $("#single-day-times");
    const multiDayTimes = $("#multi-day-times");

    if (!checkbox || !singleDayTimes || !multiDayTimes) {
        console.warn("⚠️ Multi-day elements not found");
        return;
    }

    checkbox.addEventListener('change', function() {
        if (this.checked) {
            singleDayTimes.style.display = 'none';
            multiDayTimes.style.display = 'block';

            if (multiDayData.length === 0) {
                const startDate = $("#dateStart").value;
                if (startDate) {
                    const dayOfWeek = new Date(startDate).getDay();
                    addMultiDayEntry(dayOfWeek);
                }
            }
        } else {
            singleDayTimes.style.display = 'block';
            multiDayTimes.style.display = 'none';
        }
        updateDescriptionPreview();
    });

    const btnAddDay = $("#btnAddDay");
    if (btnAddDay) {
        btnAddDay.addEventListener('click', function() {
            const lastDay = multiDayData.length > 0 ? 
                multiDayData[multiDayData.length - 1].dayOfWeek : 
                new Date().getDay();
            const nextDay = (lastDay + 1) % 7;
            addMultiDayEntry(nextDay);
        });
    }

    console.log("✅ Multi-day sales feature initialized");
}

function addMultiDayEntry(dayOfWeek = 0) {
    const container = $("#multi-day-container");
    if (!container) return;

    const entry = {
        id: Date.now(),
        dayOfWeek: dayOfWeek,
        startHour: 7,
        startMin: 0,
        startAmPm: 'AM',
        endHour: 2,
        endMin: 0,
        endAmPm: 'PM'
    };

    multiDayData.push(entry);
    renderMultiDayEntries();
    updateDescriptionPreview();
}

function renderMultiDayEntries() {
    const container = $("#multi-day-container");
    if (!container) return;

    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    container.innerHTML = multiDayData.map((entry, index) => `
        <div class="multi-day-row">
            <div class="day-number">
                <span class="day-badge">${index + 1}</span>
                <strong>Sale Day ${index + 1}</strong>
            </div>
            <div class="day-controls">
                <div class="day-selector">
                    <label>Day</label>
                    <select onchange="updateMultiDayEntry(${entry.id}, 'dayOfWeek', this.value)">
                        ${dayNames.map((day, i) => `
                            <option value="${i}" ${entry.dayOfWeek === i ? 'selected' : ''}>${day}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="time-group">
                    <select onchange="updateMultiDayEntry(${entry.id}, 'startHour', this.value)">
                        ${Array.from({length: 12}, (_, i) => i + 1).map(h => `
                            <option value="${h}" ${entry.startHour === h ? 'selected' : ''}>${h}</option>
                        `).join('')}
                    </select>
                    :
                    <select onchange="updateMultiDayEntry(${entry.id}, 'startMin', this.value)">
                        <option value="0" ${entry.startMin === 0 ? 'selected' : ''}>00</option>
                        <option value="30" ${entry.startMin === 30 ? 'selected' : ''}>30</option>
                    </select>
                    <select onchange="updateMultiDayEntry(${entry.id}, 'startAmPm', this.value)">
                        <option value="AM" ${entry.startAmPm === 'AM' ? 'selected' : ''}>AM</option>
                        <option value="PM" ${entry.startAmPm === 'PM' ? 'selected' : ''}>PM</option>
                    </select>
                </div>
                to
                <div class="time-group">
                    <select onchange="updateMultiDayEntry(${entry.id}, 'endHour', this.value)">
                        ${Array.from({length: 12}, (_, i) => i + 1).map(h => `
                            <option value="${h}" ${entry.endHour === h ? 'selected' : ''}>${h}</option>
                        `).join('')}
                    </select>
                    :
                    <select onchange="updateMultiDayEntry(${entry.id}, 'endMin', this.value)">
                        <option value="0" ${entry.endMin === 0 ? 'selected' : ''}>00</option>
                        <option value="30" ${entry.endMin === 30 ? 'selected' : ''}>30</option>
                    </select>
                    <select onchange="updateMultiDayEntry(${entry.id}, 'endAmPm', this.value)">
                        <option value="AM" ${entry.endAmPm === 'AM' ? 'selected' : ''}>AM</option>
                        <option value="PM" ${entry.endAmPm === 'PM' ? 'selected' : ''}>PM</option>
                    </select>
                </div>
                <button class="btn-remove-day" onclick="removeMultiDayEntry(${entry.id})" title="Remove this day">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

window.updateMultiDayEntry = function(id, field, value) {
    const entry = multiDayData.find(e => e.id == id);
    if (entry) {
        if (field === 'dayOfWeek' || field === 'startHour' || field === 'startMin' || field === 'endHour' || field === 'endMin') {
            entry[field] = parseInt(value);
        } else {
            entry[field] = value;
        }
        updateDescriptionPreview();
    }
};

window.removeMultiDayEntry = function(id) {
    multiDayData = multiDayData.filter(e => e.id != id);
    renderMultiDayEntries();
    updateDescriptionPreview();
    showToast("Day removed", "info");
};

/* =============== Address Autocomplete System =============== */
async function setupAddressAutocomplete() {
    const addressField = $("#address");
    const searchField = $("#addressSearch");

    if (!addressField && !searchField) return;

    suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.style.cssText = `
        position: absolute; 
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(60,240,212,0.3);
        border-radius: 12px;
        max-height: 240px; 
        overflow-y: auto; 
        z-index: 1000; 
        display: none;
        backdrop-filter: blur(12px); 
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        min-width: 300px;
    `;

    if (addressField) setupFieldAutocomplete(addressField);
    if (searchField) setupFieldAutocomplete(searchField);

    console.log("✅ Address autocomplete ready");
}

function setupFieldAutocomplete(field) {
    let timeout;

    field.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            hideSuggestions();
            return;
        }

        timeout = setTimeout(() => {
            searchAddressSuggestions(query, field);
        }, 400);
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
            const selected = suggestionsDropdown?.querySelector('.suggestion-selected');
            if (selected) selected.click();
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    document.addEventListener('click', (e) => {
        if (!field.contains(e.target) && !suggestionsDropdown?.contains(e.target)) {
            hideSuggestions();
        }
    });
}

async function searchAddressSuggestions(query, field) {
    try {
        const searchQuery = query.includes('TX') ? query : `${query}, Portland, TX`;

        const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?` +
            `text=${encodeURIComponent(searchQuery)}&f=json&maxSuggestions=6&countryCode=USA&category=Address`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.suggestions && data.suggestions.length > 0) {
            const filteredSuggestions = data.suggestions.filter(s => 
                s.text.toLowerCase().includes('portland') || 
                s.text.toLowerCase().includes('tx') ||
                s.text.toLowerCase().includes('texas')
            );

            if (filteredSuggestions.length > 0) {
                showSuggestions(filteredSuggestions, field);
            } else if (data.suggestions.length > 0) {
                showSuggestions(data.suggestions.slice(0, 4), field);
            }
        } else {
            hideSuggestions();
        }

    } catch (error) {
        console.warn("⚠️ Address suggestions failed:", error);
        hideSuggestions();
    }
}

function showSuggestions(suggestions, field) {
    const rect = field.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    suggestionsDropdown.style.left = (rect.left + scrollLeft) + 'px';
    suggestionsDropdown.style.top = (rect.bottom + scrollTop + 8) + 'px';
    suggestionsDropdown.style.width = Math.max(rect.width, 320) + 'px';

    suggestionsDropdown.innerHTML = suggestions.map((suggestion, index) => `
        <div class="suggestion-item" data-text="${suggestion.text}" data-magic="${suggestion.magicKey}" data-index="${index}">
            <span>📍</span>
            <div>
                <strong>${suggestion.text}</strong>
                <small>📍 Address suggestion</small>
            </div>
        </div>
    `).join('');

    suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(i => {
                i.classList.remove('suggestion-selected');
                i.style.background = 'transparent';
            });
            item.classList.add('suggestion-selected');
            item.style.background = 'rgba(60,240,212,0.15)';
        });

        item.addEventListener('click', () => {
            const text = item.getAttribute('data-text');
            const magicKey = item.getAttribute('data-magic');
            selectSuggestion(text, magicKey, field);
        });
    });

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
    const items = suggestionsDropdown?.querySelectorAll('.suggestion-item');
    if (!items) return;

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
        items[newIndex].style.background = 'rgba(60,240,212,0.15)';
        items[newIndex].scrollIntoView({ block: 'nearest' });
    }
}

async function selectSuggestion(text, magicKey, field) {
    console.log("🏠 Selected suggestion:", text);

    field.value = text;
    hideSuggestions();

    try {
        let url;
        if (magicKey) {
            url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?magicKey=${magicKey}&f=json`;
        } else {
            url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(text)}&f=json`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const latlng = [candidate.location.y, candidate.location.x];

            map.flyTo(latlng, 17, { duration: 1.2 });

            if (window.searchMarker) map.removeLayer(window.searchMarker);

            window.searchMarker = L.marker(latlng, {
                icon: L.divIcon({
                    html: '<div style="background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">📍</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(map);

            setTimeout(() => {
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                    window.searchMarker = null;
                }
            }, 3500);

            showToast("📍 Address located", "success");
        }
    } catch (error) {
        console.warn("⚠️ Geocoding failed for suggestion:", error);
    }
}

/* =============== Enhanced Map =============== */
async function initMap() {
    console.log("🗺️ Initializing map system...");

    try {
        showLoadingOverlay("Loading map system...");

        map = L.map('map', {
            center: [27.876, -97.323],
            zoom: 15,
            minZoom: 10,
            maxZoom: 19,
            zoomControl: true,
            attributionControl: true
        });

        // Clean, professional layers
        const baseLayers = {
            "🗺️ Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            "🛰️ Hybrid + Roads": L.layerGroup([
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Esri, DigitalGlobe, GeoEye',
                    maxZoom: 19
                }),
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Esri',
                    maxZoom: 19,
                    opacity: 0.85
                })
            ]),
            "📡 Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri, DigitalGlobe, GeoEye',
                maxZoom: 19
            })
        };

        // Start with Hybrid + Roads
        baseLayers["🛰️ Hybrid + Roads"].addTo(map);
        L.control.layers(baseLayers).addTo(map);

        // Simple, clean garage sale icon (no animations)
        window.garageSaleIcon = L.divIcon({
            className: 'garage-sale-icon',
            html: '<div style="background: linear-gradient(135deg, #3cf0d4, #7c89ff); color: #041311; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: pointer;">🏷️</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);

        await Promise.all([
            loadGarageSales(),
            setupAddressAutocomplete()
        ]);

        hideLoadingOverlay();

        console.log("✅ Map system ready");
        setStatus("🚀 System ready - click 'New Sale' to add garage sales", 'success');

    } catch (error) {
        hideLoadingOverlay();
        console.error("❌ Map initialization failed:", error);
        setStatus("Failed to initialize map. Please refresh.", 'error');
    }
}

function showLoadingOverlay(message = "Loading...") {
    let overlay = $("#loading-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.style.cssText = `
            position: fixed; inset: 0; 
            background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 500; backdrop-filter: blur(8px);
        `;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="text-align: center; color: white;">
            <div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #3cf0d4; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 16px; font-weight: 600;">${message}</div>
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

/* =============== FIXED Garage Sales Loading =============== */
async function loadGarageSales() {
    console.log("🔄 Loading garage sales...");

    try {
        const queryUrl = `${CONFIG.LAYER_URL}/query?where=1%3D1&outFields=*&returnGeometry=true&f=json`;
        console.log("🌐 Using URL:", queryUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(queryUrl, {
            signal: controller.signal,
            method: 'GET'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📊 ArcGIS Response:", data);

        if (data.error) {
            console.error("❌ ArcGIS Error:", data.error);
            throw new Error(data.error.message || "ArcGIS service error");
        }

        garageSalesData = data.features || [];
        console.log(`📍 Found ${garageSalesData.length} garage sales`);

        if (featureLayer) map.removeLayer(featureLayer);
        featureLayer = L.layerGroup();

        let markersAdded = 0;
        garageSalesData.forEach((feature, index) => {
            try {
                if (addGarageSaleMarker(feature, index)) {
                    markersAdded++;
                }
            } catch (error) {
                console.warn(`⚠️ Failed to add marker ${index}:`, error);
            }
        });

        if (markersAdded > 0) {
            featureLayer.addTo(map);
            console.log(`✅ Added ${markersAdded} garage sale markers`);
        }

        _featureCount = garageSalesData.length;
        updateStats();

        if (_featureCount === 0) {
            setStatus("No garage sales found. Click 'New Sale' to add the first one.", 'info');
        } else {
            setStatus(`${_featureCount} garage sales loaded successfully.`, 'success');
        }

    } catch (error) {
        console.error("❌ Failed to load garage sales:", error);
        setStatus("Could not load existing garage sales. You can still add new ones.", 'warning');

        if (!featureLayer) {
            featureLayer = L.layerGroup().addTo(map);
        }
    }
}

/* =============== FIXED Garage Sale Marker with Coordinate Conversion =============== */
function addGarageSaleMarker(feature, index) {
    const geom = feature.geometry;
    const attrs = feature.attributes;

    if (!geom || typeof geom.y !== 'number' || typeof geom.x !== 'number') {
        console.warn(`⚠️ Invalid geometry for feature ${index}`);
        return false;
    }

    // FIX: CONVERT COORDINATES FROM WEB MERCATOR TO WGS84
    const [lat, lng] = webMercatorToWGS84(geom.x, geom.y);
    
    console.log(`📍 Feature ${index}: Web Mercator (${geom.x}, ${geom.y}) -> WGS84 (${lat}, ${lng})`);

    const marker = L.marker([lat, lng], { 
        icon: window.garageSaleIcon,
        title: attrs[FIELDS.address] || `Garage Sale ${index + 1}`,
        zIndexOffset: 1000
    });

    const popupContent = createPopupContent(attrs);
    marker.bindPopup(popupContent);

    marker.on('click', () => {
        loadForEdit(feature);
    });

    marker.featureData = feature;
    featureLayer.addLayer(marker);

    return true;
}

function createPopupContent(attributes) {
    const address = attributes[FIELDS.address] || "No address";
    const description = attributes[FIELDS.description] || "No description";
    const startDate = attributes[FIELDS.start] ? 
        new Date(attributes[FIELDS.start]).toLocaleDateString() : "No date";

    return `
        <div style="padding: 4px; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">🏷️</span>
                <div>
                    <h4 style="margin: 0; color: #3cf0d4; font-weight: 700; font-size: 14px;">${address}</h4>
                    <small style="color: #94a3b8;">Garage Sale Location</small>
                </div>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 12px;">
                <div>
                    <span style="color: #3cf0d4;">📅 DATE</span><br>
                    <strong style="color: #f1f5f9;">${startDate}</strong>
                </div>
                <div>
                    <span style="color: #3cf0d4;">🛍️ ITEMS</span><br>
                    <strong style="color: #f1f5f9;">${description}</strong>
                </div>
            </div>
            <button onclick="editSale(${attributes[objectIdField]})" style="background: #3cf0d4; color: #041311; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
                ✏️ Edit Sale
            </button>
        </div>
    `;
}

window.editSale = function(objectId) {
    const marker = featureLayer.getLayers().find(layer => 
        layer.featureData.attributes[objectIdField] === objectId
    );
    if (marker) {
        loadForEdit(marker.featureData);
        map.closePopup();
    }
};

/* =============== Map Event Handlers =============== */
function onMapClick(e) {
    if (!inNewMode) {
        showToast("💡 Click 'New Sale' first to add a garage sale", "info");
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

function placeNewSale(latlng) {
    console.log("📍 Placing new sale at:", latlng);

    if (editMarker) {
        map.removeLayer(editMarker);
    }

    editMarker = L.marker(latlng, {
        icon: L.divIcon({
            html: '<div style="background: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4);">📍</div>',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    setTimeout(() => {
        $("#address")?.focus();
    }, 100);

    setStatus("🎯 Perfect! Location placed. Fill out the details below.", 'success');
    showToast("📍 Location placed! Now fill out the form.", "success");

    reverseGeocode(latlng);
}

async function reverseGeocode(latlng) {
    try {
        const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            $("#address").value = data.address.Match_addr;
            console.log("🏠 Auto-filled address:", data.address.Match_addr);
            showToast("🏠 Address found automatically!", "info");
        }
    } catch (error) {
        console.warn("⚠️ Reverse geocoding failed:", error);
    }
}

/* =============== Core Functions =============== */
function updateStats() {
    try {
        $("#totalSales").textContent = garageSalesData.length.toString();
        $("#weekendSales").textContent = "0"; // Simplified for demo
    } catch (error) {
        console.warn("⚠️ Stats update failed:", error);
    }
}

// FIXED: Simplified enterAddMode without template selector
function enterAddMode() {
    console.log("🆕 Entering add mode...");

    inNewMode = true;

    $("#btnCancel").style.display = "inline-flex";
    $("#modeChip").style.display = "flex";
    $("#modeChip").innerHTML = '✨ Click map to place garage sale';

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
    }

    setStatus("✨ Great! Now click anywhere on the map to place your garage sale.", 'info');
    $("#coordinates").textContent = "Click map to place garage sale";

    console.log("✅ Add mode activated");
    showToast("✨ Click anywhere on the map to place your sale", "info");
}

function cancelEditing() {
    inNewMode = false;
    selectedFeature = null;

    $("#btnCancel").style.display = "none";
    $("#modeChip").style.display = "none";

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
    }

    clearForm();
    setStatus("🏠 Ready to manage garage sales. Everything looks great!", 'info');
    showToast("Editing cancelled", "info");
}

function clearForm() {
    $("#address").value = "";
    $("#details").value = "";
    $("#dateStart").value = "";
    $("#dateEnd").value = "";

    const chkMultiDay = $("#chkMultiDay");
    if (chkMultiDay) {
        chkMultiDay.checked = false;
        $("#single-day-times").style.display = 'block';
        $("#multi-day-times").style.display = 'none';
    }
    multiDayData = [];

    updateDescriptionPreview();
}

/* =============== FIXED Load for Edit with Coordinate Conversion =============== */
function loadForEdit(feature) {
    selectedFeature = feature;
    inNewMode = false;

    $("#btnCancel").style.display = "inline-flex";
    $("#modeChip").style.display = "none";

    const attrs = feature.attributes;
    const geom = feature.geometry;

    $("#address").value = attrs[FIELDS.address] || "";
    $("#dateStart").value = fromEpoch(attrs[FIELDS.start]) || "";
    $("#dateEnd").value = fromEpoch(attrs[FIELDS.end]) || "";
    $("#details").value = attrs[FIELDS.description] || "";

    if (editMarker) map.removeLayer(editMarker);

    // FIX: CONVERT COORDINATES HERE TOO
    const [lat, lng] = webMercatorToWGS84(geom.x, geom.y);

    editMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '<div style="background: #f59e0b; color: #451a03; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4);">✏️</div>',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    map.flyTo([lat, lng], 17, { duration: 1.2 });

    const address = attrs[FIELDS.address] || "Unknown location";
    setStatus(`✏️ Editing: ${address}. Make your changes and save.`, 'info');

    updateDescriptionPreview();
    showToast("✏️ Editing garage sale", "info");
}

async function onSave() {
    const address = $("#address").value.trim();
    const startDate = $("#dateStart").value;

    if (!address) {
        showToast("⚠️ Address is required", "warning");
        $("#address").focus();
        return;
    }

    if (!startDate) {
        showToast("⚠️ Start date is required", "warning");
        $("#dateStart").focus();
        return;
    }

    if (!editMarker) {
        showToast("⚠️ Please place a location on the map first", "warning");
        return;
    }

    try {
        showLoadingOverlay("Saving your garage sale...");

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

        const formData = new FormData();
        formData.append('f', 'json');
        if (edits.adds) formData.append('adds', JSON.stringify(edits.adds));
        if (edits.updates) formData.append('updates', JSON.stringify(edits.updates));

        const response = await fetch(`${CONFIG.LAYER_URL}/applyEdits`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        hideLoadingOverlay();

        if (result.error || !(result.addResults?.[0]?.success || result.updateResults?.[0]?.success)) {
            throw new Error(result.error?.message || "Save operation failed");
        }

        const successMessage = selectedFeature ? "🎉 Garage sale updated!" : "🎉 Garage sale added!";
        showToast(successMessage, "success");

        await loadGarageSales();
        cancelEditing();

    } catch (error) {
        hideLoadingOverlay();
        console.error("❌ Save failed:", error);
        showToast(`❌ Save failed: ${error.message}`, "error");
    }
}

function cycleTheme() {
    const themes = ["dark", "dim", "light"];
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const currentIndex = themes.indexOf(current);
    const next = themes[(currentIndex + 1) % themes.length];

    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem('preferred_theme', next);

    showToast(`🎨 Theme: ${next}`, "info");
}

/* =============== Simple Help Guide =============== */
function showGuide() {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "guide-modal-backdrop";
    modalBackdrop.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.9);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 20px; backdrop-filter: blur(12px);
    `;

    modalBackdrop.innerHTML = `
        <div class="glass" style="width: min(800px, 95vw); max-height: 90vh; border-radius: 16px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--line);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">🏷️</span>
                    <h2 style="margin: 0; font-size: 18px; color: var(--text);">Garage Sale Manager Guide</h2>
                </div>
                <button class="close-guide-btn" style="background: transparent; border: none; color: var(--text); font-size: 24px; cursor: pointer; padding: 8px; border-radius: 6px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
            <div style="padding: 24px; color: var(--text); max-height: 60vh; overflow-y: auto;">
                <h3 style="color: var(--accent); margin-bottom: 12px;">🚀 Quick Start</h3>
                <ol style="margin-left: 20px; line-height: 1.6;">
                    <li><strong>Click "New Sale"</strong> - Start adding a garage sale</li>
                    <li><strong>Click the Map</strong> - Place your sale location</li>
                    <li><strong>Fill the Form</strong> - Add address, date, and items</li>
                    <li><strong>Click "Save"</strong> - Your sale is added!</li>
                </ol>

                <h3 style="color: var(--accent); margin: 24px 0 12px 0;">🔤 Address Tips</h3>
                <ul style="margin-left: 20px; line-height: 1.6;">
                    <li>Type just 2 characters to see suggestions</li>
                    <li>Use arrow keys to navigate suggestions</li>
                    <li>Press Enter to select a suggestion</li>
                    <li>The map will automatically zoom to the address</li>
                </ul>

                <h3 style="color: var(--accent); margin: 24px 0 12px 0;">📅 Multi-Day Sales</h3>
                <ul style="margin-left: 20px; line-height: 1.6;">
                    <li>Check the "Multi-day sale" box</li>
                    <li>Add different days with different times</li>
                    <li>Perfect for weekend sales with varying hours</li>
                </ul>

                <h3 style="color: var(--accent); margin: 24px 0 12px 0;">✏️ Editing</h3>
                <ul style="margin-left: 20px; line-height: 1.6;">
                    <li>Click any marker on the map to edit</li>
                    <li>Update the information and click "Save"</li>
                    <li>Click "Cancel" to stop editing</li>
                </ul>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 24px; border-top: 1px solid var(--line);">
                <button class="close-guide-btn btn" style="background: var(--accent); color: #041311; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Got it!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalBackdrop);

    // Close button handlers
    const closeButtons = modalBackdrop.querySelectorAll('.close-guide-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeGuideModal();
        });
    });

    // Close on backdrop click
    modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
            closeGuideModal();
        }
    });

    window.currentGuideModal = modalBackdrop;
}

function closeGuideModal() {
    if (window.currentGuideModal) {
        document.body.removeChild(window.currentGuideModal);
        window.currentGuideModal = null;
    }
}

function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        loadGarageSales();
        showToast("🌐 Connection restored", "success");
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        showToast("⚠️ Connection lost - working offline", "warning");
    });

    updateConnectionStatus();
}

/* =============== FIXED Initialization =============== */
async function init() {
    console.log("🏛️ Garage Sale Admin v8.0 - FIXED VERSION");
    console.log("🚀 Initializing system...");

    try {
        const savedTheme = localStorage.getItem('preferred_theme');
        if (savedTheme) {
            document.documentElement.setAttribute("data-theme", savedTheme);
        }

        setupNetworkMonitoring();
        await initMap();

        // Set up multi-day functionality
        setupMultiDayFeature();

        // Form handlers
        ["timeStartHour", "timeStartMin", "timeStartAmPm", "timeEndHour", "timeEndMin", "timeEndAmPm", "details"]
            .forEach(id => {
                const el = $("#" + id);
                if (el) el.addEventListener("change", updateDescriptionPreview);
            });

        // FIXED: Button handlers without template selector
        const btnNew = $("#btnNew");
        if (btnNew) {
            btnNew.addEventListener("click", enterAddMode);
        }

        $("#btnSave")?.addEventListener("click", onSave);
        $("#btnCancel")?.addEventListener("click", cancelEditing);
        $("#btnTheme")?.addEventListener("click", cycleTheme);
        $("#btnGuide")?.addEventListener("click", showGuide);

        // Enhanced address search
        $("#btnSearch")?.addEventListener("click", () => {
            const address = $("#addressSearch").value.trim();
            if (address && addressSuggestions.length > 0) {
                selectSuggestion(addressSuggestions[0].text, addressSuggestions[0].magicKey, $("#addressSearch"));
            } else if (address) {
                showToast("💡 Try the autocomplete suggestions for better results", "info");
            }
        });

        updateDescriptionPreview();

        console.log("✅ System ready - FIXED VERSION!");
        setStatus("🎉 System ready! All features enabled.", 'success');

        // Welcome message
        setTimeout(() => {
            showToast("🏛️ Welcome to the garage sale management system!", "info", 5000);
        }, 1000);

    } catch (error) {
        console.error("❌ Initialization failed:", error);
        setStatus("System failed to start. Please refresh.", 'error');
    }
}

window.addEventListener('error', (event) => {
    console.error("💥 Error:", event.error);
});

// Set up global functions
window.showToast = showToast;
window.setStatus = setStatus;
window.closeGuideModal = closeGuideModal;

console.log("🚀 Garage Sale Admin loaded - FIXED VERSION with working buttons and clean design!");
