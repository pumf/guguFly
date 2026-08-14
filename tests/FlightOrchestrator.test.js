import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FlightOrchestrator initialization guard', () => {
  beforeEach(() => {
    vi.stubGlobal('module', { exports: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setToastFn replaces default guard', async () => {
    const { setToastFn } = await import('../src/flight/FlightOrchestrator.js');
    const mockFn = vi.fn();
    setToastFn(mockFn);
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('default showToast throws error before init', async () => {
    vi.resetModules();
    const mod = await import('../src/flight/FlightOrchestrator.js');
    expect(() => mod.setToastFn(undefined)).not.toThrow();
  });
});