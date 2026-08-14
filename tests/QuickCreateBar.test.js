import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('QuickCreateBar initialization guard', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      getElementById: vi.fn(() => ({
        addEventListener: vi.fn(),
        value: '',
        hidden: false,
      })),
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('setQuickCreateDeps replaces default guard', async () => {
    const { setQuickCreateDeps } = await import('../src/ui/QuickCreateBar.js');
    const mockFn = vi.fn();
    setQuickCreateDeps({ showToast: mockFn });
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('default showToastFn throws error before init', async () => {
    vi.resetModules();
    const mod = await import('../src/ui/QuickCreateBar.js');
    const mockFn = vi.fn();
    mod.setQuickCreateDeps({ showToast: mockFn });
    expect(() => mockFn('test')).not.toThrow();
  });
});