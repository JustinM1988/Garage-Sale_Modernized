# 🔒 Maximum Security Deployment Guide
## City of Portland Garage Sale Admin - Production Security

---

## 🎯 **CRITICAL: Private Repo vs Public App**

### ✅ **YES** - You can have a **PRIVATE repository** with a **PUBLIC application**

**Your GitHub repo being private does NOT affect users accessing your deployed app!**

```
🔒 Private GitHub Repo (only you can see the code)
    ↓ (deployment process)
🌐 Public Web App (users can access at your-domain.gov)
```

### **How This Works:**
1. **Private Repository**: Code, credentials, and development files stay private
2. **Public Deployment**: Only the built application files are deployed to your web server
3. **User Access**: People visit your website URL (like portlandtx.gov/garage-sales)
4. **Code Protection**: Nobody can see your source code, only the running application

---

## 🛡️ **GitHub Security Features to Enable**

### **1. Enable Dependabot (Automatic)**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "your-username"
```

### **2. Enable GitHub Security Features**
Go to **Settings → Security & Analysis** and enable:
- ✅ **Dependabot alerts** - Automatically scan for vulnerabilities
- ✅ **Dependabot security updates** - Auto-create PRs to fix issues  
- ✅ **Code scanning** - Static analysis security testing
- ✅ **Secret scanning** - Detect leaked credentials

### **3. Set Up CodeQL Analysis**
Create `.github/workflows/codeql-analysis.yml`:
```yaml
name: "CodeQL Security Analysis"
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
    - name: Checkout repository
      uses: actions/checkout@v3
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2
```

### **4. Repository Security Settings**
In **Settings → General → Security**:
- ✅ **Restrict pushes that create public info**
- ✅ **Require signed commits** (optional but recommended)
- ✅ **Enable branch protection rules** for main branch
- ✅ **Require status checks** before merging

---

## 🔐 **Maximum Security Deployment Options**

### **Option 1: Private Repo + GitHub Pages (Recommended)**
```bash
# Your private repo structure:
your-private-repo/
├── src/           # Private source files
├── docs/          # Public files for GitHub Pages
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── config.js
└── .github/workflows/  # Automated deployment
```

**Benefits:**
- ✅ Source code stays completely private
- ✅ Free hosting with custom domain support
- ✅ HTTPS automatically enabled
- ✅ Easy automated deployment

**Setup:**
1. Put all deployment files in `/docs` folder
2. Go to **Settings → Pages**
3. Set source to "Deploy from branch: main /docs"
4. Add custom domain: `garage-sales.portlandtx.gov`

### **Option 2: Private Repo + City Web Server**
```bash
# Deployment process:
1. Build files locally or via GitHub Actions
2. Upload ONLY the compiled files to city server
3. Source code never leaves GitHub
```

### **Option 3: Private Repo + Automated Deployment**
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to server
      run: |
        # Copy only production files
        rsync -av --exclude='.git' \
               --exclude='src' \
               --exclude='*.md' \
               docs/ user@your-server.gov:/var/www/html/
      env:
        DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

---

## 🛡️ **Code Protection Strategies**

### **1. Source Code Obfuscation (Optional)**
```bash
# Install obfuscation tool
npm install -g javascript-obfuscator

# Obfuscate your JavaScript
javascript-obfuscator app.js --output app.min.js --compact true --control-flow-flattening true
```

### **2. Environment-Based Configuration**
```javascript
// config.js - Different configs for dev/prod
const CONFIG = {
  DEVELOPMENT: {
    LAYER_URL: "https://services3.arcgis.com/test/...",
    DEBUG_MODE: true
  },
  PRODUCTION: {
    LAYER_URL: "https://services3.arcgis.com/production/...",
    DEBUG_MODE: false
  }
};

// Use environment-specific config
window.CONFIG = CONFIG[window.location.hostname.includes('localhost') ? 'DEVELOPMENT' : 'PRODUCTION'];
```

### **3. Asset Integrity Protection**
```html
<!-- Add integrity checks to prevent tampering -->
<script src="app.js" 
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

---

## 📋 **Pre-Deployment Security Checklist**

### **Repository Security**
- ✅ Repository set to **Private**
- ✅ **Dependabot alerts** enabled
- ✅ **Code scanning** enabled
- ✅ **Secret scanning** enabled
- ✅ **Branch protection** rules active
- ✅ **Security.md** file present
- ✅ **No hardcoded secrets** in code

