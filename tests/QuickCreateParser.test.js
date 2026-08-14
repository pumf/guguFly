import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseQuickInput, formatPreview } from '../src/tasks/QuickCreateParser.js';
import { initI18n } from '../src/i18n/index.js';

describe('QuickCreateParser', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      querySelectorAll: vi.fn(() => []),
    };
    initI18n({ initialLang: 'zh-CN' });
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  describe('parseQuickInput', () => {
    it('returns null for empty or whitespace input', () => {
      expect(parseQuickInput('')).toBeNull();
      expect(parseQuickInput('   ')).toBeNull();
      expect(parseQuickInput(null)).toBeNull();
      expect(parseQuickInput(undefined)).toBeNull();
    });

    it('parses countdown with Chinese numbers', () => {
      const result = parseQuickInput('25分钟番茄');
      expect(result).toEqual({
        type: 'countdown',
        label: '番茄',
        duration: 1500,
        msg: '',
      });
    });

    it('parses countdown with hours and minutes', () => {
      const result = parseQuickInput('1小时30分钟开会');
      expect(result).toEqual({
        type: 'countdown',
        label: '开会',
        duration: 5400,
        msg: '',
      });
    });

    it('parses countdown with seconds', () => {
      const result = parseQuickInput('10秒');
      expect(result).toEqual({
        type: 'countdown',
        label: expect.any(String),
        duration: 10,
        msg: '',
      });
    });

    it('parses Chinese time (三点钟开会)', () => {
      const result = parseQuickInput('三点钟开会');
      expect(result).toEqual({
        type: 'alarm',
        label: '三点钟开会',
        hour: 3,
        minute: 0,
        repeat: { type: 'weekly', days: [] },
        msg: '',
        isTomorrow: false,
      });
    });

    it('parses Chinese time with half hour (下午3点半)', () => {
      const result = parseQuickInput('下午3点半');
      expect(result).toEqual({
        type: 'alarm',
        label: '半',
        hour: 15,
        minute: 0,
        repeat: { type: 'weekly', days: [] },
        msg: '',
        isTomorrow: false,
      });
    });

    it('parses time with tomorrow (明天9点)', () => {
      const result = parseQuickInput('明天9点');
      expect(result).toEqual({
        type: 'alarm',
        label: expect.any(String),
        hour: 9,
        minute: 0,
        repeat: { type: 'weekly', days: [] },
        msg: '',
        isTomorrow: true,
      });
    });

    it('parses weekly repeat (周一至周五站立会)', () => {
      const result = parseQuickInput('周一至周五站立会');
      expect(result).toEqual({
        type: 'alarm',
        label: '至 站立会',
        hour: 9,
        minute: 0,
        repeat: { type: 'weekly', days: [1, 5] },
        msg: '',
      });
    });

    it('parses daily repeat (每天吃药)', () => {
      const result = parseQuickInput('每天吃药');
      expect(result).toEqual({
        type: 'alarm',
        label: '吃药',
        hour: 9,
        minute: 0,
        repeat: { type: 'weekly', days: [1, 2, 3, 4, 5] },
        msg: '',
      });
    });

    it('parses holiday (国庆节)', () => {
      const result = parseQuickInput('国庆节');
      expect(result).toEqual({
        type: 'holiday',
        label: '国庆节',
        holidayKey: 'national_day',
        month: 10,
        day: 1,
        lunar: false,
        hour: 9,
        minute: 0,
        msg: '',
      });
    });

    it('parses lunar holiday (中秋节农历)', () => {
      const result = parseQuickInput('中秋节农历');
      expect(result).toEqual({
        type: 'holiday',
        label: '中秋节',
        holidayKey: 'mid_autumn',
        month: 8,
        day: 15,
        lunar: true,
        hour: 9,
        minute: 0,
        msg: '',
      });
    });

    it('parses anniversary (老婆生日5月20日)', () => {
      const result = parseQuickInput('老婆生日5月20日');
      expect(result).toEqual({
        type: 'anniversary',
        label: '老婆',
        month: 5,
        day: 20,
        lunar: false,
        hour: 9,
        minute: 0,
        msg: '',
      });
    });

    it('parses anniversary with Chinese numbers (结婚纪念日1月15日)', () => {
      const result = parseQuickInput('结婚纪念日1月15日');
      expect(result).toEqual({
        type: 'anniversary',
        label: '结婚纪念日月日',
        month: 1,
        day: 15,
        lunar: false,
        hour: 9,
        minute: 0,
        msg: '',
      });
    });

    it('returns default countdown for unrecognized input', () => {
      const result = parseQuickInput('随便写点什么');
      expect(result).toEqual({
        type: 'countdown',
        label: '随便写点什么',
        duration: 1800,
        msg: '随便写点什么',
      });
    });
  });

  describe('formatPreview', () => {
    it('returns empty string for null input', () => {
      expect(formatPreview(null)).toBe('');
    });

    it('formats countdown preview', () => {
      const result = { type: 'countdown', label: '番茄', duration: 1500 };
      const preview = formatPreview(result);
      expect(preview).toContain('⏱');
      expect(preview).toContain('番茄');
      expect(preview).toContain('25');
    });

    it('formats alarm preview', () => {
      const result = { type: 'alarm', label: '开会', hour: 9, minute: 30, repeat: { type: 'weekly', days: [] } };
      const preview = formatPreview(result);
      expect(preview).toContain('⏰');
      expect(preview).toContain('开会');
      expect(preview).toContain('9:30');
    });

    it('formats weekly alarm preview', () => {
      const result = { type: 'alarm', label: '站立会', hour: 10, minute: 0, repeat: { type: 'weekly', days: [1, 2, 3, 4, 5] } };
      const preview = formatPreview(result);
      expect(preview).toContain('站立会');
      expect(preview).toContain('10:00');
    });

    it('formats holiday preview', () => {
      const result = { type: 'holiday', label: '国庆节', month: 10, day: 1, lunar: false, hour: 9, minute: 0 };
      const preview = formatPreview(result);
      expect(preview).toContain('📅');
      expect(preview).toContain('国庆节');
      expect(preview).toContain('10月1日');
    });

    it('formats lunar holiday preview', () => {
      const result = { type: 'holiday', label: '中秋节', month: 8, day: 15, lunar: true, hour: 9, minute: 0 };
      const preview = formatPreview(result);
      expect(preview).toContain('中秋节');
      expect(preview).toContain('农历');
    });

    it('formats anniversary preview', () => {
      const result = { type: 'anniversary', label: '老婆生日', month: 5, day: 20, lunar: false, hour: 9, minute: 0 };
      const preview = formatPreview(result);
      expect(preview).toContain('💝');
      expect(preview).toContain('老婆生日');
      expect(preview).toContain('5月20日');
    });
  });
});