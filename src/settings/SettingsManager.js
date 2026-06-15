import { get, set } from '../storage.js';
import { applyTheme } from './ThemeManager.js';

export async function loadSettings() {
  return {
    muted: await get('muted'),
    todayCount: await get('todayCount'),
    streak: await get('streak'),
    lastDate: await get('lastDate'),
    speed: await get('speed'),
    height: await get('height'),
    effect: await get('effect'),
    plane: await get('plane'),
    particle: await get('particle'),
    bubble: await get('bubble'),
    bubblePosition: await get('bubblePosition'),
    sound: await get('sound'),
    soundMode: await get('soundMode'),
    useSound: await get('useSound'),
    customImage: await get('customImage'),
    customAudio: await get('customAudio'),
    customAudioName: await get('customAudioName'),
    useImage: await get('useImage'),
    theme: await get('theme'),
  };
}

export async function persistSetting(key, value) {
  await set(key, value);
}

export async function persistFlightSettings(config) {
  await Promise.all([
    persistSetting('speed', config.speed),
    persistSetting('height', config.height),
    persistSetting('effect', config.effect),
    persistSetting('plane', config.plane),
    persistSetting('particle', config.particle),
    persistSetting('bubble', config.bubble),
    persistSetting('bubblePosition', config.bubblePosition),
    persistSetting('sound', config.sound),
    persistSetting('soundMode', config.soundMode),
    persistSetting('useSound', config.useSound),
    persistSetting('useImage', config.useImage),
  ]);
}

export function isInQuietHours(quietHoursToggle, quietStartHour, quietEndHour) {
  if (!quietHoursToggle?.checked) return false;
  const now = new Date();
  const h = now.getHours();
  const start = parseInt(quietStartHour?.value) || 22;
  const end = parseInt(quietEndHour?.value) || 8;
  if (start <= end) {
    return h >= start && h < end;
  }
  return h >= start || h < end;
}
