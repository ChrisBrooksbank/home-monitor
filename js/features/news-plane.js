/**
 * News Plane Module
 * Animated plane with banner displaying news headlines
 *
 * Subscribes to AppEvents 'app:ready' for automatic initialization.
 */

// Plane configuration
const PLANE_CONFIG = {
    MIN_INTERVAL: 10 * 60 * 1000,      // 10 minutes
    MAX_INTERVAL: 15 * 60 * 1000,      // 15 minutes
    FLIGHT_DURATION: 18000,             // 18 seconds to cross screen
    PROXY_URL: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.proxies?.news) || 'http://localhost:3002',
    DEBUG_MODE: false,                  // Set to true for 30-60 sec intervals
    MAX_HEADLINE_LENGTH: 55             // Truncate headlines longer than this
};

// Plane state
let planeState = {
    isActive: false,
    currentHeadline: null,
    currentLink: null,
    nextFlightTime: null,
    currentTimeout: null
};

/**
 * Fetch a random headline from the news proxy
 */
async function fetchHeadline() {
    try {
        const response = await fetch(`${PLANE_CONFIG.PROXY_URL}/random`, {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        Logger.warn('News plane: Failed to fetch headline:', error.message);
        return null;
    }
}

/**
 * Truncate headline to fit on banner
 */
function truncateHeadline(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create the SVG plane with banner
 */
function createPlaneSVG(headline) {
    const container = document.createElement('div');
    container.className = 'news-plane';
    container.id = 'active-news-plane';

    // Calculate banner width based on headline length
    const charWidth = 7;
    const padding = 20;
    const bannerWidth = Math.min(300, headline.length * charWidth + padding);

    container.innerHTML = `
        <svg width="380" height="80" viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
            <!-- Plane body -->
            <g class="plane-body" transform="translate(280, 10)">
                <!-- Fuselage -->
                <rect x="0" y="15" width="55" height="18" fill="#C0C0C0" rx="4"/>
                <!-- Cockpit window -->
                <rect x="45" y="13" width="12" height="10" fill="#87CEEB" rx="2"/>
                <!-- Top wing -->
                <rect x="15" y="5" width="25" height="10" fill="#A0A0A0" rx="2"/>
                <!-- Bottom wing -->
                <rect x="15" y="33" width="25" height="10" fill="#A0A0A0" rx="2"/>
                <!-- Tail fin -->
                <polygon points="0,15 0,33 -8,24" fill="#A0A0A0"/>
                <!-- Tail wing -->
                <rect x="-5" y="8" width="12" height="6" fill="#909090" rx="1"/>
                <!-- Propeller hub -->
                <circle cx="58" cy="24" r="4" fill="#666"/>
                <!-- Propeller -->
                <g class="propeller" transform="translate(58, 24)">
                    <rect x="-2" y="-12" width="4" height="24" fill="#444" rx="1"/>
                </g>
                <!-- Wheel struts -->
                <line x1="20" y1="43" x2="20" y2="50" stroke="#666" stroke-width="2"/>
                <line x1="40" y1="43" x2="40" y2="50" stroke="#666" stroke-width="2"/>
                <!-- Wheels -->
                <circle cx="20" cy="52" r="4" fill="#333"/>
                <circle cx="40" cy="52" r="4" fill="#333"/>
            </g>

            <!-- Tow rope -->
            <path d="M 280 34 Q 250 45 220 50" stroke="#8B4513" stroke-width="2" fill="none"/>

            <!-- Banner -->
            <g class="banner-group" transform="translate(10, 35)">
                <rect class="plane-banner" x="0" y="0" width="${bannerWidth}" height="35"
                      fill="#F5F5DC" stroke="#8B4513" stroke-width="2" rx="4"/>
                <text x="${bannerWidth / 2}" y="23" text-anchor="middle"
                      font-family="Fredoka, sans-serif" font-size="12" fill="#333">
                    ${escapeHtml(headline)}
                </text>
            </g>
        </svg>
    `;

    return container;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show the plane flying across the screen
 */
async function showPlane() {
    if (planeState.isActive) return;

    // Check if news layer is visible
    if (window.LayersPanel && !window.LayersPanel.getLayerState('news')) {
        Logger.debug('News plane: Layer is hidden, skipping flight');
        schedulePlaneFlight();
        return;
    }

    // Fetch headline
    const newsItem = await fetchHeadline();
    if (!newsItem) {
        Logger.warn('News plane: No headline available, rescheduling');
        schedulePlaneFlight();
        return;
    }

    const headline = truncateHeadline(newsItem.headline, PLANE_CONFIG.MAX_HEADLINE_LENGTH);
    planeState.currentHeadline = headline;
    planeState.currentLink = newsItem.link;

    Logger.info(`News plane flying: "${headline}"`);

    // Create and add plane to DOM
    const planeElement = createPlaneSVG(headline);

    // Add click handler
    planeElement.addEventListener('click', () => {
        if (planeState.currentLink) {
            window.open(planeState.currentLink, '_blank');
            Logger.info('News plane: Opened article in new tab');
        }
    });

    // Add to body (fixed position)
    document.body.appendChild(planeElement);

    planeState.isActive = true;

    // Remove plane after animation completes
    setTimeout(() => {
        removePlane(planeElement);
    }, PLANE_CONFIG.FLIGHT_DURATION);
}

/**
 * Remove plane and schedule next appearance
 */
function removePlane(element) {
    if (element && element.parentNode) {
        element.remove();
    }

    planeState.isActive = false;
    planeState.currentHeadline = null;
    planeState.currentLink = null;

    Logger.debug('News plane: Flight complete');
    schedulePlaneFlight();
}

/**
 * Schedule next plane flight
 */
function schedulePlaneFlight() {
    const minInterval = PLANE_CONFIG.DEBUG_MODE ? 30 * 1000 : PLANE_CONFIG.MIN_INTERVAL;
    const maxInterval = PLANE_CONFIG.DEBUG_MODE ? 60 * 1000 : PLANE_CONFIG.MAX_INTERVAL;
    const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;

    if (planeState.currentTimeout) {
        clearTimeout(planeState.currentTimeout);
    }

    planeState.currentTimeout = setTimeout(showPlane, randomInterval);
    planeState.nextFlightTime = Date.now() + randomInterval;
    localStorage.setItem('planeNextFlight', planeState.nextFlightTime);

    const minutes = Math.round(randomInterval / 60000);
    Logger.debug(`News plane: Next flight in ~${minutes} minutes`);
}

/**
 * Handle visibility change (pause/resume)
 */
function handleVisibilityChange() {
    if (document.hidden) {
        if (planeState.currentTimeout) {
            clearTimeout(planeState.currentTimeout);
            localStorage.setItem('planeNextFlight', planeState.nextFlightTime);
        }
    } else {
        const savedTime = localStorage.getItem('planeNextFlight');
        if (savedTime && !planeState.isActive) {
            const timeRemaining = parseInt(savedTime) - Date.now();
            if (timeRemaining > 0) {
                planeState.currentTimeout = setTimeout(showPlane, timeRemaining);
            } else {
                schedulePlaneFlight();
            }
        }
    }
}

/**
 * Initialize plane system
 */
function initPlaneSystem(debugMode = false) {
    PLANE_CONFIG.DEBUG_MODE = debugMode;

    Logger.info('News plane system initialized!');
    Logger.info(`Debug mode: ${debugMode ? 'ON (30-60 sec)' : 'OFF (10-15 min)'}`);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedulePlaneFlight();
}

/**
 * Get current plane state
 */
function getPlaneState() {
    return { ...planeState };
}

// Expose to window for script tag usage
window.PlaneSystem = {
    init: initPlaneSystem,
    show: showPlane,
    getState: getPlaneState,
    config: PLANE_CONFIG
};

// Subscribe to app:ready event for automatic initialization
if (window.AppEvents) {
    AppEvents.on('app:ready', () => {
        const debugMode = window.APP_CONFIG?.debug || PLANE_CONFIG.DEBUG_MODE;
        initPlaneSystem(debugMode);
        Logger.info(`News plane auto-initialized via app:ready event (debug: ${debugMode})`);
    });
}
