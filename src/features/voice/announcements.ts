/**
 * Voice Announcements
 * Text-to-speech announcements for motion detection and light changes
 */

import { AppState } from '../../core/state';

/**
 * Announce motion detection via speech synthesis
 */
export function announceMotion(room: string): void {
  if (!('speechSynthesis' in window)) return;
  const messages: Record<string, string> = {
    Outdoor: 'Motion detected outside',
    Hall: 'Motion detected in the hall',
    Landing: 'Motion detected on the landing',
    Bathroom: 'Motion detected in the bathroom',
  };
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = messages[room] || `Motion detected in ${room}`;
  utterance.rate = 1.1;
  utterance.volume = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/**
 * Announce light state change via speech synthesis
 */
export function announceLight(room: string, isOn: boolean): void {
  if (AppState.get<boolean>('effect.inProgress')) return;
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = `${room} light turned ${isOn ? 'on' : 'off'}`;
  utterance.rate = 1.0;
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}

/**
 * Voice announcements module export
 */
export const VoiceAnnouncements = {
  announceMotion,
  announceLight,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as Window & { VoiceAnnouncements?: typeof VoiceAnnouncements }).VoiceAnnouncements =
    VoiceAnnouncements;
}
