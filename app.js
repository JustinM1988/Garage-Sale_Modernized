// app.js — MODERN STYLISH Garage Sale Admin v8.0 - FIXED COORDINATE PROJECTION
// City of Portland, Texas - Premium Modern Design

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

    console.log('🚀 Starting Modern Stylish Garage Sale Admin...');
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
let multiDayData = [];

/* ================ 🔧 COORDINATE CONVERSION FIX ================ */
// This fixes the Web Mercator to WGS84 projection issue
function webMercatorToWGS84(x, y) {
    const lng = x / 20037508.34 * 180;
    let lat = y / 20037508.34 * 180;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return [lat, lng];
}

/* ================ Modern UI Utilities ================ */
const $ = (sel) => document.querySelector(sel);

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.9); 
        display: flex; align-items: center; justify-content: center; 
        z-index: 9999; backdrop-filter: blur(8px);
    `;
    errorDiv.innerHTML = `
        <div style="background: rgba(239,68,68,0.95); padding: 40px; border-radius: 16px; text-align: center; color: white; max-width: 500px; backdrop-filter: blur(12px);">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h3 style="margin: 0 0 16px 0; font-size: 24px;">System Error</h3>
            <p style="margin: 0; font-size: 16px; line-height: 1.5;">${message}</p>
            <button onclick="location.reload()" style="margin-top: 24px; padding: 12px 24px; background: white; color: #ef4444; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Refresh Page</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

function showModernToast(msg, type = "info", duration = 4000) {
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
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 18px;">${color.icon}</span>
            <span>${msg}</span>
        </div>
    `;
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 1000;
        background: ${color.bg}; color: white; padding: 16px 20px;
        border-radius: 12px; font-weight: 500; font-size: 15px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(8px); max-width: 400px;
        transform: translateX(100%); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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

function setModernStatus(text, type = 'info') {
    console.log(`📊 Status [${type.toUpperCase()}]: ${text}`);
    const el = $("#status");
    if (el) {
        el.textContent = text;
        el.className = `modern-status modern-status-${type}`;
    }
    updateConnectionStatus();
}

function updateConnectionStatus() {
    const statusEl = $("#connectionStatus");
    if (statusEl) {
        statusEl.innerHTML = isOnline ? 
            '<span style="color: #10b981;">🌐 Connected</span>' :
            '<span style="color: #ef4444;">⚠️ Offline</span>';
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

/* ================ Enhanced Description with Multi-Day Support ================ */
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

/* ================ Sale Templates with Modern Design ================ */
const saleTemplates = {
    'Moving Sale': {
        description: 'Moving sale - everything must go! Furniture, appliances, household items',
        time: { start: 7, startAmPm: 'AM', end: 4, endAmPm: 'PM' },
        icon: '📦'
    },
    'Estate Sale': {
        description: 'Estate sale - antiques, collectibles, furniture, and more',
        time: { start: 8, startAmPm: 'AM', end: 3, endAmPm: 'PM' },
        icon: '🏛️'
    },
    'Neighborhood Sale': {
        description: 'Multi-family garage sale - clothes, toys, books, household items',
        time: { start: 7, startAmPm: 'AM', end: 2, endAmPm: 'PM' },
        icon: '🏘️'
    },
    'Holiday Sale': {
        description: 'Holiday items, decorations, seasonal clothing and accessories',
        time: { start: 8, startAmPm: 'AM', end: 3, endAmPm: 'PM' },
        icon: '🎄'
    }
};

function showTemplateSelector() {
    const modal = document.createElement("div");
    modal.className = "template-modal-backdrop";
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; backdrop-filter: blur(8px);
    `;

    modal.innerHTML = `
        <div style="background: rgba(30,41,59,0.95); border-radius: 20px; padding: 32px; max-width: 600px; width: 90%; backdrop-filter: blur(12px); border: 1px solid rgba(60,240,212,0.3);">
            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="color: #3cf0d4; margin: 0 0 8px 0; font-size: 24px;">📝 Choose a Template</h3>
                <p style="color: #94a3b8; margin: 0; font-size: 16px;">Quick start with common garage sale types</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
                ${Object.entries(saleTemplates).map(([name, template]) => `
                    <div class="template-card" onclick="applySaleTemplate('${name}'); closeTemplateModal();" style="
                        background: rgba(60,240,212,0.1); border: 1px solid rgba(60,240,212,0.3); 
                        border-radius: 12px; padding: 20px; cursor: pointer; 
                        transition: all 0.3s ease; text-align: center;
                    ">
                        <div style="font-size: 32px; margin-bottom: 8px;">${template.icon}</div>
                        <h4 style="color: #3cf0d4; margin: 0 0 8px 0; font-size: 18px;">${name}</h4>
                        <p style="color: #cbd5e1; margin: 0 0 12px 0; font-size: 14px; line-height: 1.4;">${template.description}</p>
                        <div style="color: #94a3b8; font-size: 12px; font-weight: 500;">
                            ⏰ ${template.time.start}:00 ${template.time.startAmPm} - ${template.time.end}:00 ${template.time.endAmPm}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="text-align: center;">
                <button onclick="closeTemplateModal()" style="
                    background: rgba(100,116,139,0.2); border: 1px solid #64748b; 
                    color: #cbd5e1; padding: 12px 24px; border-radius: 8px; 
                    cursor: pointer; font-weight: 500;
                ">Skip Templates</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add hover effects
    modal.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.background = 'rgba(60,240,212,0.2)';
            card.style.borderColor = '#3cf0d4';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.background = 'rgba(60,240,212,0.1)';
            card.style.borderColor = 'rgba(60,240,212,0.3)';
        });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTemplateModal();
    });

    window.currentTemplateModal = modal;
}

