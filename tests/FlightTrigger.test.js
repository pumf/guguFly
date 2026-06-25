import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFlightTrigger, registerFlightTrigger, clearFlightStreak, doTriggerFlight } from '../src/flight/FlightTrigger.js';

describe('FlightTrigger', () => {
  let store;
  let todayCountEl;
  let recordFlightTrigger;
  let notifyFlightTriggered;
  let renderStatsPanel;
  let triggerFlightWithMode;

  beforeEach(() => {
    store = new Map([
      ['streak', 0],
      ['streakLastDate', null],
    ]);
    todayCountEl = { textContent: '' };
    recordFlightTrigger = vi.fn(async () => {});
    notifyFlightTriggered = vi.fn();
    renderStatsPanel = vi.fn(async () => {});
    triggerFlightWithMode = vi.fn();

    initFlightTrigger({
      incrementTodayCount: vi.fn(async () => 3),
      todayCountEl,
      getDateKey: () => '2026-06-17',
      get: vi.fn(async (key) => store.get(key)),
      set: vi.fn(async (key, value) => { store.set(key, value); }),
      resetStreak: vi.fn(async () => { store.set('streak', 0); }),
      dayDiff: (from, to) => {
        if (!from || !to) return null;
        if (from === to) return 0;
        if (from === '2026-06-16' && to === '2026-06-17') return 1;
        return 2;
      },
      isInQuietHours: vi.fn(() => false),
      quietHoursToggle: {},
      quietStartHour: {},
      quietEndHour: {},
      getRandomQuote: vi.fn(() => '随机文案'),
      recordFlightTrigger,
      notifyFlightTriggered,
      renderStatsPanel,
      triggerFlightWithMode,
    });
  });

  it('registers today count and initializes first streak', async () => {
    await registerFlightTrigger();

    expect(todayCountEl.textContent).toBe('3 次');
    expect(store.get('streak')).toBe(1);
    expect(store.get('streakLastDate')).toBe('2026-06-17');
  });

  it('increments streak only on consecutive day', async () => {
    store.set('streak', 4);
    store.set('streakLastDate', '2026-06-16');

    await registerFlightTrigger();

    expect(store.get('streak')).toBe(5);
  });

  it('keeps streak unchanged on same day retrigger', async () => {
    store.set('streak', 4);
    store.set('streakLastDate', '2026-06-17');

    await registerFlightTrigger();

    expect(store.get('streak')).toBe(4);
  });

  it('clears flight streak', async () => {
    store.set('streak', 7);
    store.set('streakLastDate', '2026-06-17');

    await clearFlightStreak();

    expect(store.get('streak')).toBe(0);
    expect(store.get('streakLastDate')).toBeNull();
  });

  it('triggers flight side effects when not in quiet hours', async () => {
    const task = { label: '喝水', msg: '记得喝水', type: 'alarm' };

    await doTriggerFlight(task);

    expect(recordFlightTrigger).toHaveBeenCalledWith(task);
    expect(notifyFlightTriggered).toHaveBeenCalledWith('喝水', '记得喝水', 'alarm');
    expect(renderStatsPanel).toHaveBeenCalled();
    expect(triggerFlightWithMode).toHaveBeenCalledWith(task, null, null, null, null);
  });
});
