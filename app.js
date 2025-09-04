// app.js — Ultimate Garage Sale Admin for City of Portland, Texas
// v8.0 — Government-Ready Production System

/* ================ Configuration & Globals ================ */
const CONFIG = window.CONFIG;
const LOG = window.APP_LOG;
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

// Enhanced toast notifications with accessibility
function toast(msg, type = "info", duration = CONFIG.TOAST_DURATION) {
    const el = document.createElement("div");
    el.className = `toast glass toast-${type}`;
    el.innerHTML = msg;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    // Add to DOM
    document.body.appendChild(el);

    // Auto-remove
    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
        }
    }, duration);

    // Announce to screen readers
    announceToScreenReader(msg);

    LOG.info(`Toast [${type.toUpperCase()}]:`, msg);
}

// Screen reader announcements
function announceToScreenReader(message) {
    if (!CONFIG.SCREEN_READER_ENABLED) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

// Enhanced status updates
function setStatus(text, type = 'info') {
    const el = $("#status");
    if (el) {
        el.textContent = text;
        el.className = `status ${type}`;
        el.setAttribute('aria-live', 'polite');
    }

    // Update connection status
    updateConnectionStatus();

    LOG.info(`Status [${type.toUpperCase()}]:`, text);
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

// Enhanced error handling
function handleError(error, context = 'Application', showToast = true) {
    const errorMessage = error.message || error.toString();
    LOG.error(`${context} Error:`, error);

    if (showToast) {
        toast(`${context} failed: ${errorMessage}`, "error");
    }

    // Send error to status
    setStatus(`Error: ${errorMessage}`, 'error');

    // Store error for debugging
    if (!window.errorLog) window.errorLog = [];
    window.errorLog.push({
        timestamp: new Date().toISOString(),
        context,
        error: errorMessage,
        stack: error.stack
    });
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
        // Multi-day format: "Friday 7:00 AM - 2:00 PM & Saturday 8:00 AM - 4:00 PM: Items"
        const dayStrings = multiDayData.map(day => {
            const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day.dayOfWeek];
            const startTime = formatTime(day.startHour, day.startMin, day.startAmPm);
            const endTime = formatTime(day.endHour, day.endMin, day.endAmPm);
            return `${dayName} ${startTime} - ${endTime}`;
        });
        const timeStr = dayStrings.join(' & ');
        return details ? `${timeStr}: ${details}` : timeStr;
    } else {
        // Single day format: "7:00 AM - 4:00 PM: Items"
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

        // Auto-save draft if enabled
        if (CONFIG.AUTO_SAVE_DRAFTS) {
            scheduleAutoSave();
        }
    }
}

// Auto-save drafts
function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    autoSaveTimer = setTimeout(() => {
        saveDraft();
    }, 2000); // Save after 2 seconds of inactivity
}

function saveDraft() {
    try {
        const draft = {
            address: $("#address")?.value || "",
            details: $("#details")?.value || "",
            dateStart: $("#dateStart")?.value || "",
            dateEnd: $("#dateEnd")?.value || "",
            multiDay: $("#chkMultiDay")?.checked || false,
            multiDayData: [...multiDayData],
            timestamp: Date.now()
        };

        localStorage.setItem('garage_sale_draft', JSON.stringify(draft));
        LOG.debug("Draft saved automatically");
    } catch (error) {
        LOG.warn("Failed to save draft:", error);
    }
}

function loadDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem('garage_sale_draft') || '{}');

        if (draft.timestamp && (Date.now() - draft.timestamp) < 86400000) { // 24 hours
            if (draft.address) $("#address").value = draft.address;
            if (draft.details) $("#details").value = draft.details;
            if (draft.dateStart) $("#dateStart").value = draft.dateStart;
            if (draft.dateEnd) $("#dateEnd").value = draft.dateEnd;
            if (draft.multiDay) {
                $("#chkMultiDay").checked = true;
                multiDayData = draft.multiDayData || [];
                toggleMultiDayDisplay(true);
            }

            updateDescriptionPreview();
            LOG.info("Draft restored from previous session");
            toast("Previous draft restored", "info");
        }
    } catch (error) {
        LOG.warn("Failed to load draft:", error);
    }
}

function clearDraft() {
    localStorage.removeItem('garage_sale_draft');
}

/* ================ Stats & Analytics ================ */
function updateStats() {
    try {
        const totalSales = garageSalesData.length;
        const now = new Date();
        const thisWeekend = garageSalesData.filter(sale => {
            const saleDate = new Date(sale.attributes[FIELDS.start]);
            const dayOfWeek = saleDate.getDay();
            const thisWeekendStart = new Date(now);
            thisWeekendStart.setDate(now.getDate() + (6 - now.getDay())); // This Saturday
            const thisWeekendEnd = new Date(thisWeekendStart);
            thisWeekendEnd.setDate(thisWeekendStart.getDate() + 1); // This Sunday

            return saleDate >= thisWeekendStart && saleDate <= thisWeekendEnd;
        }).length;

        $("#totalSales").textContent = totalSales.toString();
        $("#weekendSales").textContent = thisWeekend.toString();

        LOG.debug("Stats updated:", { totalSales, thisWeekend });
    } catch (error) {
        handleError(error, 'Stats Update', false);
    }
}

