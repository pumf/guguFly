import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAlarmChecker, destroyAlarmChecker, getNextUpcomingTask } from '../src/tasks/AlarmChecker.js';

function createMockCtx(tasks = []) {
  return {
    getTasks: () => tasks,
    saveTasks: vi.fn(),
    getCleanTasks: (ts) => ts,
    doTriggerFlight: vi.fn(),
    showToast: vi.fn(),
    updateNextUpcoming: vi.fn(),
    updateMiniWindow: vi.fn(),
    isInQuietHours: () => false,
    getQuietHoursConfig: () => ({ quietHoursToggle: null, quietStartHour: null, quietEndHour: null }),
    normalizeRepeat: () => ({ type: 'daily', days: [] }),
    isAlarmDueToday: () => true,
  };
}

beforeEach(() => {
  destroyAlarmChecker();
});

describe('getNextUpcomingTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns null for empty tasks', async () => {
    initAlarmChecker(createMockCtx([]));
    const result = await getNextUpcomingTask();
    expect(result).toBeNull();
  });

  it('returns null when all tasks are disabled', async () => {
    const tasks = [
      { id: 1, type: 'alarm', enabled: false, hour: 10, minute: 30 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result).toBeNull();
  });

  it('picks the nearest enabled alarm task today', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 0, 0));
    const tasks = [
      { id: 1, type: 'alarm', enabled: true, hour: 10, minute: 30 },
      { id: 2, type: 'alarm', enabled: true, hour: 9, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result).not.toBeNull();
    expect(result.task.id).toBe(2);
    expect(result.seconds).toBe(3600);
  });

  it('skips already triggered alarms', async () => {
    const today = new Date(2026, 5, 16, 8, 0, 0);
    vi.setSystemTime(today);
    const tasks = [
      { id: 1, type: 'alarm', enabled: true, hour: 7, minute: 0, _lastTriggeredDate: today.toDateString() },
      { id: 2, type: 'alarm', enabled: true, hour: 9, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result.task.id).toBe(2);
  });

  it('returns null for one-time alarm after time passed', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 14, 0, 0));
    const tasks = [
      { id: 1, type: 'alarm', enabled: true, hour: 10, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result).toBeNull();
  });

  it('wraps recurring weekly alarm to next day', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 14, 0, 0));
    const tasks = [
      { id: 1, type: 'alarm', enabled: true, hour: 10, minute: 0, repeat: { type: 'weekly', days: [2, 3] } },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result).not.toBeNull();
    expect(result.task.id).toBe(1);
    expect(result.seconds).toBe(72000);
  });

  it('picks the nearest holiday task', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 0, 0)); // June 16
    const tasks = [
      { id: 1, type: 'holiday', enabled: true, month: 6, day: 16, hour: 10, minute: 0 },
      { id: 2, type: 'holiday', enabled: true, month: 6, day: 20, hour: 9, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result.task.id).toBe(1);
  });

  it('picks the nearest anniversary task', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 0, 0));
    const tasks = [
      { id: 1, type: 'anniversary', enabled: true, month: 6, day: 16, hour: 11, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result.task.id).toBe(1);
  });

  it('picks running countdown with least remaining time', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 0, 0));
    const tasks = [
      { id: 1, type: 'countdown', enabled: true, _status: 'running', _remaining: 120 },
      { id: 2, type: 'countdown', enabled: true, _status: 'running', _remaining: 300 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result.task.id).toBe(1);
    expect(result.seconds).toBe(120);
  });

  it('prioritizes the task with least seconds remaining across types', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 55, 0));
    const tasks = [
      { id: 1, type: 'countdown', enabled: true, _status: 'running', _remaining: 600 },
      { id: 2, type: 'alarm', enabled: true, hour: 9, minute: 0 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    // alarm at 9:00 is 300s away, countdown is 600s away
    expect(result.task.id).toBe(2);
    expect(result.seconds).toBe(300);
  });

  it('ignores non-running countdown tasks', async () => {
    vi.setSystemTime(new Date(2026, 5, 16, 8, 0, 0));
    const tasks = [
      { id: 1, type: 'countdown', enabled: true, _status: 'paused', _remaining: 60 },
    ];
    initAlarmChecker(createMockCtx(tasks));
    const result = await getNextUpcomingTask();
    expect(result).toBeNull();
  });
});

describe('destroyAlarmChecker', () => {
  it('cleans up without error when not initialized', () => {
    expect(() => destroyAlarmChecker()).not.toThrow();
  });

  it('cleans up without error after initialization', () => {
    initAlarmChecker(createMockCtx([]));
    expect(() => destroyAlarmChecker()).not.toThrow();
  });
});
