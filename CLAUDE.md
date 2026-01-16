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

1. Create a Google Cloud project and enable Smart Device Management API
2. Create OAuth2 credentials (Web application type)
3. Create `nest-config.json`:
    ```json
    {
        "CLIENT_ID": "your-client-id",
        "CLIENT_SECRET": "your-client-secret",
        "PROJECT_ID": "your-sdm-project-id",
        "REDIRECT_URI": "http://localhost:8080/auth/callback"
    }
    ```
4. Run `npx tsx src/scripts/setup/nest-auth.ts` to authorize

### Refreshing Expired Tokens

```bash
npx tsx src/scripts/setup/nest-auth.ts
```
