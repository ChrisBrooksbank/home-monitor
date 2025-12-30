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

## Setup

1. **Copy the example config:**
   ```bash
   copy config.example.js config.js
   ```

2. **Edit config.js with your Hue Bridge details:**
   - Find your Bridge IP address
   - Generate an API username (see Philips Hue API documentation)

3. **Open the page:**
   ```
   index.html
   ```

## Hosting as a PWA

To enable PWA features (offline support, installation), you need to serve the app over HTTP/HTTPS:

### Option 1: Using Node.js (Recommended)
```bash
# Install http-server globally (one-time)
npm install -g http-server

# Start the server
http-server -p 8080
```

### Option 2: Using Python
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

### Option 3: Using PHP
```bash
php -S localhost:8080
```

### Installing the PWA

1. Open `http://localhost:8080` in Chrome, Edge, or Safari
2. Look for the install button (⊕ or download icon) in the address bar
3. Click install to add the app to your device
4. The app will work offline once installed

**Note:** The service worker requires a web server to function. Opening `index.html` directly from the filesystem will not enable PWA features.

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

## Technologies

- Vanilla JavaScript
- SVG graphics
- Web Speech API (voice announcements)
- Philips Hue Bridge API
- LocalStorage for 24-hour history
- Service Workers (offline support)
- Web App Manifest (PWA installation)

## Generated with

🤖 Built with [Claude Code](https://claude.com/claude-code)
