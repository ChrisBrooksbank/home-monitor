# Quick Start - After Refactoring

## ⚠️ IMPORTANT: First-Time Setup Required

The project has been refactored with improved security. You **must** create a `.env` file before running.

### 1. Create Environment File

```bash
# Copy the template
cp .env.example .env

# Or on Windows
copy .env.example .env
```

### 2. Edit `.env` with Your Credentials

Open `.env` in your text editor and fill in:

```env
# Your Tapo smart plug credentials
TAPO_EMAIL=your-actual-email@example.com
TAPO_PASSWORD=your-actual-password

# Frontend URL (default is correct for development)
FRONTEND_ORIGIN=http://localhost:5173

# Environment
NODE_ENV=development
```

### 3. Start the Application

```bash
npm start
```

This will start:
- ✅ Vite dev server on port 5173
- ✅ Sonos proxy on port 3000
- ✅ Tapo proxy on port 3001
- ✅ SHIELD proxy on port 8082

### 4. Open in Browser

Navigate to: **http://localhost:5173**

---

## 🔧 Common Commands

### Development
```bash
npm start              # Start everything
npm run dev            # Start only Vite (no proxies)
```

### Individual Proxies
```bash
npm run proxy:sonos    # Start Sonos proxy
npm run proxy:tapo     # Start Tapo proxy
npm run proxy:shield   # Start SHIELD proxy
```

### Code Quality
```bash
npm run lint           # Check code quality
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format all code
npm run format:check   # Check formatting
```

### Production
```bash
npm run build          # Build for production
npm run preview        # Preview production build
```

---

## 🏥 Health Checks

Verify proxies are running:

```bash
# Sonos proxy
curl http://localhost:3000/health

# Tapo proxy
curl http://localhost:3001/health

# SHIELD proxy
curl http://localhost:8082/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "tapo-proxy",
  "uptime": 123.45,
  "timestamp": "2025-01-03T12:00:00.000Z"
}
```

---

## 🐛 Troubleshooting

### Error: "TAPO_EMAIL and TAPO_PASSWORD environment variables are required"

**Solution**: You haven't created the `.env` file. Follow step 1 above.

### Error: "Access to fetch blocked by CORS policy"

**Solution**: Check `FRONTEND_ORIGIN` in `.env` matches your frontend URL.

### Proxies won't start

**Solution**:
1. Check ports 3000, 3001, 8082 aren't in use
2. Run `npm install` to ensure dependencies are installed
3. Check `.env` file exists and has valid credentials

### ESLint errors

**Solution**: Run `npm run lint:fix` to auto-fix most issues.

---

## 📖 What Changed?

### Security Improvements ✅
- No more hardcoded credentials
- CORS restricted to your domain only
- Sensitive config in `.env` (never committed to Git)

### Code Quality ✅
- Modular architecture (easier to maintain)
- ESLint + Prettier for consistent code style
- Health check endpoints on all proxies
- Centralized configuration

### Developer Experience ✅
- Better documentation
- Automated linting and formatting
- Named constants instead of magic numbers
- Clear project structure

---

## 📚 More Information

- **REFACTORING.md** - Detailed technical changes
- **IMPLEMENTATION_SUMMARY.md** - Complete implementation report
- **.env.example** - Environment variable template

---

## 🆘 Need Help?

1. Check the documentation files above
2. Verify `.env` file is correctly configured
3. Check health endpoints are responding
4. Review console output for error messages

**Remember**: The `.env` file is required and must contain valid Tapo credentials!
