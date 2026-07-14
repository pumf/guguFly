import { Store } from '@tauri-apps/plugin-store';
import { isTauriRuntime } from './utils.js';

let store = null;
let onQuotaExceeded = null;
let onStoreFailure = null;

const BROWSER_KEY_PREFIX = 'gugufly:';

export function setStorageQuotaHandler(fn) {
  onQuotaExceeded = fn;
}

export function setStoreFailureHandler(fn) {
  onStoreFailure = fn;
}

function browserGet(key) {
  try {
    const raw = window.localStorage.getItem(BROWSER_KEY_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function browserSet(key, value) {
  try {
    window.localStorage.setItem(BROWSER_KEY_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    // QuotaExceededError, SecurityError (private browsing), etc.
    console.error('localStorage write failed:', error);
    if (onQuotaExceeded) {
      try { onQuotaExceeded(key, error); } catch (handlerErr) {
        console.error('storage quota handler failed:', handlerErr);
      }
    }
  }
}

async function browserEntries() {
  const pairs = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(BROWSER_KEY_PREFIX)) continue;
    try {
      pairs.push([key.slice(BROWSER_KEY_PREFIX.length), JSON.parse(window.localStorage.getItem(key))]);
    } catch (error) {
      console.error('localStorage entry parse failed:', error);
    }
  }
  return pairs;
}

async function getStore() {
  if (store) return store;
  if (isTauriRuntime()) {
    try {
      store = await Store.load('config.json');
    } catch (err) {
      console.error('Failed to load Tauri store:', err);
      store = null;
      if (onStoreFailure) {
        try { onStoreFailure(err); } catch (handlerErr) {
          console.error('store failure handler failed:', handlerErr);
        }
      }
    }
  } else {
    store = {
      get: browserGet,
      set: browserSet,
      save: async () => {},
      entries: browserEntries,
    };
  }
  return store;
}

const DEFAULTS = {
  minutes: 25,
  seconds: 0,
  repeat: false,
  repeatInterval: 30,
  muted: false,
  todayCount: 0,
  streak: 0,
  lastDate: null,
};

export async function get(key) {
  const s = await getStore();
  if (!s) return DEFAULTS[key];
  const val = await s.get(key);
  return val !== undefined ? val : DEFAULTS[key];
}

export async function set(key, value) {
  const s = await getStore();
  if (!s) return;
  try {
    await s.set(key, value);
    if (s.save) await s.save();
  } catch (e) {
    console.error('storage set failed:', key, e);
  }
}

export async function loadTasks() {
  const val = await get('_tasks');
  return val || [];
}

export async function saveTasks(tasks) {
  await set('_tasks', tasks);
}

export async function incrementTodayCount() {
  const date = new Date().toDateString();
  const lastDate = await get('lastDate');

  if (lastDate !== date) {
    await set('lastDate', date);
    await set('todayCount', 1);
    return 1;
  }

  const count = (await get('todayCount')) + 1;
  await set('todayCount', count);
  return count;
}

export async function resetStreak() {
  await set('streak', 0);
  return 0;
}

const FLIGHT_LOG_KEY = '_flightLog';
const FLIGHT_LOG_RETENTION_DAYS = 90;

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEmptyDayLog() {
  return { totalCount: 0, byTask: {}, byType: { alarm: 0, countdown: 0, holiday: 0, anniversary: 0 } };
}

function pruneOldEntries(log) {
  if (!Array.isArray(log)) return [];
  const cutoff = Date.now() - FLIGHT_LOG_RETENTION_DAYS * 86400000;
  return log.filter(entry => entry && entry.date && new Date(entry.date).getTime() >= cutoff - 86400000);
}

export async function loadFlightLog() {
  const log = await get(FLIGHT_LOG_KEY);
  return pruneOldEntries(Array.isArray(log) ? log : []);
}

export async function recordFlightTrigger(task) {
  if (!task || !task.type || task.id == null) return null;
  const today = getDateKey();
  const log = await loadFlightLog();
  let day = log.find(d => d.date === today);
  if (!day) {
    day = { date: today, ...getEmptyDayLog() };
    log.push(day);
  }
  day.totalCount += 1;
  day.byTask[task.id] = (day.byTask[task.id] || 0) + 1;
  day.byType[task.type] = (day.byType[task.type] || 0) + 1;
  await set(FLIGHT_LOG_KEY, log);
  return day;
}

export async function computeFlightStats() {
  const log = await loadFlightLog();
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date));
  const totalCount = sorted.reduce((s, d) => s + d.totalCount, 0);
  const last7 = sorted.slice(-7);
  const last30 = sorted.slice(-30);
  const last7Total = last7.reduce((s, d) => s + d.totalCount, 0);
  const last30Total = last30.reduce((s, d) => s + d.totalCount, 0);
  const prev7Start = Math.max(0, sorted.length - 14);
  const prev7 = sorted.slice(prev7Start, prev7Start + 7);
  const prev7Total = prev7.reduce((s, d) => s + d.totalCount, 0);
  let trend = null;
  if (prev7Total > 0) {
    trend = Math.round(((last7Total - prev7Total) / prev7Total) * 100);
  } else if (last7Total > 0) {
    trend = 100;
  }
  const byTypeTotals = { alarm: 0, countdown: 0, holiday: 0, anniversary: 0 };
  for (const d of sorted) {
    if (d.byType) {
      for (const k of Object.keys(byTypeTotals)) {
        byTypeTotals[k] += d.byType[k] || 0;
      }
    }
  }
  const taskTotals = {};
  for (const d of sorted) {
    if (d.byTask) {
      for (const [taskId, count] of Object.entries(d.byTask)) {
        taskTotals[taskId] = (taskTotals[taskId] || 0) + count;
      }
    }
  }
  return {
    totalCount,
    last7Total,
    last30Total,
    trend,
    byType: byTypeTotals,
    taskTotals,
    daily: last7,
  };
}
