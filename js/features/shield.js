/**
 * NVIDIA SHIELD TV UI Module
 * Renders TV remote control with app launcher buttons
 */

// App configuration with colors and icons
const SHIELD_APPS = {
    netflix: { name: 'Netflix', color: '#E50914', icon: 'N' },
    youtube: { name: 'YouTube', color: '#FF0000', icon: '▶' },
    plex: { name: 'Plex', color: '#E5A00D', icon: 'P' },
    spotify: { name: 'Spotify', color: '#1DB954', icon: '♫' },
    prime: { name: 'Prime', color: '#00A8E1', icon: 'P' },
    disney: { name: 'Disney+', color: '#113CCF', icon: 'D' },
    twitch: { name: 'Twitch', color: '#9146FF', icon: 'T' },
    hbo: { name: 'HBO', color: '#B066FE', icon: 'H' },
    settings: { name: 'Settings', color: '#607D8B', icon: '⚙' }
};

// State
let shieldAvailable = false;
let shieldInfo = null;

/**
 * Create the SHIELD TV remote control panel
 */
function createShieldPanel() {
    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.id = 'shield-tv-panel';
    group.setAttribute('class', 'shield-tv-control');

    // Panel dimensions
    const panelWidth = 160;
    const panelHeight = 200;
    const buttonSize = 32;
    const buttonSpacing = 42;
    const cols = 3;

    // Build panel HTML
    let buttonsHtml = '';
    const apps = Object.entries(SHIELD_APPS);

    apps.forEach(([id, app], index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = -50 + col * buttonSpacing;
        const y = 30 + row * buttonSpacing;

        buttonsHtml += `
            <g id="shield-btn-${id}" class="shield-app-button" transform="translate(${x}, ${y})" style="cursor: pointer;">
                <rect x="-${buttonSize/2}" y="-${buttonSize/2}" width="${buttonSize}" height="${buttonSize}" rx="6"
                      fill="${app.color}" stroke="#000" stroke-width="1.5" opacity="0.9"/>
                <text x="0" y="5" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${app.icon}</text>
                <title>${app.name}</title>
            </g>
        `;
    });

    group.innerHTML = `
        <!-- Panel Background -->
        <rect x="-${panelWidth/2}" y="-25" width="${panelWidth}" height="${panelHeight}" rx="10"
              fill="#1a1a2e" stroke="#16213e" stroke-width="2" opacity="0.95"/>

        <!-- Title Bar -->
        <rect x="-${panelWidth/2}" y="-25" width="${panelWidth}" height="28" rx="10"
              fill="#16213e" stroke="none"/>
        <rect x="-${panelWidth/2}" y="-10" width="${panelWidth}" height="13"
              fill="#16213e" stroke="none"/>

        <!-- Title -->
        <text x="0" y="-5" text-anchor="middle" fill="#76ff03" font-size="12" font-weight="bold">SHIELD TV</text>

        <!-- Status indicator -->
        <circle id="shield-status-led" cx="${panelWidth/2 - 15}" cy="-11" r="4" fill="#4CAF50"/>

        <!-- App Buttons -->
        ${buttonsHtml}

        <!-- Home Button -->
        <g id="shield-btn-home" class="shield-app-button" transform="translate(0, ${30 + 3 * buttonSpacing})" style="cursor: pointer;">
            <rect x="-50" y="-12" width="100" height="24" rx="12"
                  fill="#37474F" stroke="#546E7A" stroke-width="1.5"/>
            <text x="0" y="5" text-anchor="middle" fill="white" font-size="11" font-weight="bold">🏠 HOME</text>
            <title>Return to Home Screen</title>
        </g>

        <!-- Device Info -->
        <text id="shield-device-name" x="0" y="${panelHeight - 35}" text-anchor="middle" fill="#888" font-size="8">Connecting...</text>
    `;

    return group;
}

/**
 * Setup event handlers for SHIELD buttons
 */
