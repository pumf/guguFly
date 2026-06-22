import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getNextSolarFromLunar, getLunarLabel, lunarToSolarDate } from '../src/tasks/LunarUtils.js';

describe('getNextSolarFromLunar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('converts lunar 8/15 to solar for 2026', () => {
    const result = lunarToSolarDate(2026, 8, 15);
    expect(result).toEqual({ year: 2026, month: 9, day: 25 });
  });

  it('returns next upcoming solar date for mid-autumn', () => {
    vi.setSystemTime(new Date(2026, 5, 22, 10, 0));
    const result = getNextSolarFromLunar(8, 15, new Date(2026, 5, 22, 10, 0));
    expect(result).toEqual({ year: 2026, solarMonth: 9, solarDay: 25 });
  });

  it('advances to next year when lunar date has passed', () => {
    vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
    const result = getNextSolarFromLunar(8, 15, new Date(2026, 8, 26, 10, 0));
    expect(result).toEqual({ year: 2027, solarMonth: 9, solarDay: 15 });
  });

  it('returns same year for spring festival before the date', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    const result = getNextSolarFromLunar(1, 1, new Date(2026, 0, 1, 10, 0));
    expect(result).toEqual({ year: 2026, solarMonth: 2, solarDay: 17 });
  });

  it('returns mid-autumn correctly from January', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));
    const result = getNextSolarFromLunar(8, 15, new Date(2026, 0, 15, 10, 0));
    expect(result).toEqual({ year: 2026, solarMonth: 9, solarDay: 25 });
  });

  it('returns dragon boat (lunar 5/5) solar date', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    const result = getNextSolarFromLunar(5, 5, new Date(2026, 0, 1, 10, 0));
    expect(result).toEqual({ year: 2026, solarMonth: 6, solarDay: 19 });
  });
});

describe('getLunarLabel', () => {
  it('formats lunar month 8 day 15 (mid-autumn)', () => {
    expect(getLunarLabel(8, 15)).toBe('农历八月十五');
  });

  it('formats lunar month 1 day 1 (spring festival)', () => {
    expect(getLunarLabel(1, 1)).toBe('农历正月初一');
  });

  it('formats lunar month 5 day 5 (dragon boat)', () => {
    expect(getLunarLabel(5, 5)).toBe('农历五月初五');
  });

  it('formats lunar month 9 day 9 (double ninth)', () => {
    expect(getLunarLabel(9, 9)).toBe('农历九月初九');
  });
});