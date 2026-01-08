/**
 * Moose Character System Module
 * Handles the animated moose character that appears periodically
 *
 * Subscribes to AppEvents 'app:ready' for automatic initialization.
 */

// Moose configuration
const MOOSE_CONFIG = {
    MIN_INTERVAL: 10 * 60 * 1000,      // 10 minutes
    MAX_INTERVAL: 20 * 60 * 1000,      // 20 minutes
    ENABLE_NIGHT_ACTIVITIES: true,
    ENABLE_EFFECTS: true,
    WALK_IN_DURATION: 2000,
    WALK_OUT_DURATION: 2000,
    DEBUG_MODE: false                   // Set to true for 30-60 sec intervals
};

// Moose locations on the SVG
const mooseLocations = {
    garden: {
        tree: { x: 40, y: 480 },
        lamppost: { x: 110, y: 520 },
        flowers: { x: 720, y: 510 }
    },
    house: {
        frontDoor: { x: 160, y: 480 },
        window1: { x: 300, y: 380 },
        window2: { x: 500, y: 380 },
        window3: { x: 720, y: 380 },
        gardenEdge: { x: 80, y: 520 }
    }
};

// Available activities
const mooseActivities = [
    { name: 'cleaningWindows', locations: ['house.window1', 'house.window2', 'house.window3'], duration: 20000, emoji: '🧽' },
    { name: 'mowingLawn', locations: ['house.gardenEdge'], duration: 25000, emoji: '🌱' },
    { name: 'wateringPlants', locations: ['garden.flowers'], duration: 18000, emoji: '💧' },
    { name: 'havingPicnic', locations: ['garden.tree'], duration: 30000, emoji: '🧺' },
    { name: 'readingNewspaper', locations: ['garden.lamppost'], duration: 22000, emoji: '📰' },
    { name: 'paintingHouse', locations: ['house.frontDoor'], duration: 25000, emoji: '🎨' },
    { name: 'starGazing', locations: ['garden.tree'], duration: 35000, nightOnly: true, emoji: '🔭' }
];

// Moose state
let mooseState = {
    isActive: false,
    currentActivity: null,
    nextAppearanceTime: null,
    currentTimeout: null
};

/**
 * Create moose character SVG
 * @param {string} activityName - Name of the activity
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {SVGElement} - Moose SVG group element
 */
function createMooseCharacter(activityName, x, y) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const mooseGroup = document.createElementNS(svgNS, 'g');
    mooseGroup.setAttribute('id', 'active-moose');
    mooseGroup.setAttribute('transform', `translate(${x}, ${y})`);

    // Antlers
    createAntlers(mooseGroup, svgNS);

    // Head
    const head = document.createElementNS(svgNS, 'rect');
    head.setAttribute('x', '12');
    head.setAttribute('y', '8');
    head.setAttribute('width', '24');
    head.setAttribute('height', '24');
    head.setAttribute('fill', '#8B4513');
    mooseGroup.appendChild(head);

    // Eyes
    const eyeLeft = document.createElementNS(svgNS, 'circle');
    eyeLeft.setAttribute('cx', '18');
    eyeLeft.setAttribute('cy', '18');
    eyeLeft.setAttribute('r', '3');
    eyeLeft.setAttribute('fill', '#000');
    mooseGroup.appendChild(eyeLeft);

    const eyeRight = document.createElementNS(svgNS, 'circle');
    eyeRight.setAttribute('cx', '30');
    eyeRight.setAttribute('cy', '18');
    eyeRight.setAttribute('r', '3');
    eyeRight.setAttribute('fill', '#000');
    mooseGroup.appendChild(eyeRight);

    // Snout
    const snout = document.createElementNS(svgNS, 'rect');
    snout.setAttribute('x', '16');
    snout.setAttribute('y', '24');
    snout.setAttribute('width', '16');
    snout.setAttribute('height', '12');
    snout.setAttribute('fill', '#A0522D');
    snout.setAttribute('rx', '4');
    mooseGroup.appendChild(snout);

    // Nose
    const nose = document.createElementNS(svgNS, 'circle');
    nose.setAttribute('cx', '24');
    nose.setAttribute('cy', '30');
    nose.setAttribute('r', '3');
    nose.setAttribute('fill', '#000');
    mooseGroup.appendChild(nose);

    // Body
    const body = document.createElementNS(svgNS, 'rect');
    body.setAttribute('x', '8');
    body.setAttribute('y', '36');
    body.setAttribute('width', '32');
    body.setAttribute('height', '28');
    body.setAttribute('fill', '#8B4513');
    mooseGroup.appendChild(body);

    // Legs
    for (let i = 0; i < 4; i++) {
        const leg = document.createElementNS(svgNS, 'rect');
        leg.setAttribute('x', 12 + (i % 2) * 20);
        leg.setAttribute('y', 64);
        leg.setAttribute('width', '6');
        leg.setAttribute('height', '16');
        leg.setAttribute('fill', '#654321');
        mooseGroup.appendChild(leg);
    }

    // Activity props
    const props = createActivityProps(activityName, svgNS);
    if (props) {
        props.setAttribute('class', 'moose-activity-prop');
        mooseGroup.appendChild(props);
    }

    // Speech bubble
    const bubble = createSpeechBubble(svgNS, activityName);
    mooseGroup.appendChild(bubble);

    return mooseGroup;
}

