import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let mockStorage = new Map();

beforeEach(() => {
  mockStorage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStorage.get(key) ?? null,
      setItem: (key, value) => { mockStorage.set(key, value); },
      removeItem: (key) => { mockStorage.delete(key); },
      get length() { return mockStorage.size; },
      key: (index) => [...mockStorage.keys()][index] ?? null,
      clear: () => mockStorage.clear(),
    },
  };
});

afterEach(() => {
  delete globalThis.window;
});

const STORE_KEY_PREFIX = 'gugufly:';

describe('storage get/set', () => {
  it('get returns default for missing key', async () => {
    const { get } = await import('../src/storage.js');
    const val = await get('minutes');
    expect(val).toBe(25);
  });

  it('set then get returns the stored value', async () => {
    const { set, get } = await import('../src/storage.js');
    await set('minutes', 30);
    const val = await get('minutes');
    expect(val).toBe(30);
  });

  it('set persists value in localStorage with prefix', async () => {
    const { set } = await import('../src/storage.js');
    await set('testKey', 'hello');
    const raw = mockStorage.get(STORE_KEY_PREFIX + 'testKey');
    expect(JSON.parse(raw)).toBe('hello');
  });

  it('get retrieves value stored directly in localStorage', async () => {
    mockStorage.set(STORE_KEY_PREFIX + 'testKey', JSON.stringify(42));
    const { get } = await import('../src/storage.js');
    const val = await get('testKey');
    expect(val).toBe(42);
  });
});

describe('loadTasks / saveTasks', () => {
  it('loadTasks returns empty array by default', async () => {
    const { loadTasks } = await import('../src/storage.js');
    const tasks = await loadTasks();
    expect(tasks).toEqual([]);
  });

  it('saveTasks then loadTasks returns the tasks', async () => {
    const { saveTasks, loadTasks } = await import('../src/storage.js');
    const sample = [{ id: 1, type: 'alarm', enabled: true }];
    await saveTasks(sample);
    const loaded = await loadTasks();
    expect(loaded).toEqual(sample);
  });

  it('loadTasks returns stored value directly', async () => {
    mockStorage.set(STORE_KEY_PREFIX + '_tasks', JSON.stringify('not an array'));
    const { loadTasks } = await import('../src/storage.js');
    const tasks = await loadTasks();
    expect(tasks).toBe('not an array');
  });
});

describe('incrementTodayCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns 1 on first call of the day', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { incrementTodayCount } = await import('../src/storage.js');
    const count = await incrementTodayCount();
    expect(count).toBe(1);
  });

  it('increments count on same day', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { incrementTodayCount } = await import('../src/storage.js');
    await incrementTodayCount();
    await incrementTodayCount();
    const count = await incrementTodayCount();
    expect(count).toBe(3);
  });

  it('resets count on new day', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { incrementTodayCount } = await import('../src/storage.js');
    await incrementTodayCount();
    await incrementTodayCount();
    vi.setSystemTime(new Date(2026, 5, 17, 10, 0, 0));
    const count = await incrementTodayCount();
    expect(count).toBe(1);
  });
});

describe('resetStreak', () => {
  it('resets streak to 0', async () => {
    const { set, resetStreak } = await import('../src/storage.js');
    await set('streak', 10);
    const result = await resetStreak();
    expect(result).toBe(0);
    const val = await import('../src/storage.js').then(m => m.get('streak'));
    expect(val).toBe(0);
  });
});

describe('settings keys', () => {
  it('supports newer persisted settings', async () => {
    const { set, get } = await import('../src/storage.js');
    await set('display', 'active');
    await set('quietHoursEnabled', true);
    await set('quietStartHour', 23);
    await set('quietEndHour', 7);
    await set('miniWindowEnabled', true);
    await set('miniWindowPosition', 'bottom-right');

    await expect(get('display')).resolves.toBe('active');
    await expect(get('quietHoursEnabled')).resolves.toBe(true);
    await expect(get('quietStartHour')).resolves.toBe(23);
    await expect(get('quietEndHour')).resolves.toBe(7);
    await expect(get('miniWindowEnabled')).resolves.toBe(true);
    await expect(get('miniWindowPosition')).resolves.toBe('bottom-right');
  });
});

