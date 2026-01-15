/**
 * Moose Character System Module
 * Handles the animated moose character that appears periodically
 *
 * Subscribes to AppEvents 'app:ready' for automatic initialization.
 */

import { Logger, getAppEvents, getAppConfig } from '../utils';
import { Registry } from '../core/registry';

// Moose configuration interface
interface MooseConfig {
  MIN_INTERVAL: number;
  MAX_INTERVAL: number;
  ENABLE_NIGHT_ACTIVITIES: boolean;
  ENABLE_EFFECTS: boolean;
  WALK_IN_DURATION: number;
  WALK_OUT_DURATION: number;
  DEBUG_MODE: boolean;
}

// Moose configuration
const MOOSE_CONFIG: MooseConfig = {
  MIN_INTERVAL: 10 * 60 * 1000, // 10 minutes
  MAX_INTERVAL: 20 * 60 * 1000, // 20 minutes
  ENABLE_NIGHT_ACTIVITIES: true,
  ENABLE_EFFECTS: true,
  WALK_IN_DURATION: 2000,
  WALK_OUT_DURATION: 2000,
  DEBUG_MODE: false, // Set to true for 30-60 sec intervals
};

// Location interface
interface MooseLocation {
  x: number;
  y: number;
}

// Activity interface
interface MooseActivity {
  name: string;
  locations: string[];
  duration: number;
  emoji: string;
  nightOnly?: boolean;
}

// Moose locations on the SVG
const mooseLocations: Record<string, Record<string, MooseLocation>> = {
  garden: {
    tree: { x: 40, y: 480 },
    lamppost: { x: 110, y: 520 },
    flowers: { x: 720, y: 510 },
  },
  house: {
    frontDoor: { x: 160, y: 480 },
    window1: { x: 300, y: 380 },
    window2: { x: 500, y: 380 },
    window3: { x: 720, y: 380 },
    gardenEdge: { x: 80, y: 520 },
  },
};

// Available activities
const mooseActivities: MooseActivity[] = [
  {
    name: 'cleaningWindows',
    locations: ['house.window1', 'house.window2', 'house.window3'],
    duration: 20000,
    emoji: '\uD83E\uDDFD',
  },
  { name: 'mowingLawn', locations: ['house.gardenEdge'], duration: 25000, emoji: '\uD83C\uDF31' },
  { name: 'wateringPlants', locations: ['garden.flowers'], duration: 18000, emoji: '\uD83D\uDCA7' },
  { name: 'havingPicnic', locations: ['garden.tree'], duration: 30000, emoji: '\uD83E\uDDFA' },
  { name: 'readingNewspaper', locations: ['garden.lamppost'], duration: 22000, emoji: '\uD83D\uDCF0' },
  { name: 'paintingHouse', locations: ['house.frontDoor'], duration: 25000, emoji: '\uD83C\uDFA8' },
  {
    name: 'starGazing',
    locations: ['garden.tree'],
    duration: 35000,
    nightOnly: true,
    emoji: '\uD83D\uDD2D',
  },
];

// Moose state interface
interface MooseState {
  isActive: boolean;
  currentActivity: string | null;
  nextAppearanceTime: number | null;
  currentTimeout: ReturnType<typeof setTimeout> | null;
}

// Moose state
const mooseState: MooseState = {
  isActive: false,
  currentActivity: null,
  nextAppearanceTime: null,
  currentTimeout: null,
};

/**
 * Create antlers for the moose
 */
function createAntlers(group: SVGGElement, svgNS: string): void {
  const antlerPositions = [
    { x: 8, y: 0, w: 12, h: 4 },
    { x: 4, y: 4, w: 8, h: 4 },
    { x: 28, y: 0, w: 12, h: 4 },
    { x: 36, y: 4, w: 8, h: 4 },
  ];

  antlerPositions.forEach((pos) => {
    const antler = document.createElementNS(svgNS, 'rect');
    antler.setAttribute('x', String(pos.x));
    antler.setAttribute('y', String(pos.y));
    antler.setAttribute('width', String(pos.w));
    antler.setAttribute('height', String(pos.h));
    antler.setAttribute('fill', '#654321');
    group.appendChild(antler);
  });
}

/**
 * Create activity-specific props
 */
