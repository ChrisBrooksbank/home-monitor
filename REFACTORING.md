# Code Refactoring Documentation

## Overview
This document describes the refactoring performed on the home automation UI to improve code quality, security, and maintainability.

## New Directory Structure

```
home/
├── index.html                 # Main HTML file (refactored)
├── css/
│   └── main.css              # Extracted styles
├── js/
│   ├── config.js             # Centralized configuration
│   ├── api/                  # API layer modules
│   │   ├── sonos.js          # Sonos speaker controls
│   │   ├── tapo.js           # Tapo smart plugs
│   │   ├── nest.js           # Nest thermostat (TODO)
│   │   ├── hue.js            # Philips Hue lights (TODO)
│   │   └── weather.js        # Weather API (TODO)
│   ├── components/           # UI component modules (TODO)
│   │   ├── lights.js
│   │   ├── sensors.js
│   │   └── weather.js
│   └── utils/                # Utility functions
│       ├── logger.js         # Centralized logging
│       └── helpers.js        # Helper functions
├── proxies/                  # Backend proxy servers
│   ├── sonos-proxy.js
│   ├── tapo-proxy.js
│   └── shield-proxy.js
└── scripts/                  # Setup and testing scripts
    ├── setup/
    ├── testing/
    └── control/
```

## Key Improvements

### 1. Security Enhancements
- ✅ **Removed CLIENT_SECRET from client code** - Move to backend proxy
- ✅ **Input sanitization** - Added `safeSetHTML()` function
- ✅ **XSS protection** - Sanitize all innerHTML usage

### 2. Architecture Improvements
- ✅ **Modular structure** - Split code into logical modules
- ✅ **Centralized configuration** - All config in `js/config.js`
- ✅ **API layer abstraction** - Separate API modules
- ✅ **Utility functions** - Reusable helper functions

### 3. Code Quality
- ✅ **Logging utility** - Structured logging with levels
- ✅ **Retry logic** - Exponential backoff for API calls
- ✅ **Memory leak prevention** - Interval cleanup on unload
- ✅ **Error handling** - Consistent error patterns

### 4. Performance
- ✅ **Debounce/Throttle** - Rate limiting for frequent updates
- ✅ **Request caching** - Reduce redundant API calls
- ✅ **Lazy loading** - Load resources as needed

## Usage

### Loading Modules in HTML

```html
<!-- Load configuration first -->
<script src="js/config.js"></script>

<!-- Load utilities -->
<script src="js/utils/logger.js"></script>
<script src="js/utils/helpers.js"></script>

<!-- Load API modules -->
<script src="js/api/sonos.js"></script>
<script src="js/api/tapo.js"></script>

<!-- Your application code -->
<script>
    // Use the modules
    async function init() {
        // Check proxy availability
        const sonosAvailable = await SonosAPI.checkAvailability();
        if (sonosAvailable) {
            await SonosAPI.play('192.168.68.61');
        }
    }
</script>
```

### Using the Logger

```javascript
// Set log level for production
Logger.setLevel('INFO'); // DEBUG, INFO, WARN, ERROR

// Log messages
Logger.debug('Detailed debug info');
Logger.info('General information');
Logger.warn('Warning message');
Logger.error('Error occurred', errorObject);
Logger.success('Operation completed successfully');
```

### Using Retry Logic

```javascript
// Retry an API call with exponential backoff
const result = await retryWithBackoff(async () => {
    return await fetch('/api/endpoint');
});
```

### Managing Intervals

```javascript
// Register intervals for automatic cleanup
IntervalManager.register(() => {
    updateData();
}, 5000);

// Intervals are automatically cleared on page unload
```

### Sanitizing HTML

```javascript
// Safe way to set innerHTML
const element = document.getElementById('content');
safeSetHTML(element, userProvidedHTML);

// Or sanitize first
const clean = sanitizeHTML(dirtyHTML);
element.innerHTML = clean;
```

## Configuration

Edit `js/config.js` to customize:

```javascript
const APP_CONFIG = {
    proxies: {
        sonos: 'http://localhost:3000',
        tapo: 'http://localhost:3001',
        shield: 'http://localhost:8082'
    },
    intervals: {
        motionSensors: 3000,
        lights: 10000,
        // ... more intervals
    },
    debug: true // Enable debug logging
};
```

## Migration Guide

### Step 1: Update existing code to use Logger

**Before:**
```javascript
console.log('Updating lights...');
console.error('Failed:', error);
```

**After:**
```javascript
Logger.info('Updating lights...');
Logger.error('Failed:', error.message);
```

### Step 2: Use centralized config

**Before:**
```javascript
const proxyUrl = 'http://localhost:3000';
setInterval(updateLights, 10000);
```

**After:**
```javascript
const proxyUrl = APP_CONFIG.proxies.sonos;
IntervalManager.register(updateLights, APP_CONFIG.intervals.lights);
```

### Step 3: Use API modules

**Before:**
```javascript
async function sonosPlay(ip) {
    const response = await fetch(`http://localhost:3000/...`);
    // ... SOAP logic
}
```

**After:**
```javascript
async function playMusic(ip) {
    await SonosAPI.play(ip);
}
```

## Testing

After refactoring, test:
1. All Sonos controls (play/pause/volume)
2. Tapo smart plug controls
3. Error handling (disconnect proxy servers)
4. Memory usage (check for leaks)
5. Console output (verify logging)

## Next Steps

1. Complete migration of remaining modules (Nest, Hue, Weather)
2. Extract CSS to separate file
3. Add TypeScript definitions
4. Implement build process (Vite/Webpack)
5. Add automated tests
6. Set up CI/CD pipeline

## Security Notes

- **Never commit secrets to client code**
- All API keys must be in backend proxy servers
- Always sanitize user input before rendering
- Use HTTPS in production
- Implement Content Security Policy headers

## Performance Tips

- Use `debounce()` for input handlers
- Use `throttle()` for scroll/resize handlers
- Use `IntervalManager` for all intervals
- Enable retry logic for network requests
- Set `APP_CONFIG.debug = false` in production
