# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart home monitoring dashboard that displays real-time data from Philips Hue sensors, controls Sonos speakers, TP-Link Tapo smart plugs, NVIDIA SHIELD TV, and Google Nest thermostat. Built as a PWA with a pixel art UK house visualization.

## Development Commands

```bash
npm start              # Start Vite dev server + all proxy servers (recommended)
npm run dev            # Vite dev server only (port 5173)
npm run build          # Production build to dist/
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format all files

# Testing
npm test               # Vitest watch mode
npm run test:run       # Run tests once
npm run test:run -- src/api/hue.test.ts  # Run single test file
npm run test:coverage  # Coverage report
npm run test:ui        # Vitest UI

# Code quality
npm run knip           # Find unused code, exports, and dependencies

# Individual proxies
npm run proxy:sonos    # Sonos proxy (port 3000)
npm run proxy:tapo     # Tapo proxy (port 3001)
npm run proxy:shield   # SHIELD proxy (port 8082)
npm run proxy:news     # News proxy (port 3002)
```

## Architecture

### TypeScript with ES Modules

The codebase uses TypeScript with ES module imports/exports. Path aliases are configured:

- `@api/*` → `src/api/*`
- `@core/*` → `src/core/*`
- `@features/*` → `src/features/*`
- `@ui/*` → `src/ui/*`
- `@utils/*` → `src/utils/*`
- `@config/*` → `src/config/*`
- `@types/*` → `src/types/*`

### Source Structure (`src/`)

- `main.ts` - Entry point, bootstraps on DOMContentLoaded
- `app.ts` - Main application (Hue sensors, lights, thermometers, voice)
- `types/index.ts` - All TypeScript interfaces and types
- `core/` - Infrastructure (events, state, poller, connection-monitor, initializer)
- `api/` - API clients (hue, sonos, tapo, shield, hub)
- `features/` - Feature modules (weather, sky, temperature, nest, moose, effects, etc.)
- `ui/` - UI utilities (draggable, color-picker, layers)
- `utils/` - Shared utilities (logger, helpers)
- `config/` - Configuration (constants, mappings, schema, loader)
- `proxies/` - Node.js proxy servers for device APIs without CORS
- `scripts/` - CLI scripts for device discovery and control

### Key Modules

- **AppState** (`core/state.ts`) - Centralized reactive state with `get<T>(key)` and `set(key, value)`
- **AppEvents** (`core/events.ts`) - Event bus for module communication
- **Poller** (`core/poller.ts`) - Manages polling intervals for sensors
- **ConnectionMonitor** (`core/connection-monitor.ts`) - Health checks for all services
- **Logger** (`utils/logger.ts`) - Use `Logger.info()`, `.warn()`, `.error()`, `.success()` instead of console.log

### Configuration

- `APP_CONFIG` in `config/constants.ts` - Proxy URLs, intervals, timeouts
- `config.js` (root, not committed) - Hue Bridge IP/username, Weather API key
- `.env` - Tapo credentials (TAPO_EMAIL, TAPO_PASSWORD)

## Key Patterns

### Importing Modules

```typescript
import { HueAPI } from '@api/hue';
import { Logger } from '@utils/logger';
import { APP_CONFIG } from '@config/constants';
import type { LightInfo, RoomName } from '@types';
```

### Retry Logic

```typescript
import { retryWithBackoff } from '@utils/helpers';
const data = await retryWithBackoff(() => fetchData());
```

### Interval Management

```typescript
import { IntervalManager } from '@utils/helpers';
IntervalManager.register(() => pollSensors(), APP_CONFIG.intervals.lights);
```

### Draggable Elements

```typescript
import { createDraggable } from '@ui/draggable';
createDraggable(element, { storageKey: 'myPosition' });
```

## External Dependencies

- **Philips Hue Bridge** - Direct HTTP API (no proxy needed)
- **Sonos Speakers** - SOAP/UPnP via sonos-proxy
- **TP-Link Tapo Plugs** - tp-link-tapo-connect via tapo-proxy
- **NVIDIA SHIELD** - ADB over TCP via shield-proxy
- **Google Nest Thermostat** - Smart Device Management API (OAuth2)
- **WeatherAPI.com** - Weather data
- **Sunrise-Sunset API** - Day/night transitions

## Environment Setup

1. Copy `config.example.js` to `config.js` and add Hue Bridge credentials
2. Copy `.env.example` to `.env` and add Tapo credentials
3. Run `npm install`
4. Run `npm start`

## Nest Thermostat Setup

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Smart Device Management API**
4. Go to **APIs & Services > Credentials**
5. Create **OAuth 2.0 Client ID** (Web application type)
6. Add authorized redirect URI: `http://localhost:3003/auth/callback`
7. Note your **Client ID** and **Client Secret**

### 2. Smart Device Management Setup

1. Go to [Device Access Console](https://console.nest.google.com/device-access)
2. Create a project (costs $5 one-time fee)
3. Add your OAuth Client ID from step 1
4. Note your **Project ID**

### 3. Configure the App

1. Copy the example config:
    ```bash
    cp nest-config.example.json nest-config.json
    ```
2. Fill in your credentials:
    ```json
    {
        "CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "CLIENT_SECRET": "your-client-secret",
        "PROJECT_ID": "your-sdm-project-id"
    }
    ```

### 4. Authorize

1. Start the app: `npm start`
2. Click the wheelie bin in the UI
3. Click the "Auth" link next to Nest status
4. Complete Google authorization in the popup
5. Tokens are saved automatically

### Refreshing Expired Tokens

Click the "Auth" link in the wheelie bin popup - no CLI needed.
