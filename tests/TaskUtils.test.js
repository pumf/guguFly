import { describe, it, expect } from 'vitest';
import {
  pad2,
  formatDuration,
  getDateKey,
  dayDiff,
  getMaxDayForMonth,
  daysUntilMonthDay,
  compareVersions,
  repeatSummary,
  matchesFilter,
  getTaskSortScore,
  getTaskTimeAnchor,
  getTaskGroupKey,
  getCleanTasks,
  hydrateTasks,
  normalizeRepeat,
  computeNextAlarmDate,
  isAlarmDueToday,
  nextTriggerText,
} from '../src/tasks/TaskUtils.js';

describe('pad2', () => {
  it('pads single digit', () => expect(pad2(5)).toBe('05'));
  it('keeps double digit', () => expect(pad2(12)).toBe('12'));
  it('handles zero', () => expect(pad2(0)).toBe('00'));
});

describe('formatDuration', () => {
  it('formats seconds only', () => expect(formatDuration(45)).toBe('00:45'));
  it('formats minutes and seconds', () => expect(formatDuration(125)).toBe('02:05'));
  it('formats zero', () => expect(formatDuration(0)).toBe('00:00'));
});

describe('getDateKey', () => {
  it('formats date', () => {
    const d = new Date(2026, 0, 5);
    expect(getDateKey(d)).toBe('2026-01-05');
  });
});

describe('dayDiff', () => {
  it('calculates same day', () => expect(dayDiff('2026-01-05', '2026-01-05')).toBe(0));
  it('calculates one day diff', () => expect(dayDiff('2026-01-05', '2026-01-06')).toBe(1));
  it('returns null for null input', () => expect(dayDiff(null, '2026-01-05')).toBeNull());
});

describe('getMaxDayForMonth', () => {
  it('returns 31 for January', () => expect(getMaxDayForMonth(1)).toBe(31));
  it('returns 29 for February (leap)', () => expect(getMaxDayForMonth(2)).toBe(29));
  it('returns 30 for April', () => expect(getMaxDayForMonth(4)).toBe(30));
});

describe('daysUntilMonthDay', () => {
  it('returns positive days', () => {
    const days = daysUntilMonthDay(12, 25);
    expect(days).toBeGreaterThan(0);
  });
});

describe('compareVersions', () => {
  it('equal versions', () => expect(compareVersions('v0.4.0', 'v0.4.0')).toBe(0));
  it('newer version', () => expect(compareVersions('v0.5.0', 'v0.4.0')).toBe(1));
  it('older version', () => expect(compareVersions('v0.3.0', 'v0.4.0')).toBe(-1));
  it('handles different lengths', () => expect(compareVersions('v0.4', 'v0.4.0')).toBe(0));
});

describe('repeatSummary', () => {
  it('no repeat (empty array)', () => expect(repeatSummary({ repeat: [] })).toBe('仅一次'));
  it('every day', () => expect(repeatSummary({ repeat: [0,1,2,3,4,5,6] })).toBe('每天'));
  it('weekdays', () => expect(repeatSummary({ repeat: [1,2,3,4,5] })).toBe('工作日'));
  it('weekend', () => expect(repeatSummary({ repeat: [6,0] })).toBe('周末'));
  it('specific days', () => expect(repeatSummary({ repeat: [1,3,5] })).toBe('一三五'));

  it('new format: monthly_date', () => expect(repeatSummary({ repeat: { type: 'monthly_date', day: 15 } })).toBe('每月15号'));
  it('new format: monthly_weekday', () => expect(repeatSummary({ repeat: { type: 'monthly_weekday', week: 2, weekday: 1 } })).toBe('每月第二个一'));
  it('new format: monthly_weekday last', () => expect(repeatSummary({ repeat: { type: 'monthly_weekday', week: 5, weekday: 5 } })).toBe('每月最后一个五'));
  it('new format: interval', () => expect(repeatSummary({ repeat: { type: 'interval', interval: 3 } })).toBe('每3天'));
});