function closeTemplateModal() {
    if (window.currentTemplateModal) {
        document.body.removeChild(window.currentTemplateModal);
        window.currentTemplateModal = null;
    }
}

function applySaleTemplate(templateName) {
    const template = saleTemplates[templateName];
    if (!template) return;

    $("#details").value = template.description;
    $("#timeStartHour").value = template.time.start;
    $("#timeStartAmPm").value = template.time.startAmPm;
    $("#timeEndHour").value = template.time.end;
    $("#timeEndAmPm").value = template.time.endAmPm;

    updateDescriptionPreview();
    showModernToast(`${template.icon} Applied ${templateName} template`, "success");
}

/* ================ Multi-Day Sales Functionality ================ */
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
        <div style="background: rgba(60,240,212,0.05); border: 1px solid rgba(60,240,212,0.2); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3cf0d4, #7c89ff); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${index + 1}</div>
                    <span style="color: #3cf0d4; font-weight: 600; font-size: 16px;">Sale Day ${index + 1}</span>
                </div>
                <button onclick="removeMultiDayEntry(${entry.id})" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px;">✕</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px; align-items: end;">
                <div>
                    <label style="color: #94a3b8; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block;">Day</label>
                    <select onchange="updateMultiDayEntry(${entry.id}, 'dayOfWeek', this.value)" style="width: 100%; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                        ${dayNames.map((day, i) => `
                            <option value="${i}" ${entry.dayOfWeek === i ? 'selected' : ''}>${day}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="display: flex; align-items: end; gap: 8px;">
                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'startHour', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            ${Array.from({length: 12}, (_, i) => i + 1).map(h => `
                                <option value="${h}" ${entry.startHour === h ? 'selected' : ''}>${h}</option>
                            `).join('')}
                        </select>
                    </div>
                    <span style="color: #94a3b8;">:</span>
                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'startMin', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            <option value="0" ${entry.startMin === 0 ? 'selected' : ''}>00</option>
                            <option value="30" ${entry.startMin === 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'startAmPm', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            <option value="AM" ${entry.startAmPm === 'AM' ? 'selected' : ''}>AM</option>
                            <option value="PM" ${entry.startAmPm === 'PM' ? 'selected' : ''}>PM</option>
                        </select>
                    </div>
                    
                    <span style="color: #94a3b8; margin: 0 8px;">to</span>

                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'endHour', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            ${Array.from({length: 12}, (_, i) => i + 1).map(h => `
                                <option value="${h}" ${entry.endHour === h ? 'selected' : ''}>${h}</option>
                            `).join('')}
                        </select>
                    </div>
                    <span style="color: #94a3b8;">:</span>
                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'endMin', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            <option value="0" ${entry.endMin === 0 ? 'selected' : ''}>00</option>
                            <option value="30" ${entry.endMin === 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                    <div>
                        <select onchange="updateMultiDayEntry(${entry.id}, 'endAmPm', this.value)" style="width: 60px; padding: 12px; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; color: white;">
                            <option value="AM" ${entry.endAmPm === 'AM' ? 'selected' : ''}>AM</option>
                            <option value="PM" ${entry.endAmPm === 'PM' ? 'selected' : ''}>PM</option>
                        </select>
                    </div>
                </div>
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
    showModernToast("Day removed", "info");
};

/* ================ Modern Address Autocomplete System ================ */
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

    console.log("✅ Modern address autocomplete ready");
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
                showModernSuggestions(filteredSuggestions, field);
            } else if (data.suggestions.length > 0) {
                showModernSuggestions(data.suggestions.slice(0, 4), field);
            }
        } else {
            hideSuggestions();
        }

    } catch (error) {
        console.warn("⚠️ Address suggestions failed:", error);
        hideSuggestions();
    }
}

