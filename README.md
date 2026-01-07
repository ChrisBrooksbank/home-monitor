# Home Monitor Dashboard

A real-time, interactive smart home dashboard for monitoring and controlling Philips Hue sensors, Sonos speakers, TP-Link Tapo smart plugs, NVIDIA SHIELD TV, and Google Nest thermostat. Built as a Progressive Web App (PWA) with a pixel art UK house visualization.

## Features

### Temperature Monitoring
- Mercury thermometer graphics with color-coded temperatures
- 24-hour temperature history
- Draggable thermometer positions (saved to localStorage)
- Sparkle effects on temperature updates

### Motion Detection
- Animated monkey face indicators when motion is detected
- Voice announcements for Outdoor, Hall, Landing, Bathroom
- 48-hour motion event log with timestamps
- Real-time updates every 3 seconds

### Smart Lighting
- Light indicators show **actual Hue bulb colors** (HSV, color temperature, CIE xy)
- Narnia-style lamppost for outdoor lighting
- Double-click any light to toggle on/off
- Light effects: Red Alert, Party Mode, Disco, Wave, Sunset

### Monty the Moose
- Animated moose character appears every 10-20 minutes
- Various activities: cleaning windows, mowing lawn, watering plants, picnics
- Voice announcement: "It's me, Monty!"
- Night-only star gazing activity

### Sonos Speaker Control
- Play/pause, volume control
- Speaker discovery and status display
- SOAP/UPnP integration via proxy server

### TP-Link Tapo Smart Plugs
- UK socket faceplate design with rocker switch
- Auto-discovery of plugs on network
- Toggle on/off with visual feedback
- Draggable plug positions

### NVIDIA SHIELD TV
- Launch apps (Netflix, YouTube, Plex, Spotify, etc.)
- ADB-based control via proxy server

### Google Nest Thermostat
- Current and target temperature display
- Visual thermostat control
- OAuth2 token management

### Weather Integration
- Live weather from WeatherAPI.com
- Temperature, conditions, humidity, UV index
- Auto-updates every 15 minutes

### Connection Status
- Header displays real-time status of all services
- Hue Bridge, Sonos, Tapo, and SHIELD proxy indicators
- Visual feedback (green = online, red = offline)

### UI Features
- Pixel art UK semi-detached house design
- Day/night sky transitions based on sunrise/sunset
- Animated smoke, clouds, and birds
- Draggable UI elements with position persistence
- Compact/Full view mode toggle

### Progressive Web App
- Install on any device
- Offline support with service worker
- Auto-cache invalidation on updates

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure `.env`:**
   ```env
   TAPO_EMAIL=your-email@example.com
   TAPO_PASSWORD=your-password
   FRONTEND_ORIGIN=http://localhost:5173
   NODE_ENV=development
   ```

4. **Configure Hue Bridge:**
   ```bash
   cp config.example.js config.js
   ```
   Edit `config.js` with your Hue Bridge IP and API username.

5. **Start the application:**
   ```bash
   npm start
   ```
   This starts:
   - Vite dev server (port 5173)
   - Sonos proxy (port 3000)
   - Tapo proxy (port 3001)
   - SHIELD proxy (port 8082)

6. **Open browser:**
   ```
   http://localhost:5173
   ```

## Configuration

### Hue Bridge (Required)
Edit `config.js`:
```javascript
const HUE_CONFIG = {
    BRIDGE_IP: "192.168.1.XXX",
    USERNAME: "your-hue-api-username"
};
```

