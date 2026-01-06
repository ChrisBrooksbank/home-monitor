/**
 * Light Effects Module
 * Fun light effects for Philips Hue lights (party, disco, wave, etc.)
 */

// Effect state
let originalLightStates = {};
let effectInProgress = false;

// Get bridge configuration
const getBridgeConfig = () => ({
    ip: window.HUE_CONFIG?.BRIDGE_IP,
    username: window.HUE_CONFIG?.USERNAME
});

/**
 * Get all lights from Hue Bridge
 * @returns {Promise<Object|null>}
 */
async function getAllLights() {
    try {
        const config = getBridgeConfig();
        const response = await fetch(`http://${config.ip}/api/${config.username}/lights`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        Logger.error('Error getting lights:', error);
        return null;
    }
}

/**
 * Set a light to specific state
 * @param {string} lightId - Light ID
 * @param {Object} state - Light state
 */
async function setLightState(lightId, state) {
    try {
        const config = getBridgeConfig();
        await fetch(`http://${config.ip}/api/${config.username}/lights/${lightId}/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
    } catch (error) {
        Logger.error(`Error setting light ${lightId}:`, error);
    }
}

/**
 * Save current state of all lights
 * @returns {Promise<boolean>}
 */
async function saveLightStates() {
    const lights = await getAllLights();
    if (!lights) return false;

    originalLightStates = {};
    for (const [lightId, light] of Object.entries(lights)) {
        originalLightStates[lightId] = {
            on: light.state.on,
            bri: light.state.bri,
            hue: light.state.hue,
            sat: light.state.sat
        };
    }
    return true;
}

/**
 * Restore original light states
 * @param {Function} onComplete - Callback when complete
 */
async function restoreLightStates(onComplete) {
    for (const [lightId, state] of Object.entries(originalLightStates)) {
        await setLightState(lightId, state);
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Keep effectInProgress true for a bit longer to suppress voice announcements
    // during the next polling cycle (lights poll every 10 seconds)
    setTimeout(() => {
        effectInProgress = false;
        window.effectInProgress = false;
        if (onComplete) onComplete();
    }, 12000);
}

/**
 * Disable/enable all effect buttons
 * @param {boolean} disable - Whether to disable
 */
function disableEffectButtons(disable) {
    const buttons = ['redAlertBtn', 'partyBtn', 'discoBtn', 'waveBtn', 'sunsetBtn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = disable;
    });
}

/**
 * Confirm effect with time-based warning
 * @param {string} effectName - Name of the effect
 * @returns {boolean} - User confirmation
 */
function confirmEffect(effectName) {
    const hour = new Date().getHours();
    const isNightTime = hour >= 22 || hour < 7;

    let message = `Run ${effectName} effect?\n\nThis will change all lights in your home.`;

    if (isNightTime) {
        message += `\n\nWARNING: It's currently ${hour}:00 - people may be sleeping!`;
    }

    return confirm(message);
}

/**
 * Check if effect is in progress
 * @returns {boolean}
 */
function isEffectInProgress() {
    return effectInProgress;
}

/**
 * Run a light effect with common boilerplate
 * @param {string} effectName - Name of the effect
 * @param {Function} effectCallback - Effect logic function
 * @param {Function} onComplete - Callback when effect completes
 */
async function runLightEffect(effectName, effectCallback, onComplete) {
    if (!confirmEffect(effectName)) return;
    if (effectInProgress) return;

    effectInProgress = true;
    window.effectInProgress = true; // For global access
    disableEffectButtons(true);

    try {
        const success = await saveLightStates();
        if (!success) {
            effectInProgress = false;
            window.effectInProgress = false;
            disableEffectButtons(false);
            return;
        }

        const lights = await getAllLights();
        if (!lights) {
            effectInProgress = false;
            window.effectInProgress = false;
            disableEffectButtons(false);
            return;
        }

        await effectCallback(lights);
        await restoreLightStates(onComplete);
    } finally {
        effectInProgress = false;
        window.effectInProgress = false;
        disableEffectButtons(false);
    }
}

/**
 * Red Alert - Flash all lights red
 */
async function redAlert(onComplete) {
    return runLightEffect('Red Alert', async (lights) => {
        for (let i = 0; i < 6; i++) {
            for (const lightId of Object.keys(lights)) {
                await setLightState(lightId, {
                    on: true, bri: 254, hue: 0, sat: 254, transitiontime: 0
                });
            }
            await new Promise(resolve => setTimeout(resolve, 250));

            for (const lightId of Object.keys(lights)) {
                await setLightState(lightId, { on: false, transitiontime: 0 });
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }, onComplete);
}

/**
 * Party Mode - Cycle through rainbow colors
 */
async function partyMode(onComplete) {
    return runLightEffect('Party Mode', async (lights) => {
        const colors = [0, 10922, 12750, 25500, 46920, 56100]; // Rainbow hues

        for (let cycle = 0; cycle < 12; cycle++) {
            const hue = colors[cycle % colors.length];

            for (const lightId of Object.keys(lights)) {
                await setLightState(lightId, {
                    on: true, bri: 254, hue: hue, sat: 254, transitiontime: 5
                });
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }, onComplete);
}

/**
 * Disco Mode - Random flashing colors
 */
async function discoMode(onComplete) {
    return runLightEffect('Disco', async (lights) => {
        const lightIds = Object.keys(lights);

        for (let i = 0; i < 20; i++) {
            for (const lightId of lightIds) {
                const randomHue = Math.floor(Math.random() * 65535);
                const randomOn = Math.random() > 0.3;

                await setLightState(lightId, {
                    on: randomOn,
                    bri: randomOn ? 254 : 0,
                    hue: randomHue,
                    sat: 254,
                    transitiontime: 0
                });
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }, onComplete);
}

/**
 * Wave Effect - Lights turn on in sequence
 */
async function waveEffect(onComplete) {
    return runLightEffect('Wave', async (lights) => {
        const lightIds = Object.keys(lights);

        // Turn all off first
        for (const lightId of lightIds) {
            await setLightState(lightId, { on: false, transitiontime: 0 });
        }
        await new Promise(resolve => setTimeout(resolve, 300));

        // Wave through 3 times
        for (let wave = 0; wave < 3; wave++) {
            for (const lightId of lightIds) {
                await setLightState(lightId, {
                    on: true, bri: 254, hue: 46920, sat: 254, transitiontime: 0
                });
                await new Promise(resolve => setTimeout(resolve, 150));
                await setLightState(lightId, { on: false, transitiontime: 2 });
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }, onComplete);
}

/**
 * Sunset Mode - Gradual warm orange glow then fade
 */
async function sunsetMode(onComplete) {
    return runLightEffect('Sunset', async (lights) => {
        // Fade to warm sunset orange
        for (const lightId of Object.keys(lights)) {
            await setLightState(lightId, {
                on: true, bri: 200, hue: 5000, sat: 200, transitiontime: 30
            });
        }
        await new Promise(resolve => setTimeout(resolve, 3500));
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fade to dim
        for (const lightId of Object.keys(lights)) {
            await setLightState(lightId, {
                on: true, bri: 1, transitiontime: 30
            });
        }
        await new Promise(resolve => setTimeout(resolve, 3500));
    }, onComplete);
}

/**
 * Initialize effects and wire up jukebox buttons
 */
function initEffects() {
    // Expose to window
    window.redAlert = redAlert;
    window.partyMode = partyMode;
    window.discoMode = discoMode;
    window.waveEffect = waveEffect;
    window.sunsetMode = sunsetMode;
    window.effectInProgress = false;

    // Wire up jukebox buttons
    const buttonMap = {
        'jukebox-btn-1': redAlert,      // Red Alert
        'jukebox-btn-2': partyMode,     // Party
        'jukebox-btn-3': discoMode,     // Disco
        'jukebox-btn-4': waveEffect,    // Wave
        'jukebox-btn-5': sunsetMode     // Sunset
    };

    for (const [btnId, effectFn] of Object.entries(buttonMap)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                effectFn();
            });
        }
    }

    Logger.info('Light effects initialized');
}

// Expose for other scripts
window.LightEffects = {
    redAlert,
    partyMode,
    discoMode,
    waveEffect,
    sunsetMode,
    isEffectInProgress
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffects);
} else {
    initEffects();
}
