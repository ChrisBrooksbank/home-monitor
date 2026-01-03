/**
 * Motion Detection and Activity Logging
 * Handles motion sensors, event logging, and history display
 */

import { MOTION_HISTORY_RETENTION } from '../config/constants.js';

// Motion sensor states
export const motionSensors = {
    'Outdoor': { detected: false, lastUpdated: null, previousDetected: false },
    'Hall': { detected: false, lastUpdated: null, previousDetected: false },
    'Landing': { detected: false, lastUpdated: null, previousDetected: false },
    'Bathroom': { detected: false, lastUpdated: null, previousDetected: false }
};

// Motion detection history (48 hours)
export let motionHistory = [];

/**
 * Initialize motion history from localStorage
 */
export function initMotionHistory() {
    const stored = localStorage.getItem('motionHistory');
    if (stored) {
        motionHistory = JSON.parse(stored);
        // Clean old data (older than retention period)
        const now = Date.now();
        const cutoff = now - MOTION_HISTORY_RETENTION;
        motionHistory = motionHistory.filter(entry => entry.time > cutoff);
        localStorage.setItem('motionHistory', JSON.stringify(motionHistory));
    }
    updateMotionLogDisplay();
}

/**
 * Log a motion detection event
 * @param {string} room - Room where motion was detected
 */
export function logMotionEvent(room) {
    logActivityEvent('motion', room, null);
}

/**
 * Log a light on/off event
 * @param {string} lightName - Name of the light
 * @param {boolean} isOn - Whether light is on
 */
export function logLightEvent(lightName, isOn) {
    logActivityEvent('light', lightName, isOn ? 'on' : 'off');
}

/**
 * Log a thermostat temperature change
 * @param {number} targetTemp - Target temperature in Celsius
 */
export function logThermostatEvent(targetTemp) {
    logActivityEvent('thermostat', 'Main Bedroom', `${targetTemp}°C`);
}

/**
 * General activity logging function
 * @param {string} type - Event type (motion, light, thermostat)
 * @param {string} location - Room name or light name
 * @param {string|null} detail - Additional info (e.g., 'on', 'off', '21°C')
 */
export function logActivityEvent(type, location, detail) {
    const now = Date.now();
    motionHistory.push({
        type: type,
        location: location,
        detail: detail,
        time: now,
        room: location  // Keep for backwards compatibility
    });

    // Keep only last retention period
    const cutoff = now - MOTION_HISTORY_RETENTION;
    motionHistory = motionHistory.filter(entry => entry.time > cutoff);

    // Save to localStorage
    localStorage.setItem('motionHistory', JSON.stringify(motionHistory));

    // Update display
    updateMotionLogDisplay();
}

/**
 * Update the motion log display
 */
export function updateMotionLogDisplay() {
    const logContainer = document.getElementById('motion-log');
    const countDisplay = document.getElementById('motion-log-count');

    if (!logContainer) return;

    // Get colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const textLight = styles.getPropertyValue('--text-light').trim();
    const textPrimary = styles.getPropertyValue('--text-primary').trim();

    // Count display
    if (countDisplay) countDisplay.textContent = motionHistory.length;

    if (motionHistory.length === 0) {
        logContainer.innerHTML = `<div style="text-align: center; color: ${textLight}; padding: 20px;">No motion events recorded yet</div>`;
        return;
    }

    // Sort by most recent first
    const sortedHistory = [...motionHistory].sort((a, b) => b.time - a.time);

    // Group by date
    const groupedByDate = {};
    sortedHistory.forEach(entry => {
        const date = new Date(entry.time);
        const dateKey = date.toLocaleDateString();
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(entry);
    });

    // Build HTML
    let html = '';
    for (const [dateKey, events] of Object.entries(groupedByDate)) {
        html += `<div style="margin-bottom: 15px;">`;
        html += `<div style="font-weight: bold; color: ${textPrimary}; margin-bottom: 8px; font-family: 'Fredoka', sans-serif;">📅 ${dateKey}</div>`;

        events.forEach(entry => {
            const date = new Date(entry.time);
            const timeStr = date.toLocaleTimeString();

            // Determine event type (backwards compatible)
            const eventType = entry.type || 'motion';
            let emoji, description, borderColor;

            if (eventType === 'motion') {
                const roomEmoji = {
                    'Outdoor': '🌳',
                    'Hall': '🚪',
                    'Landing': '🪜',
                    'Bathroom': '🚿'
                };
                emoji = roomEmoji[entry.room || entry.location] || '🚶';
                description = `<strong>${entry.room || entry.location}</strong> motion`;
                borderColor = '#FF6B35';
            } else if (eventType === 'light') {
                emoji = entry.detail === 'on' ? '💡' : '🌙';
                description = `<strong>${entry.location}</strong> turned ${entry.detail}`;
                borderColor = entry.detail === 'on' ? '#FFD700' : '#4A5568';
            } else if (eventType === 'thermostat') {
                emoji = '🌡️';
                description = `<strong>${entry.location}</strong> set to ${entry.detail}`;
                borderColor = '#FF6B6B';
            } else {
                emoji = '📝';
                description = `${entry.location}`;
                borderColor = textPrimary;
            }

            // Calculate how long ago
            const now = Date.now();
            const diff = now - entry.time;
            const hours = Math.floor(diff / (60 * 60 * 1000));
            const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
            let ago = '';
            if (hours > 0) {
                ago = `${hours}h ${minutes}m ago`;
            } else if (minutes > 0) {
                ago = `${minutes}m ago`;
            } else {
                ago = 'just now';
            }

            html += `<div style="padding: 6px 10px; margin: 4px 0; background: ${styles.getPropertyValue('--bg-graph').trim()}; border-radius: 6px; border-left: 3px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">`;
            html += `<span style="color: ${textPrimary};">${emoji} ${description} - ${timeStr}</span>`;
            html += `<span style="color: ${textLight}; font-size: 11px;">${ago}</span>`;
            html += `</div>`;
        });

        html += `</div>`;
    }

    logContainer.innerHTML = html;

    // Auto-scroll to top (most recent)
    logContainer.scrollTop = 0;
}

/**
 * Voice announcement function for motion
 * @param {string} room - Room where motion was detected
 */
export function announceMotion(room) {
    // Use Web Speech API for local voice announcement
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance();

        // Different messages for different locations
        const messages = {
            'Outdoor': 'Motion detected outside',
            'Hall': 'Motion detected in the hall',
            'Landing': 'Motion detected on the landing',
            'Bathroom': 'Motion detected in the bathroom'
        };

        utterance.text = messages[room] || `Motion detected in ${room}`;
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Cancel any ongoing speech and speak
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } else {
        // Fallback: play a beep sound if speech not available
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

/**
 * Voice announcement function for lights
 * @param {string} room - Room name
 * @param {boolean} isOn - Whether light is on
 */
export function announceLight(room, isOn) {
    // Don't announce during light effects to avoid spam
    if (window.effectInProgress) {
        return;
    }

    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance();

        const action = isOn ? 'on' : 'off';
        utterance.text = `${room} light turned ${action}`;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        // Don't cancel ongoing speech, queue it instead
        window.speechSynthesis.speak(utterance);
    }
}
