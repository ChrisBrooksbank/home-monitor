/**
 * House Configuration
 * Central configuration for rooms, devices, and mappings
 */

// Import device configuration
import devices from '../../config/devices.json';

export const HOUSE_CONFIG = {
    // House Information
    address: '28 Barn Green',

    // Network & Device IPs (from centralized config)
    devices: {
        hueBridge: window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51',
        hueUsername: window.HUE_CONFIG?.USERNAME,
        googleHub: devices.hub.ip,
        nest: null,  // Set if using Nest integration

        // Sonos Speakers
        sonos: devices.sonos,

        // Tapo Smart Plugs
        tapo: {
            tree: { ip: devices.tapo.tree, room: 'Extension', label: 'Tree Lights', x: 800, y: 410 },
            winter: { ip: devices.tapo.winter, room: 'Extension', label: 'Winter Lights', x: 690, y: 410 },
            extension: { ip: devices.tapo.extension, room: 'Extension', label: 'Extension Plug', x: 580, y: 410 }
        }
    },

    // Room Definitions
    rooms: [
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
    ],

    // Light Name to Room Mapping Rules
    lightMappings: {
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
    },

    // Motion Sensor Name to Room Mapping Rules
    motionSensorMappings: {
        'outdoor|outside|garden': 'Outdoor',
        'hall|frontdoor|front door': 'Hall',
        'landing': 'Landing',
        'bathroom|bath': 'Bathroom'
    },

    // Temperature Sensor Locations (SVG coordinates)
    tempSensorPositions: {
        'temp-bedroom': { x: 700, y: 300, isOutdoor: false },
        'temp-office': { x: 515, y: 290, isOutdoor: false },
        'temp-lounge': { x: 400, y: 480, isOutdoor: false },
        'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
    }
};

// Sensor mapping (legacy - to be refactored)
export const sensorMapping = {
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

export const roomColors = {
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

export const roomNames = {
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

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        HOUSE_CONFIG,
        sensorMapping,
        roomColors,
        roomNames
    };
}
