# 🏠 Funky Home Temperature Monitor

A real-time, interactive dashboard for monitoring Philips Hue sensors throughout your home. Now available as a Progressive Web App (PWA) - install it on your phone or desktop!

## Features

✨ **Real-time Temperature Monitoring**
- Beautiful mercury thermometer graphics with color-coded temperatures
- Temperature history graphs (24-hour)
- Displays only rooms with active sensors

🚶 **Motion Detection**
- Visual indicators when motion is detected
- Voice announcements for key areas (Outdoor, Hall, Landing, Bathroom)
- 48-hour motion event log with timestamps
- Real-time updates every 3 seconds

💡 **Smart Lighting Status**
- Shows which lights are on/off in each room
- Narnia-style lamppost for outdoor lighting
- Double-click any light to toggle on/off
- Fun light effects: Red Alert, Party Mode, Disco, Wave, Sunset
- Auto-updates every 10 seconds

📡 **Comprehensive Sensor Details**
- Temperature, light level, motion, and battery status
- Real-time updates for all sensor capabilities
- Color-coded battery warnings
- Ambient light detection (daylight/dim/dark)

🌤️ **Weather Integration**
- Live outdoor weather from WeatherAPI.com
- Current temperature, conditions, and weather icon
- Feels-like temperature, humidity, and UV index
- Auto-updates every 15 minutes
- Compare indoor vs outdoor temperatures

🎨 **Beautiful UI**
- Pixel art UK semi-detached house design
- Animated smoke, clouds, and birds
- Sparkle effects on temperature updates
- Massive shake animation on hover

📱 **Progressive Web App (PWA)**
- Install on any device (mobile, tablet, desktop)
- Offline support with service worker caching
- App-like experience in standalone mode
- Custom themed app icon with house design

🎵 **Sonos Speaker Control**
- Control Sonos speakers in bedroom, office, and lounge
- Play/pause, volume control
- SOAP/UPnP integration via proxy server

🔌 **TP-Link Tapo Smart Plugs**
- Toggle smart plugs on/off from the UI
- UK socket faceplate design with rocker switch
- Control tree lights, winter lights, and extension plugs

📺 **NVIDIA SHIELD TV Integration**
- Launch apps (Netflix, YouTube, Plex, Spotify, etc.)
- ADB-based control via proxy server

🌡️ **Google Nest Thermostat**
- Display current and target temperatures
- Visual thermostat control

## Setup

### Prerequisites
- Node.js 18+ (for development server and proxy servers)
- npm (comes with Node.js)

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   # Copy the template
   cp .env.example .env

   # Or on Windows
   copy .env.example .env
   ```

3. **Configure credentials in `.env`:**
   ```env
   # Tapo smart plug credentials (required)
   TAPO_EMAIL=your-email@example.com
   TAPO_PASSWORD=your-password

   # Frontend origin for CORS (default is fine for development)
   FRONTEND_ORIGIN=http://localhost:5173

   NODE_ENV=development
   ```

4. **Configure Hue Bridge:**
   ```bash
   copy config.example.js config.js
   ```
   - Edit `config.js` with your Hue Bridge IP and username
   - See Philips Hue API documentation for generating API username

5. **Add weather API key (optional but recommended):**
   - Sign up at [weatherapi.com/signup.aspx](https://www.weatherapi.com/signup.aspx)
   - Add your API key to `WEATHER_CONFIG.API_KEY` in `config.js`
   - Free tier: 1 million calls/month

6. **Configure Nest Thermostat (optional):**
   - Create `nest-config.json` with your Google Cloud OAuth credentials
   - Run `node scripts/setup/nest-auth.cjs` to authorize
   - See [Nest Thermostat Setup](#nest-thermostat-setup) below for details

7. **Start the application:**
   ```bash
   npm start
   ```
   This starts:
   - Vite dev server (port 5173)
   - Sonos proxy (port 3000)
   - Tapo proxy (port 3001)
   - SHIELD proxy (port 8082)

8. **Open in browser:**
   ```
   http://localhost:5173
   ```

### Nest Thermostat Setup

The Nest integration uses Google's Smart Device Management API with OAuth2.

1. **Create a Google Cloud project** and enable the Smart Device Management API
2. **Create OAuth2 credentials** (Web application type) with redirect URI: `http://localhost:8080/auth/callback`
3. **Create `nest-config.json`** in the project root:
   ```json
   {
     "CLIENT_ID": "your-client-id.apps.googleusercontent.com",
     "CLIENT_SECRET": "your-client-secret",
     "PROJECT_ID": "your-sdm-project-id",
     "REDIRECT_URI": "http://localhost:8080/auth/callback"
   }
   ```
4. **Run the auth script:**
   ```bash
   node scripts/setup/nest-auth.cjs
   ```
   This opens a browser for Google login and saves tokens to `nest-config.js`.

#### Refreshing Expired Tokens

If you see "Token has been expired or revoked" in the browser console:
```bash
node scripts/setup/nest-auth.cjs
```

**Note:** Google refresh tokens expire if unused for 6 months or if revoked in Google Account settings.

### 📖 Documentation
- **QUICK_START.md** - Fast setup guide
- **REFACTORING.md** - Technical architecture details
- **IMPLEMENTATION_SUMMARY.md** - Recent improvements

## Development Commands

```bash
# Development
npm start              # Start all services (Vite + proxies)
npm run dev            # Start only Vite dev server

# Individual proxies
npm run proxy:sonos    # Sonos proxy (port 3000)
npm run proxy:tapo     # Tapo proxy (port 3001)
npm run proxy:shield   # SHIELD proxy (port 8082)

# Code quality
npm run lint           # Check code for issues
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format all code
npm run format:check   # Check code formatting

# Production
npm run build          # Build for production (outputs to dist/)
npm run preview        # Preview production build
```

## Health Checks

Verify proxy servers are running:
```bash
curl http://localhost:3000/health  # Sonos
curl http://localhost:3001/health  # Tapo
curl http://localhost:8082/health  # SHIELD
```

## Installing as PWA

1. Start the dev server: `npm start`
2. Open `http://localhost:5173` in Chrome, Edge, or Safari
3. Look for the install button (⊕) in the address bar
4. Click install to add the app to your device
5. Works offline once installed

## Room Layout

**First Floor:**
- Main Bedroom
- Guest Bedroom
- Landing
- Home Office
- Bathroom

**Ground Floor:**
- Lounge
- Hall
- Extension
- Kitchen

**Outdoor:**
- Garden area with lamppost

## Update Intervals

- **Motion Sensors:** 3 seconds (real-time detection)
- **Lights:** 10 seconds (frequent updates)
- **Temperatures:** 60 seconds (slow changes)
- **Weather:** 15 minutes (API rate limit friendly)

## Technologies

### Frontend
- Vanilla JavaScript (ES6+ modules)
- SVG graphics for house visualization
- Web Speech API (voice announcements)
- Vite (development server and build tool)
- Service Workers (offline support)
- Web App Manifest (PWA installation)

### Backend
- Node.js proxy servers
- Philips Hue Bridge API
- Sonos SOAP/UPnP protocol
- TP-Link Tapo smart plug API
- NVIDIA SHIELD ADB control
- Google Nest API
- WeatherAPI.com

### Development
- ESLint (code linting)
- Prettier (code formatting)
- dotenv (environment variables)
- Concurrently (run multiple servers)

### Architecture
- Modular code structure (feature-based)
- Centralized configuration
- DRY middleware for proxies
- Health check endpoints
- CORS security

## Generated with

🤖 Built with [Claude Code](https://claude.com/claude-code)
