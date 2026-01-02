# NVIDIA SHIELD Real Control Setup

This guide will help you set up **real** control of your NVIDIA SHIELD (no simulation).

## Prerequisites

You need:
1. ADB (Android Debug Bridge) installed on your computer
2. Network debugging enabled on your SHIELD

---

## Step 1: Install ADB

### Windows (Recommended - Chocolatey)
```powershell
# Install Chocolatey if you don't have it
# Then install ADB:
choco install adb
```

### Windows (Manual)
1. Download Android Platform Tools from: https://developer.android.com/studio/releases/platform-tools
2. Extract the ZIP file to `C:\platform-tools`
3. Add `C:\platform-tools` to your PATH environment variable
4. Restart your terminal

### macOS
```bash
brew install android-platform-tools
```

### Linux
```bash
sudo apt-get install android-tools-adb
# or
sudo pacman -S android-tools
```

---

## Step 2: Enable Network Debugging on SHIELD

1. On your SHIELD, go to:
   - **Settings** → **Device Preferences** → **About**
2. Scroll down to **Build** and click it **7 times** (this enables Developer Options)
3. Go back to **Device Preferences** → **Developer Options**
4. Enable:
   - ✅ **USB debugging**
   - ✅ **Network debugging**
5. Note the IP address shown (should be `192.168.68.63`)

---

## Step 3: Connect via ADB

Open a terminal and run:

```bash
# Connect to your SHIELD
adb connect 192.168.68.63:5555

# You should see: "connected to 192.168.68.63:5555"
```

**First time:** A popup will appear on your SHIELD TV asking to allow the connection. Select **"Always allow"** and click **OK**.

---

## Step 4: Test Connection

```bash
# Check connected devices
adb devices

# Should show:
# 192.168.68.63:5555   device
```

If you see "unauthorized", approve the connection on your TV.

---

## Step 5: Test App Launching

```bash
# Launch YouTube
node shield-control.js launch youtube

# Launch Netflix
node shield-control.js launch netflix

# Go to home screen
node shield-control.js stop
```

If this works, **you're all set!** 🎉

---

## Step 6: Restart the Proxy Server

Kill the old simulated proxy and start the real one:

```bash
# The proxy server will automatically use the updated code
# Just restart it:
# 1. Stop the current one (Ctrl+C or kill the process)
# 2. Start fresh:
node shield-proxy.js
```

---

## Troubleshooting

### "adb: command not found"
- ADB is not installed or not in your PATH
- Follow Step 1 again

### "unable to connect to 192.168.68.63:5555"
- Network debugging is not enabled on SHIELD
- Follow Step 2 again
- Make sure SHIELD and computer are on the same network

### "device unauthorized"
- Check your SHIELD TV screen for authorization popup
- Select "Always allow" and click OK
- Run `adb connect 192.168.68.63:5555` again

### App doesn't launch
- Some apps might use different activity names
- Check the app package name: `adb shell pm list packages | grep <app-name>`
- Update the component in shield-control.js

---

## Available Apps

Once set up, you can launch:
- Netflix
- YouTube
- Plex
- Spotify
- Amazon Prime Video
- Disney+
- Twitch
- HBO
- Settings

---

## Usage After Setup

**Web UI:** Just click the app buttons in your home automation dashboard

**Command Line:**
```bash
node shield-control.js launch netflix
node shield-control.js info
node shield-control.js stop
```

**HTTP API:**
```bash
curl -X POST http://localhost:8082/launch -H "X-App-Name: youtube"
```
