// Philips Hue Bridge Configuration Example
// Copy this file to config.js and fill in your actual values
const HUE_CONFIG = {
    BRIDGE_IP: "192.168.1.XXX",  // Your Hue Bridge IP address
    USERNAME: "YOUR-HUE-API-USERNAME-HERE",  // Your Hue Bridge API username

    // IFTTT Configuration (optional - for Google Home broadcasts)
    // Get your webhook key from https://ifttt.com/maker_webhooks/settings
    IFTTT: {
        enabled: false,  // Set to true once you've configured IFTTT
        webhookKey: "YOUR_IFTTT_WEBHOOK_KEY_HERE",  // Your IFTTT webhook key
        events: {
            'Outdoor': 'motion_outdoor',
            'Hall': 'motion_hall',
            'Landing': 'motion_landing',
            'Bathroom': 'motion_bathroom'
        }
    }
};