/**
 * Create antlers for the moose
 */
function createAntlers(group, svgNS) {
    const antlerPositions = [
        { x: 8, y: 0, w: 12, h: 4 },
        { x: 4, y: 4, w: 8, h: 4 },
        { x: 28, y: 0, w: 12, h: 4 },
        { x: 36, y: 4, w: 8, h: 4 }
    ];

    antlerPositions.forEach(pos => {
        const antler = document.createElementNS(svgNS, 'rect');
        antler.setAttribute('x', pos.x);
        antler.setAttribute('y', pos.y);
        antler.setAttribute('width', pos.w);
        antler.setAttribute('height', pos.h);
        antler.setAttribute('fill', '#654321');
        group.appendChild(antler);
    });
}

/**
 * Create activity-specific props
 */
function createActivityProps(activityName, svgNS) {
    const propsGroup = document.createElementNS(svgNS, 'g');

    switch (activityName) {
        case 'cleaningWindows':
            const sponge = document.createElementNS(svgNS, 'rect');
            sponge.setAttribute('x', '44');
            sponge.setAttribute('y', '32');
            sponge.setAttribute('width', '12');
            sponge.setAttribute('height', '8');
            sponge.setAttribute('fill', '#FFD700');
            propsGroup.appendChild(sponge);
            break;

        case 'wateringPlants':
            const can = document.createElementNS(svgNS, 'rect');
            can.setAttribute('x', '44');
            can.setAttribute('y', '36');
            can.setAttribute('width', '16');
            can.setAttribute('height', '12');
            can.setAttribute('fill', '#228B22');
            propsGroup.appendChild(can);
            break;

        case 'mowingLawn':
            const mower = document.createElementNS(svgNS, 'rect');
            mower.setAttribute('x', '44');
            mower.setAttribute('y', '56');
            mower.setAttribute('width', '20');
            mower.setAttribute('height', '12');
            mower.setAttribute('fill', '#FF4500');
            propsGroup.appendChild(mower);
            break;

        case 'readingNewspaper':
            const paper = document.createElementNS(svgNS, 'rect');
            paper.setAttribute('x', '44');
            paper.setAttribute('y', '28');
            paper.setAttribute('width', '16');
            paper.setAttribute('height', '20');
            paper.setAttribute('fill', '#F5F5DC');
            propsGroup.appendChild(paper);
            break;

        case 'paintingHouse':
            const brush = document.createElementNS(svgNS, 'rect');
            brush.setAttribute('x', '44');
            brush.setAttribute('y', '30');
            brush.setAttribute('width', '4');
            brush.setAttribute('height', '24');
            brush.setAttribute('fill', '#8B4513');
            propsGroup.appendChild(brush);
            break;

        case 'starGazing':
            const telescope = document.createElementNS(svgNS, 'rect');
            telescope.setAttribute('x', '54');
            telescope.setAttribute('y', '44');
            telescope.setAttribute('width', '24');
            telescope.setAttribute('height', '6');
            telescope.setAttribute('fill', '#34495E');
            propsGroup.appendChild(telescope);
            break;
    }

    return propsGroup;
}

/**
 * Create speech bubble
 */
function createSpeechBubble(svgNS, activityName) {
    const bubble = document.createElementNS(svgNS, 'g');
    bubble.setAttribute('transform', 'translate(50, -20)');

    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', '60');
    bg.setAttribute('height', '24');
    bg.setAttribute('rx', '8');
    bg.setAttribute('fill', 'white');
    bg.setAttribute('stroke', '#333');
    bubble.appendChild(bg);

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', '30');
    text.setAttribute('y', '17');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', '#333');
    text.textContent = getActivityMessage(activityName);
    bubble.appendChild(text);

    return bubble;
}

/**
 * Get activity-specific message
 */
function getActivityMessage(activityName) {
    const messages = {
        'cleaningWindows': 'Sparkly!',
        'mowingLawn': 'Bzzz!',
        'wateringPlants': 'Splash!',
        'havingPicnic': 'Yummy!',
        'readingNewspaper': 'Hmm...',
        'paintingHouse': 'Nice!',
        'starGazing': 'Wow!'
    };
    return messages[activityName] || 'Hi!';
}

/**
 * Show moose with random activity
 */
