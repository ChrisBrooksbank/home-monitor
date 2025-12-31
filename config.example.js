// Philips Hue Bridge Configuration Example
// Copy this file to config.js and fill in your actual values
const HUE_CONFIG = {
    BRIDGE_IP: "192.168.1.XXX",  // Your Hue Bridge IP address
    USERNAME: "YOUR-HUE-API-USERNAME-HERE"  // Your Hue Bridge API username
};

// Weather API Configuration (WeatherAPI.com)
// Get a free API key from https://www.weatherapi.com/signup.aspx
const WEATHER_CONFIG = {
    API_KEY: "YOUR-WEATHERAPI-KEY-HERE",  // Your WeatherAPI.com API key
    LOCATION: "CM1 6UG",  // Your UK postcode
    UPDATE_INTERVAL: 15  // Update interval in minutes (free tier allows 1M calls/month)
};
