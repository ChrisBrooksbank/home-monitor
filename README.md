# 🏠 Funky Home Temperature Monitor

A real-time, interactive dashboard for monitoring Philips Hue sensors throughout your home.

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

## Generated with

🤖 Built with [Claude Code](https://claude.com/claude-code)