function showModernSuggestions(suggestions, field) {
    const rect = field.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    suggestionsDropdown.style.left = (rect.left + scrollLeft) + 'px';
    suggestionsDropdown.style.top = (rect.bottom + scrollTop + 8) + 'px';
    suggestionsDropdown.style.width = Math.max(rect.width, 320) + 'px';

    suggestionsDropdown.innerHTML = suggestions.map((suggestion, index) => `
        <div class="modern-suggestion-item" 
             data-index="${index}" 
             data-text="${suggestion.text}" 
             data-magic="${suggestion.magicKey || ''}"
             style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid rgba(100,116,139,0.1); display: flex; align-items: center; gap: 12px;">
            <span style="color: #3cf0d4; font-size: 16px;">📍</span>
            <div>
                <div style="color: white; font-weight: 500;">${suggestion.text}</div>
                <div style="color: #94a3b8; font-size: 12px;">📍 Address suggestion</div>
            </div>
        </div>
    `).join('');

    suggestionsDropdown.querySelectorAll('.modern-suggestion-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            suggestionsDropdown.querySelectorAll('.modern-suggestion-item').forEach(i => {
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
    const items = suggestionsDropdown?.querySelectorAll('.modern-suggestion-item');
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
    console.log("🏠 Selected modern suggestion:", text);

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
                    html: `
                        <div style="background: #3cf0d4; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(60,240,212,0.4);">📍</div>
                        <div style="position: absolute; top: -8px; left: -8px; width: 44px; height: 44px; border: 2px solid #3cf0d4; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    `,
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

            showModernToast("📍 Address located", "success");
        }
    } catch (error) {
        console.warn("⚠️ Geocoding failed for suggestion:", error);
    }
}

/* ================ Modern Building Footprints + Click for Address ================ */
async function loadBuildingFootprints(bounds) {
    if (!buildingsLayer) {
        buildingsLayer = L.layerGroup().addTo(map);
    }

    buildingsLayer.clearLayers();

    try {
        const mapBounds = bounds || map.getBounds();
        const bbox = `${mapBounds.getSouth()},${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()}`;

        const overpassQuery = `
            [out:json][timeout:10];
            (way["building"](${bbox});relation["building"](${bbox}););
            out geom;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery,
            headers: { 'Content-Type': 'text/plain' }
        });

        if (!response.ok) throw new Error('Building data unavailable');

        const data = await response.json();
        console.log(`🏠 Processing ${data.elements.length} buildings`);

        let buildingsAdded = 0;

        data.elements.forEach(element => {
            if (element.type === 'way' && element.geometry && element.geometry.length > 2) {
                try {
                    const coords = element.geometry.map(node => [node.lat, node.lon]);

                    const polygon = L.polygon(coords, {
                        color: '#3cf0d4',
                        weight: 2,
                        opacity: 0.8,
                        fillColor: '#3cf0d4',
                        fillOpacity: 0.12,
                        className: 'modern-building-footprint'
                    });

                    polygon.on('click', async function(e) {
                        const latlng = e.latlng;
                        await getModernAddressForLocation(latlng, polygon);
                    });

                    // Hover effects
                    polygon.on('mouseover', function() {
                        this.setStyle({
                            fillOpacity: 0.25,
                            weight: 3
                        });
                    });

                    polygon.on('mouseout', function() {
                        this.setStyle({
                            fillOpacity: 0.12,
                            weight: 2
                        });
                    });

                    polygon.addTo(buildingsLayer);
                    buildingsAdded++;

                } catch (buildingError) {
                    // Skip problematic buildings
                }
            }
        });

        console.log(`✅ Added ${buildingsAdded} modern building footprints`);

    } catch (error) {
        console.warn("⚠️ Buildings unavailable:", error);
    }
}

async function getModernAddressForLocation(latlng, polygon) {
    try {
        const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            const address = data.address.Match_addr;

            polygon.bindPopup(`
                <div style="background: rgba(30,41,59,0.95); border-radius: 12px; padding: 16px; backdrop-filter: blur(12px); min-width: 200px;">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <span style="font-size: 32px;">🏠</span>
                    </div>
                    
                    <h4 style="color: #3cf0d4; margin: 0 0 8px 0; text-align: center;">Building Found</h4>
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px 0; text-align: center;">Click to use this address</p>
                    
                    <div style="background: rgba(60,240,212,0.1); border: 1px solid rgba(60,240,212,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">📍 ADDRESS</div>
                        <div style="color: white; font-weight: 500;">${address}</div>
                    </div>

                    <button onclick="useThisModernAddress('${address.replace(/'/g, "\\'")}')" style="
                        width: 100%; background: linear-gradient(135deg, #3cf0d4, #7c89ff); 
                        border: none; color: white; padding: 12px; border-radius: 8px; 
                        font-weight: 600; cursor: pointer; font-size: 14px;
                    ">Use This Address</button>
                </div>
            `).openPopup();

            console.log("🏠 Found modern building address:", address);
        } else {
            polygon.bindPopup(`
                <div style="text-align: center; padding: 16px;">
                    <span style="font-size: 32px;">🏠</span>
                    <h4 style="color: #3cf0d4; margin: 8px 0;">Building</h4>
                    <p style="color: #94a3b8; margin: 0;">Address not available for this location</p>
                </div>
            `).openPopup();
        }
    } catch (error) {
        console.warn("⚠️ Address lookup failed:", error);
    }
}

window.useThisModernAddress = function(address) {
    const addressField = $("#address");
    if (addressField && inNewMode) {
        addressField.value = address;
        showModernToast("📋 Address copied to form", "success");
        map.closePopup();
        updateDescriptionPreview();
    } else {
        showModernToast("💡 Click 'New Sale' first, then click a building", "info");
        map.closePopup();
    }
};

/* ================ Enhanced Modern Map ================ */
async function initMap() {
    console.log("🗺️ Initializing modern map system...");

    try {
        showModernLoadingOverlay("Loading modern map system...");

        map = L.map('map', {
            center: [27.876, -97.323],
            zoom: 15,
            minZoom: 10,
            maxZoom: 19,
            zoomControl: true,
            attributionControl: true
        });

        // Modern enhanced layers
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

        // Start with modern Hybrid + Roads
        baseLayers["🛰️ Hybrid + Roads"].addTo(map);
        L.control.layers(baseLayers).addTo(map);

        // Modern custom garage sale icon
        window.modernGarageSaleIcon = L.divIcon({
            className: 'modern-garage-sale-icon',
            html: `
                <div style="position: relative;">
                    <div style="background: linear-gradient(135deg, #3cf0d4, #7c89ff); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(60,240,212,0.4); border: 3px solid white;">🏷️</div>
                    <div style="position: absolute; top: -2px; left: -2px; width: 40px; height: 40px; border: 2px solid #3cf0d4; border-radius: 50%; animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.3;"></div>
                    <div style="position: absolute; top: -4px; left: -4px; width: 44px; height: 44px; border: 1px solid #3cf0d4; border-radius: 50%; animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 1s; opacity: 0.2;"></div>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);
        map.on('zoomend', onMapZoom);
        map.on('moveend', onMapMove);

        await Promise.all([
            loadGarageSales(),
            loadBuildingFootprints()
        ]);

        await setupAddressAutocomplete();

        hideModernLoadingOverlay();

        console.log("✅ Modern map system ready");
        setModernStatus("🚀 Modern system ready with all premium features", 'success');

    } catch (error) {
        hideModernLoadingOverlay();
        console.error("❌ Map initialization failed:", error);
        setModernStatus("Failed to initialize map. Please refresh.", 'error');
    }
}

