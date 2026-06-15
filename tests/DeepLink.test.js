import { describe, it, expect } from 'vitest';
import { parseDeepLinkUrl, buildTaskFromDeepLink } from '../src/flight/DeepLink.js';

const mockCtx = {
  createAlarmTask: () => ({ id: 1, type: 'alarm', repeat: {} }),
  createCountdownTask: () => ({ id: 2, type: 'countdown', duration: 0, _remaining: 0 }),
  createHolidayTask: () => ({ id: 3, type: 'holiday' }),
  createAnniversaryTask: () => ({ id: 4, type: 'anniversary' }),
  HOLIDAY_PRESETS: { new_year: { label: '元旦', month: 1, day: 1 } },
  formatHolidayLabel: (p) => p.label,
};

describe('parseDeepLinkUrl', () => {
  it('parses valid gugufly url', () => {
    const result = parseDeepLinkUrl('gugufly:add?type=alarm&hour=9&minute=0&msg=meeting');
    expect(result).toEqual({ action: 'add', params: { type: 'alarm', hour: '9', minute: '0', msg: 'meeting' } });
  });

  it('returns null for non-gugufly protocol', () => {
    expect(parseDeepLinkUrl('https://example.com')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseDeepLinkUrl('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseDeepLinkUrl(null)).toBeNull();
    expect(parseDeepLinkUrl(undefined)).toBeNull();
  });
});

describe('buildTaskFromDeepLink', () => {
  it('builds alarm task by default', () => {
    const task = buildTaskFromDeepLink({ hour: '10', minute: '30', days: '1,3,5' }, mockCtx);
    expect(task.type).toBe('alarm');
    expect(task.hour).toBe(10);
    expect(task.minute).toBe(30);
  });

  it('builds countdown task', () => {
    const task = buildTaskFromDeepLink({ type: 'countdown', mins: '5', secs: '0' }, mockCtx);
    expect(task.type).toBe('countdown');
    expect(task.duration).toBe(300);
  });

  it('builds holiday task', () => {
    const task = buildTaskFromDeepLink({ type: 'holiday', holidayKey: 'new_year' }, mockCtx);
    expect(task.type).toBe('holiday');
    expect(task.label).toBe('元旦');
  });
});
