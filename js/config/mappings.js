/**
 * House Mappings Configuration
 * Single source of truth for all sensor, room, and light mappings
 */

(function() {
    'use strict';

    // Temperature sensor name to DOM element ID mapping
    const sensorMapping = {
        'landing': 'temp-landing',
        'main bedroom': 'temp-main-bedroom',
        'guest room': 'temp-guest-bedroom',
        'Hue temperature sensor 1': 'temp-office',
        'bathroom': 'temp-bathroom',
        'Hall': 'temp-hall',
        'lounge': 'temp-lounge',
        'ExtensionDimmer': 'temp-extension',
        'KitchenSensor': 'temp-kitchen',
        'Hue outdoor temp. sensor 1': 'temp-outdoor'
    };

    // Sensor name to display room name mapping
    const roomNames = {
        'landing': 'Landing',
        'main bedroom': 'Main Bedroom',
        'guest room': 'Guest Bedroom',
        'Hue temperature sensor 1': 'Home Office',
        'bathroom': 'Bathroom',
        'Hall': 'Hall',
        'lounge': 'Lounge',
        'ExtensionDimmer': 'Extension',
        'KitchenSensor': 'Kitchen',
        'Hue outdoor temp. sensor 1': 'Outdoor'
    };

    // Room colors for UI elements
    const roomColors = {
        'landing': '#FF6B9D',
        'main bedroom': '#FFB6C1',
        'guest room': '#DDA0DD',
        'Hue temperature sensor 1': '#87CEEB',
        'bathroom': '#4ECDC4',
        'Hall': '#95E1D3',
        'lounge': '#F4A460',
        'ExtensionDimmer': '#98D8C8',
        'KitchenSensor': '#FFB347',
        'Hue outdoor temp. sensor 1': '#7AE582'
    };

    // Thermometer SVG positions (adjusted for compact pixel-art style)
    const roomPositions = {
        'temp-main-bedroom': { x: 180, y: 280 },
        'temp-landing': { x: 335, y: 280 },
        'temp-office': { x: 490, y: 280 },
        'temp-bathroom': { x: 645, y: 290 },
        'temp-guest-bedroom': { x: 810, y: 280 },
        'temp-hall': { x: 200, y: 450 },
        'temp-lounge': { x: 340, y: 450 },
        'temp-kitchen': { x: 590, y: 450 },
        'temp-extension': { x: 790, y: 450 },
        'temp-outdoor': { x: 55, y: 95, isOutdoor: true }
    };

    // Light name patterns to room mapping (regex patterns)
    const lightMappings = {
        'outdoor|outside|garden': 'Outdoor',
        'guest': 'Guest Bedroom',
        'main bedroom|mainbedroom|^bedroomlight$|^bedroom$': 'Main Bedroom',
        'landing': 'Landing',
        'office': 'Home Office',
        'bathroom|bath': 'Bathroom',
        'lounge': 'Lounge',
        'hall': 'Hall',
        'extension': 'Extension',
        'kitchen': 'Kitchen'
    };

    // Motion sensor name patterns to room mapping (regex patterns)
    const motionSensorMappings = {
        'outdoor|outside|garden': 'Outdoor',
        'hall|frontdoor|front door': 'Hall',
        'landing': 'Landing',
        'bathroom|bath': 'Bathroom'
    };

    // Light indicator positions on house SVG
    const lightPositions = {
        'Main Bedroom': { x: 180, y: 240 },
        'Landing': { x: 340, y: 240 },
        'Home Office': { x: 500, y: 240 },
        'Bathroom': { x: 660, y: 240 },
        'Guest Bedroom': { x: 820, y: 240 },
        'Hall': { x: 200, y: 405 },
        'Lounge': { x: 400, y: 405 },
        'Kitchen': { x: 600, y: 405 },
        'Extension': { x: 800, y: 405 }
    };

    // List of all rooms
    const rooms = [
        'Main Bedroom',
        'Guest Bedroom',
        'Bathroom',
        'Landing',
        'Hall',
        'Home Office',
        'Lounge',
        'Kitchen',
        'Extension',
        'Outdoor'
    ];

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Map a light name to a room using pattern matching
     * @param {string} lightName - Name of the light from Hue Bridge
     * @returns {string|null} - Room name or null if not mapped
     */
    function mapLightToRoom(lightName) {
        if (!lightName) return null;
        const nameLower = lightName.toLowerCase();
        for (const [pattern, room] of Object.entries(lightMappings)) {
            if (new RegExp(pattern, 'i').test(nameLower)) return room;
        }
        return null;
    }

    /**
     * Map a motion sensor name to a room using pattern matching
     * @param {string} sensorName - Name of the sensor from Hue Bridge
     * @returns {string|null} - Room name or null if not mapped
     */
    function mapMotionSensorToRoom(sensorName) {
        if (!sensorName) return null;
        const nameLower = sensorName.toLowerCase();
        for (const [pattern, room] of Object.entries(motionSensorMappings)) {
            if (new RegExp(pattern, 'i').test(nameLower)) return room;
        }
        return null;
    }

    // =============================================================================
    // EXPOSE ON WINDOW
    // =============================================================================

    window.MAPPINGS = {
        // Data
        sensorMapping,
        roomNames,
        roomColors,
        roomPositions,
        lightMappings,
        motionSensorMappings,
        lightPositions,
        rooms,

        // Functions
        mapLightToRoom,
        mapMotionSensorToRoom
    };

})();
