# Tapo P105 Smart Plug Setup Guide

## Installation Steps

### 1. Install Required Package

```bash
npm install tp-link-tapo-connect
```

### 2. Get Your Tapo Account Credentials

You'll need:
- Your Tapo app email
- Your Tapo app password
- The IP address of your P105 plug

### 3. Find Your Plug's IP Address

**Option A: Check your router's DHCP client list**

**Option B: Use the Tapo app**
- Open device settings
- Look for network information

**Option C: Use the probe script** (already in your codebase)
```bash
node probe-smart-plugs.js
```

## Configuration

The Tapo P105 uses:
- **Port**: Not required (uses HTTP/HTTPS directly)
- **Protocol**: Tapo Cloud API
- **Authentication**: Email + Password

## Assign Static IP (Recommended)

In your router, assign static IPs to your Tapo plugs:
- Example: 192.168.68.70, 192.168.68.71, etc.

This prevents IP changes and makes automation more reliable.

## Control Methods

### Method 1: Cloud API (Recommended)
- Requires internet connection
- Works from anywhere
- More reliable

### Method 2: Local API
- No internet required
- Faster response
- Requires device handshake

## Troubleshooting

### "Device not responding"
- Check if plug is on same WiFi network
- Verify IP address hasn't changed
- Ensure Tapo app can control it

### "Authentication failed"
- Verify email/password are correct
- Check if 2FA is enabled (may need app password)

### "Connection timeout"
- Check firewall settings
- Ensure device is powered on
- Verify network connectivity
