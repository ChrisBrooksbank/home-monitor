/**
 * Sky Feature Module
 * Handles sky gradients, sun/moon display, and time-of-day visuals
 */

import { Logger } from '../utils/logger';
import { LOCATION } from '../config';

// Sky configuration interface
export interface SkyConfig {
  color1: string;
  color2: string;
  showSun: boolean;
  showMoon: boolean;
  showStars: boolean;
}

// Sun times interface
export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

// Time of day period type
export type TimeOfDay = 'night' | 'dawn' | 'day' | 'dusk';

// Sun position interface
export interface SunPosition {
  x: number;
  y: number;
}

// Store sunrise/sunset times
let sunriseTime: Date | null = null;
let sunsetTime: Date | null = null;

/**
 * Fetch sunrise/sunset times from API
 */
export async function fetchSunTimes(): Promise<SunTimes | null> {
  try {
    const response = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${LOCATION.LAT}&lng=${LOCATION.LNG}&formatted=0`
    );
    const data = await response.json();

    if (data.status === 'OK') {
      sunriseTime = new Date(data.results.sunrise);
      sunsetTime = new Date(data.results.sunset);

      Logger.info(`Sunrise today: ${sunriseTime.toLocaleTimeString()}`);
      Logger.info(`Sunset today: ${sunsetTime.toLocaleTimeString()}`);

      // Update sky immediately with new times
      updateSky();

      return { sunrise: sunriseTime, sunset: sunsetTime };
    }
  } catch (error) {
    Logger.error('Error fetching sun times:', error);
    // Fallback to default times if API fails
    const now = new Date();
    sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
    sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  }

  return null;
}

/**
 * Get current time of day period
 */
export function getTimeOfDay(): TimeOfDay {
  const now = new Date();

  // Use defaults if sun times not loaded
  if (!sunriseTime || !sunsetTime) {
    sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
    sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  }

  const dawnStart = new Date(sunriseTime.getTime() - 60 * 60 * 1000); // 1 hour before sunrise
  const dawnEnd = sunriseTime;
  const duskStart = sunsetTime;
  const duskEnd = new Date(sunsetTime.getTime() + 90 * 60 * 1000); // 1.5 hours after sunset

  if (now >= dawnStart && now < dawnEnd) return 'dawn';
  if (now >= dawnEnd && now < duskStart) return 'day';
  if (now >= duskStart && now < duskEnd) return 'dusk';
  return 'night';
}

/**
 * Get sky configuration for a time period
 */
export function getSkyConfig(period: TimeOfDay): SkyConfig {
  const configs: Record<TimeOfDay, SkyConfig> = {
    dawn: {
      color1: '#FF6B6B', // Pink
      color2: '#FFD93D', // Golden yellow
      showSun: true,
      showMoon: false,
      showStars: false,
    },
    day: {
      color1: '#87CEEB', // Sky blue
      color2: '#E0F6FF', // Very light blue
      showSun: true,
      showMoon: false,
      showStars: false,
    },
    dusk: {
      color1: '#FF6B35', // Orange
      color2: '#6A4C93', // Purple
      showSun: true,
      showMoon: false,
      showStars: true,
    },
    night: {
      color1: '#0B1026', // Dark blue/black
      color2: '#1E3A5F', // Deep blue
      showSun: false,
      showMoon: true,
      showStars: true,
    },
  };

  return configs[period] || configs.night;
}

/**
 * Update sky based on time of day
 */
export function updateSky(): void {
  const skyGradient = document.getElementById('skyGradient');
  const sun = document.getElementById('sun');
  const moon = document.getElementById('moon');
  const stars = document.getElementById('stars');

  if (!skyGradient) return;

  // Check for dark mode - override time-based sky if dark mode is active
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let skyConfig: SkyConfig;

  if (isDarkMode) {
    // Force night theme in dark mode
    skyConfig = getSkyConfig('night');
  } else {
    const period = getTimeOfDay();
    skyConfig = getSkyConfig(period);
  }

  // Update sky gradient
  const stops = skyGradient.getElementsByTagName('stop');
  if (stops.length >= 2) {
    stops[0].setAttribute('style', `stop-color:${skyConfig.color1};stop-opacity:1`);
    stops[1].setAttribute('style', `stop-color:${skyConfig.color2};stop-opacity:1`);
  }

  // Show/hide sun, moon, and stars
  if (sun) sun.style.display = skyConfig.showSun ? 'block' : 'none';
  if (moon) moon.style.display = skyConfig.showMoon ? 'block' : 'none';
  if (stars) stars.style.display = skyConfig.showStars ? 'block' : 'none';
}

/**
 * Get sun position for current time (for animated sun movement)
 */
export function getSunPosition(): SunPosition {
  const now = new Date();

  if (!sunriseTime || !sunsetTime) {
    return { x: 450, y: 80 }; // Default centered position
  }

  const dayLength = sunsetTime.getTime() - sunriseTime.getTime();
  const currentTime = now.getTime() - sunriseTime.getTime();
  const progress = Math.max(0, Math.min(1, currentTime / dayLength));

  // Sun arc from left to right across the sky
  const x = 100 + progress * 800; // 100 to 900
  const y = 150 - Math.sin(progress * Math.PI) * 100; // Arc from 150 up to 50 and back

  return { x, y };
}

/**
 * Check if it's currently daytime
 */
export function isDaytime(): boolean {
  const period = getTimeOfDay();
  return period === 'day' || period === 'dawn' || period === 'dusk';
}

/**
 * Check if it's nighttime
 */
export function isNighttime(): boolean {
  return getTimeOfDay() === 'night';
}

/**
 * Get sunrise time
 */
export function getSunriseTime(): Date | null {
  return sunriseTime;
}

/**
 * Get sunset time
 */
export function getSunsetTime(): Date | null {
  return sunsetTime;
}

/**
 * Sky module export
 */
export const Sky = {
  fetchSunTimes,
  getTimeOfDay,
  getSkyConfig,
  updateSky,
  getSunPosition,
  isDaytime,
  isNighttime,
  getSunriseTime,
  getSunsetTime,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as Window & { Sky?: typeof Sky }).Sky = Sky;
}