function setupShieldControls() {
    // App buttons
    Object.keys(SHIELD_APPS).forEach(appId => {
        const btn = document.getElementById(`shield-btn-${appId}`);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await launchShieldApp(appId);
            });

            // Hover effects
            btn.addEventListener('mouseenter', () => {
                const rect = btn.querySelector('rect');
                if (rect) rect.setAttribute('opacity', '1');
            });
            btn.addEventListener('mouseleave', () => {
                const rect = btn.querySelector('rect');
                if (rect) rect.setAttribute('opacity', '0.9');
            });
        }
    });

    // Home button
    const homeBtn = document.getElementById('shield-btn-home');
    if (homeBtn) {
        homeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await stopShieldApp();
        });
    }

    // Make panel draggable
    const panel = document.getElementById('shield-tv-panel');
    if (panel && typeof createDraggable === 'function') {
        const storageKey = 'shieldPanelPosition';
        loadSavedPosition(panel, storageKey);
        createDraggable(panel, {
            storageKey: storageKey,
            excludeSelector: '.shield-app-button'
        });
    }
}

/**
 * Launch an app on SHIELD
 */
async function launchShieldApp(appId) {
    const app = SHIELD_APPS[appId];
    if (!app) return;

    // Visual feedback
    const btn = document.getElementById(`shield-btn-${appId}`);
    if (btn) {
        btn.style.opacity = '0.5';
    }

    try {
        await ShieldAPI.launchApp(appId);
        showShieldFeedback(`Launching ${app.name}...`, 'success');
    } catch (error) {
        showShieldFeedback(`Failed: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.style.opacity = '1';
        }
    }
}

/**
 * Stop current app on SHIELD
 */
async function stopShieldApp() {
    const btn = document.getElementById('shield-btn-home');
    if (btn) {
        btn.style.opacity = '0.5';
    }

    try {
        await ShieldAPI.stop();
        showShieldFeedback('Returned home', 'success');
    } catch (error) {
        showShieldFeedback(`Failed: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.style.opacity = '1';
        }
    }
}

/**
 * Show feedback message
 */
function showShieldFeedback(message, type) {
    const nameEl = document.getElementById('shield-device-name');
    if (nameEl) {
        const originalText = nameEl.textContent;
        nameEl.textContent = message;
        nameEl.setAttribute('fill', type === 'success' ? '#4CAF50' : '#f44336');

        setTimeout(() => {
            nameEl.textContent = shieldInfo?.name || 'SHIELD';
            nameEl.setAttribute('fill', '#888');
        }, 2000);
    }
}

/**
 * Update SHIELD status
 */
async function updateShieldStatus() {
    const led = document.getElementById('shield-status-led');
    const nameEl = document.getElementById('shield-device-name');

    try {
        shieldInfo = await ShieldAPI.getInfo();
        shieldAvailable = !!shieldInfo;

        if (led) {
            led.setAttribute('fill', shieldAvailable ? '#4CAF50' : '#f44336');
        }
        if (nameEl && shieldInfo) {
            nameEl.textContent = shieldInfo.name || 'SHIELD';
        }
    } catch (error) {
        shieldAvailable = false;
        if (led) {
            led.setAttribute('fill', '#f44336');
        }
        if (nameEl) {
            nameEl.textContent = 'Offline';
        }
    }
}

/**
 * Render SHIELD controls
 */
async function renderShieldControls() {
    const container = document.getElementById('shield-controls-container');
    if (!container) {
        Logger.warn('SHIELD controls container not found');
        return;
    }

    // Clear existing
    container.innerHTML = '';

    // Create and add panel
    const panel = createShieldPanel();

    // Set initial position (near the TV/lounge area)
    panel.setAttribute('transform', 'translate(600, 520)');

    container.appendChild(panel);

    // Setup event handlers
    setupShieldControls();

    // Get initial status
    await updateShieldStatus();

    Logger.info('SHIELD TV controls rendered');
}

/**
 * Initialize SHIELD UI
 */
async function initShieldUI() {
    // Check if proxy is available
    const available = await ShieldAPI.checkAvailability();
    if (!available) {
        Logger.warn('SHIELD proxy not available - controls disabled');
        return;
    }

    // Render controls
    await renderShieldControls();

    // Poll for status updates every 30 seconds
    if (typeof IntervalManager !== 'undefined') {
        IntervalManager.register(updateShieldStatus, 30000);
    }

    Logger.success('SHIELD UI initialized');
}

// Expose for other scripts
window.ShieldUI = {
    init: initShieldUI,
    render: renderShieldControls,
    launchApp: launchShieldApp,
    stop: stopShieldApp,
    updateStatus: updateShieldStatus
};

// Auto-initialize with consistent timing
(function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 50));
    } else {
        setTimeout(fn, 50);
    }
})(initShieldUI);