/* ================ Enhanced Map Implementation ================ */
async function initMap() {
    LOG.info("Initializing enhanced map system...");

    try {
        // Show loading overlay
        showLoadingOverlay("Initializing map...");

        // Create Leaflet map with enhanced options
        map = L.map('map', {
            center: CONFIG.CENTER,
            zoom: CONFIG.ZOOM,
            minZoom: CONFIG.MIN_ZOOM,
            maxZoom: CONFIG.MAX_ZOOM,
            zoomControl: false, // We'll add our own
            attributionControl: true
        });

        // Add custom zoom control
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Add scale control
        L.control.scale({ position: 'bottomright' }).addTo(map);

        // Enhanced base layer with multiple options
        const baseLayers = {
            "Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
                maxZoom: 19
            })
        };

        // Add default layer
        baseLayers["Street Map"].addTo(map);

        // Add layer control
        L.control.layers(baseLayers).addTo(map);

        // Custom garage sale icon
        window.garageSaleIcon = L.divIcon({
            className: 'garage-sale-icon',
            html: '<div class="garage-sale-marker">🏷️</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Enhanced map event handlers
        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);
        map.on('zoomend', onMapZoom);
        map.on('moveend', onMapMove);

        // Load garage sales data
        await loadGarageSales();

        // Hide loading overlay
        hideLoadingOverlay();

        LOG.success("Map initialized successfully");
        setStatus("Map loaded successfully. Ready to manage garage sales.", 'success');

    } catch (error) {
        hideLoadingOverlay();
        handleError(error, 'Map Initialization');
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

// Enhanced garage sales loading with retry logic
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

        // Create/update feature layer
        if (featureLayer) {
            map.removeLayer(featureLayer);
        }
        featureLayer = L.layerGroup();

        // Add each garage sale as a marker
        garageSalesData.forEach((feature, index) => {
            try {
                addGarageSaleMarker(feature, index);
            } catch (markerError) {
                LOG.warn("Failed to add marker:", markerError, feature);
            }
        });

        featureLayer.addTo(map);
        _featureCount = garageSalesData.length;

        // Update stats
        updateStats();

        hideLoadingOverlay();

        LOG.success(`Loaded ${_featureCount} garage sales successfully`);

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
            LOG.warn(`Load failed, retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
            toast(`Loading failed, retrying... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, "warning");

            setTimeout(() => {
                loadGarageSales(retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff

            return;
        }

        handleError(error, 'Load Garage Sales');
        setStatus("Failed to load garage sales. Please refresh the page.", 'error');
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
        title: attrs[FIELDS.address] || `Garage Sale ${index + 1}`,
        alt: `Garage sale at ${attrs[FIELDS.address] || 'unknown location'}`
    })
        .bindPopup(() => createPopupContent(attrs), {
            maxWidth: 300,
            className: 'garage-sale-popup'
        })
        .on('click', () => loadForEdit(feature))
        .on('keypress', (e) => {
            if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                loadForEdit(feature);
            }
        });

    // Store feature data on marker
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

// Security utility
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

// Enhanced map event handlers
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

function onMapZoom(e) {
    LOG.debug("Map zoom level:", map.getZoom());
}

function onMapMove(e) {
    LOG.debug("Map center:", map.getCenter());
}

function placeNewSale(latlng) {
    // Remove previous edit marker
    if (editMarker) {
        map.removeLayer(editMarker);
    }

    // Create edit marker (green for new)
    editMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'edit-marker',
            html: '<div class="edit-marker-icon new" aria-label="New sale location">📍</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        }),
        title: 'New garage sale location'
    }).addTo(map);

    // Focus address field for accessibility
    setTimeout(() => {
        $("#address")?.focus();
    }, 100);

    setStatus("Sale location placed. Fill out the form and click Save.", 'info');
    announceToScreenReader("Garage sale location placed on map. Please fill out the form.");

    // Try reverse geocoding for address
    reverseGeocode(latlng);
}

