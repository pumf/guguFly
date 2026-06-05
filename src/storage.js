import { Store } from '@tauri-apps/plugin-store';

let store = null;

const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

const BROWSER_KEY_PREFIX = 'gugufly:';

function browserGet(key) {
  try {
    const raw = window.localStorage.getItem(BROWSER_KEY_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

function browserSet(key, value) {
  try {
    window.localStorage.setItem(BROWSER_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {}
}

async function browserEntries() {
  const pairs = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(BROWSER_KEY_PREFIX)) continue;
    try {
      pairs.push([key.slice(BROWSER_KEY_PREFIX.length), JSON.parse(window.localStorage.getItem(key))]);
    } catch (e) {}
  }
  return pairs;
}

async function getStore() {
  if (store) return store;
  if (isTauri) {
    try {
      store = await Store.load('config.json');
    } catch (e) {
      store = null;
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
  await s.set(key, value);
  if (s.save) await s.save();
}

export async function getAll() {
  const s = await getStore();
  if (!s) return DEFAULTS;
  const entries = await s.entries();
  return { ...DEFAULTS, ...Object.fromEntries(entries) };
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

export async function incrementStreak() {
  const streak = (await get('streak')) + 1;
  await set('streak', streak);
  return streak;
}

export async function resetStreak() {
  await set('streak', 0);
  return 0;
}
