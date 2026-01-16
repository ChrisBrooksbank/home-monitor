/**
 * Weather Feature Module
 * Handles weather API, display updates, and visual effects
 */

import { Logger } from '../utils/logger';
import { Registry } from '../core/registry';

// Weather data interface
export interface WeatherData {
    temp: number;
    condition: string;
    icon: string;
    humidity: number;
    feelsLike: number;
    uv: number;
    wind: number;
    windDir: string;
}

// Helper to get weather config from Registry
function getWeatherConfig() {
    return Registry.getOptional('WEATHER_CONFIG') as
        | { API_KEY?: string; LOCATION?: string }
        | undefined;
}

// Weather configuration
const WEATHER_CONFIG = {
    get apiKey(): string {
        return getWeatherConfig()?.API_KEY || '';
    },
    get location(): string {
        return getWeatherConfig()?.LOCATION || 'Chelmsford,UK';
    },
};

// Cached weather data
let cachedWeatherData: WeatherData | null = null;

/**
 * Fetch weather data from WeatherAPI.com
 */
async function fetchWeather(): Promise<WeatherData | null> {
    if (!WEATHER_CONFIG.apiKey || WEATHER_CONFIG.apiKey === 'YOUR-WEATHERAPI-KEY-HERE') {
        Logger.warn('Weather API key not configured');
        return null;
    }

    try {
        const response = await fetch(
            `https://api.weatherapi.com/v1/current.json?key=${WEATHER_CONFIG.apiKey}&q=${WEATHER_CONFIG.location}`
        );

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();

        cachedWeatherData = {
            temp: data.current.temp_c,
            condition: data.current.condition.text,
            icon: data.current.condition.icon,
            humidity: data.current.humidity,
            feelsLike: data.current.feelslike_c,
            uv: data.current.uv,
            wind: data.current.wind_kph,
            windDir: data.current.wind_dir,
        };

        return cachedWeatherData;
    } catch (error) {
        Logger.error('Error fetching weather:', error);
        return null;
    }
}

/**
 * Update weather display elements
 */