function createActivityProps(activityName: string, svgNS: string): SVGGElement | null {
  const propsGroup = document.createElementNS(svgNS, 'g') as SVGGElement;

  switch (activityName) {
    case 'cleaningWindows': {
      const sponge = document.createElementNS(svgNS, 'rect');
      sponge.setAttribute('x', '44');
      sponge.setAttribute('y', '32');
      sponge.setAttribute('width', '12');
      sponge.setAttribute('height', '8');
      sponge.setAttribute('fill', '#FFD700');
      propsGroup.appendChild(sponge);
      break;
    }

    case 'wateringPlants': {
      const can = document.createElementNS(svgNS, 'rect');
      can.setAttribute('x', '44');
      can.setAttribute('y', '36');
      can.setAttribute('width', '16');
      can.setAttribute('height', '12');
      can.setAttribute('fill', '#228B22');
      propsGroup.appendChild(can);
      break;
    }

    case 'mowingLawn': {
      const mower = document.createElementNS(svgNS, 'rect');
      mower.setAttribute('x', '44');
      mower.setAttribute('y', '56');
      mower.setAttribute('width', '20');
      mower.setAttribute('height', '12');
      mower.setAttribute('fill', '#FF4500');
      propsGroup.appendChild(mower);
      break;
    }

    case 'readingNewspaper': {
      const paper = document.createElementNS(svgNS, 'rect');
      paper.setAttribute('x', '44');
      paper.setAttribute('y', '28');
      paper.setAttribute('width', '16');
      paper.setAttribute('height', '20');
      paper.setAttribute('fill', '#F5F5DC');
      propsGroup.appendChild(paper);
      break;
    }

    case 'paintingHouse': {
      const brush = document.createElementNS(svgNS, 'rect');
      brush.setAttribute('x', '44');
      brush.setAttribute('y', '30');
      brush.setAttribute('width', '4');
      brush.setAttribute('height', '24');
      brush.setAttribute('fill', '#8B4513');
      propsGroup.appendChild(brush);
      break;
    }

    case 'starGazing': {
      const telescope = document.createElementNS(svgNS, 'rect');
      telescope.setAttribute('x', '54');
      telescope.setAttribute('y', '44');
      telescope.setAttribute('width', '24');
      telescope.setAttribute('height', '6');
      telescope.setAttribute('fill', '#34495E');
      propsGroup.appendChild(telescope);
      break;
    }
  }

  return propsGroup;
}

/**
 * Get activity-specific message
 */
function getActivityMessage(activityName: string): string {
  const messages: Record<string, string> = {
    cleaningWindows: 'Sparkly!',
    mowingLawn: 'Bzzz!',
    wateringPlants: 'Splash!',
    havingPicnic: 'Yummy!',
    readingNewspaper: 'Hmm...',
    paintingHouse: 'Nice!',
    starGazing: 'Wow!',
  };
  return messages[activityName] || 'Hi!';
}

/**
 * Create speech bubble
 */