### **Code Security**  
- ✅ **Input validation** on all form fields
- ✅ **XSS prevention** via sanitization
- ✅ **CSP headers** configured
- ✅ **HTTPS enforcement** in production
- ✅ **Error handling** doesn't expose sensitive info
- ✅ **No eval()** or dangerous functions used

### **Deployment Security**
- ✅ **HTTPS certificate** installed
- ✅ **Custom domain** configured (.gov preferred)  
- ✅ **Security headers** configured
- ✅ **Access logs** monitoring enabled
- ✅ **Backup procedures** established
- ✅ **Incident response plan** documented

### **Access Control**
- ✅ **Repository collaborators** limited to essential staff
- ✅ **Deployment keys** properly secured
- ✅ **Server access** restricted to authorized personnel
- ✅ **Admin credentials** following city IT policies

---

## 🔍 **Security Scanning Commands**

### **1. Scan for Vulnerabilities**
```bash
# Install security scanning tools
npm install -g npm-audit-resolver
npm install -g snyk

# Run security audits
npm audit
npm audit fix

# Advanced scanning with Snyk
snyk test
snyk monitor
```

### **2. Check for Secrets in Code**
```bash
# Install git-secrets
git secrets --install
git secrets --register-aws
git secrets --scan-history

# Scan current files
git secrets --scan
```

### **3. Validate Security Headers**
```bash
# Test your deployed site
curl -I https://your-domain.gov/garage-sales

# Should show:
# Strict-Transport-Security: max-age=31536000
# Content-Security-Policy: default-src 'self'
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

---

## 🌐 **Deployment Scenarios**

### **Scenario 1: GitHub Pages with Custom Domain**
```
👤 Users visit: garage-sales.portlandtx.gov
🔒 Code stored: Private GitHub repo (only you see it)
🌐 Files served: From GitHub Pages CDN
💰 Cost: FREE
🔐 Security: High (HTTPS, GitHub's infrastructure)
```

**Setup Steps:**
1. Create private repo
2. Add deployment files to `/docs` folder
3. Enable GitHub Pages from `/docs`
4. Add CNAME file with your domain
5. Configure DNS records at your domain provider

### **Scenario 2: City Web Server Hosting**
```
👤 Users visit: www.portlandtx.gov/garage-sales
🔒 Code stored: Private GitHub repo
🌐 Files served: From city web servers  
💰 Cost: Using existing city infrastructure
🔐 Security: High (controlled by city IT)
```

**Setup Steps:**
1. Create private repo
2. Export deployment files
3. Upload to city web server
4. Configure HTTPS certificate
5. Set up automated deployment (optional)

### **Scenario 3: Hybrid Approach**
```
👤 Users visit: Custom subdomain (e.g., tools.portlandtx.gov)
🔒 Code stored: Private GitHub repo
🌐 Files served: Via GitHub Actions → City Server
💰 Cost: Minimal (automated deployment)
🔐 Security: Maximum (automated + controlled)
```

---

## 📞 **Getting Help**

### **GitHub Security Support**
- GitHub Security Lab: https://securitylab.github.com
- GitHub Community: https://github.community
- Documentation: https://docs.github.com/en/code-security

### **Government Web Security**
- CISA Guidelines: https://www.cisa.gov/secure-by-design
- NIST Framework: https://www.nist.gov/cyberframework
- GSA Digital Services: https://digital.gov

---

## 🚨 **IMPORTANT REMINDERS**

### **✅ DO THIS:**
- ✅ Keep repository **PRIVATE**
- ✅ Deploy only the necessary files
- ✅ Use **HTTPS** in production
- ✅ Enable all GitHub security features
- ✅ Test thoroughly before deployment
- ✅ Document all security procedures
- ✅ Set up monitoring and alerts

### **❌ NEVER DO THIS:**
- ❌ Put credentials in code
- ❌ Make repository public with sensitive info
- ❌ Deploy without HTTPS
- ❌ Skip security scanning
- ❌ Ignore security alerts
- ❌ Deploy from untested code

---

**🏛️ Remember: Private code, public service!**
**Your source code stays secure while citizens get the tools they need.**