describe('flight log', () => {
  it('loadFlightLog returns empty array when no log exists', async () => {
    const { loadFlightLog } = await import('../src/storage.js');
    const log = await loadFlightLog();
    expect(log).toEqual([]);
  });

  it('recordFlightTrigger creates a new day entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { recordFlightTrigger, loadFlightLog } = await import('../src/storage.js');
    const task = { id: 1, type: 'alarm' };
    await recordFlightTrigger(task);
    const log = await loadFlightLog();
    expect(log).toHaveLength(1);
    expect(log[0].date).toBe('2026-06-16');
    expect(log[0].totalCount).toBe(1);
    expect(log[0].byTask[1]).toBe(1);
    expect(log[0].byType.alarm).toBe(1);
  });

  it('recordFlightTrigger increments existing day entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { recordFlightTrigger } = await import('../src/storage.js');
    const task = { id: 1, type: 'alarm' };
    await recordFlightTrigger(task);
    await recordFlightTrigger(task);
    const { loadFlightLog, recordFlightTrigger: rft } = await import('../src/storage.js');
    await rft({ id: 2, type: 'countdown' });
    const log = await loadFlightLog();
    expect(log).toHaveLength(1);
    expect(log[0].totalCount).toBe(3);
    expect(log[0].byTask[1]).toBe(2);
    expect(log[0].byTask[2]).toBe(1);
    expect(log[0].byType.alarm).toBe(2);
    expect(log[0].byType.countdown).toBe(1);
  });

  it('recordFlightTrigger returns null for invalid task', async () => {
    const { recordFlightTrigger } = await import('../src/storage.js');
    const result = await recordFlightTrigger(null);
    expect(result).toBeNull();
  });
});

describe('computeFlightStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns zero stats for empty log', async () => {
    const { computeFlightStats } = await import('../src/storage.js');
    const stats = await computeFlightStats();
    expect(stats.totalCount).toBe(0);
    expect(stats.last7Total).toBe(0);
    expect(stats.last30Total).toBe(0);
    expect(stats.trend).toBeNull();
    expect(stats.byType).toEqual({ alarm: 0, countdown: 0, holiday: 0, anniversary: 0 });
  });

  it('computes stats from recorded flights', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { recordFlightTrigger, computeFlightStats } = await import('../src/storage.js');
    await recordFlightTrigger({ id: 1, type: 'alarm' });
    await recordFlightTrigger({ id: 1, type: 'alarm' });
    await recordFlightTrigger({ id: 2, type: 'countdown' });
    const stats = await computeFlightStats();
    expect(stats.totalCount).toBe(3);
    expect(stats.byType.alarm).toBe(2);
    expect(stats.byType.countdown).toBe(1);
    // Only one day in the last 7
    expect(stats.last7Total).toBe(3);
    expect(stats.daily).toHaveLength(1);
  });

  it('prunes old entries beyond retention', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 10, 0, 0));
    const { recordFlightTrigger } = await import('../src/storage.js');
    await recordFlightTrigger({ id: 1, type: 'alarm' });
    // Add an old entry directly in localStorage
    const oldDate = '2026-01-01';
    const oldEntry = {
      date: oldDate,
      totalCount: 5,
      byTask: { '3': 5 },
      byType: { alarm: 5, countdown: 0, holiday: 0, anniversary: 0 },
    };
    const oldKey = STORE_KEY_PREFIX + '_flightLog';
    const existing = JSON.parse(mockStorage.get(oldKey) || '[]');
    existing.push(oldEntry);
    mockStorage.set(oldKey, JSON.stringify(existing));
    const { loadFlightLog } = await import('../src/storage.js');
    const log = await loadFlightLog();
    expect(log).toHaveLength(1);
    expect(log[0].date).toBe('2026-06-16');
  });
});