function updateWeatherElements(weatherData: WeatherData | null): void {
    if (!weatherData) return;

    // Update stat card elements (if they exist)
    const elements: Record<string, string> = {
        'weather-temp': `${weatherData.temp.toFixed(1)}°C`,
        'weather-condition': weatherData.condition,
        'weather-feels': `Feels like ${weatherData.feelsLike.toFixed(1)}°C`,
        'weather-humidity': `${weatherData.humidity}%`,
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Update icon
    const iconEl = document.getElementById('weather-icon') as HTMLImageElement | null;
    if (iconEl) iconEl.src = `https:${weatherData.icon}`;

    // Update SVG weather panel elements
    const svgElements: Record<string, string> = {
        'weather-temp-svg': `${Math.round(weatherData.temp)}°`,
        'weather-condition-svg': weatherData.condition,
        'weather-feels-svg': `Feels: ${Math.round(weatherData.feelsLike)}°`,
        'weather-humidity-svg': `${weatherData.humidity}%`,
        'weather-uv-svg': `UV ${weatherData.uv}`,
        'weather-wind-svg': `${Math.round(weatherData.wind)} km/h`,
        'weather-wind-dir-svg': weatherData.windDir,
    };

    for (const [id, value] of Object.entries(svgElements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Update SVG icon
    const svgIconEl = document.getElementById('weather-icon-svg');
    if (svgIconEl) svgIconEl.setAttribute('href', `https:${weatherData.icon}`);

    Logger.info(`Weather updated: ${weatherData.temp.toFixed(1)}°C, ${weatherData.condition}`);
}

/**
 * Update visual effects based on weather conditions
 */
function updateWeatherVisuals(weatherData: WeatherData | null): void {
    if (!weatherData) return;

    const rainEl = document.getElementById('rain');
    const snowEl = document.getElementById('snow');
    const fogEl = document.getElementById('fog');
    const skyGradient = document.getElementById('skyGradient');

    // Hide all weather effects by default
    if (rainEl) rainEl.style.display = 'none';
    if (snowEl) snowEl.style.display = 'none';
    if (fogEl) fogEl.style.display = 'none';

    const condition = weatherData.condition.toLowerCase();
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Determine weather effects and sky colors
    let skyColor1: string;
    let skyColor2: string;

    if (
        condition.includes('rain') ||
        condition.includes('drizzle') ||
        condition.includes('shower')
    ) {
        if (rainEl) rainEl.style.display = 'block';
        skyColor1 = '#6B7F8F';
        skyColor2 = '#8B9DAF';
        Logger.info('Rain effect activated');
    } else if (
        condition.includes('snow') ||
        condition.includes('sleet') ||
        condition.includes('blizzard')
    ) {
        if (snowEl) snowEl.style.display = 'block';
        skyColor1 = '#D0D8E0';
        skyColor2 = '#E8EEF5';
        Logger.info('Snow effect activated');
    } else if (
        condition.includes('fog') ||
        condition.includes('mist') ||
        condition.includes('haze')
    ) {
        if (fogEl) fogEl.style.display = 'block';
        skyColor1 = '#B0B8C0';
        skyColor2 = '#D0D8E0';
        Logger.info('Fog effect activated');
    } else if (condition.includes('thunder') || condition.includes('storm')) {
        if (rainEl) rainEl.style.display = 'block';
        skyColor1 = '#4A5568';
        skyColor2 = '#6B7F8F';
        Logger.info('Storm effect activated');
    } else if (condition.includes('cloud') || condition.includes('overcast')) {
        skyColor1 = '#A0AEC0';
        skyColor2 = '#C0CED8';
        Logger.info('Cloudy sky');
    } else if (condition.includes('clear') || condition.includes('sunny')) {
        skyColor1 = '#87CEEB';
        skyColor2 = '#E0F6FF';
        Logger.info('Clear sky');
    } else {
        skyColor1 = '#98C8E8';
        skyColor2 = '#D0E8F8';
    }

    // Don't override sky colors in dark mode
    if (!isDarkMode && skyGradient) {
        const stops = skyGradient.getElementsByTagName('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('style', `stop-color:${skyColor1};stop-opacity:0.3`);
            stops[1].setAttribute('style', `stop-color:${skyColor2};stop-opacity:0.1`);
        }
    }

    // Adjust cloud appearance based on weather
    const cloudOpacity = condition.includes('cloud') || condition.includes('overcast') ? 0.9 : 0.7;
    const cloudColor =
        condition.includes('rain') || condition.includes('storm')
            ? '#808080'
            : condition.includes('fog') || condition.includes('mist')
              ? '#B0B0B0'
              : 'white';

    if (!isDarkMode) {
        document.documentElement.style.setProperty('--cloud-color', cloudColor);
        document.documentElement.style.setProperty('--cloud-opacity', String(cloudOpacity));
    }
}

/**
 * Full weather update - fetch and update display
 */
export async function updateWeatherDisplay(): Promise<WeatherData | null> {
    const weatherData = await fetchWeather();

    if (weatherData) {
        updateWeatherElements(weatherData);
        updateWeatherVisuals(weatherData);
    }

    return weatherData;
}

/**
 * Get cached weather data
 */
function getCachedWeather(): WeatherData | null {
    return cachedWeatherData;
}

/**
 * Weather condition category type
 */
type WeatherCategory = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';

/**
 * Get weather condition category
 */
function getWeatherCategory(condition: string): WeatherCategory {
    const cond = condition.toLowerCase();

    if (cond.includes('thunder') || cond.includes('storm')) return 'storm';
    if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) return 'rain';
    if (cond.includes('snow') || cond.includes('sleet') || cond.includes('blizzard')) return 'snow';
    if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) return 'fog';
    if (cond.includes('cloud') || cond.includes('overcast')) return 'cloudy';
    return 'clear';
}

/**
 * Weather module export
 */
const Weather = {
    fetch: fetchWeather,
    updateElements: updateWeatherElements,
    updateVisuals: updateWeatherVisuals,
    updateDisplay: updateWeatherDisplay,
    getCached: getCachedWeather,
    getCategory: getWeatherCategory,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
    (window as Window & { Weather?: typeof Weather }).Weather = Weather;
}
