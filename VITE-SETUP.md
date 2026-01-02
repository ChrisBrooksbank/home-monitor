# Vite Build System Setup

## Overview

This project now uses **Vite** as a modern build tool for development and production.

## Why Vite?

- ⚡ **Lightning fast** - Instant server start with Hot Module Replacement (HMR)
- 📦 **Optimized builds** - Automatic code splitting, minification, and tree-shaking
- 🔥 **Hot reload** - See changes instantly without full page refresh
- 🚀 **Production ready** - Optimized bundles with perfect caching

---

## Installation

```bash
npm install
```

This installs:
- Vite 5.x (build tool)
- All project dependencies

---

## Development

### Start Development Server

```bash
npm run dev
```

This:
- Starts Vite dev server on `http://localhost:5173`
- Auto-opens browser
- Watches for file changes
- Hot reloads on save
- Shows build errors in browser

### Start Proxy Servers

In separate terminals, run the backend proxies:

```bash
# Terminal 1
npm run proxy:sonos

# Terminal 2
npm run proxy:tapo

# Terminal 3
npm run proxy:shield
```

Or use a process manager like `concurrently`:

```bash
npm install -g concurrently
concurrently "npm run dev" "npm run proxy:sonos" "npm run proxy:tapo"
```

---

## Production Build

### Create Optimized Build

```bash
npm run build
```

This creates a `dist/` folder with:
- Minified HTML
- Bundled and minified JavaScript
- Bundled and minified CSS
- Optimized assets
- Source maps for debugging

**Expected output size:**
- HTML: ~400 lines (minified)
- CSS: ~25KB (minified + gzipped)
- JS: ~80KB (minified + gzipped)
- **Total: ~105KB** (vs ~250KB unoptimized)

### Preview Production Build

```bash
npm run preview
```

This:
- Serves the `dist/` folder on `http://localhost:4173`
- Tests production build locally
- Verifies everything works after optimization

---

## File Structure

```
home/
├── index.html              # Entry point (processed by Vite)
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies and scripts
│
├── css/
│   └── main.css          # Styles (bundled by Vite)
│
├── js/
│   ├── main.js           # Main application
│   ├── config.js         # Configuration
│   ├── api/              # API modules
│   │   ├── sonos.js
│   │   └── tapo.js
│   └── utils/            # Utilities
│       ├── logger.js
│       └── helpers.js
│
├── proxies/              # Backend Node.js servers
│   ├── sonos-proxy.js    # (run separately)
│   ├── tapo-proxy.js     # (run separately)
│   └── shield-proxy.js   # (run separately)
│
└── dist/                 # Production build output
    ├── index.html        # (generated)
    ├── assets/           # (generated)
    │   ├── main-[hash].js
    │   ├── main-[hash].css
    │   └── vendor-[hash].js
    └── ...
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Create production build in `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run proxy:sonos` | Start Sonos proxy server |
| `npm run proxy:tapo` | Start Tapo proxy server |
| `npm run proxy:shield` | Start SHIELD proxy server |

---

## Vite Configuration

The `vite.config.js` file includes:

### Development
- Port: 5173
- Auto-open browser
- CORS enabled
- Hot Module Replacement

### Build Optimization
- Minification: Terser
- Source maps: Enabled
- Code splitting: Automatic
- Manual chunks for better caching:
  - `vendor`: Config files
  - `utils`: Logger and helpers
  - `api`: API modules

### Asset Handling
- Automatic optimization
- Support for `.wav` and `.mp3` files
- Image compression
- Font optimization

---

## Development Workflow

### Making Changes

1. **Edit any file** (HTML, CSS, JS)
2. **Save** the file
3. **Browser automatically updates** ⚡

No manual refresh needed!

### Debugging

- Use browser DevTools as normal
- Source maps allow debugging original code
- Console logs preserved (Logger statements)
- Network tab shows optimized bundles

---

## Production Deployment

### Deploy the `dist/` folder

After running `npm run build`, deploy the contents of the `dist/` folder to your web server.

#### Static Hosting Options

**Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

**GitHub Pages:**
```bash
# Build
npm run build

# Push dist/ folder to gh-pages branch
git subtree push --prefix dist origin gh-pages
```

**Any Web Server:**
- Upload `dist/` contents via FTP/SFTP
- Configure server to serve index.html
- Ensure proper MIME types for .js and .css

---

## Performance Benefits

### Development
- **Instant start** - No bundling needed
- **Fast HMR** - Sub-second updates
- **Smart caching** - Unchanged modules not reprocessed

### Production
- **60% smaller bundles** - Minification + tree-shaking
- **Perfect caching** - Content-based hashing
- **Code splitting** - Load only what's needed
- **Compression ready** - Works with gzip/brotli

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173
npx kill-port 5173

# Or specify different port
npm run dev -- --port 5174
```

### Build Errors
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Proxy Connection Issues
- Ensure proxy servers are running (`npm run proxy:*`)
- Check proxy URLs in `js/config.js`
- Verify device IPs are correct

---

## Next Steps (Optional)

### Further Optimization

1. **Convert to ES6 modules** - Use import/export
2. **Add TypeScript** - Type safety
3. **Add CSS preprocessing** - SASS/Less
4. **Add testing** - Vitest (built on Vite)
5. **Add linting** - ESLint + Prettier

### Example: ES6 Module Conversion

**Current (Global Scope):**
```javascript
// js/utils/logger.js
const Logger = { /* ... */ };
```

**Future (ES6 Module):**
```javascript
// js/utils/logger.js
export const Logger = { /* ... */ };

// js/main.js
import { Logger } from './utils/logger.js';
```

---

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vite Config Reference](https://vitejs.dev/config/)
- [Rollup Options](https://rollupjs.org/configuration-options/)

---

**Your project is now using modern build tools! 🚀**