function createSpeechBubble(svgNS: string, activityName: string): SVGGElement {
  const bubble = document.createElementNS(svgNS, 'g') as SVGGElement;
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
 * Create moose character SVG
 */
function createMooseCharacter(activityName: string, x: number, y: number): SVGGElement {
  const svgNS = 'http://www.w3.org/2000/svg';
  const mooseGroup = document.createElementNS(svgNS, 'g') as SVGGElement;
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
    leg.setAttribute('x', String(12 + (i % 2) * 20));
    leg.setAttribute('y', '64');
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
 * Select a random activity (considering time of day)
 */
function selectRandomActivity(): MooseActivity | null {
  const sun = document.getElementById('sun') as unknown as SVGElement | null;
  const isNight = sun && sun.style.display === 'none';

  const available = mooseActivities.filter((a) => !a.nightOnly || (a.nightOnly && isNight));

  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Start activity animation
 */
function startActivityAnimation(element: SVGGElement, activityName: string): void {
  (element as SVGGElement & { style: CSSStyleDeclaration }).style.animation =
    'moose-bob 2s ease-in-out infinite';

  const activityElement = element.querySelector('.moose-activity-prop') as SVGElement | null;
  if (activityElement) {
    const animations: Record<string, string> = {
      cleaningWindows: 'window-clean 2s ease-in-out infinite',
      wateringPlants: 'water-pour 2s ease-in-out infinite',
      mowingLawn: 'mow-forward 8s linear',
      readingNewspaper: 'read-newspaper 3s ease-in-out infinite',
      paintingHouse: 'paint-brush 1.5s ease-in-out infinite',
      starGazing: 'telescope-pan 4s ease-in-out alternate infinite',
    };

    if (animations[activityName]) {
      (activityElement as SVGElement & { style: CSSStyleDeclaration }).style.animation =
        animations[activityName];
    }
  }
}

/**
 * Announce moose arrival with speech
 */
function announceMoose(): void {
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
 * Schedule next moose appearance
 */
function scheduleMooseAppearance(): void {
  const minInterval = MOOSE_CONFIG.DEBUG_MODE ? 30 * 1000 : MOOSE_CONFIG.MIN_INTERVAL;
  const maxInterval = MOOSE_CONFIG.DEBUG_MODE ? 60 * 1000 : MOOSE_CONFIG.MAX_INTERVAL;
  const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;

  mooseState.currentTimeout = setTimeout(showMoose, randomInterval);
  mooseState.nextAppearanceTime = Date.now() + randomInterval;
  localStorage.setItem('mooseNextAppearance', String(mooseState.nextAppearanceTime));

  const minutes = Math.round(randomInterval / 60000);
  Logger.info(`Next moose appearance in ~${minutes} minutes`);
}

/**
 * Remove moose and schedule next appearance
 */
function removeMoose(element: SVGGElement): void {
  (element as SVGGElement & { style: CSSStyleDeclaration }).style.animation =
    `moose-walk-out ${MOOSE_CONFIG.WALK_OUT_DURATION}ms ease-in`;

  setTimeout(() => {
    element.remove();
    mooseState.isActive = false;
    mooseState.currentActivity = null;
    Logger.info('Moose left!');
    scheduleMooseAppearance();
  }, MOOSE_CONFIG.WALK_OUT_DURATION);
}

/**
 * Show moose with random activity
 */
function showMoose(): void {
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

  (mooseElement as SVGGElement & { style: CSSStyleDeclaration }).style.animation =
    `moose-walk-in ${MOOSE_CONFIG.WALK_IN_DURATION}ms ease-out`;

  setTimeout(() => {
    startActivityAnimation(mooseElement, activity.name);
  }, MOOSE_CONFIG.WALK_IN_DURATION);

  setTimeout(() => {
    removeMoose(mooseElement);
  }, activity.duration);
}

/**
 * Handle visibility change (pause/resume)
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    if (mooseState.currentTimeout) {
      clearTimeout(mooseState.currentTimeout);
      localStorage.setItem('mooseNextAppearance', String(mooseState.nextAppearanceTime));
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
 */
function initMooseSystem(debugMode = false): void {
  MOOSE_CONFIG.DEBUG_MODE = debugMode;

  Logger.info('Moose system initialized!');
  Logger.info(`Debug mode: ${debugMode ? 'ON (30-60 sec)' : 'OFF (10-20 min)'}`);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  scheduleMooseAppearance();
}

/**
 * Get current moose state
 */
function getMooseState(): MooseState {
  return { ...mooseState };
}

/**
 * Moose System module export
 */
export const MooseSystem = {
  init: initMooseSystem,
  show: showMoose,
  getState: getMooseState,
  config: MOOSE_CONFIG,
};

// Register with the service registry
Registry.register({
  key: 'MooseSystem',
  instance: MooseSystem,
});

// Subscribe to app:ready event for automatic initialization
// This decouples MooseSystem from app.js
if (typeof window !== 'undefined') {
  // Defer subscription to allow Registry to be populated
  setTimeout(() => {
    const appEvents = getAppEvents();
    if (appEvents) {
      appEvents.on('app:ready', () => {
        // Initialize with debug mode from config if available
        const config = getAppConfig();
        const debugMode = config?.debug || MOOSE_CONFIG.DEBUG_MODE;
        initMooseSystem(debugMode);
        Logger.info(`Moose system auto-initialized via app:ready event (debug: ${debugMode})`);
      });
    }
  }, 0);
}