### Weather API (Optional)
Sign up at [weatherapi.com](https://www.weatherapi.com/signup.aspx) and add to `config.js`:
```javascript
const WEATHER_CONFIG = {
    API_KEY: "your-api-key",
    LOCATION: "CM1 6UG"
};
```

### Nest Thermostat (Optional)

1. Create Google Cloud project with Smart Device Management API
2. Create OAuth2 credentials with redirect URI: `http://localhost:8080/auth/callback`
3. Create `nest-config.json`:
   ```json
   {
     "CLIENT_ID": "your-client-id.apps.googleusercontent.com",
     "CLIENT_SECRET": "your-client-secret",
     "PROJECT_ID": "your-sdm-project-id",
     "REDIRECT_URI": "http://localhost:8080/auth/callback"
   }
   ```
4. Run authorization:
   ```bash
   node scripts/setup/nest-auth.cjs
   ```

#### Refreshing Expired Tokens
If you see "Token has been expired or revoked":
```bash
node scripts/setup/nest-auth.cjs
```

## Development Commands

```bash
# Development
npm start              # Start all services (Vite + proxies)
npm run dev            # Vite dev server only

# Individual proxies
npm run proxy:sonos    # Sonos proxy (port 3000)
npm run proxy:tapo     # Tapo proxy (port 3001)
npm run proxy:shield   # SHIELD proxy (port 8082)

# Production
npm run build          # Build for production
npm run preview        # Preview production build
```

## Project Structure

```
home/
├── index.html              # Main SVG-based house visualization
├── config.js               # Hue/Weather credentials (not committed)
├── nest-config.js          # Nest OAuth tokens (not committed)
├── js/
│   ├── app.js              # Main application entry point
│   ├── config.js           # Runtime configuration (intervals, URLs)
│   ├── config/
│   │   ├── schema.js       # Config validation schemas
│   │   ├── loader.js       # Config loading with validation
│   │   └── index.js        # Config module entry point
│   ├── api/
│   │   ├── sonos.js        # Sonos API client
│   │   ├── tapo.js         # Tapo API client
│   │   └── shield.js       # SHIELD API client
│   ├── features/
│   │   ├── effects.js      # Light effects (party mode, etc.)
│   │   ├── moose.js        # Monty the Moose character
│   │   ├── motion-indicators.js  # Monkey motion indicators
│   │   ├── nest.js         # Nest thermostat
│   │   ├── shield.js       # SHIELD TV controls
│   │   ├── sonos.js        # Sonos speaker UI
│   │   └── tapo.js         # Tapo plug controls
│   ├── ui/
│   │   └── draggable.js    # Drag-and-drop functionality
│   └── utils/
│       ├── logger.js       # Logging utilities
│       └── helpers.js      # IntervalManager, retryWithBackoff
├── proxies/
│   ├── sonos-proxy.js      # Sonos SOAP/UPnP proxy
│   ├── tapo-proxy.js       # Tapo API proxy with discovery
│   ├── shield-proxy.js     # SHIELD ADB proxy
│   └── middleware.js       # Shared proxy middleware
├── scripts/
│   ├── setup/              # Device discovery scripts (.cjs)
│   ├── testing/            # Testing/debugging scripts (.cjs)
│   └── control/            # Device control CLI scripts (.cjs)
├── config/
│   └── devices.json        # Discovered device registry
└── css/
    └── main.css            # Styles including animations
```

## Health Checks

Verify proxy servers are running:
```bash
curl http://localhost:3000/health  # Sonos
curl http://localhost:3001/health  # Tapo
curl http://localhost:8082/health  # SHIELD
```

## Update Intervals

| Data | Interval | Notes |
|------|----------|-------|
| Motion sensors | 3 sec | Real-time detection |
| Lights | 10 sec | Frequent updates |
| Temperatures | 60 sec | Slow changes |
| Connection status | 30 sec | Service health |
| Sonos volume | 30 sec | Speaker status |
| Tapo status | 30 sec | Plug states |
| Weather | 15 min | API rate friendly |
| Nest | 15 min | Avoid rate limits |
| Sun times | 24 hr | Sunrise/sunset |

## Room Layout

**First Floor:** Main Bedroom, Guest Bedroom, Landing, Home Office, Bathroom

**Ground Floor:** Lounge, Hall, Extension, Kitchen

**Outdoor:** Garden with lamppost

## Technologies

### Frontend
- Vanilla JavaScript (ES6+)
- SVG graphics
- Web Speech API
- Vite
- Service Workers (PWA)

### Backend
- Node.js proxy servers
- Philips Hue Bridge API
- Sonos SOAP/UPnP
- TP-Link Tapo API
- NVIDIA SHIELD ADB
- Google Nest SDM API
- WeatherAPI.com
- Sunrise-Sunset API

### Architecture
- Feature-based modular structure
- Centralized config with validation
- IntervalManager for polling
- Draggable UI with localStorage persistence
- Connection status monitoring

## Built with

[Claude Code](https://claude.com/claude-code)
