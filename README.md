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

2. **Create configuration file:**

    ```bash
    cp home.config.example.json home.config.json
    ```

3. **Configure `home.config.json`:**

    Edit the file with your settings:
    - `services.hue`: Your Hue Bridge IP and API username
    - `services.weather`: Your WeatherAPI.com API key
    - `services.nest`: Google Nest OAuth credentials (optional)
    - `proxies`: Customize proxy ports if needed

4. **Create environment file for Tapo:**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` with your Tapo credentials:

    ```env
    TAPO_EMAIL=your-email@example.com
    TAPO_PASSWORD=your-password
    ```

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

## New Machine Setup

When cloning to a new machine, these files are **not in git** and must be created:

### Required Files

| File               | Purpose                                   | Template                   |
| ------------------ | ----------------------------------------- | -------------------------- |
| `home.config.json` | All app config (Hue, Weather, Nest, etc.) | `home.config.example.json` |
| `.env`             | Tapo email/password (proxy-side only)     | `.env.example`             |

### Quick Setup Commands

```bash
# Clone and install
git clone https://github.com/ChrisBrooksbank/home-monitor.git
cd home-monitor
npm install

# Create config files from templates
cp home.config.example.json home.config.json
cp .env.example .env

# Edit with your credentials
# home.config.json: Configure Hue, Weather, Nest services
# .env: Add TAPO_EMAIL and TAPO_PASSWORD

# Start
npm start
```

### Troubleshooting

**"Configuration file not found"** - Copy the example config:

```bash
cp home.config.example.json home.config.json
```

**"Configuration validation failed"** - Check the error message for which field is invalid. Common issues:

- Placeholder values like "YOUR-" still in config
- Invalid IP address format for Hue bridge
- Missing required fields

**"Unexpected token '<'"** - Browser cached a bad response. Clear site data:

1. DevTools (F12) → Application → Storage → Clear site data
2. Hard refresh (Ctrl+Shift+R)

**Greyed out status indicators** - Check:

1. Node.js 18+ installed (`node --version`)
2. `home.config.json` exists with correct Hue credentials
3. Devices are on same network (VPN may block local access)

**Proxies not starting** - Ports may be in use. Check with:

```bash
netstat -ano | findstr ":3000 :3001 :8082"
```

## Configuration

All configuration is in a single `home.config.json` file. Copy `home.config.example.json` and customize.

### Hue Bridge

```json
{
    "services": {
        "hue": {
            "bridgeIp": "192.168.1.XXX",
            "username": "your-hue-api-username"
        }
    }
}
```

### Weather API

Sign up at [weatherapi.com](https://www.weatherapi.com/signup.aspx):

```json
{
    "services": {
        "weather": {
            "apiKey": "your-api-key"
        }
    }
}
```

### Proxy Ports

Customize if defaults conflict with other services:

```json
{
    "proxies": {
        "sonos": { "host": "localhost", "port": 3000 },
        "tapo": { "host": "localhost", "port": 3001 },
        "shield": { "host": "localhost", "port": 8082 },
        "nest": { "host": "localhost", "port": 3003 }
    }
}
```

### Nest Thermostat (Optional)

#### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Search for and enable the **Smart Device Management API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Select **Web application** as application type
7. Add authorized redirect URI: `http://localhost:3003/auth/callback`
8. Click **Create** and note your **Client ID** and **Client Secret**

#### 2. Smart Device Management Setup