/* ================ Enhanced Address Search & Geocoding ================ */
async function reverseGeocode(latlng) {
    try {
        const url = `${CONFIG.GEOCODING_SERVICE}/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            const address = data.address.Match_addr;
            $("#address").value = address;
            LOG.debug("Reverse geocoded address:", address);
            announceToScreenReader(`Address found: ${address}`);
        }
    } catch (error) {
        LOG.warn("Reverse geocoding failed:", error);
    }
}

async function geocodeAddress(address) {
    if (!address.trim()) {
        toast("Please enter an address to search", "warning");
        return;
    }

    try {
        showLoadingOverlay("Searching for address...");

        // Enhanced address search with Portland, TX preference
        const searchAddress = address.includes('TX') || address.includes('Texas') ? 
            address : `${address}, Portland, TX`;

        const url = `${CONFIG.GEOCODING_SERVICE}/findAddressCandidates?` +
            `singleLine=${encodeURIComponent(searchAddress)}&` +
            `f=json&maxLocations=5&` +
            `bbox=-97.5,-27.7,-97.1,28.1`; // Bounding box around Portland, TX

        const response = await fetch(url);
        const data = await response.json();

        hideLoadingOverlay();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const latlng = [candidate.location.y, candidate.location.x];

            // Zoom to location with animation
            map.flyTo(latlng, 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });

            // Add temporary search marker
            if (window.searchMarker) {
                map.removeLayer(window.searchMarker);
            }

            window.searchMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'search-marker',
                    html: '<div class="search-marker-icon" aria-label="Search result">🔍</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                }),
                title: `Search result: ${candidate.address}`
            }).addTo(map);

            // Auto-remove search marker
            setTimeout(() => {
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                    window.searchMarker = null;
                }
            }, 5000);

            const foundAddress = candidate.address;
            toast(`Found: ${foundAddress}`, "success");
            announceToScreenReader(`Address found and map zoomed to: ${foundAddress}`);

            LOG.success("Geocoding successful:", foundAddress);

        } else {
            toast("Address not found. Try a more specific address.", "warning");
            announceToScreenReader("Address not found. Please try a more specific address.");
        }
    } catch (error) {
        hideLoadingOverlay();
        handleError(error, 'Address Search');
    }
}

// Enhanced address validation
function validateAddress(address) {
    if (!CONFIG.ENABLE_ADDRESS_VALIDATION) return true;

    const trimmedAddress = address.trim();

    if (trimmedAddress.length < 5) {
        return "Address is too short";
    }

    // Check for basic address components
    const hasNumber = /\d/.test(trimmedAddress);
    const hasStreetIndicator = /(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|circle|cir|court|ct)/i.test(trimmedAddress);

    if (!hasNumber) {
        return "Address should include a street number";
    }

    if (!hasStreetIndicator) {
        return "Address should include a street name";
    }

    return true;
}

/* ================ Enhanced Multi-Day Sale Management ================ */
function setupMultiDayFeature() {
    const multiDayCheckbox = $("#chkMultiDay");
    if (multiDayCheckbox) {
        multiDayCheckbox.addEventListener("change", (e) => {
            const isMultiDay = e.target.checked;
            toggleMultiDayDisplay(isMultiDay);

            if (isMultiDay && multiDayData.length === 0) {
                // Initialize with Friday and Saturday
                addMultiDayRow(5, 7, 0, "AM", 2, 0, "PM"); // Friday 7 AM - 2 PM
                addMultiDayRow(6, 8, 0, "AM", 4, 0, "PM"); // Saturday 8 AM - 4 PM
            }

            updateDescriptionPreview();
            announceToScreenReader(isMultiDay ? 
                "Multi-day sale enabled. Configure different times for each day." : 
                "Single day sale enabled."
            );
        });
    }

    const addDayButton = $("#btnAddDay");
    if (addDayButton) {
        addDayButton.addEventListener("click", () => {
            addMultiDayRow();
            announceToScreenReader("New day added to sale schedule");
        });
    }
}

function toggleMultiDayDisplay(isMultiDay) {
    $("#single-day-times").style.display = isMultiDay ? "none" : "block";
    $("#multi-day-times").style.display = isMultiDay ? "block" : "none";
}

function addMultiDayRow(dayOfWeek = 0, startHour = 7, startMin = 0, startAmPm = "AM", 
                       endHour = 2, endMin = 0, endAmPm = "PM") {
    const container = $("#multi-day-container");
    if (!container) return;

    const index = multiDayData.length;

    const dayData = {
        dayOfWeek: dayOfWeek || (index === 0 ? 5 : 6), // Default to Friday, Saturday
        startHour,
        startMin,
        startAmPm,
        endHour,
        endMin,
        endAmPm
    };

    multiDayData.push(dayData);

    const dayRow = document.createElement("div");
    dayRow.className = "multi-day-row";
    dayRow.setAttribute('role', 'group');
    dayRow.setAttribute('aria-label', `Day ${index + 1} schedule`);

    dayRow.innerHTML = `
        <div class="day-selector">
            <label for="daySelect${index}" class="sr-only">Day of week</label>
            <select id="daySelect${index}" class="day-select" data-index="${index}" aria-label="Day of week">
                <option value="0" ${dayData.dayOfWeek === 0 ? 'selected' : ''}>Sunday</option>
                <option value="1" ${dayData.dayOfWeek === 1 ? 'selected' : ''}>Monday</option>
                <option value="2" ${dayData.dayOfWeek === 2 ? 'selected' : ''}>Tuesday</option>
                <option value="3" ${dayData.dayOfWeek === 3 ? 'selected' : ''}>Wednesday</option>
                <option value="4" ${dayData.dayOfWeek === 4 ? 'selected' : ''}>Thursday</option>
                <option value="5" ${dayData.dayOfWeek === 5 ? 'selected' : ''}>Friday</option>
                <option value="6" ${dayData.dayOfWeek === 6 ? 'selected' : ''}>Saturday</option>
            </select>
        </div>
        <div class="time-row">
            <div class="time-group">
                <label for="startHour${index}" class="sr-only">Start hour</label>
                <label for="startMin${index}" class="sr-only">Start minute</label>
                <label for="startAmPm${index}" class="sr-only">Start AM/PM</label>
                <select id="startHour${index}" class="time-hour" data-index="${index}" data-field="startHour">
                    ${Array.from({length: 12}, (_, i) => 
                        `<option value="${i+1}" ${i+1 === dayData.startHour ? 'selected' : ''}>${i+1}</option>`
                    ).join('')}
                </select>
                <span>:</span>
                <select id="startMin${index}" class="time-min" data-index="${index}" data-field="startMin">
                    <option value="0" ${dayData.startMin === 0 ? 'selected' : ''}>00</option>
                    <option value="15" ${dayData.startMin === 15 ? 'selected' : ''}>15</option>
                    <option value="30" ${dayData.startMin === 30 ? 'selected' : ''}>30</option>
                    <option value="45" ${dayData.startMin === 45 ? 'selected' : ''}>45</option>
                </select>
                <select id="startAmPm${index}" class="time-ampm" data-index="${index}" data-field="startAmPm">
                    <option value="AM" ${dayData.startAmPm === 'AM' ? 'selected' : ''}>AM</option>
                    <option value="PM" ${dayData.startAmPm === 'PM' ? 'selected' : ''}>PM</option>
                </select>
            </div>
            <span class="time-separator">to</span>
            <div class="time-group">
                <label for="endHour${index}" class="sr-only">End hour</label>
                <label for="endMin${index}" class="sr-only">End minute</label>
                <label for="endAmPm${index}" class="sr-only">End AM/PM</label>
                <select id="endHour${index}" class="time-hour" data-index="${index}" data-field="endHour">
                    ${Array.from({length: 12}, (_, i) => 
                        `<option value="${i+1}" ${i+1 === dayData.endHour ? 'selected' : ''}>${i+1}</option>`
                    ).join('')}
                </select>
                <span>:</span>
                <select id="endMin${index}" class="time-min" data-index="${index}" data-field="endMin">
                    <option value="0" ${dayData.endMin === 0 ? 'selected' : ''}>00</option>
                    <option value="15" ${dayData.endMin === 15 ? 'selected' : ''}>15</option>
                    <option value="30" ${dayData.endMin === 30 ? 'selected' : ''}>30</option>
                    <option value="45" ${dayData.endMin === 45 ? 'selected' : ''}>45</option>
                </select>
                <select id="endAmPm${index}" class="time-ampm" data-index="${index}" data-field="endAmPm">
                    <option value="AM" ${dayData.endAmPm === 'AM' ? 'selected' : ''}>AM</option>
                    <option value="PM" ${dayData.endAmPm === 'PM' ? 'selected' : ''}>PM</option>
                </select>
            </div>
        </div>
        <button class="btn-remove-day" data-index="${index}" type="button" aria-label="Remove this day">
            ❌
        </button>
    `;

    container.appendChild(dayRow);

    // Add event listeners
    dayRow.querySelectorAll("select").forEach(select => {
        select.addEventListener("change", updateMultiDayData);
    });

    dayRow.querySelector(".btn-remove-day").addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.index);
        removeMultiDayRow(idx);
    });

    updateDescriptionPreview();
}

function updateMultiDayData(e) {
    const index = parseInt(e.target.dataset.index);
    const field = e.target.dataset.field || "dayOfWeek";

    if (multiDayData[index]) {
        if (field === "dayOfWeek") {
            multiDayData[index].dayOfWeek = parseInt(e.target.value);
        } else {
            multiDayData[index][field] = e.target.classList.contains("time-hour") || 
                                        e.target.classList.contains("time-min") ? 
                                        parseInt(e.target.value) : e.target.value;
        }

        updateDescriptionPreview();
        LOG.debug("Multi-day data updated:", multiDayData[index]);
    }
}

function removeMultiDayRow(index) {
    if (multiDayData.length <= 1) {
        toast("At least one day is required for multi-day sales", "warning");
        return;
    }

    multiDayData.splice(index, 1);
    rebuildMultiDayRows();
    updateDescriptionPreview();
    announceToScreenReader("Day removed from sale schedule");
}

function rebuildMultiDayRows() {
    const container = $("#multi-day-container");
    if (container) {
        container.innerHTML = "";
        multiDayData.forEach((dayData, i) => {
            addMultiDayRow(dayData.dayOfWeek, dayData.startHour, dayData.startMin, 
                          dayData.startAmPm, dayData.endHour, dayData.endMin, dayData.endAmPm);
        });
    }
}

/* ================ Enhanced Edit Mode Functions ================ */
function enterAddMode() {
    inNewMode = true;
    $("#btnCancel")?.style.setProperty("display", "inline-block");
    $("#modeChip")?.style.setProperty("display", "block");

    if (editMarker) {
        map.removeLayer(editMarker);
    }

    clearDraft(); // Clear any existing draft
    setStatus("Click on the map where you want to place the garage sale.", 'info');
    $("#coordinates").textContent = "Click map to place garage sale";

    announceToScreenReader("New sale mode activated. Click on the map to place a garage sale.");

    // Add map instruction
    const modeChip = $("#modeChip");
    if (modeChip) {
        modeChip.textContent = "✨ Click map to place garage sale";
        modeChip.setAttribute('aria-live', 'polite');
    }
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
    clearDraft();
    setStatus("Ready to manage garage sales. Click 'New Sale' to add a location.", 'info');
    announceToScreenReader("Edit cancelled. Form cleared.");
}

function clearForm() {
    // Clear all form fields
    $("#address").value = "";
    $("#details").value = "";
    $("#dateStart").value = "";
    $("#dateEnd").value = "";

    const chk = $("#chkMultiDay");
    if (chk) {
        chk.checked = false;
        toggleMultiDayDisplay(false);
    }

    multiDayData = [];
    const container = $("#multi-day-container");
    if (container) container.innerHTML = "";

    // Reset time selectors to defaults
    $("#timeStartHour").value = "7";
    $("#timeStartMin").value = "0";
    $("#timeStartAmPm").value = "AM";
    $("#timeEndHour").value = "2";
    $("#timeEndMin").value = "0";
    $("#timeEndAmPm").value = "PM";

    updateDescriptionPreview();
}

function loadForEdit(feature) {
    selectedFeature = feature;
    inNewMode = false;
    $("#btnCancel")?.style.setProperty("display", "inline-block");
    $("#modeChip")?.style.setProperty("display", "none");

    const attrs = feature.attributes;
    const geom = feature.geometry;

    // Load form data
    $("#address").value = attrs[FIELDS.address] || "";
    $("#dateStart").value = fromEpoch(attrs[FIELDS.start]) || "";
    $("#dateEnd").value = fromEpoch(attrs[FIELDS.end]) || "";

    // Parse description to extract details and times
    const description = attrs[FIELDS.description] || "";
    parseDescriptionForEdit(description);

    // Place edit marker
    if (editMarker) {
        map.removeLayer(editMarker);
    }

    editMarker = L.marker([geom.y, geom.x], {
        icon: L.divIcon({
            className: 'edit-marker',
            html: '<div class="edit-marker-icon edit" aria-label="Editing sale location">✏️</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        }),
        title: 'Editing garage sale location'
    }).addTo(map);

    // Zoom to feature with animation
    map.flyTo([geom.y, geom.x], 16, {
        duration: 1.0,
        easeLinearity: 0.5
    });

    const address = attrs[FIELDS.address] || "Unknown location";
    setStatus(`Editing: ${address}. Make changes and click Save, or Cancel to exit.`, 'info');
    announceToScreenReader(`Now editing garage sale at ${address}`);

    // Focus first editable field
    setTimeout(() => {
        $("#address")?.focus();
    }, 100);
}

function parseDescriptionForEdit(description) {
    try {
        if (description.includes(' & ')) {
            // Multi-day format
            const chk = $("#chkMultiDay");
            if (chk) {
                chk.checked = true;
                toggleMultiDayDisplay(true);
            }

            // Parse multi-day description - simplified parsing
            const parts = description.split(':');
            if (parts.length >= 2) {
                $("#details").value = parts.slice(1).join(':').trim();
            }

            // Initialize with default multi-day if empty
            if (multiDayData.length === 0) {
                addMultiDayRow(5, 7, 0, "AM", 2, 0, "PM");
                addMultiDayRow(6, 8, 0, "AM", 4, 0, "PM");
            }
        } else {
            // Single day format
            const chk = $("#chkMultiDay");
            if (chk) {
                chk.checked = false;
                toggleMultiDayDisplay(false);
            }

            // Parse single day: "7:00 AM - 4:00 PM: Details"
            const match = description.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM):\s*(.+)/);
            if (match) {
                $("#timeStartHour").value = match[1];
                $("#timeStartMin").value = match[2];
                $("#timeStartAmPm").value = match[3];
                $("#timeEndHour").value = match[4];
                $("#timeEndMin").value = match[5];
                $("#timeEndAmPm").value = match[6];
                $("#details").value = match[7];
            } else {
                // Fallback: just put entire description in details
                $("#details").value = description;
            }
        }

        updateDescriptionPreview();
        LOG.debug("Description parsed for editing:", description);

    } catch (error) {
        LOG.warn("Failed to parse description for editing:", error);
        $("#details").value = description; // Fallback
    }
}

/* ================ Enhanced Save/Delete Operations ================ */
async function onSave() {
    try {
        // Validate required fields
        const address = $("#address").value.trim();
        const startDate = $("#dateStart").value;

        if (!address) {
            toast("Address is required.", "warning");
            $("#address").focus();
            announceToScreenReader("Address is required");
            return;
        }

        // Enhanced address validation
        if (CONFIG.ADDRESS_REQUIRED) {
            const addressValidation = validateAddress(address);
            if (addressValidation !== true) {
                toast(addressValidation, "warning");
                $("#address").focus();
                announceToScreenReader(addressValidation);
                return;
            }
        }

        if (!startDate) {
            toast("Start date is required.", "warning");
            $("#dateStart").focus();
            announceToScreenReader("Start date is required");
            return;
        }

        if (!editMarker) {
            toast("Please place a location on the map first.", "warning");
            announceToScreenReader("Please place a location on the map first");
            return;
        }

        // Show saving overlay
        showLoadingOverlay("Saving garage sale...");

        const description = composeDescription();
        const latlng = editMarker.getLatLng();

        // Enhanced description validation
        if (CONFIG.DESCRIPTION_MIN_LENGTH > 0 && description.length < CONFIG.DESCRIPTION_MIN_LENGTH) {
            hideLoadingOverlay();
            toast(`Description must be at least ${CONFIG.DESCRIPTION_MIN_LENGTH} characters long.`, "warning");
            $("#details").focus();
            return;
        }

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
            // Update existing feature
            attributes[objectIdField] = selectedFeature.attributes[objectIdField];
            edits = {
                updates: [{
                    attributes: attributes,
                    geometry: geometry
                }]
            };
        } else {
            // Add new feature
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

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

        const isUpdate = !!selectedFeature;
        const successMessage = isUpdate ? "Garage sale updated!" : "Garage sale added!";

        toast(successMessage, "success");
        announceToScreenReader(successMessage);
        LOG.success(isUpdate ? "Sale updated" : "Sale added", attributes);

        // Clear draft
        clearDraft();

        // Refresh the map
        await loadGarageSales();

        cancelEditing();

    } catch (error) {
        hideLoadingOverlay();

        if (error.name === 'AbortError') {
            error.message = 'Save operation timed out. Please try again.';
        }

        handleError(error, 'Save Operation');
        announceToScreenReader(`Save failed: ${error.message}`);
    }
}

async function onDelete() {
    if (!selectedFeature) {
        toast("Please select a garage sale to delete.", "warning");
        return;
    }

    const address = selectedFeature.attributes[FIELDS.address] || "this garage sale";

    // Enhanced confirmation dialog
    const confirmed = confirm(
        `Are you sure you want to delete this garage sale?\n\n` +
        `Address: ${address}\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
        announceToScreenReader("Delete cancelled");
        return;
    }

    try {
        showLoadingOverlay("Deleting garage sale...");

        const url = `${CONFIG.LAYER_URL}/deleteFeatures`;

        const formData = new FormData();
        formData.append('f', 'json');
        formData.append('objectIds', selectedFeature.attributes[objectIdField]);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.error || !result.deleteResults?.[0]?.success) {
            const error = result.error || result.deleteResults?.[0]?.error;
            throw new Error(error?.description || error?.message || "Delete failed");
        }

        hideLoadingOverlay();

        toast("Garage sale deleted.", "success");
        announceToScreenReader(`Garage sale at ${address} deleted`);
        LOG.success("Sale deleted:", address);

        // Refresh the map
        await loadGarageSales();

        cancelEditing();

    } catch (error) {
        hideLoadingOverlay();

        if (error.name === 'AbortError') {
            error.message = 'Delete operation timed out. Please try again.';
        }

        handleError(error, 'Delete Operation');
        announceToScreenReader(`Delete failed: ${error.message}`);
    }
}

