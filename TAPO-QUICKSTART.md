# Tapo P105 Quick Start Guide

## Step-by-Step Setup

### 1. Install the Package

```bash
npm install tp-link-tapo-connect
```

### 2. Configure Your Plugs

Edit `tapo-control.js` and update:

```javascript
const TAPO_EMAIL = 'your-email@example.com';     // Your Tapo app login
const TAPO_PASSWORD = 'your-password';            // Your Tapo app password

const PLUGS = {
    'office-lamp': '192.168.68.70',               // Update with your plug IPs
    'bedroom-fan': '192.168.68.71',
};
```

### 3. Find Your Plug IP Addresses

**Option A: Run the probe script**
```bash
node probe-smart-plugs.js
```

**Option B: Check your router**
- Log into your router admin panel
- Look for "Connected Devices" or "DHCP Clients"
- Find devices with TP-Link MAC addresses

**Option C: Use Tapo app**
- Open Tapo app → Select your plug
- Tap settings (gear icon)
- Look for "Device Info" or "Network"

### 4. Test Your Setup

```bash
# Show available commands
node tapo-control.js

# Get status of a plug
node tapo-control.js status office-lamp

# Turn a plug on
node tapo-control.js on office-lamp

# Turn a plug off
node tapo-control.js off office-lamp

# Toggle a plug
node tapo-control.js toggle office-lamp

# Check all plugs
node tapo-control.js status all
```

## Example Usage in Your Code

```javascript
const tapo = require('./tapo-control.js');

// Turn on a plug
await tapo.turnOn('office-lamp');

// Turn off a plug
await tapo.turnOff('bedroom-fan');

// Toggle a plug
await tapo.toggle('office-lamp');

// Get status
const status = await tapo.getStatus('office-lamp');
console.log(`Plug is ${status.state}`);

// Get all statuses
const allStatus = await tapo.getAllStatus();
```

## Assign Static IPs (Recommended)

To prevent IP addresses from changing:

1. Log into your router
2. Find the DHCP or LAN settings
3. Reserve/assign static IPs for your Tapo plugs using their MAC addresses
4. Suggested IP range: 192.168.68.70-79 for smart plugs

## Integrate with Your Home Dashboard

To add Tapo controls to `index.html`:

```javascript
// Import the tapo control module
const tapo = require('./tapo-control.js');

// Add button handlers
async function toggleOfficeLamp() {
    await tapo.toggle('office-lamp');
}
```

## Troubleshooting

### "Cannot find module 'tp-link-tapo-connect'"
Run: `npm install tp-link-tapo-connect`

### "Authentication failed"
- Double-check email and password in `tapo-control.js`
- Ensure you can log into Tapo app with same credentials

### "Device not responding"
- Verify plug is powered on
- Check IP address is correct
- Ensure plug is connected to WiFi (LED should be solid, not blinking)
- Try pinging the IP: `ping 192.168.68.70`

### "Connection timeout"
- Plug might have changed IP address
- Check router for current IP
- Assign static IP to prevent this

## Next Steps

1. **Test with one plug first** before configuring multiple
2. **Assign static IPs** to all your plugs
3. **Update the PLUGS object** in tapo-control.js with your actual devices
4. **Integrate into your home dashboard** (index.html)

## Security Note

The `tapo-control.js` file contains your Tapo credentials. Options:

1. **Use environment variables** (recommended):
   ```javascript
   const TAPO_EMAIL = process.env.TAPO_EMAIL;
   const TAPO_PASSWORD = process.env.TAPO_PASSWORD;
   ```

2. **Create a separate config file** and add it to `.gitignore`

3. **Keep the file local** and don't commit credentials to version control
