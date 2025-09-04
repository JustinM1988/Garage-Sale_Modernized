// DEBUGGING VERSION - Add this to your browser console to check what's happening

// Check if garage sales data is loading
console.log("🔍 DEBUGGING GARAGE SALES:");
console.log("CONFIG.LAYER_URL:", CONFIG.LAYER_URL);
console.log("garageSalesData:", garageSalesData);
console.log("_featureCount:", _featureCount);

// Test the ArcGIS service directly
async function testArcGISService() {
    try {
        const url = CONFIG.LAYER_URL + "/query?where=1=1&outFields=*&returnGeometry=true&f=json";
        console.log("🌐 Testing URL:", url);

        const response = await fetch(url);
        const data = await response.json();

        console.log("📊 ArcGIS Response:", data);
        console.log("Features found:", data.features ? data.features.length : "No features");

        if (data.features && data.features.length > 0) {
            console.log("📍 First feature:", data.features[0]);
            console.log("Geometry:", data.features[0].geometry);
            console.log("Attributes:", data.features[0].attributes);
        }

        if (data.error) {
            console.error("❌ ArcGIS Error:", data.error);
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

// Test the service
testArcGISService();

// Check if buttons are working
console.log("🔍 DEBUGGING BUTTONS:");
console.log("New Sale button:", document.getElementById("btnNew"));
console.log("Map element:", document.getElementById("map"));
console.log("inNewMode:", inNewMode);

// Test new sale mode
function testNewSaleMode() {
    console.log("🆕 Testing New Sale mode...");
    enterAddMode();
    console.log("inNewMode after enterAddMode:", inNewMode);

    // Simulate map click
    const mapCenter = map.getCenter();
    console.log("Map center:", mapCenter);

    const fakeEvent = {
        latlng: mapCenter
    };

    onMapClick(fakeEvent);
}

// Test it
testNewSaleMode();
