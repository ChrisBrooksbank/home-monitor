# Home Automation Personalization Guide

This guide explains how to customize this home automation system for your own house.

## Quick Start

All house-specific configuration is located at the **top of `index.html`** in the `HOUSE_CONFIG` object (starting around line 1527).

## Configuration Sections

### 1. House Information

```javascript
address: '28 Barn Green',
```

**What to change:** Your house address or name

---

### 2. Network & Device IPs

```javascript
devices: {
    hueBridge: HUE_CONFIG.BRIDGE_IP,
    hueUsername: HUE_CONFIG.USERNAME,
    googleHub: '192.168.68.62',
    nest: null,  // Set if using Nest integration

    sonos: {
        bedroom: '192.168.68.61',
        office: '192.168.68.75',
        lounge: '192.168.68.64'
    }
}
```

**What to change:**
- `googleHub`: IP address of your Google Home Hub (or set to `null` if not using)
- `nest`: IP or identifier for Nest thermostat
- `sonos`: IP addresses of your Sonos speakers
  - Add/remove rooms as needed
  - Room names here should match the room names in the `rooms` array

**Note:** Hue Bridge IP and username are configured in `config.js`

---

### 3. Room Definitions

```javascript
rooms: [
    'Main Bedroom',
    'Guest Bedroom',
    'Bathroom',
    'Landing',
    'Hall',
    'Home Office',
    'Lounge',
    'Kitchen',
    'Extension',
    'Outdoor'
]
```

**What to change:**
- Add, remove, or rename rooms to match your house layout
- These names are used throughout the application

---

### 4. Light Name Mappings

```javascript
lightMappings: {
    'outdoor|outside|garden': 'Outdoor',
    'guest': 'Guest Bedroom',
    'main bedroom|mainbedroom|^bedroomlight$|^bedroom$': 'Main Bedroom',
    'landing': 'Landing',
    'office': 'Home Office',
    'bathroom|bath': 'Bathroom',
    'lounge': 'Lounge',
    'hall': 'Hall',
    'extension': 'Extension',
    'kitchen': 'Kitchen'
}
```

**How it works:**
- Keys are **regex patterns** that match keywords in your Philips Hue light names
- Values are **room names** from your `rooms` array
- The `|` character means "OR" - so `outdoor|outside|garden` matches any of those words

**What to change:**
1. Look at your Hue light names in the Philips Hue app
2. Update the patterns to match YOUR light naming conventions
3. Make sure room names match your `rooms` array

**Examples:**
- If you have lights named "Kitchen Ceiling", "Kitchen Counter", add: `'kitchen': 'Kitchen'`
- If you have "Master Bedroom Light", add: `'master bedroom|master': 'Master Bedroom'`
- Pattern `^bedroom$` means "exactly bedroom" (nothing before or after)

---

### 5. Motion Sensor Mappings

```javascript
motionSensorMappings: {
    'outdoor|outside|garden': 'Outdoor',
    'hall|frontdoor|front door': 'Hall',
    'landing': 'Landing',
    'bathroom|bath': 'Bathroom'
}
```

**How it works:** Same as light mappings, but for Hue motion sensor names

**What to change:**
1. Check your Hue motion sensor names
2. Update patterns to match your naming
3. Add entries for any additional motion sensors

---

### 6. Temperature Sensor Positions

```javascript
tempSensorPositions: {
    'temp-bedroom': { x: 700, y: 300, isOutdoor: false },
    'temp-office': { x: 515, y: 290, isOutdoor: false },
    'temp-lounge': { x: 400, y: 480, isOutdoor: false },
    'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
}
```

**What to change:**
- These are **SVG coordinates** for displaying temperature icons on your house diagram
- `x` and `y` values position the thermometer on the SVG
- `isOutdoor`: `true` for outdoor sensors, `false` for indoor
- **Note:** If you're not modifying the SVG house diagram, you can leave these as-is

---

## Advanced Customization

### Adding New Sonos Rooms

1. **Add IP to config:**
```javascript
sonos: {
    bedroom: '192.168.68.61',
    office: '192.168.68.75',
    lounge: '192.168.68.64',
    kitchen: '192.168.68.80'  // NEW
}
```

2. **Update SONOS_ROOMS array** (search for `const SONOS_ROOMS` around line 5341):
```javascript
const SONOS_ROOMS = [
    { name: 'bedroom', ip: BEDROOM_SONOS_IP, ... },
    { name: 'office', ip: OFFICE_SONOS_IP, ... },
    { name: 'lounge', ip: LOUNGE_SONOS_IP, ... },
    { name: 'kitchen', ip: KITCHEN_SONOS_IP, ... }  // NEW
];
```

3. **Add SVG controls** in the HTML section for the new room's Sonos panel

---

### Removing Features You Don't Have

**No Google Hub?**
```javascript
googleHub: null,
```
The Hub panel won't display if IP is null.

**No Nest?**
```javascript
nest: null,
```

**Fewer Sonos speakers?**
- Remove entries from the `sonos` object
- Remove corresponding entries from `SONOS_ROOMS` array

---

## Testing Your Changes

1. **Save `index.html`** after making changes
2. **Refresh the page** in your browser
3. **Check the browser console** (F12) for any errors
4. **Verify:**
   - Lights are correctly mapped to rooms
   - Motion sensors work in the right rooms
   - Sonos controls appear and function
   - All IPs are correct

---

## Common Issues

### Lights not showing in the right room
- Check your light names in the Hue app
- Update `lightMappings` patterns to match
- Remember: patterns are case-insensitive regex

### Motion sensors not working
- Verify sensor names in Hue app
- Check `motionSensorMappings` patterns
- Ensure room names match your `rooms` array

### Sonos not connecting
- Verify IP addresses are correct
- Ensure devices are on the same network
- Check that `sonos-proxy.js` is running (if using proxy)

---

## Getting Help

- All configuration is in **one place** - the `HOUSE_CONFIG` object
- Configuration uses **plain JavaScript** - edit like any JavaScript object
- **Comments** in the config explain what each section does
- Check your **browser console** (F12) for error messages

Happy automating! 🏠✨
