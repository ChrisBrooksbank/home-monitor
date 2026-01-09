// Tapo Smart Plug Feature Module
// Dynamically generates controls for all discovered Tapo plugs
// Uses centralized AppState for plug state management

(function() {
    'use strict';

    const CONTAINER_ID = 'tapo-plugs-container';
    const NS = 'http://www.w3.org/2000/svg';

    // Default positions for plugs (can be overridden by saved positions)
    const DEFAULT_POSITIONS = {
        'tree': { x: 800, y: 410 },
        'winter lights': { x: 690, y: 410 },
        'extension plug': { x: 580, y: 410 },
        'bedroom plug': { x: 180, y: 320 },
        'tv plug': { x: 470, y: 520 },
        'office plug 1': { x: 520, y: 320 },
        'office plug 2': { x: 620, y: 320 }
    };

    // Helper to access plug states from AppState
    const getPlugStates = () => (window.AppState ? AppState.get('plugs') : {}) || {};
    const setPlugState = (name, isOn) => {
        if (window.AppState) {
            AppState.set(`plugs.${name}`, isOn);
        }
    };

    /**
     * Create SVG element with attributes
     */
    function createSvgElement(tag, attrs = {}) {
        const el = document.createElementNS(NS, tag);
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, value);
        }
        return el;
    }

    /**
     * Get saved position or default
     */
    function getPosition(plugName) {
        const storageKey = `tapo-${plugName.replace(/\s+/g, '-')}-position`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Check default positions (case insensitive)
        const lowerName = plugName.toLowerCase();
        for (const [key, pos] of Object.entries(DEFAULT_POSITIONS)) {
            if (lowerName.includes(key) || key.includes(lowerName)) {
                return pos;
            }
        }

        // Fallback: stack vertically on the right side
        const plugStates = getPlugStates();
        const index = Object.keys(plugStates).length;
        return { x: 850, y: 150 + (index * 80) };
    }

    /**
     * Save position to localStorage
     */
    function savePosition(plugName, x, y) {
        const storageKey = `tapo-${plugName.replace(/\s+/g, '-')}-position`;
        localStorage.setItem(storageKey, JSON.stringify({ x, y }));
    }

    /**
     * Create a compact pixel-art UK socket plug control
     * Matches cozy UK home aesthetic
     */
    function createPlugControl(plugName, plugInfo) {
        const position = getPosition(plugName);
        const safeId = plugName.replace(/\s+/g, '-').toLowerCase();

        const group = createSvgElement('g', {
            'id': `tapo-${safeId}-controls`,
            'transform': `translate(${position.x}, ${position.y})`,
            'class': 'tapo-plug-control pixel-plug',
            'data-plug-name': plugName
        });

        // Wooden mounting plate (pixel-art style)
        group.appendChild(createSvgElement('rect', {
            'x': '-22', 'y': '-18',
            'width': '44', 'height': '42',
            'rx': '2',
            'fill': '#8B7355',
            'stroke': '#5A4A3A',
            'stroke-width': '1.5'
        }));

        // Highlight on wood
        group.appendChild(createSvgElement('rect', {
            'x': '-21', 'y': '-17',
            'width': '2', 'height': '40',
            'fill': '#A08060',
            'opacity': '0.5',
            'rx': '1'
        }));

        // UK Socket Faceplate (compact)
        group.appendChild(createSvgElement('rect', {
            'x': '-18', 'y': '-14',
            'width': '36', 'height': '34',
            'rx': '2',
            'fill': '#F5F5F0',
            'stroke': '#C8C0B0',
            'stroke-width': '1',
            'class': 'faceplate'
        }));

        // Socket recess
        group.appendChild(createSvgElement('rect', {
            'x': '-14', 'y': '-6',
            'width': '28', 'height': '20',
            'rx': '1',
            'fill': '#E8E0D0'
        }));

        // Socket holes group (compact UK 3-pin)
        const socketHoles = createSvgElement('g', { 'class': 'socket-holes' });

        // Earth pin (top, horizontal)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '-2', 'y': '-4',
            'width': '4', 'height': '6',
            'rx': '0.5',
            'fill': '#2C2C2C'
        }));

        // Live pin (bottom left)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '-10', 'y': '6',
            'width': '4', 'height': '6',
            'rx': '0.5',
            'fill': '#2C2C2C'
        }));

        // Neutral pin (bottom right)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '6', 'y': '6',
            'width': '4', 'height': '6',
            'rx': '0.5',
            'fill': '#2C2C2C'
        }));

        group.appendChild(socketHoles);

        // Power indicator LED
        const led = createSvgElement('circle', {
            'id': `tapo-${safeId}-power-led`,
            'cx': '12', 'cy': '-10',
            'r': '2',
            'fill': '#333',
            'class': 'power-led'
        });
        group.appendChild(led);

        // Toggle switch area
        const toggle = createSvgElement('g', {
            'id': `tapo-${safeId}-toggle`,
            'class': 'tapo-toggle',
            'style': 'cursor: pointer;'
        });

        // Switch background
        toggle.appendChild(createSvgElement('rect', {
            'id': `tapo-${safeId}-toggle-bg`,
            'x': '-12', 'y': '-12',
            'width': '10', 'height': '8',
            'rx': '1',
            'fill': '#666',
            'stroke': '#444',
            'stroke-width': '0.5'
        }));

        // Switch rocker
        const knob = createSvgElement('g', {
            'id': `tapo-${safeId}-toggle-knob`,
            'class': 'toggle-knob'
        });

        knob.appendChild(createSvgElement('rect', {
            'x': '-11', 'y': '-11',
            'width': '8', 'height': '6',
            'rx': '0.5',
            'fill': '#888'
        }));

        toggle.appendChild(knob);
        group.appendChild(toggle);

        // Title below plug
        const title = createSvgElement('text', {
            'x': '0', 'y': '28',
            'text-anchor': 'middle',
            'fill': '#6B4423',
            'font-size': '8',
            'font-weight': '600',
            'font-family': "'Fredoka', sans-serif",
            'class': 'plug-title'
        });
        title.textContent = plugName;
        group.appendChild(title);

        // Hidden status text for updates
        const statusText = createSvgElement('text', {
            'id': `tapo-${safeId}-status-text`,
            'x': '0', 'y': '0',
            'opacity': '0'
        });
        statusText.textContent = '--';
        group.appendChild(statusText);

        // Add click handler for entire plug
        group.addEventListener('click', (e) => {
            if (!e.target.closest('.tapo-toggle')) {
                // Click on plug body also toggles
            }
        });
        toggle.addEventListener('click', () => togglePlug(plugName));

        // Make draggable
        makeDraggable(group, plugName);

        return group;
    }

    /**
     * Make a plug control draggable
     */
    function makeDraggable(element, plugName) {
        let isDragging = false;
        let startX, startY, origX, origY;

        element.style.cursor = 'move';

        element.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on toggle
            if (e.target.closest('.tapo-toggle')) return;

            isDragging = true;
            const transform = element.getAttribute('transform');
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                origX = parseFloat(match[1]);
                origY = parseFloat(match[2]);
            }
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const svg = element.ownerSVGElement;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX - startX;
            pt.y = e.clientY - startY;

            // Convert screen coords to SVG coords
            const ctm = svg.getScreenCTM().inverse();
            const svgPt = pt.matrixTransform(ctm);
            const startPt = svg.createSVGPoint();
            startPt.x = 0;
            startPt.y = 0;
            const svgStartPt = startPt.matrixTransform(ctm);

            const dx = svgPt.x - svgStartPt.x;
            const dy = svgPt.y - svgStartPt.y;

            const newX = origX + dx;
            const newY = origY + dy;

            element.setAttribute('transform', `translate(${newX}, ${newY})`);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                const transform = element.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                    savePosition(plugName, parseFloat(match[1]), parseFloat(match[2]));
                }
            }
        });
    }

    /**
     * Update the visual state of a plug control
     */
    function updatePlugVisual(plugName, isOn) {
        const safeId = plugName.replace(/\s+/g, '-').toLowerCase();

        const toggleBg = document.getElementById(`tapo-${safeId}-toggle-bg`);
        const statusText = document.getElementById(`tapo-${safeId}-status-text`);
        const powerLed = document.getElementById(`tapo-${safeId}-power-led`);
        const knob = document.getElementById(`tapo-${safeId}-toggle-knob`);

        if (!toggleBg) return;

        if (isOn) {
            toggleBg.setAttribute('fill', '#228B22');
            toggleBg.setAttribute('stroke', '#1A6B1A');
            if (statusText) statusText.textContent = 'ON';
            if (powerLed) {
                powerLed.setAttribute('fill', '#00FF00');
                powerLed.setAttribute('opacity', '1');
            }
            if (knob) knob.setAttribute('transform', 'rotate(-5)');
        } else {
            toggleBg.setAttribute('fill', '#8B4513');
            toggleBg.setAttribute('stroke', '#6B3410');
            if (statusText) statusText.textContent = 'OFF';
            if (powerLed) {
                powerLed.setAttribute('fill', '#4A3728');
                powerLed.setAttribute('opacity', '0.6');
            }
            if (knob) knob.setAttribute('transform', 'rotate(5)');
        }

        // Update centralized state
        setPlugState(plugName, isOn);
    }

    /**
     * Toggle a plug on/off
     */
    async function togglePlug(plugName) {
        const plugStates = getPlugStates();
        const currentState = plugStates[plugName];
        const newState = !currentState;

        // Optimistic UI update
        updatePlugVisual(plugName, newState);

        try {
            if (currentState) {
                await TapoAPI.turnOff(plugName);
            } else {
                await TapoAPI.turnOn(plugName);
            }

            // Emit event on successful toggle
            if (window.AppEvents) {
                AppEvents.emit('tapo:toggled', {
                    plug: plugName,
                    on: newState,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            // Revert on error
            Logger.error(`Failed to toggle ${plugName}:`, error);
            updatePlugVisual(plugName, currentState);
        }
    }

    /**
     * Fetch status for all plugs
     */
    async function refreshAllStatuses() {
        const plugStates = getPlugStates();
        for (const plugName of Object.keys(plugStates)) {
            try {
                const status = await TapoAPI.getStatus(plugName);
                if (status) {
                    const isOn = status.state === 'on' || status.device_on === true;
                    updatePlugVisual(plugName, isOn);
                }
            } catch (error) {
                Logger.error(`Failed to get status for ${plugName}:`, error);
            }
        }
    }

    /**
     * Initialize Tapo controls
     */
    async function init() {
        Logger.info('Initializing Tapo plug controls...');

        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
            Logger.error('Tapo plugs container not found');
            return;
        }

        // Check if proxy is available with retry
        // Proxy may take a moment to respond on page load
        let available = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            available = await TapoAPI.checkAvailability();
            if (available) break;
            if (attempt < 3) {
                Logger.info(`Tapo proxy check attempt ${attempt} failed, retrying in 500ms...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (!available) {
            Logger.warn('Tapo proxy not available after retries - controls disabled');
            return;
        }

        // Fetch discovered plugs from proxy (retry if discovery still running)
        let plugs = {};
        try {
            for (let attempt = 1; attempt <= 5; attempt++) {
                const response = await TapoAPI.getPlugs();
                plugs = response.plugs || {};

                if (Object.keys(plugs).length > 0) {
                    break;
                }

                if (attempt < 5) {
                    Logger.info(`No plugs found yet (attempt ${attempt}/5), waiting for discovery...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            if (Object.keys(plugs).length === 0) {
                Logger.warn('No Tapo plugs discovered after retries');
                return;
            }

            Logger.info(`Found ${Object.keys(plugs).length} Tapo plugs`);

            // Clear container
            container.innerHTML = '';

            // Create controls for each plug
            for (const [name, info] of Object.entries(plugs)) {
                setPlugState(name, false); // Initialize state in AppState
                const control = createPlugControl(name, info);
                container.appendChild(control);
            }

            // Fetch initial status for all plugs
            await refreshAllStatuses();

            // Set up periodic status refresh
            if (typeof IntervalManager !== 'undefined') {
                IntervalManager.register(refreshAllStatuses, APP_CONFIG.intervals.tapoStatus);
            } else {
                setInterval(refreshAllStatuses, APP_CONFIG.intervals.tapoStatus || 30000);
            }

            Logger.success(`Tapo controls initialized for ${Object.keys(plugs).length} plugs`);

        } catch (error) {
            Logger.error('Failed to initialize Tapo controls:', error);
        }
    }

    // Expose to window
    window.TapoControls = {
        init,
        refreshAllStatuses,
        togglePlug
    };

    // NOTE: Auto-initialization removed - app.js now calls TapoControls.init()
    // This ensures proper initialization order and avoids race conditions

})();