1. Go to [Device Access Console](https://console.nest.google.com/device-access)
2. Click **Create project** ($5 one-time registration fee)
3. Give your project a name
4. Enter your OAuth Client ID from step 1
5. Enable events (optional)
6. Note your **Project ID** (displayed on the project page)

#### 3. Configure the App

Add your credentials to `home.config.json`:

```json
{
    "services": {
        "nest": {
            "clientId": "123456789-abc.apps.googleusercontent.com",
            "clientSecret": "GOCSPX-yourSecretHere",
            "projectId": "your-sdm-project-id",
            "tokens": null
        }
    }
}
```

#### 4. Authorize

1. Start the app: `npm start`
2. Click the **wheelie bin** icon in the bottom-right of the house
3. Click the **"Auth"** link next to the Nest status indicator
4. Complete Google authorization in the popup window
5. Tokens are saved automatically to `home.config.json`

#### Refreshing Expired Tokens

If you see "Token has been expired or revoked", simply click the **"Auth"** link in the wheelie bin popup again. No CLI commands needed.

## Development Commands

```bash
# Development
npm start              # Start all services (Vite + proxies)
npm run dev            # Vite dev server only

# Individual proxies
npm run proxy:sonos    # Sonos proxy (port 3000)
npm run proxy:tapo     # Tapo proxy (port 3001)
npm run proxy:shield   # SHIELD proxy (port 8082)

# Code quality
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run knip           # Find unused code/exports/dependencies

# Production
npm run build          # Build for production
npm run preview        # Preview production build
```

## Project Structure

```
home/
├── index.html                  # Main SVG-based house visualization
├── home.config.json            # All app config (not committed)
├── home.config.example.json    # Config template
├── .env                        # Tapo credentials (not committed)
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.ts                  # Main orchestration module
│   ├── config/
│   │   ├── index.ts            # Config module exports
│   │   ├── schema.ts           # Zod validation schemas
│   │   ├── loader.ts           # Async config loader
│   │   ├── defaults.ts         # Default configuration values
│   │   ├── env.ts              # Environment detection
│   │   └── mappings.ts         # Room/sensor name mappings
│   ├── api/
│   │   ├── hue.ts              # Philips Hue API client
│   │   ├── sonos.ts            # Sonos SOAP/UPnP client
│   │   ├── tapo.ts             # Tapo API client
│   │   └── shield.ts           # SHIELD ADB client
│   ├── features/
│   │   ├── effects.ts          # Light effects (party mode, etc.)
│   │   ├── moose.ts            # Monty the Moose character
│   │   ├── motion-indicators.ts # Monkey motion indicators
│   │   ├── nest.ts             # Nest thermostat
│   │   ├── weather.ts          # Weather display
│   │   ├── sky.ts              # Day/night sky effects
│   │   └── ...
│   ├── core/
│   │   ├── registry.ts         # Service registry
│   │   ├── events.ts           # Event bus
│   │   ├── state.ts            # Centralized state
│   │   └── poller.ts           # Polling scheduler
│   ├── ui/
│   │   └── draggable.ts        # Drag-and-drop functionality
│   └── utils/
│       ├── logger.ts           # Logging utilities
│       └── helpers.ts          # IntervalManager, retryWithBackoff
├── src/proxies/
│   ├── sonos-proxy.ts          # Sonos SOAP/UPnP proxy
│   ├── tapo-proxy.ts           # Tapo API proxy with discovery
│   ├── shield-proxy.ts         # SHIELD ADB proxy
│   ├── nest-proxy.ts           # Nest OAuth proxy
│   └── middleware.ts           # Shared proxy middleware
├── scripts/
│   ├── setup/                  # Device discovery scripts
│   ├── testing/                # Testing/debugging scripts
│   └── control/                # Device control CLI scripts
└── css/
    └── main.css                # Styles including animations
```

## Health Checks

Verify proxy servers are running:

```bash
curl http://localhost:3000/health  # Sonos
curl http://localhost:3001/health  # Tapo
curl http://localhost:8082/health  # SHIELD
```

## Update Intervals

| Data              | Interval | Notes               |
| ----------------- | -------- | ------------------- |
| Motion sensors    | 3 sec    | Real-time detection |
| Lights            | 10 sec   | Frequent updates    |
| Temperatures      | 60 sec   | Slow changes        |
| Connection status | 30 sec   | Service health      |
| Sonos volume      | 30 sec   | Speaker status      |
| Tapo status       | 30 sec   | Plug states         |
| Weather           | 15 min   | API rate friendly   |
| Nest              | 15 min   | Avoid rate limits   |
| Sun times         | 24 hr    | Sunrise/sunset      |

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