/* ================ Enhanced Export & Print Functions ================ */
async function exportGarageSales() {
    try {
        if (garageSalesData.length === 0) {
            toast("No garage sales to export", "warning");
            return;
        }

        showLoadingOverlay("Preparing export...");

        // Prepare CSV data
        const headers = [
            'Address',
            'Description', 
            'Start Date',
            'End Date',
            ...(CONFIG.INCLUDE_COORDINATES ? ['Latitude', 'Longitude'] : [])
        ];

        const rows = garageSalesData.map(feature => {
            const attrs = feature.attributes;
            const geom = feature.geometry;

            const row = [
                attrs[FIELDS.address] || '',
                attrs[FIELDS.description] || '',
                attrs[FIELDS.start] ? new Date(attrs[FIELDS.start]).toLocaleDateString() : '',
                attrs[FIELDS.end] ? new Date(attrs[FIELDS.end]).toLocaleDateString() : ''
            ];

            if (CONFIG.INCLUDE_COORDINATES) {
                row.push(geom?.y || '', geom?.x || '');
            }

            return row;
        });

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `${CONFIG.CSV_FILENAME}-${timestamp}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        hideLoadingOverlay();

        toast(`Exported ${garageSalesData.length} garage sales to CSV`, "success");
        announceToScreenReader(`Successfully exported ${garageSalesData.length} garage sales`);
        LOG.success("CSV export completed:", { count: garageSalesData.length, filename: link.download });

    } catch (error) {
        hideLoadingOverlay();
        handleError(error, 'Export');
    }
}

function printGarageSales() {
    try {
        // Generate print-friendly content
        const printContent = generatePrintReport();

        // Create print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Trigger print
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        toast("Print dialog opened", "info");
        announceToScreenReader("Print dialog opened");
        LOG.info("Print report generated");

    } catch (error) {
        handleError(error, 'Print');
    }
}

function generatePrintReport() {
    const now = new Date();
    const reportTitle = `City of Portland, TX - Garage Sales Report`;
    const reportDate = now.toLocaleDateString();
    const reportTime = now.toLocaleTimeString();

    let salesHTML = '';
    if (garageSalesData.length > 0) {
        salesHTML = garageSalesData.map((feature, index) => {
            const attrs = feature.attributes;
            const startDate = attrs[FIELDS.start] ? 
                new Date(attrs[FIELDS.start]).toLocaleDateString() : 'No date';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(attrs[FIELDS.address] || 'N/A')}</td>
                    <td>${escapeHtml(attrs[FIELDS.description] || 'N/A')}</td>
                    <td>${startDate}</td>
                </tr>
            `;
        }).join('');
    } else {
        salesHTML = '<tr><td colspan="4">No garage sales found</td></tr>';
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${reportTitle}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    color: #000; 
                    background: #fff; 
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 20px; 
                    border-bottom: 2px solid #333; 
                    padding-bottom: 10px; 
                }
                .report-info { 
                    margin-bottom: 20px; 
                    font-size: 12px; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 20px; 
                }
                th, td { 
                    border: 1px solid #333; 
                    padding: 8px; 
                    text-align: left; 
                }
                th { 
                    background: #f0f0f0; 
                    font-weight: bold; 
                }
                .footer { 
                    margin-top: 30px; 
                    font-size: 10px; 
                    color: #666; 
                    text-align: center; 
                }
                @page { margin: 0.5in; }
                @media print {
                    body { margin: 0; }
                    .header h1 { font-size: 18pt; }
                    table { font-size: 10pt; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${reportTitle}</h1>
                <p>Official garage sale location report</p>
            </div>

            <div class="report-info">
                <p><strong>Report Generated:</strong> ${reportDate} at ${reportTime}</p>
                <p><strong>Total Sales:</strong> ${garageSalesData.length}</p>
                <p><strong>Contact:</strong> ${CONFIG.ORGANIZATION.contact}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Address</th>
                        <th>Description</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${salesHTML}
                </tbody>
            </table>

            <div class="footer">
                <p>Generated by ${CONFIG.ORGANIZATION.name} Garage Sale Admin System</p>
                <p>${CONFIG.ORGANIZATION.website}</p>
            </div>
        </body>
        </html>
    `;
}

/* ================ Enhanced Filter & List Functions ================ */
function applyQuickFilter(filterType) {
    try {
        LOG.info("Applying filter:", filterType);

        let filteredSales = [...garageSalesData];
        const now = new Date();

        switch (filterType) {
            case 'weekend':
                filteredSales = garageSalesData.filter(sale => {
                    const saleDate = new Date(sale.attributes[FIELDS.start]);
                    const dayOfWeek = saleDate.getDay();
                    const thisWeekend = new Date(now);
                    thisWeekend.setDate(now.getDate() + (6 - now.getDay())); // Next Saturday
                    const nextWeekend = new Date(thisWeekend);
                    nextWeekend.setDate(thisWeekend.getDate() + 7); // Following Saturday

                    return saleDate >= thisWeekend && saleDate <= nextWeekend;
                });
                break;

            case 'next14':
                const twoWeeksFromNow = new Date(now);
                twoWeeksFromNow.setDate(now.getDate() + 14);
                filteredSales = garageSalesData.filter(sale => {
                    const saleDate = new Date(sale.attributes[FIELDS.start]);
                    return saleDate >= now && saleDate <= twoWeeksFromNow;
                });
                break;

            case 'past':
                filteredSales = garageSalesData.filter(sale => {
                    const saleDate = new Date(sale.attributes[FIELDS.start]);
                    return saleDate < now;
                });
                break;

            case 'all':
            default:
                // No filtering
                break;
        }

        // Update map display
        updateMapFilter(filteredSales);

        const filterLabels = {
            'all': 'All sales',
            'weekend': 'This weekend',
            'next14': 'Next 2 weeks',
            'past': 'Past sales'
        };

        const message = `Showing ${filteredSales.length} ${filterLabels[filterType] || 'sales'}`;
        toast(message, "info");
        announceToScreenReader(message);
        setStatus(message, 'info');

    } catch (error) {
        handleError(error, 'Filter Application');
    }
}

function updateMapFilter(filteredSales) {
    // Clear existing layer
    if (featureLayer) {
        map.removeLayer(featureLayer);
    }

    // Create new layer with filtered sales
    featureLayer = L.layerGroup();

    filteredSales.forEach((feature, index) => {
        try {
            addGarageSaleMarker(feature, index);
        } catch (markerError) {
            LOG.warn("Failed to add filtered marker:", markerError);
        }
    });

    featureLayer.addTo(map);
}

async function showSalesList() {
    try {
        if (garageSalesData.length === 0) {
            toast("No garage sales to display", "warning");
            return;
        }

        const listContent = generateSalesListContent();
        showModal("Garage Sales List", listContent);

        announceToScreenReader("Garage sales list opened");
        LOG.info("Sales list displayed");

    } catch (error) {
        handleError(error, 'Sales List');
    }
}

function generateSalesListContent() {
    const container = document.createElement('div');
    container.className = 'sales-list-container';

    let listHTML = `
        <div class="list-header">
            <p><strong>Total Sales:</strong> ${garageSalesData.length}</p>
        </div>
        <div class="sales-list">
    `;

    garageSalesData
        .sort((a, b) => {
            const dateA = new Date(a.attributes[FIELDS.start] || 0);
            const dateB = new Date(b.attributes[FIELDS.start] || 0);
            return dateB - dateA; // Most recent first
        })
        .forEach((feature, index) => {
            const attrs = feature.attributes;
            const startDate = attrs[FIELDS.start] ? 
                new Date(attrs[FIELDS.start]).toLocaleDateString() : 'No date';

            listHTML += `
                <div class="sale-item" data-object-id="${attrs[objectIdField]}">
                    <h4>${escapeHtml(attrs[FIELDS.address] || 'No address')}</h4>
                    <p><strong>Date:</strong> ${startDate}</p>
                    <p><strong>Details:</strong> ${escapeHtml(attrs[FIELDS.description] || 'No description')}</p>
                    <button onclick="editSaleFromList(${attrs[objectIdField]})" class="btn btn-small">
                        ✏️ Edit
                    </button>
                    <button onclick="zoomToSale(${attrs[objectIdField]})" class="btn btn-small">
                        🔍 Show on Map
                    </button>
                </div>
            `;
        });

    listHTML += '</div>';
    container.innerHTML = listHTML;

    return container;
}

// Global functions for list interactions
window.editSaleFromList = function(objectId) {
    const feature = garageSalesData.find(f => f.attributes[objectIdField] === objectId);
    if (feature) {
        // Close modal first
        const modal = document.querySelector('.modal-backdrop');
        if (modal) modal.remove();

        loadForEdit(feature);
        announceToScreenReader("Editing garage sale from list");
    }
};

window.zoomToSale = function(objectId) {
    const feature = garageSalesData.find(f => f.attributes[objectIdField] === objectId);
    if (feature && feature.geometry) {
        map.flyTo([feature.geometry.y, feature.geometry.x], 16, {
            duration: 1.5,
            easeLinearity: 0.5
        });

        // Close modal
        const modal = document.querySelector('.modal-backdrop');
        if (modal) modal.remove();

        toast(`Zoomed to ${feature.attributes[FIELDS.address] || 'garage sale'}`, "info");
        announceToScreenReader(`Map zoomed to ${feature.attributes[FIELDS.address] || 'garage sale'}`);
    }
};

/* ================ Enhanced Theme & Accessibility Functions ================ */
function cycleTheme() {
    const themes = ["dark", "dim", "light"];
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const currentIndex = themes.indexOf(current);
    const next = themes[(currentIndex + 1) % themes.length];

    document.documentElement.setAttribute("data-theme", next);

    // Store preference
    localStorage.setItem('preferred_theme', next);

    const themeNames = {
        dark: "Dark",
        dim: "Dim", 
        light: "Light"
    };

    toast(`Theme: ${themeNames[next]}`, "info");
    announceToScreenReader(`Theme changed to ${themeNames[next]}`);
    LOG.info("Theme changed:", next);
}

function loadThemePreference() {
    try {
        const savedTheme = localStorage.getItem('preferred_theme');
        if (savedTheme) {
            document.documentElement.setAttribute("data-theme", savedTheme);
        } else if (CONFIG.DARK_MODE_DEFAULT) {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (error) {
        LOG.warn("Failed to load theme preference:", error);
    }
}

/* ================ Enhanced Help & Guide Functions ================ */
function showGuide() {
    const content = document.createElement("div");
    content.innerHTML = `
        <div class="guide-content">
            <h3>🏷️ Garage Sale Manager Guide</h3>

            <div class="guide-section">
                <h4>🎯 Getting Started</h4>
                <ol>
                    <li><strong>Add Sale:</strong> Click "New Sale", then click on the map where the sale will be</li>
                    <li><strong>Fill Form:</strong> Enter address, dates, times, and items for sale</li>
                    <li><strong>Save:</strong> Click "Save Sale" to add it to the database</li>
                </ol>
            </div>

            <div class="guide-section">
                <h4>🔍 Finding Locations</h4>
                <ul>
                    <li><strong>Address Search:</strong> Type any Portland address to zoom to that location</li>
                    <li><strong>Map Navigation:</strong> Click and drag to move, scroll to zoom</li>
                    <li><strong>Edit Sales:</strong> Click any garage sale marker to edit or delete</li>
                </ul>
            </div>

            <div class="guide-section">
                <h4>📅 Sale Timing</h4>
                <ul>
                    <li><strong>Single Day:</strong> Set start and end times for one day</li>
                    <li><strong>Multi-Day:</strong> Check the multi-day box for different hours on different days</li>
                    <li><strong>Auto Description:</strong> Times and items are automatically combined</li>
                </ul>
            </div>

            <div class="guide-section">
                <h4>📊 Managing Sales</h4>
                <ul>
                    <li><strong>Filter:</strong> Use the dropdown to show only certain time periods</li>
                    <li><strong>Export:</strong> Download all data as a CSV file</li>
                    <li><strong>Print:</strong> Generate a printer-friendly report</li>
                    <li><strong>List:</strong> View all sales in a searchable list format</li>
                </ul>
            </div>

            <div class="guide-section">
                <h4>♿ Accessibility Features</h4>
                <ul>
                    <li><strong>Keyboard Navigation:</strong> Tab through all controls</li>
                    <li><strong>Screen Reader:</strong> Full support for voice announcements</li>
                    <li><strong>High Contrast:</strong> Multiple theme options available</li>
                    <li><strong>Focus Indicators:</strong> Clear visual focus on active elements</li>
                </ul>
            </div>

            <div class="guide-footer">
                <p><strong>Need Help?</strong> Contact: ${CONFIG.ORGANIZATION.contact}</p>
                <p><strong>Organization:</strong> ${CONFIG.ORGANIZATION.name}</p>
                <p><strong>Version:</strong> 8.0 - Government Ready</p>
            </div>
        </div>
    `;

    showModal("User Guide", content);
    announceToScreenReader("User guide opened");
}

/* ================ Enhanced Modal Functions ================ */
function showModal(title, bodyElement) {
    // Remove any existing modals
    const existingModal = document.querySelector('.modal-backdrop');
    if (existingModal) {
        existingModal.remove();
    }

    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-labelledby', 'modal-title');
    wrap.setAttribute('aria-modal', 'true');

    wrap.innerHTML = `
        <div class="modal glass">
            <div class="modal-header">
                <div id="modal-title" class="modal-title">${escapeHtml(title)}</div>
                <button class="modal-close" aria-label="Close dialog">✕</button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;

    wrap.querySelector(".modal-body").appendChild(bodyElement);
    document.body.appendChild(wrap);

    // Focus management
    const modal = wrap.querySelector('.modal');
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
    }

    // Trap focus
    function trapFocus(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }
    }

    modal.addEventListener('keydown', trapFocus);

    const closeModal = () => {
        document.removeEventListener('keydown', handleModalEscape);
        modal.removeEventListener('keydown', trapFocus);
        wrap.remove();
        announceToScreenReader("Dialog closed");
    };

    const handleModalEscape = (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    };

    wrap.querySelector(".modal-close").addEventListener("click", closeModal);
    wrap.querySelector(".modal-actions .btn").addEventListener("click", closeModal);

    // Close when clicking backdrop
    wrap.addEventListener("click", (e) => {
        if (e.target === wrap) {
            closeModal();
        }
    });

    document.addEventListener("keydown", handleModalEscape);

    LOG.info("Modal opened:", title);
}