describe('matchesFilter', () => {
  const task = { type: 'alarm', label: '测试任务', msg: '测试消息', group: 'work' };

  it('matches all type', () => expect(matchesFilter(task, 'all', 'all', '')).toBe(true));
  it('filters by type', () => expect(matchesFilter(task, 'alarm', 'all', '')).toBe(true));
  it('filters by group', () => expect(matchesFilter(task, 'all', 'work', '')).toBe(true));
  it('filters by keyword in label', () => expect(matchesFilter(task, 'all', 'all', '测试')).toBe(true));
  it('filters by keyword in msg', () => expect(matchesFilter(task, 'all', 'all', '消息')).toBe(true));
  it('rejects non-matching keyword', () => expect(matchesFilter(task, 'all', 'all', '不存在')).toBe(false));
  it('rejects wrong type', () => expect(matchesFilter(task, 'countdown', 'all', '')).toBe(false));
});

describe('getTaskSortScore', () => {
  it('running tasks have priority', () => {
    const running = { enabled: true, _status: 'running', type: 'alarm' };
    const idle = { enabled: true, _status: 'idle', type: 'alarm' };
    expect(getTaskSortScore(running)).toBeLessThan(getTaskSortScore(idle));
  });
  it('disabled tasks go last', () => {
    const disabled = { enabled: false, _status: 'idle', type: 'alarm' };
    const enabled = { enabled: true, _status: 'idle', type: 'alarm' };
    expect(getTaskSortScore(disabled)).toBeGreaterThan(getTaskSortScore(enabled));
  });
});

describe('getTaskGroupKey', () => {
  it('in_progress for running', () => expect(getTaskGroupKey({ enabled: true, _status: 'running', type: 'alarm' })).toBe('in_progress'));
  it('disabled for disabled', () => expect(getTaskGroupKey({ enabled: false, _status: 'idle', type: 'alarm' })).toBe('disabled'));
  it('upcoming for enabled alarm', () => expect(getTaskGroupKey({ enabled: true, _status: 'idle', type: 'alarm' })).toBe('upcoming'));
  it('special_dates for holiday', () => expect(getTaskGroupKey({ enabled: true, _status: 'idle', type: 'holiday' })).toBe('special_dates'));
});

describe('getCleanTasks', () => {
  it('strips runtime state and normalizes repeat', () => {
    const tasks = [{ id: 1, type: 'alarm', label: 'test', enabled: true, hour: 9, minute: 0, repeat: [1,3,5], _lastTriggeredDate: null, _timer: {}, _status: 'running', flightMode: 'once', loopCount: 3, loopInterval: 5, intervalCount: 10 }];
    const clean = getCleanTasks(tasks);
    expect(clean[0]).not.toHaveProperty('_timer');
    expect(clean[0]).toHaveProperty('hour', 9);
    expect(clean[0]).toHaveProperty('type', 'alarm');
    expect(clean[0].repeat).toEqual({ type: 'weekly', days: [1,3,5] });
  });

  it('preserves new format repeat', () => {
    const tasks = [{ id: 1, type: 'alarm', label: 'test', enabled: true, hour: 9, minute: 0, repeat: { type: 'monthly_date', day: 15 }, _lastTriggeredDate: null, flightMode: 'once', loopCount: 3, loopInterval: 5, intervalCount: 10 }];
    const clean = getCleanTasks(tasks);
    expect(clean[0].repeat).toEqual({ type: 'monthly_date', day: 15 });
  });

  it('preserves paused countdown remaining', () => {
    const tasks = [{ id: 1, type: 'countdown', label: 'cd', enabled: true, duration: 300, _remaining: 150, _status: 'paused', flightMode: 'once', loopCount: 3, loopInterval: 5, intervalCount: 10 }];
    const clean = getCleanTasks(tasks);
    expect(clean[0]._remaining).toBe(150);
    expect(clean[0]._status).toBe('paused');
  });

  it('resets idle countdown remaining', () => {
    const tasks = [{ id: 1, type: 'countdown', label: 'cd', enabled: true, duration: 300, _remaining: 100, _status: 'idle', flightMode: 'once', loopCount: 3, loopInterval: 5, intervalCount: 10 }];
    const clean = getCleanTasks(tasks);
    expect(clean[0]._remaining).toBeUndefined();
    expect(clean[0]._status).toBe('idle');
  });
});

