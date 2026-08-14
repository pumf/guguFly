import { get, set } from '../storage.js';

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
    display: await get('display'),
    quietHoursEnabled: await get('quietHoursEnabled'),
    quietStartHour: await get('quietStartHour'),
    quietEndHour: await get('quietEndHour'),
    miniWindowEnabled: await get('miniWindowEnabled'),
    miniWindowPosition: await get('miniWindowPosition'),
    theme: await get('theme'),
    language: await get('language'),
    smartPauseEnabled: await get('smartPauseEnabled'),
    naturalBreakEnabled: await get('naturalBreakEnabled'),
    naturalBreakThreshold: await get('naturalBreakThreshold'),
    workScheduleEnabled: await get('workScheduleEnabled'),
    workSchedule: await get('workSchedule'),
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

const DEFAULT_WORK_SCHEDULE = {
  0: { enabled: false, start: 9, end: 18 },
  1: { enabled: true, start: 9, end: 18 },
  2: { enabled: true, start: 9, end: 18 },
  3: { enabled: true, start: 9, end: 18 },
  4: { enabled: true, start: 9, end: 18 },
  5: { enabled: true, start: 9, end: 18 },
  6: { enabled: false, start: 9, end: 18 },
};

export function isWithinWorkSchedule(schedule) {
  if (!schedule) return true;
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMinutes = h * 60 + m;

  const dayConfig = schedule[day];
  if (!dayConfig || !dayConfig.enabled) return false;

  const startMinutes = (dayConfig.start || 0) * 60;
  const endMinutes = (dayConfig.end || 24) * 60;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function getDefaultWorkSchedule() {
  return { ...DEFAULT_WORK_SCHEDULE };
}

export function getNextWorkWindow(schedule) {
  if (!schedule) return null;
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMinutes = h * 60 + m;

  for (let i = 0; i < 7; i++) {
    const checkDay = (day + i) % 7;
    const dayConfig = schedule[checkDay];
    if (!dayConfig || !dayConfig.enabled) continue;

    const startMinutes = (dayConfig.start || 0) * 60;
    if (i === 0 && currentMinutes < startMinutes) {
      return { day: checkDay, hour: dayConfig.start, minutes: startMinutes - currentMinutes };
    }
    if (i > 0) {
      return { day: checkDay, hour: dayConfig.start, minutes: startMinutes - currentMinutes + i * 24 * 60 };
    }
  }
  return null;
}