/* ================ Enhanced Keyboard Shortcuts ================ */
function setupKeyboardShortcuts() {
    if (!CONFIG.KEYBOARD_SHORTCUTS) return;

    document.addEventListener('keydown', (e) => {
        // Only handle shortcuts when not focused on input elements
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Handle modifier key combinations
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'n': // Ctrl+N - New sale
                    e.preventDefault();
                    enterAddMode();
                    announceToScreenReader("Keyboard shortcut: New sale mode");
                    break;
                case 's': // Ctrl+S - Save
                    e.preventDefault();
                    onSave();
                    announceToScreenReader("Keyboard shortcut: Save");
                    break;
                case 'e': // Ctrl+E - Export
                    e.preventDefault();
                    exportGarageSales();
                    announceToScreenReader("Keyboard shortcut: Export data");
                    break;
                case 'p': // Ctrl+P - Print
                    e.preventDefault();
                    printGarageSales();
                    announceToScreenReader("Keyboard shortcut: Print report");
                    break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'escape':
                    if (inNewMode || selectedFeature) {
                        cancelEditing();
                        announceToScreenReader("Keyboard shortcut: Cancel editing");
                    }
                    break;
                case 'h': // H - Help
                    showGuide();
                    announceToScreenReader("Keyboard shortcut: Help guide");
                    break;
                case 't': // T - Toggle theme
                    cycleTheme();
                    break;
            }
        }
    });

    LOG.info("Keyboard shortcuts enabled");
}

