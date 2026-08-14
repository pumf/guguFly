import { describe, it, expect } from 'vitest';
import { HOLIDAY_PRESETS } from '../src/tasks/HolidayPresets.js';

describe('HolidayPresets', () => {
  describe('data integrity', () => {
    it('has 24 solar terms', () => {
      const solarTerms = Object.values(HOLIDAY_PRESETS).filter(
        (preset) => preset.category === 'solar_term'
      );
      expect(solarTerms).toHaveLength(24);
    });

    it('all solar terms have lunar=false', () => {
      const solarTerms = Object.values(HOLIDAY_PRESETS).filter(
        (preset) => preset.category === 'solar_term'
      );
      solarTerms.forEach((term) => {
        expect(term.lunar).toBe(false);
      });
    });

    it('has statutory holidays with labels', () => {
      const statutory = Object.values(HOLIDAY_PRESETS).filter(
        (preset) => preset.category === 'statutory'
      );
      statutory.forEach((holiday) => {
        expect(holiday.label).toBeTruthy();
        expect(typeof holiday.label).toBe('string');
      });
    });

    it('has valid month and day ranges', () => {
      Object.values(HOLIDAY_PRESETS).forEach((preset) => {
        expect(preset.month).toBeGreaterThanOrEqual(1);
        expect(preset.month).toBeLessThanOrEqual(12);
        expect(preset.day).toBeGreaterThanOrEqual(1);
        expect(preset.day).toBeLessThanOrEqual(31);
      });
    });

    it('has lunar flag as boolean', () => {
      Object.values(HOLIDAY_PRESETS).forEach((preset) => {
        expect(typeof preset.lunar).toBe('boolean');
      });
    });
  });

  describe('specific holidays', () => {
    it('has national_day (国庆节)', () => {
      const preset = HOLIDAY_PRESETS.national_day;
      expect(preset).toBeDefined();
      expect(preset.label).toBe('国庆节');
      expect(preset.month).toBe(10);
      expect(preset.day).toBe(1);
      expect(preset.lunar).toBe(false);
    });

    it('has spring_festival (春节) as lunar', () => {
      const preset = HOLIDAY_PRESETS.spring_festival;
      expect(preset).toBeDefined();
      expect(preset.label).toBe('春节');
      expect(preset.month).toBe(1);
      expect(preset.day).toBe(1);
      expect(preset.lunar).toBe(true);
    });

    it('has mid_autumn (中秋节) as lunar', () => {
      const preset = HOLIDAY_PRESETS.mid_autumn;
      expect(preset).toBeDefined();
      expect(preset.label).toBe('中秋节');
      expect(preset.month).toBe(8);
      expect(preset.day).toBe(15);
      expect(preset.lunar).toBe(true);
    });

    it('has lichun (立春) solar term', () => {
      const preset = HOLIDAY_PRESETS.lichun;
      expect(preset).toBeDefined();
      expect(preset.label).toBe('立春');
      expect(preset.category).toBe('solar_term');
      expect(preset.month).toBe(2);
      expect(preset.day).toBe(4);
    });
  });

  describe('getHolidayByKey', () => {
    it('returns correct preset for valid key', () => {
      const preset = HOLIDAY_PRESETS['national_day'];
      expect(preset).toBeDefined();
      expect(preset.label).toBe('国庆节');
    });

    it('returns undefined for invalid key', () => {
      const preset = HOLIDAY_PRESETS['invalid_key'];
      expect(preset).toBeUndefined();
    });
  });
});