// config.js — Production-Ready Configuration for City of Portland
window.CONFIG = {
    // Garage Sale Data Source
    LAYER_URL: "https://services3.arcgis.com/DAf01WuIltSLujAv/arcgis/rest/services/Garage_Sales/FeatureServer/0",

    // Map Configuration - Portland, TX
    CENTER: [-97.323, 27.876], // Portland, TX coordinates
    ZOOM: 13,
    MIN_ZOOM: 10,
    MAX_ZOOM: 18,

    // No Authentication Required
    REQUIRE_SIGN_IN: false,

    // Enhanced Features
    AUTO_COMPOSE_DESCRIPTION: true,
    MULTI_DAY_SALES: true,
    EXPORT_ENABLED: true,
    PRINT_ENABLED: true,
    AUTO_SAVE_DRAFTS: true,

    // Geocoding & Search
    GEOCODING_SERVICE: "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer",
    ENABLE_ADDRESS_VALIDATION: true,

    // UI Enhancements
    DARK_MODE_DEFAULT: true,
    ANIMATION_SPEED: 300,
    TOAST_DURATION: 4000,

    // Government Information
    ORGANIZATION: {
        name: "City of Portland",
        state: "Texas",
        website: "https://www.portlandtx.gov",
        contact: "justin.mcintyre@portlandtx.gov"
    },

    // Performance & Reliability
    AUTO_REFRESH_INTERVAL: 300000, // 5 minutes
    MAX_RETRIES: 3,
    REQUEST_TIMEOUT: 10000,

    // Data Validation
    ADDRESS_REQUIRED: true,
    DATE_REQUIRED: true,
    DESCRIPTION_MIN_LENGTH: 5,

    // Export Options
    CSV_FILENAME: "portland-tx-garage-sales",
    INCLUDE_COORDINATES: true,

    // Accessibility
    HIGH_CONTRAST_MODE: false,
    KEYBOARD_SHORTCUTS: true,
    SCREEN_READER_ENABLED: true
};

// Initialize logging for debugging
window.APP_LOG = {
    debug: (...args) => console.log("🐛 [DEBUG]", ...args),
    info: (...args) => console.log("ℹ️ [INFO]", ...args),
    warn: (...args) => console.warn("⚠️ [WARN]", ...args),
    error: (...args) => console.error("❌ [ERROR]", ...args),
    success: (...args) => console.log("✅ [SUCCESS]", ...args)
};

APP_LOG.info("City of Portland Garage Sale Admin - Configuration Loaded");
APP_LOG.info("Organization:", CONFIG.ORGANIZATION.name);
APP_LOG.info("No authentication required - ready for immediate use");