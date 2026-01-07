# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart home monitoring dashboard that displays real-time data from Philips Hue sensors, controls Sonos speakers, TP-Link Tapo smart plugs, NVIDIA SHIELD TV, and Google Nest thermostat. Built as a PWA with a pixel art UK house visualization.

## Development Commands

```bash
npm start              # Start Vite dev server + all proxy servers (recommended)
npm run dev            # Vite dev server only (port 5173)
npm run proxy:sonos    # Sonos proxy (port 3000)
npm run proxy:tapo     # Tapo proxy (port 3001)
npm run proxy:shield   # SHIELD proxy (port 8082)
npm run build          # Production build to dist/
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format all files
```

## Architecture

### Frontend (Vanilla JS + SVG)
- `index.html` - Main SVG-based house visualization with embedded components
- `js/app.js` - Application entry point, initializes all modules and polling intervals
- `js/config.js` - Centralized configuration (proxy URLs, intervals, timeouts, retry settings)
- `js/features/` - Feature modules (lights, motion, temperature, sonos, tapo, nest, effects, weather, sky)
- `js/api/` - API client modules for external services (hue.js, sonos.js, tapo.js, hub.js)
- `js/ui/` - UI utilities (draggable.js for drag-and-drop, thermometer.js)
- `js/utils/` - Shared utilities (logger.js, helpers.js with IntervalManager, retryWithBackoff)

### Backend (Node.js Proxy Servers)
- `proxies/` - HTTP proxy servers for device APIs that don't support CORS
- `proxies/middleware.js` - Shared middleware (CORS, JSON parsing, health checks)
- Each proxy handles device-specific protocols (SOAP/UPnP for Sonos, Tapo API, ADB for SHIELD)

### Configuration Files
- `config.js` - Hue Bridge IP/username and Weather API key (not committed)
- `config.example.js` - Template for config.js
- `.env` - Tapo credentials (TAPO_EMAIL, TAPO_PASSWORD)
- `config/devices.json` - Auto-discovered device registry

## Key Patterns

### Global Configuration
`APP_CONFIG` in `js/config.js` centralizes all settings. Access via `APP_CONFIG.proxies.sonos`, `APP_CONFIG.intervals.temperatures`, etc.

### Interval Management
Use `IntervalManager.register(fn, delay)` for all polling. Intervals auto-cleanup on page unload.

### Logging
Use `Logger.info()`, `Logger.warn()`, `Logger.error()`, `Logger.success()` instead of console.log. Timestamps are included automatically.

### Draggable UI Elements
SVG elements are made draggable with `createDraggable(element, { storageKey: 'myPosition' })`. Positions persist to localStorage.

### Module Pattern
Feature modules expose themselves on `window` (e.g., `window.HomeMonitor`, `window.SonosUI`, `window.TapoAPI`) and auto-initialize on DOMContentLoaded.

### Retry Logic
API calls should use `retryWithBackoff(fn)` for resilience. Config controls attempts and backoff delays.

## External Dependencies

- **Philips Hue Bridge** - Direct HTTP API on local network (no proxy needed)
- **Sonos Speakers** - SOAP/UPnP protocol via sonos-proxy
- **TP-Link Tapo Plugs** - tp-link-tapo-connect library via tapo-proxy
- **NVIDIA SHIELD** - ADB over TCP via shield-proxy
- **Google Nest Thermostat** - Google Smart Device Management API (OAuth2)
- **WeatherAPI.com** - Weather data (API key in config.js)
- **Sunrise-Sunset API** - Day/night sky transitions

## Environment Setup

1. Copy `config.example.js` to `config.js` and add Hue Bridge credentials
2. Copy `.env.example` to `.env` and add Tapo credentials
3. Run `npm install`
4. Run `npm start`

## Nest Thermostat Setup

The Nest integration uses Google's Smart Device Management API with OAuth2.

### Initial Setup
1. Create a Google Cloud project and enable the Smart Device Management API
2. Create OAuth2 credentials (Web application type)
3. Create `nest-config.json` with your credentials:
   ```json
   {
     "CLIENT_ID": "your-client-id",
     "CLIENT_SECRET": "your-client-secret",
     "PROJECT_ID": "your-sdm-project-id",
     "REDIRECT_URI": "http://localhost:8080/auth/callback"
   }
   ```
4. Run `node scripts/setup/nest-auth.cjs` to authorize and get tokens

### Refreshing Expired Tokens
If you see "Token has been expired or revoked" error in the console:
```bash
node scripts/setup/nest-auth.cjs
```
This opens a browser for Google login, gets new tokens, and saves them to `nest-config.js` and `nest-config.json`.

**Note:** Google refresh tokens can expire if unused for 6 months or if revoked in Google Account settings.