/* ================ Network Status Monitoring ================ */
function setupNetworkMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        toast("Connection restored", "success");
        announceToScreenReader("Internet connection restored");

        // Refresh data when back online
        loadGarageSales();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        toast("Connection lost - operating in offline mode", "warning");
        announceToScreenReader("Internet connection lost. Operating in offline mode.");
    });

    // Initial status
    updateConnectionStatus();
}

/* ================ Auto-refresh Functionality ================ */
function setupAutoRefresh() {
    if (CONFIG.AUTO_REFRESH_INTERVAL > 0) {
        setInterval(async () => {
            if (isOnline && !inNewMode && !selectedFeature) {
                try {
                    LOG.debug("Auto-refreshing garage sales data");
                    await loadGarageSales();
                } catch (error) {
                    LOG.warn("Auto-refresh failed:", error);
                }
            }
        }, CONFIG.AUTO_REFRESH_INTERVAL);

        LOG.info("Auto-refresh enabled:", CONFIG.AUTO_REFRESH_INTERVAL, "ms");
    }
}

/* ================ Initialization ================ */
async function init() {
    LOG.info("🏛️ City of Portland Garage Sale Admin v8.0 - Government Ready");
    LOG.info("Initializing enhanced system...");

    try {
        // Load saved preferences
        loadThemePreference();

        // Setup network monitoring
        setupNetworkMonitoring();

        // Initialize map
        await initMap();

        // Load draft if available
        loadDraft();

        // Set up form handlers
        setupMultiDayFeature();
        setupKeyboardShortcuts();
        setupAutoRefresh();

        // Auto-update description preview
        ["timeStartHour", "timeStartMin", "timeStartAmPm", "timeEndHour", "timeEndMin", "timeEndAmPm", "details"]
            .forEach(id => {
                const el = $("#" + id);
                if (el) el.addEventListener("change", updateDescriptionPreview);
                if (el) el.addEventListener("input", updateDescriptionPreview);
            });

        // Enhanced button handlers with accessibility
        $("#btnSave")?.addEventListener("click", onSave);
        $("#btnNew")?.addEventListener("click", () => {
            enterAddMode();
            announceToScreenReader("New sale mode activated");
        });
        $("#btnCancel")?.addEventListener("click", cancelEditing);
        $("#btnDelete")?.addEventListener("click", onDelete);
        $("#btnTheme")?.addEventListener("click", cycleTheme);
        $("#btnSales")?.addEventListener("click", showSalesList);
        $("#btnGuide")?.addEventListener("click", showGuide);
        $("#btnExport")?.addEventListener("click", exportGarageSales);
        $("#btnPrint")?.addEventListener("click", printGarageSales);

        $("#selFilter")?.addEventListener("change", (e) => applyQuickFilter(e.target.value));

        // Enhanced address search
        $("#btnSearch")?.addEventListener("click", () => {
            const address = $("#addressSearch").value.trim();
            if (address) {
                geocodeAddress(address);
            } else {
                $("#addressSearch").focus();
                announceToScreenReader("Please enter an address to search");
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

        // Form validation
        $("#address")?.addEventListener("blur", (e) => {
            const address = e.target.value.trim();
            if (address && CONFIG.ENABLE_ADDRESS_VALIDATION) {
                const validation = validateAddress(address);
                if (validation !== true) {
                    toast(validation, "warning", 2000);
                }
            }
        });

        // Initial state
        updateDescriptionPreview();

        LOG.success("✅ Application initialized successfully");
        setStatus("✅ System ready. All features operational.", 'success');
        announceToScreenReader("Garage Sale Admin system ready. All features operational.");

        // Show welcome message for first-time users
        if (!localStorage.getItem('garage_sale_welcomed')) {
            setTimeout(() => {
                toast("🏛️ Welcome to City of Portland Garage Sale Admin! Click the Help button for a guide.", "info", 8000);
                localStorage.setItem('garage_sale_welcomed', 'true');
            }, 1000);
        }

    } catch (error) {
        LOG.error("❌ Initialization failed:", error);
        handleError(error, 'Application Initialization');
        setStatus("❌ Initialization failed. Please refresh the page.", 'error');
    }
}

// Start the application when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// Global error handler
window.addEventListener('error', (event) => {
    LOG.error("Global error caught:", event.error);
    handleError(event.error, 'Global', false);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    LOG.error("Unhandled promise rejection:", event.reason);
    handleError(event.reason, 'Promise', false);
});

LOG.info("🏛️ Government-ready garage sale admin system loaded");