function showMoose() {
    if (mooseState.isActive) return;

    const activity = selectRandomActivity();
    if (!activity) {
        scheduleMooseAppearance();
        return;
    }

    const locationKey = activity.locations[Math.floor(Math.random() * activity.locations.length)];
    const [category, place] = locationKey.split('.');
    const location = mooseLocations[category][place];

    Logger.info(`Moose appearing! Activity: ${activity.name}`);
    announceMoose();

    const mooseElement = createMooseCharacter(activity.name, location.x, location.y);
    const container = document.getElementById('moose-container');
    if (container) {
        container.appendChild(mooseElement);
    }

    mooseState.isActive = true;
    mooseState.currentActivity = activity.name;

    mooseElement.style.animation = `moose-walk-in ${MOOSE_CONFIG.WALK_IN_DURATION}ms ease-out`;

    setTimeout(() => {
        startActivityAnimation(mooseElement, activity.name);
    }, MOOSE_CONFIG.WALK_IN_DURATION);

    setTimeout(() => {
        removeMoose(mooseElement);
    }, activity.duration);
}

/**
 * Select a random activity (considering time of day)
 */
function selectRandomActivity() {
    const sun = document.getElementById('sun');
    const isNight = sun && sun.style.display === 'none';

    let available = mooseActivities.filter(a =>
        !a.nightOnly || (a.nightOnly && isNight)
    );

    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

/**
 * Start activity animation
 */
function startActivityAnimation(element, activityName) {
    element.style.animation = 'moose-bob 2s ease-in-out infinite';

    const activityElement = element.querySelector('.moose-activity-prop');
    if (activityElement) {
        const animations = {
            'cleaningWindows': 'window-clean 2s ease-in-out infinite',
            'wateringPlants': 'water-pour 2s ease-in-out infinite',
            'mowingLawn': 'mow-forward 8s linear',
            'readingNewspaper': 'read-newspaper 3s ease-in-out infinite',
            'paintingHouse': 'paint-brush 1.5s ease-in-out infinite',
            'starGazing': 'telescope-pan 4s ease-in-out alternate infinite'
        };

        if (animations[activityName]) {
            activityElement.style.animation = animations[activityName];
        }
    }
}

/**
 * Remove moose and schedule next appearance
 */
function removeMoose(element) {
    element.style.animation = `moose-walk-out ${MOOSE_CONFIG.WALK_OUT_DURATION}ms ease-in`;

    setTimeout(() => {
        element.remove();
        mooseState.isActive = false;
        mooseState.currentActivity = null;
        Logger.info('Moose left!');
        scheduleMooseAppearance();
    }, MOOSE_CONFIG.WALK_OUT_DURATION);
}

/**
 * Schedule next moose appearance
 */
function scheduleMooseAppearance() {
    const minInterval = MOOSE_CONFIG.DEBUG_MODE ? 30 * 1000 : MOOSE_CONFIG.MIN_INTERVAL;
    const maxInterval = MOOSE_CONFIG.DEBUG_MODE ? 60 * 1000 : MOOSE_CONFIG.MAX_INTERVAL;
    const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;

    mooseState.currentTimeout = setTimeout(showMoose, randomInterval);
    mooseState.nextAppearanceTime = Date.now() + randomInterval;
    localStorage.setItem('mooseNextAppearance', mooseState.nextAppearanceTime);

    const minutes = Math.round(randomInterval / 60000);
    Logger.info(`Next moose appearance in ~${minutes} minutes`);
}

/**
 * Announce moose arrival with speech
 */
function announceMoose() {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = "It's me, Monty!";
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = 0.8;
        speechSynthesis.speak(utterance);
    }
}

/**
 * Handle visibility change (pause/resume)
 */
function handleVisibilityChange() {
    if (document.hidden) {
        if (mooseState.currentTimeout) {
            clearTimeout(mooseState.currentTimeout);
            localStorage.setItem('mooseNextAppearance', mooseState.nextAppearanceTime);
        }
    } else {
        const savedTime = localStorage.getItem('mooseNextAppearance');
        if (savedTime && !mooseState.isActive) {
            const timeRemaining = parseInt(savedTime) - Date.now();
            if (timeRemaining > 0) {
                mooseState.currentTimeout = setTimeout(showMoose, timeRemaining);
            } else {
                scheduleMooseAppearance();
            }
        }
    }
}

/**
 * Initialize moose system
 * @param {boolean} debugMode - Enable debug mode (shorter intervals)
 */
function initMooseSystem(debugMode = false) {
    MOOSE_CONFIG.DEBUG_MODE = debugMode;

    Logger.info('Moose system initialized!');
    Logger.info(`Debug mode: ${debugMode ? 'ON (30-60 sec)' : 'OFF (10-20 min)'}`);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleMooseAppearance();
}

/**
 * Get current moose state
 */
function getMooseState() {
    return { ...mooseState };
}

// Expose to window for script tag usage
window.MooseSystem = {
    init: initMooseSystem,
    show: showMoose,
    getState: getMooseState,
    config: MOOSE_CONFIG
};

// Subscribe to app:ready event for automatic initialization
// This decouples MooseSystem from app.js
if (window.AppEvents) {
    AppEvents.on('app:ready', () => {
        // Initialize with debug mode from config if available
        const debugMode = window.APP_CONFIG?.debug || MOOSE_CONFIG.DEBUG_MODE;
        initMooseSystem(debugMode);
        Logger.info(`Moose system auto-initialized via app:ready event (debug: ${debugMode})`);
    });
}