describe('hydrateTasks', () => {
  it('hydrates saved tasks with defaults', () => {
    const saved = [{ id: 1, type: 'alarm', label: 'test', enabled: true, hour: 9, minute: 0, repeat: [] }];
    const result = hydrateTasks(saved);
    expect(result.tasks).toHaveLength(1);
    expect(result.maxId).toBe(2);
    expect(result.tasks[0].flightMode).toBe('once');
    expect(result.tasks[0]._timer).toBeNull();
    expect(result.tasks[0].repeat).toEqual({ type: 'weekly', days: [] });
  });

  it('hydrates old array-format repeat to object', () => {
    const saved = [{ id: 5, type: 'alarm', label: 'test', enabled: true, hour: 9, minute: 0, repeat: [1,2,3,4,5] }];
    const result = hydrateTasks(saved);
    expect(result.tasks[0].repeat).toEqual({ type: 'weekly', days: [1,2,3,4,5] });
  });

  it('preserves new object-format repeat', () => {
    const saved = [{ id: 3, type: 'alarm', label: 'test', enabled: true, hour: 9, minute: 0, repeat: { type: 'interval', interval: 5 } }];
    const result = hydrateTasks(saved);
    expect(result.tasks[0].repeat).toEqual({ type: 'interval', interval: 5 });
  });
});

describe('normalizeRepeat', () => {
  it('converts empty array', () => expect(normalizeRepeat({ repeat: [] })).toEqual({ type: 'weekly', days: [] }));
  it('converts array with days', () => expect(normalizeRepeat({ repeat: [1,3,5] })).toEqual({ type: 'weekly', days: [1,3,5] }));
  it('passes through object format', () => expect(normalizeRepeat({ repeat: { type: 'monthly_date', day: 20 } })).toEqual({ type: 'monthly_date', day: 20 }));
  it('handles null repeat', () => expect(normalizeRepeat({})).toEqual({ type: 'weekly', days: [] }));
});

