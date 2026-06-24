import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMiniPositions, formatUpcomingTime, updateMiniPosGridActive } from '../src/ui/MiniWindow.js';

describe('MiniWindow helpers', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('returns supported mini window positions', () => {
    const positions = getMiniPositions();
    expect(positions['top-right']).toBeTruthy();
    expect(positions['bottom-left']).toBeTruthy();
  });

  it('formats upcoming time across ranges', () => {
    expect(formatUpcomingTime(30)).toBe('30s');
    expect(formatUpcomingTime(120)).toBe('2min');
    expect(formatUpcomingTime(3660)).toBe('1h1m');
    expect(formatUpcomingTime(90000)).toBe('1d');
  });

  it('updates active grid cell for selected mini position', () => {
    const cells = [
      { dataset: { pos: 'top-right' }, classList: { toggle: vi.fn() } },
      { dataset: { pos: 'bottom-left' }, classList: { toggle: vi.fn() } },
    ];

    globalThis.document = {
      getElementById: vi.fn(() => ({ querySelectorAll: vi.fn(() => cells) })),
    };

    updateMiniPosGridActive('bottom-left');

    expect(cells[0].classList.toggle).toHaveBeenCalledWith('active', false);
    expect(cells[1].classList.toggle).toHaveBeenCalledWith('active', true);
  });
});
