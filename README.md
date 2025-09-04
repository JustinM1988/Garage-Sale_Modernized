# 🏛️ City of Portland Garage Sale Admin System
## Government-Ready Production Application v8.0

**Official garage sale location management system for City of Portland, Texas**

---

## 🎯 **System Overview**

This is a production-ready, government-compliant web application designed specifically for municipal staff to manage garage sale permits and locations. Built with modern web standards, accessibility compliance (WCAG 2.1 AA), and security best practices.

### ✨ **Key Features**

#### 🗺️ **Advanced Mapping & Location**
- Interactive Leaflet-based mapping with multiple base layers
- Precise GPS coordinate capture and reverse geocoding
- Address search and validation for Portland, TX
- Click-to-place functionality for accurate positioning
- Visual markers with accessibility support

#### 📅 **Flexible Scheduling System**
- Single-day and multi-day sale support
- Custom time ranges for different days
- Auto-generated descriptions: "Friday 7:00 AM - 2:00 PM & Saturday 8:00 AM - 4:00 PM: Books, clothes, furniture"
- Date validation and conflict checking

#### 📊 **Professional Data Management**
- Real-time statistics dashboard
- CSV export functionality for data analysis
- Print-friendly report generation
- Advanced filtering (All, This Weekend, Next 2 weeks, Past sales)
- Auto-save draft functionality

#### ♿ **Government Accessibility Standards**
- **WCAG 2.1 AA Compliant** - Full screen reader support
- **Keyboard Navigation** - Complete keyboard-only operation
- **Focus Management** - Clear visual focus indicators
- **Voice Announcements** - Screen reader status updates
- **High Contrast Mode** - Enhanced visibility options
- **Responsive Design** - Mobile, tablet, desktop optimized

#### 🔒 **Security & Reliability**
- Content Security Policy (CSP) headers
- XSS and injection attack prevention
- HTTPS enforcement (production requirement)
- Input validation and sanitization
- Error handling with graceful degradation
- Network status monitoring
- Offline functionality with service worker

---

## 🚀 **Quick Deployment Guide**

### **Prerequisites**
- Web server with HTTPS support (required for government sites)
- Domain name (preferably .gov or city domain)
- ArcGIS Feature Service access (already configured)

### **1. Download & Extract**
```bash
# Extract the deployment package
unzip portland-tx-garage-sale-admin.zip
cd portland-tx-garage-sale-admin/
```

### **2. Upload to Web Server**
Upload all files to your web server's public directory:
- `index.html` - Main application
- `config.js` - Configuration file
- `app.js` - Application logic
- `styles.css` - Styling and themes
- `manifest.json` - PWA configuration
- `sw.js` - Service worker for offline support
- `.well-known/` - Security and verification files

### **3. Configure Domain**
Update `config.js` if needed:
```javascript
ORGANIZATION: {
    name: "City of Portland",
    state: "Texas", 
    website: "https://www.portlandtx.gov",
    contact: "justin.mcintyre@portlandtx.gov"
}
```

### **4. Enable HTTPS** ⚠️ **REQUIRED**
Government applications must use HTTPS. Configure SSL certificate:
```bash
# Example with Let's Encrypt
sudo certbot --nginx -d your-domain.gov
```

### **5. Test Deployment**
Visit your site and verify:
- ✅ Map loads correctly
- ✅ Address search works
- ✅ Form submission succeeds
- ✅ Mobile responsiveness
- ✅ Accessibility features
- ✅ Print functionality
- ✅ Export capability

---

## 📋 **User Guide**

### **🎯 Adding a Garage Sale**
1. Click "➕ New Sale"
2. Click on map where sale will be located
3. Enter address (auto-filled from coordinates)
4. Set dates and times
5. Add items description
6. Click "💾 Save Sale"

### **⏰ Time Configuration**
- **Single Day**: Set one time range
- **Multi-Day**: Check box and configure different hours for each day

### **🔍 Search & Navigation**
- **Address Search**: Type address to zoom to location
- **Filter**: Use dropdown to show specific time periods
- **List View**: See all sales in searchable format

### **📊 Data Management**
- **Export**: Download CSV file with all garage sale data
- **Print**: Generate professional reports
- **Stats**: View real-time counts and status

### **⌨️ Keyboard Shortcuts**
- `Ctrl+N` - New sale
- `Ctrl+S` - Save current sale
- `Ctrl+E` - Export data
- `Ctrl+P` - Print report
- `Escape` - Cancel current operation
- `H` - Open help guide
- `T` - Toggle theme

---

## 🛡️ **Security & Compliance**

### **Government Standards Met**
- ✅ **Section 508 Compliance** - Federal accessibility requirements
- ✅ **WCAG 2.1 AA** - Web accessibility guidelines  
- ✅ **HTTPS Enforcement** - Encrypted data transmission
- ✅ **CSP Headers** - Content security policy protection
- ✅ **Input Validation** - XSS and injection prevention
- ✅ **Error Handling** - Secure error messages
- ✅ **Audit Trail** - Activity logging

