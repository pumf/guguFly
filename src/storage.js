import { Store } from '@tauri-apps/plugin-store';

let store = null;
let browserStoreAvailable = null;

function isBrowserStoreAvailable() {
  if (browserStoreAvailable !== null) return browserStoreAvailable;
  try {
    const key = '__gugufly_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    browserStoreAvailable = true;
  } catch (e) {
    browserStoreAvailable = false;
  }
  return browserStoreAvailable;
}

async function getStore() {
  if (!store) {
    try {
      store = await Store.load('config.json');
    } catch (e) {
      store = {
        async get(key) {
          if (!isBrowserStoreAvailable()) return undefined;
          const raw = window.localStorage.getItem(`gugufly:${key}`);
          return raw === null ? undefined : JSON.parse(raw);
        },
        async set(key, value) {
          if (!isBrowserStoreAvailable()) return;
          window.localStorage.setItem(`gugufly:${key}`, JSON.stringify(value));
        },
        async save() {},
        async entries() {
          if (!isBrowserStoreAvailable()) return [];
          const pairs = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key || !key.startsWith('gugufly:')) continue;
            pairs.push([key.slice('gugufly:'.length), JSON.parse(window.localStorage.getItem(key))]);
          }
          return pairs;
        },
      };
    }
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
  const val = await s.get(key);
  return val !== undefined ? val : DEFAULTS[key];
}

export async function set(key, value) {
  const s = await getStore();
  await s.set(key, value);
  await s.save();
}

export async function getAll() {
  const s = await getStore();
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