function onMapZoom(e) {
    const zoom = map.getZoom();
    if (zoom >= 16) {
        loadBuildingFootprints();
    } else {
        if (buildingsLayer) buildingsLayer.clearLayers();
    }
}

function onMapMove(e) {
    if (map.getZoom() >= 16) {
        clearTimeout(window.moveTimeout);
        window.moveTimeout = setTimeout(() => {
            loadBuildingFootprints();
        }, 1200);
    }
}

function showModernLoadingOverlay(message = "Loading...") {
    let overlay = $("#modern-loading-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modern-loading-overlay";
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
            <div style="font-size: 48px; margin-bottom: 16px; animation: spin 2s linear infinite;">⚙️</div>
            <div style="font-size: 18px; font-weight: 500;">${message}</div>
        </div>
    `;
    overlay.style.display = "flex";
}

function hideModernLoadingOverlay() {
    const overlay = $("#modern-loading-overlay");
    if (overlay) overlay.style.display = "none";
}

/* ================ 🔧 FIXED Modern Garage Sales Loading ================ */
async function loadGarageSales() {
    console.log("🔄 Loading garage sales with modern system...");

    try {
        const queryUrl = `${CONFIG.LAYER_URL}/query?where=1%3D1&outFields=*&returnGeometry=true&f=json`;
        console.log("🌐 Using modern URL:", queryUrl);

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
        console.log("📊 Modern ArcGIS Response:", data);

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
                if (addModernGarageSaleMarker(feature, index)) {
                    markersAdded++;
                }
            } catch (error) {
                console.warn(`⚠️ Failed to add modern marker ${index}:`, error);
            }
        });

        if (markersAdded > 0) {
            featureLayer.addTo(map);
            console.log(`✅ Added ${markersAdded} modern garage sale markers`);
        }

        _featureCount = garageSalesData.length;
        updateModernStats();

        if (_featureCount === 0) {
            setModernStatus("No garage sales found. Click 'New Sale' to add the first one.", 'info');
        } else {
            setModernStatus(`${_featureCount} garage sales loaded successfully.`, 'success');
        }

    } catch (error) {
        console.error("❌ Failed to load garage sales:", error);
        setModernStatus("Could not load existing garage sales. You can still add new ones.", 'warning');

        if (!featureLayer) {
            featureLayer = L.layerGroup().addTo(map);
        }
    }
}

/* ================ 🔧 FIXED Modern Garage Sale Marker with Coordinate Conversion ================ */
function addModernGarageSaleMarker(feature, index) {
    const geom = feature.geometry;
    const attrs = feature.attributes;

    if (!geom || typeof geom.y !== 'number' || typeof geom.x !== 'number') {
        console.warn(`⚠️ Invalid geometry for modern feature ${index}`);
        return false;
    }

    // 🔧 FIX: CONVERT COORDINATES FROM WEB MERCATOR TO WGS84
    const [lat, lng] = webMercatorToWGS84(geom.x, geom.y);
    
    console.log(`📍 Feature ${index}: Web Mercator (${geom.x}, ${geom.y}) -> WGS84 (${lat}, ${lng})`);

    const marker = L.marker([lat, lng], { 
        icon: window.modernGarageSaleIcon,
        title: attrs[FIELDS.address] || `Garage Sale ${index + 1}`,
        zIndexOffset: 1000
    });

    const popupContent = createModernPopupContent(attrs);
    marker.bindPopup(popupContent);

    marker.on('click', () => {
        loadForEdit(feature);
    });

    marker.featureData = feature;
    featureLayer.addLayer(marker);

    return true;
}

function createModernPopupContent(attributes) {
    const address = attributes[FIELDS.address] || "No address";
    const description = attributes[FIELDS.description] || "No description";
    const startDate = attributes[FIELDS.start] ? 
        new Date(attributes[FIELDS.start]).toLocaleDateString() : "No date";

    return `
        <div style="background: rgba(30,41,59,0.95); border-radius: 16px; padding: 20px; backdrop-filter: blur(12px); min-width: 250px;">
            <div style="text-align: center; margin-bottom: 16px;">
                <span style="font-size: 40px;">🏷️</span>
            </div>
            
            <h4 style="color: #3cf0d4; margin: 0 0 4px 0; text-align: center; font-size: 18px;">${address}</h4>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px 0; text-align: center;">Garage Sale Location</p>
            
            <div style="space-y: 12px;">
                <div style="background: rgba(60,240,212,0.1); border: 1px solid rgba(60,240,212,0.3); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #3cf0d4;">📅</span>
                        <span style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">DATE</span>
                    </div>
                    <div style="color: white; font-weight: 500;">${startDate}</div>
                </div>
                
                <div style="background: rgba(60,240,212,0.1); border: 1px solid rgba(60,240,212,0.3); border-radius: 8px; padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #3cf0d4;">🛍️</span>
                        <span style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ITEMS</span>
                    </div>
                    <div style="color: white; font-weight: 500;">${description}</div>
                </div>
            </div>

            <button onclick="editSale(${attributes[objectIdField]})" style="
                width: 100%; background: linear-gradient(135deg, #3cf0d4, #7c89ff); 
                border: none; color: white; padding: 12px; border-radius: 8px; 
                font-weight: 600; cursor: pointer; margin-top: 16px; font-size: 14px;
            ">✏️ Edit This Sale</button>
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

/* ================ Modern Map Event Handlers ================ */
function onMapClick(e) {
    if (!inNewMode) {
        showModernToast("💡 Click 'New Sale' first to add a garage sale", "info");
        return;
    }

    placeModernNewSale(e.latlng);
}

function onMapMouseMove(e) {
    const coords = $("#coordinates");
    if (coords) {
        coords.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
}

function placeModernNewSale(latlng) {
    console.log("📍 Placing modern new sale at:", latlng);

    if (editMarker) {
        map.removeLayer(editMarker);
    }

    editMarker = L.marker(latlng, {
        icon: L.divIcon({
            html: `
                <div style="position: relative;">
                    <div style="background: linear-gradient(135deg, #10b981, #3cf0d4); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(16,185,129,0.4); border: 4px solid white;">📍</div>
                    <div style="position: absolute; top: -4px; left: -4px; width: 56px; height: 56px; border: 2px solid #10b981; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="position: absolute; top: -8px; left: -8px; width: 64px; height: 64px; border: 1px solid #10b981; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 1s;"></div>
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    setTimeout(() => {
        $("#address")?.focus();
    }, 100);

    setModernStatus("🎯 Perfect! Location placed. Fill out the details below.", 'success');
    showModernToast("📍 Location placed! Now fill out the form.", "success");

    reverseGeocode(latlng);
}

async function reverseGeocode(latlng) {
    try {
        const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${latlng.lng},${latlng.lat}&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.address && data.address.Match_addr) {
            $("#address").value = data.address.Match_addr;
            console.log("🏠 Auto-filled modern address:", data.address.Match_addr);
            showModernToast("🏠 Address found automatically!", "info");
        }
    } catch (error) {
        console.warn("⚠️ Reverse geocoding failed:", error);
    }
}

/* ================ Modern Core Functions ================ */
function updateModernStats() {
    try {
        $("#totalSales").textContent = garageSalesData.length.toString();
        $("#weekendSales").textContent = "0"; // Simplified for demo
    } catch (error) {
        console.warn("⚠️ Modern stats update failed:", error);
    }
}

function enterAddMode() {
    console.log("🆕 Entering modern add mode...");

    inNewMode = true;

    $("#btnCancel").style.display = "inline-flex";
    $("#modeChip").style.display = "flex";
    $("#modeChip").innerHTML = '✨ Click map to place garage sale';

    if (editMarker) {
        map.removeLayer(editMarker);
        editMarker = null;
    }

    setModernStatus("✨ Great! Now click anywhere on the map to place your garage sale.", 'info');
    $("#coordinates").textContent = "Click map to place garage sale";

    console.log("✅ Modern add mode activated");
    showModernToast("✨ Click anywhere on the map to place your sale", "info");
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
    setModernStatus("🏠 Ready to manage garage sales. Everything looks great!", 'info');
    showModernToast("Editing cancelled", "info");
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

/* ================ 🔧 FIXED Load for Edit with Coordinate Conversion ================ */
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

    // 🔧 FIX: CONVERT COORDINATES HERE TOO
    const [lat, lng] = webMercatorToWGS84(geom.x, geom.y);

    editMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: `
                <div style="position: relative;">
                    <div style="background: linear-gradient(135deg, #f59e0b, #eab308); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(245,158,11,0.4); border: 4px solid white;">✏️</div>
                    <div style="position: absolute; top: -4px; left: -4px; width: 56px; height: 56px; border: 2px solid #f59e0b; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    map.flyTo([lat, lng], 17, { duration: 1.2 });

    const address = attrs[FIELDS.address] || "Unknown location";
    setModernStatus(`✏️ Editing: ${address}. Make your changes and save.`, 'info');

    updateDescriptionPreview();
    showModernToast("✏️ Editing garage sale", "info");
}

async function onSave() {
    const address = $("#address").value.trim();
    const startDate = $("#dateStart").value;

    if (!address) {
        showModernToast("⚠️ Address is required", "warning");
        $("#address").focus();
        return;
    }

    if (!startDate) {
        showModernToast("⚠️ Start date is required", "warning");
        $("#dateStart").focus();
        return;
    }

    if (!editMarker) {
        showModernToast("⚠️ Please place a location on the map first", "warning");
        return;
    }

    try {
        showModernLoadingOverlay("Saving your garage sale...");

        const description = composeDescription();
        const latlng = editMarker.getLatLng();

        const attributes = {
            [FIELDS.address]: address,
            [FIELDS.description]: description,
            [FIELDS.start]: toEpochMaybe(startDate),
            [FIELDS.end]: toEpochMaybe($("#dateEnd").value)
        };

        // Note: We save coordinates as WGS84 but ArcGIS might convert them
        // The service should handle this automatically
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
        hideModernLoadingOverlay();

        if (result.error || !(result.addResults?.[0]?.success || result.updateResults?.[0]?.success)) {
            throw new Error(result.error?.message || "Save operation failed");
        }

        const successMessage = selectedFeature ? "🎉 Garage sale updated!" : "🎉 Garage sale added!";
        showModernToast(successMessage, "success");

        await loadGarageSales();
        cancelEditing();

    } catch (error) {
        hideModernLoadingOverlay();
        console.error("❌ Modern save failed:", error);
        showModernToast(`❌ Save failed: ${error.message}`, "error");
    }
}

function cycleTheme() {
    const themes = ["dark", "dim", "light"];
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const currentIndex = themes.indexOf(current);
    const next = themes[(currentIndex + 1) % themes.length];

    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem('preferred_theme', next);

    showModernToast(`🎨 Theme: ${next}`, "info");
}

/* ================ Modern Enhanced Guide ================ */
function showModernGuide() {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modern-guide-modal-backdrop";
    modalBackdrop.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.9);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 20px; backdrop-filter: blur(12px);
    `;

    modalBackdrop.innerHTML = `
        <div style="background: rgba(30,41,59,0.95); border-radius: 20px; padding: 40px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; backdrop-filter: blur(12px); border: 1px solid rgba(60,240,212,0.3);">
            <div style="text-align: center; margin-bottom: 32px;">
                <button onclick="closeModernGuideModal()" style="position: absolute; top: 20px; right: 20px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600;">✕ Close</button>
                
                <div style="font-size: 48px; margin-bottom: 16px;">🏷️</div>
                <h2 style="color: #3cf0d4; margin: 0 0 8px 0; font-size: 32px;">Ultimate Garage Sale Manager</h2>
                <div style="background: linear-gradient(135deg, #3cf0d4, #7c89ff); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 16px; font-weight: 600;">
                    Professional-grade system for the City of Portland, Texas
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px;">
                <div style="text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🚀</div>
                    <h3 style="color: #3cf0d4; margin: 0 0 8px 0;">Quick Start (60 Seconds)</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px; background: rgba(60,240,212,0.1); border-radius: 8px; padding: 12px;">
                            <div style="background: #3cf0d4; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">1</div>
                            <div style="text-align: left;">
                                <div style="color: white; font-weight: 500;">Click "New Sale"</div>
                                <div style="color: #94a3b8; font-size: 12px;">Start the process</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 12px; background: rgba(60,240,212,0.1); border-radius: 8px; padding: 12px;">
                            <div style="background: #3cf0d4; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">2</div>
                            <div style="text-align: left;">
                                <div style="color: white; font-weight: 500;">Click Map/Building</div>
                                <div style="color: #94a3b8; font-size: 12px;">Place your sale</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 12px; background: rgba(60,240,212,0.1); border-radius: 8px; padding: 12px;">
                            <div style="background: #3cf0d4; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">3</div>
                            <div style="text-align: left;">
                                <div style="color: white; font-weight: 500;">Fill & Save</div>
                                <div style="color: #94a3b8; font-size: 12px;">Complete the form</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">✨</div>
                    <h3 style="color: #3cf0d4; margin: 0 0 16px 0;">Premium Features</h3>
                    
                    <div style="text-align: left; space-y: 16px;">
                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #7c89ff; margin: 0 0 4px 0; font-size: 16px;">🔤 Smart Address Entry</h4>
                            <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.4;">
                                Type just 2 characters and get instant suggestions. Arrow keys to navigate, Enter to select.
                            </p>
                            <div style="background: rgba(124,137,255,0.1); border-radius: 4px; padding: 4px 8px; margin-top: 4px; font-family: monospace; font-size: 11px; color: #7c89ff;">
                                Example: Type "123 ma" → "123 Main St, Portland, TX"
                            </div>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #7c89ff; margin: 0 0 4px 0; font-size: 16px;">🏠 Building Click Magic</h4>
                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 4px 0; line-height: 1.4;">
                                Zoom in close, click any building to see its address, then click "Use This Address".
                            </p>
                            <div style="color: #10b981; font-size: 12px; font-weight: 500;">
                                💡 No more typing addresses manually!
                            </div>
                        </div>

                        <div>
                            <h4 style="color: #7c89ff; margin: 0 0 4px 0; font-size: 16px;">📅 Multi-Day Sales</h4>
                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 4px 0; line-height: 1.4;">
                                Check "Multi-day sale" box, add different days with different times. Perfect for weekend sales!
                            </p>
                            <div style="background: rgba(124,137,255,0.1); border-radius: 4px; padding: 4px 8px; font-family: monospace; font-size: 11px; color: #7c89ff;">
                                Friday 7:00 AM - 2:00 PM & Saturday 8:00 AM - 4:00 PM
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="background: rgba(60,240,212,0.05); border: 1px solid rgba(60,240,212,0.2); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="color: #3cf0d4; margin: 0 0 16px 0; text-align: center;">📝 Quick Templates</h3>
                <p style="color: #94a3b8; text-align: center; margin: 0 0 16px 0;">Save time with pre-made templates for common garage sale types:</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    ${Object.entries(saleTemplates).map(([name, template]) => `
                        <div style="background: rgba(60,240,212,0.1); border: 1px solid rgba(60,240,212,0.2); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 20px; margin-bottom: 4px;">${template.icon}</div>
                            <div style="color: white; font-weight: 500; font-size: 14px; margin-bottom: 2px;">${name}</div>
                            <div style="color: #94a3b8; font-size: 11px;">${template.time.start}:00 ${template.time.startAmPm} - ${template.time.end}:00 ${template.time.endAmPm}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px;">
                <div>
                    <h3 style="color: #3cf0d4; margin: 0 0 12px 0;">🎯 Pro Tips</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <h4 style="color: #f59e0b; margin: 0 0 6px 0; font-size: 16px;">⌨️ Keyboard Shortcuts</h4>
                        <ul style="color: #94a3b8; font-size: 13px; margin: 0; padding-left: 16px; line-height: 1.5;">
                            <li>Tab key moves between form fields</li>
                            <li>Arrow keys navigate address suggestions</li>
                            <li>Enter selects highlighted suggestion</li>
                            <li>Escape closes suggestion dropdown</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 style="color: #f59e0b; margin: 0 0 6px 0; font-size: 16px;">🎨 Interface Tips</h4>
                        <ul style="color: #94a3b8; font-size: 13px; margin: 0; padding-left: 16px; line-height: 1.5;">
                            <li>Click theme button for dark/light modes</li>
                            <li>Zoom to level 16+ to see buildings</li>
                            <li>Use Hybrid + Roads for best view</li>
                            <li>Status bar shows connection status</li>
                        </ul>
                    </div>
                </div>

                <div>
                    <h3 style="color: #3cf0d4; margin: 0 0 12px 0;">✅ Best Practices</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <h4 style="color: #10b981; margin: 0 0 6px 0; font-size: 16px;">📍 Location & Timing</h4>
                        <ul style="color: #94a3b8; font-size: 13px; margin: 0; padding-left: 16px; line-height: 1.5;">
                            <li>Use exact street addresses</li>
                            <li>Most sales: 7 AM - 2 PM</li>
                            <li>Friday-Saturday for multi-day</li>
                            <li>Verify dates before saving</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 style="color: #10b981; margin: 0 0 6px 0; font-size: 16px;">🛍️ Items & Descriptions</h4>
                        <ul style="color: #94a3b8; font-size: 13px; margin: 0; padding-left: 16px; line-height: 1.5;">
                            <li>List popular items (furniture, clothes)</li>
                            <li>Mention "everything must go" for moving sales</li>
                            <li>Include "multi-family" for neighborhood sales</li>
                            <li>Keep descriptions concise but informative</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid rgba(100,116,139,0.2);">
                <button onclick="closeModernGuideModal()" style="background: linear-gradient(135deg, #3cf0d4, #7c89ff); border: none; color: white; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px; margin-bottom: 16px;">Got It! Let's Start</button>
                <div style="color: #64748b; font-size: 14px;">
                    Professional garage sale management system <br>
                    <strong style="color: #3cf0d4;">City of Portland, Texas</strong> • Version 8.0 Modern
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalBackdrop);

    // Close button handlers - FIXED
    const closeButtons = modalBackdrop.querySelectorAll('.modern-close-guide-btn, .modern-close-guide-main');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeModernGuideModal();
        });
    });

    // Close on backdrop click
    modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
            closeModernGuideModal();
        }
    });

    window.currentModernGuideModal = modalBackdrop;
}

function closeModernGuideModal() {
    if (window.currentModernGuideModal) {
        document.body.removeChild(window.currentModernGuideModal);
        window.currentModernGuideModal = null;
    }
}

window.closeModernGuideModal = closeModernGuideModal;
window.showTemplateSelector = showTemplateSelector;
window.closeTemplateModal = closeTemplateModal;

function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        loadGarageSales();
        showModernToast("🌐 Connection restored", "success");
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        showModernToast("⚠️ Connection lost - working offline", "warning");
    });

    updateConnectionStatus();
}

/* ================ Modern Premium Initialization ================ */
async function init() {
    console.log("🏛️ Modern Stylish Garage Sale Admin v8.0 - FIXED COORDINATES");
    console.log("🚀 Initializing premium modern system...");

    try {
        const savedTheme = localStorage.getItem('preferred_theme');
        if (savedTheme) {
            document.documentElement.setAttribute("data-theme", savedTheme);
        }

        setupNetworkMonitoring();
        await initMap();

        // Set up multi-day functionality
        setupMultiDayFeature();

        // Form handlers with modern touch
        ["timeStartHour", "timeStartMin", "timeStartAmPm", "timeEndHour", "timeEndMin", "timeEndAmPm", "details"]
            .forEach(id => {
                const el = $("#" + id);
                if (el) el.addEventListener("change", updateDescriptionPreview);
            });

        // Modern button handlers with enhanced feedback
        const btnNew = $("#btnNew");
        if (btnNew) {
            btnNew.addEventListener("click", () => {
                enterAddMode();
                // Show template selector option
                setTimeout(() => {
                    if (confirm("Would you like to start with a template?")) {
                        showTemplateSelector();
                    }
                }, 1000);
            });
        }

        $("#btnSave")?.addEventListener("click", onSave);
        $("#btnCancel")?.addEventListener("click", cancelEditing);
        $("#btnTheme")?.addEventListener("click", cycleTheme);
        $("#btnGuide")?.addEventListener("click", showModernGuide);

        // Enhanced address search
        $("#btnSearch")?.addEventListener("click", () => {
            const address = $("#addressSearch").value.trim();
            if (address && addressSuggestions.length > 0) {
                selectSuggestion(addressSuggestions[0].text, addressSuggestions[0].magicKey, $("#addressSearch"));
            } else if (address) {
                showModernToast("💡 Try the autocomplete suggestions for better results", "info");
            }
        });

        updateDescriptionPreview();

        console.log("✅ Modern premium system ready with FIXED COORDINATES!");
        setModernStatus("🎉 Premium modern system ready! All enhanced features enabled.", 'success');

        // Welcome message
        setTimeout(() => {
            showModernToast("🏛️ Welcome to the premium garage sale management system!", "info", 5000);
        }, 1000);

    } catch (error) {
        console.error("❌ Modern initialization failed:", error);
        setModernStatus("System failed to start. Please refresh.", 'error');
    }
}

window.addEventListener('error', (event) => {
    console.error("💥 Modern error:", event.error);
});

// Replace traditional functions with modern equivalents
window.toast = showModernToast;
window.setStatus = setModernStatus;

console.log("🚀 Modern Stylish Garage Sale Admin loaded with premium features and FIXED COORDINATES!");