### **Privacy & Data**
- **No Personal Data Collection** - Only location and event information
- **Local Processing** - No data sent to third parties
- **Government Servers** - Data stays within official infrastructure
- **Public Information** - Garage sale data is public by nature

---

## 🔧 **Configuration Options**

### **Map Settings** (`config.js`)
```javascript
CENTER: [-97.323, 27.876], // Portland, TX coordinates
ZOOM: 13,                  // Default zoom level
MIN_ZOOM: 10,             // Minimum zoom out
MAX_ZOOM: 18              // Maximum zoom in
```

### **Feature Toggles**
```javascript
AUTO_COMPOSE_DESCRIPTION: true,  // Auto-generate descriptions
MULTI_DAY_SALES: true,          // Enable multi-day scheduling  
EXPORT_ENABLED: true,           // Allow CSV exports
PRINT_ENABLED: true,            // Allow report printing
AUTO_SAVE_DRAFTS: true,         // Save work automatically
```

### **Accessibility Options**
```javascript
HIGH_CONTRAST_MODE: false,      // Default to high contrast
KEYBOARD_SHORTCUTS: true,       // Enable keyboard shortcuts
SCREEN_READER_ENABLED: true,    // Screen reader announcements
```

---

## 📱 **Progressive Web App (PWA)**

This application works as a PWA with offline capabilities:

### **Installation**
- Mobile users can "Add to Home Screen"
- Desktop users can install via browser
- Works offline for viewing existing data
- Background sync when connection restored

### **Offline Features**
- ✅ View existing garage sales
- ✅ Use map functionality  
- ✅ Access help and guides
- ❌ Add/edit sales (requires internet)
- ❌ Address search (requires internet)

---

## 🎨 **Customization**

### **City Branding**
Update logos and colors in `styles.css`:
```css
:root {
    --accent: #3cf0d4;        /* Primary color */
    --accent-2: #7c89ff;      /* Secondary color */
    --gov-primary: #1e40af;   /* Government blue */
}
```

### **Organization Info**
Update contact and organization details in `config.js`:
```javascript
ORGANIZATION: {
    name: "City of [Your City]",
    state: "[Your State]",
    website: "https://www.[yourcity].gov",
    contact: "[email@yourcity].gov"
}
```

---

## 📊 **Analytics & Monitoring**

### **Built-in Logging**
The application includes comprehensive logging:
```javascript
// View logs in browser console
window.errorLog      // Error tracking
APP_LOG.info()      // Information messages  
APP_LOG.warn()      // Warning messages
APP_LOG.error()     // Error messages
```

### **Performance Monitoring**
Monitor these metrics:
- Map load time
- Address search response time  
- Save operation success rate
- User accessibility feature usage

---

## 🆘 **Support & Maintenance**

### **Contact Information**
- **Primary Contact**: justin.mcintyre@portlandtx.gov
- **Organization**: City of Portland, Texas
- **Website**: https://www.portlandtx.gov

### **Common Issues & Solutions**

#### **Map Not Loading**
```bash
# Check browser console for errors
# Verify internet connection
# Check ArcGIS service status
```

#### **Address Search Failing**
```bash  
# Verify geocoding service in config.js
# Check for typos in address
# Try more specific address format
```

#### **Save Operations Failing**
```bash
# Check browser console for error details
# Verify ArcGIS Feature Service permissions
# Check network connectivity
```

#### **Accessibility Issues**
```bash
# Test with screen reader (NVDA recommended)
# Verify keyboard-only navigation
# Check color contrast ratios
# Test on mobile devices
```

---

## 📅 **Version History**

### **v8.0 - Government Ready (Current)**
- ✅ Full WCAG 2.1 AA compliance
- ✅ Government security standards
- ✅ Enhanced accessibility features  
- ✅ PWA offline functionality
- ✅ Professional reporting
- ✅ Keyboard shortcuts
- ✅ Multi-language support ready

### **v7.0 - No Authentication**
- Removed OAuth complexity
- Simplified deployment
- Enhanced user experience

### **v6.0 - Simple Authentication**  
- Client-side authentication
- Enhanced security features

---

## 🏛️ **Government Compliance Checklist**

- ✅ **Accessibility**: WCAG 2.1 AA compliant
- ✅ **Security**: HTTPS required, CSP headers
- ✅ **Privacy**: No personal data collection
- ✅ **Performance**: Fast loading, mobile optimized
- ✅ **Reliability**: Offline functionality, error handling
- ✅ **Usability**: Intuitive interface, keyboard navigation
- ✅ **Documentation**: Complete user and admin guides
- ✅ **Standards**: Modern web technologies, best practices

---

## 📞 **Getting Help**

### **Technical Support**
For technical issues or questions:
1. Check the browser console for error messages
2. Review this documentation
3. Contact: justin.mcintyre@portlandtx.gov

### **Feature Requests**
To request new features or enhancements:
1. Document the specific need
2. Provide use case examples  
3. Contact the development team

### **Accessibility Concerns**
If you encounter accessibility barriers:
1. Describe the specific issue
2. Include browser and assistive technology details
3. Contact support immediately for priority resolution

---

**🏷️ Built with ❤️ for the City of Portland, Texas**  
**Serving the community through better technology**