describe('computeNextAlarmDate', () => {
  it('weekly: returns next day in same week', () => {
    // 2026-01-05 is Monday
    const now = new Date(2026, 0, 5, 10, 0);
    const task = { type: 'alarm', hour: 14, minute: 30, repeat: { type: 'weekly', days: [1, 3, 5] } };
    const next = computeNextAlarmDate(task, now);
    expect(next).toEqual(new Date(2026, 0, 5, 14, 30));
  });

  it('weekly: returns next day later in week', () => {
    // 2026-01-05 Monday, next Wednesday
    const now = new Date(2026, 0, 5, 10, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [3, 5] } };
    const next = computeNextAlarmDate(task, now);
    // Wednesday 2026-01-07
    expect(next).toEqual(new Date(2026, 0, 7, 9, 0));
  });

  it('weekly: returns next week if today done', () => {
    const now = new Date(2026, 0, 5, 10, 0); // Monday
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [1] } };
    const next = computeNextAlarmDate(task, now);
    // Next Monday 2026-01-12
    expect(next).toEqual(new Date(2026, 0, 12, 9, 0));
  });

  it('no repeat (empty days) returns null if time passed', () => {
    const now = new Date(2026, 0, 5, 10, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [] } };
    const next = computeNextAlarmDate(task, now);
    expect(next).toBeNull();
  });

  it('monthly_date: returns current month date if later today', () => {
    const now = new Date(2026, 0, 15, 10, 0);
    const task = { type: 'alarm', hour: 14, minute: 0, repeat: { type: 'monthly_date', day: 15 } };
    const next = computeNextAlarmDate(task, now);
    expect(next).toEqual(new Date(2026, 0, 15, 14, 0));
  });

  it('monthly_date: returns next month if date passed', () => {
    const now = new Date(2026, 0, 16, 10, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'monthly_date', day: 15 } };
    const next = computeNextAlarmDate(task, now);
    // Feb 15 is the next occurrence
    expect(next).toEqual(new Date(2026, 1, 15, 9, 0));
  });

  it('monthly_weekday: 2nd Monday of month', () => {
    const now = new Date(2026, 0, 1, 10, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'monthly_weekday', week: 2, weekday: 1 } };
    const next = computeNextAlarmDate(task, now);
    // 2nd Monday of Jan 2026: Jan 12
    expect(next).toEqual(new Date(2026, 0, 12, 9, 0));
  });

  it('interval: every 3 days', () => {
    const now = new Date(2026, 0, 5, 10, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'interval', interval: 3 } };
    const next = computeNextAlarmDate(task, now);
    // origin is 2024-01-01
    // Every 3rd day from origin: 2024-01-01, 2024-01-04, 2024-01-07, ...
    // Days from origin to now = 735, next interval = ceil((735+1)/3)*3 = 738
    // 2024-01-01 + 738 days = 2026-01-08
    expect(next).toEqual(new Date(2026, 0, 8, 9, 0));
  });
});

describe('isAlarmDueToday', () => {
  it('returns false if already triggered today', () => {
    const now = new Date(2026, 0, 5, 9, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [1] }, _lastTriggeredDate: now.toDateString() };
    expect(isAlarmDueToday(task, now)).toBe(false);
  });

  it('returns false if day not in weekly repeat', () => {
    const now = new Date(2026, 0, 5, 9, 0); // Monday
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [3, 5] }, _lastTriggeredDate: null };
    expect(isAlarmDueToday(task, now)).toBe(false);
  });

  it('returns true for matching weekly', () => {
    const now = new Date(2026, 0, 5, 9, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [1] }, _lastTriggeredDate: null };
    expect(isAlarmDueToday(task, now)).toBe(true);
  });

  it('returns true for matching monthly_date', () => {
    const now = new Date(2026, 0, 15, 9, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'monthly_date', day: 15 }, _lastTriggeredDate: null };
    expect(isAlarmDueToday(task, now)).toBe(true);
  });

  it('returns false for monthly_date not matching', () => {
    const now = new Date(2026, 0, 16, 9, 0);
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'monthly_date', day: 15 }, _lastTriggeredDate: null };
    expect(isAlarmDueToday(task, now)).toBe(false);
  });
});

describe('nextTriggerText', () => {
  it('returns today triggered text when already triggered', () => {
    const today = new Date().toDateString();
    const task = { type: 'alarm', hour: 9, minute: 0, repeat: { type: 'weekly', days: [1] }, _lastTriggeredDate: today };
    expect(nextTriggerText(task)).toBe('今天已触发');
  });

  it('returns expired for no-repeat past time', () => {
    // Simulate a past time today
    const now = new Date();
    const pastHour = now.getHours() - 1;
    const task = { type: 'alarm', hour: pastHour, minute: 0, repeat: { type: 'weekly', days: [] }, _lastTriggeredDate: null };
    const text = nextTriggerText(task);
    expect(text === '已过期' || text === '').toBe(true);
  });

  it('returns today time for future time with no-repeat', () => {
    const now = new Date();
    const futureHour = Math.min(23, now.getHours() + 1);
    const task = { type: 'alarm', hour: futureHour, minute: 0, repeat: { type: 'weekly', days: [] }, _lastTriggeredDate: null };
    const text = nextTriggerText(task);
    expect(text).toContain('今天');
  });
});
