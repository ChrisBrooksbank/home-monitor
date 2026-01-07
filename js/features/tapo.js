// Tapo Smart Plug Feature Module
// Dynamically generates controls for all discovered Tapo plugs

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
        'office plug 1': { x: 520, y: 320 }
    };

    // Track plug states
    let plugStates = {};

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
     * Create a UK socket plug control SVG
     */
    function createPlugControl(plugName, plugInfo) {
        const position = getPosition(plugName);
        const safeId = plugName.replace(/\s+/g, '-').toLowerCase();

        const group = createSvgElement('g', {
            'id': `tapo-${safeId}-controls`,
            'transform': `translate(${position.x}, ${position.y})`,
            'class': 'tapo-plug-control',
            'data-plug-name': plugName
        });

        // Title
        const title = createSvgElement('text', {
            'x': '0', 'y': '-32',
            'text-anchor': 'middle',
            'fill': '#ECF0F1',
            'font-size': '7',
            'font-weight': 'bold',
            'class': 'plug-title'
        });
        title.textContent = plugName.toUpperCase();
        group.appendChild(title);

        // UK Socket Faceplate
        group.appendChild(createSvgElement('rect', {
            'x': '-35', 'y': '-25',
            'width': '70', 'height': '60',
            'rx': '3',
            'fill': '#F5F5F5',
            'stroke': '#D0D0D0',
            'stroke-width': '2',
            'class': 'faceplate'
        }));

        // Socket cutout shadow
        group.appendChild(createSvgElement('rect', {
            'x': '-28', 'y': '-10',
            'width': '56', 'height': '35',
            'rx': '2',
            'fill': '#E0E0E0',
            'opacity': '0.8'
        }));

        // Socket holes group
        const socketHoles = createSvgElement('g', { 'class': 'socket-holes' });

        // Earth pin (top)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '-3', 'y': '-8',
            'width': '6', 'height': '10',
            'rx': '1',
            'fill': '#2C2C2C'
        }));

        // Live pin (bottom left)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '-15', 'y': '8',
            'width': '6', 'height': '10',
            'rx': '1',
            'fill': '#2C2C2C'
        }));

        // Neutral pin (bottom right)
        socketHoles.appendChild(createSvgElement('rect', {
            'x': '9', 'y': '8',
            'width': '6', 'height': '10',
            'rx': '1',
            'fill': '#2C2C2C'
        }));

        group.appendChild(socketHoles);

        // Rocker Switch
        const toggle = createSvgElement('g', {
            'id': `tapo-${safeId}-toggle`,
            'class': 'tapo-toggle',
            'style': 'cursor: pointer;',
            'transform': 'translate(0, -18)'
        });

        // Switch housing
        toggle.appendChild(createSvgElement('rect', {
            'x': '-12', 'y': '-8',
            'width': '24', 'height': '16',
            'rx': '2',
            'fill': '#333',
            'stroke': '#222',
            'stroke-width': '1'
        }));

        // Rocker switch knob
        const knob = createSvgElement('g', {
            'id': `tapo-${safeId}-toggle-knob`,
            'class': 'toggle-knob'
        });

        knob.appendChild(createSvgElement('rect', {
            'id': `tapo-${safeId}-toggle-bg`,
            'x': '-10', 'y': '-6',
            'width': '20', 'height': '12',
            'rx': '1.5',
            'fill': '#666',
            'stroke': '#555',
            'stroke-width': '1'
        }));

        const statusText = createSvgElement('text', {
            'id': `tapo-${safeId}-status-text`,
            'x': '0', 'y': '1.5',
            'text-anchor': 'middle',
            'fill': 'white',
            'font-size': '6',
            'font-weight': 'bold'
        });
        statusText.textContent = '--';
        knob.appendChild(statusText);

        toggle.appendChild(knob);
        group.appendChild(toggle);

        // Power LED
        const led = createSvgElement('circle', {
            'id': `tapo-${safeId}-power-led`,
            'cx': '25', 'cy': '-18',
            'r': '2.5',
            'fill': '#333',
            'opacity': '0.5'
        });
        group.appendChild(led);

        // ON/OFF labels
        const onLabel = createSvgElement('text', {
            'id': `tapo-${safeId}-on-label`,
            'x': '0', 'y': '-24',
            'text-anchor': 'middle',
            'fill': '#666',
            'font-size': '4',
            'font-weight': 'bold',
            'opacity': '0.5'
        });
        onLabel.textContent = 'ON';
        group.appendChild(onLabel);

        const offLabel = createSvgElement('text', {
            'id': `tapo-${safeId}-off-label`,
            'x': '0', 'y': '-12',
            'text-anchor': 'middle',
            'fill': '#666',
            'font-size': '4',
            'font-weight': 'bold',
            'opacity': '0.5'
        });
        offLabel.textContent = 'OFF';
        group.appendChild(offLabel);

        // 13A rating
        const rating = createSvgElement('text', {
            'x': '0', 'y': '32',
            'text-anchor': 'middle',
            'fill': '#999',
            'font-size': '5'
        });
        rating.textContent = '13A';
        group.appendChild(rating);

        // Add click handler for toggle
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
        const onLabel = document.getElementById(`tapo-${safeId}-on-label`);
        const offLabel = document.getElementById(`tapo-${safeId}-off-label`);
        const knob = document.getElementById(`tapo-${safeId}-toggle-knob`);

        if (!toggleBg) return;

        if (isOn) {
            toggleBg.setAttribute('fill', '#00AA00');
            toggleBg.setAttribute('stroke', '#008800');
            statusText.textContent = 'ON';
            powerLed.setAttribute('fill', '#00FF00');
            powerLed.setAttribute('opacity', '1');
            onLabel.setAttribute('opacity', '1');
            offLabel.setAttribute('opacity', '0.3');
            knob.setAttribute('transform', 'rotate(-5)');
        } else {
            toggleBg.setAttribute('fill', '#CC0000');
            toggleBg.setAttribute('stroke', '#AA0000');
            statusText.textContent = 'OFF';
            powerLed.setAttribute('fill', '#333');
            powerLed.setAttribute('opacity', '0.5');
            onLabel.setAttribute('opacity', '0.3');
            offLabel.setAttribute('opacity', '1');
            knob.setAttribute('transform', 'rotate(5)');
        }

        plugStates[plugName] = isOn;
    }

    /**
     * Toggle a plug on/off
     */
    async function togglePlug(plugName) {
        const currentState = plugStates[plugName];

        // Optimistic UI update
        updatePlugVisual(plugName, !currentState);

        try {
            if (currentState) {
                await TapoAPI.turnOff(plugName);
            } else {
                await TapoAPI.turnOn(plugName);
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

        // Fetch discovered plugs from proxy
        try {
            const response = await TapoAPI.getPlugs();
            const plugs = response.plugs || {};

            if (Object.keys(plugs).length === 0) {
                Logger.warn('No Tapo plugs discovered');
                return;
            }

            Logger.info(`Found ${Object.keys(plugs).length} Tapo plugs`);

            // Clear container
            container.innerHTML = '';

            // Create controls for each plug
            for (const [name, info] of Object.entries(plugs)) {
                plugStates[name] = false; // Initialize state
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
