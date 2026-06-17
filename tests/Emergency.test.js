import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initEmergency,
  shouldHandleEmergencyShortcut,
  triggerEmergencyLanding,
  setEmergencyCooldown,
} from '../src/flight/Emergency.js';

describe('Emergency', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = { addEventListener: vi.fn() };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('triggers emergency landing and closes flight windows', async () => {
    const stopLoopSoundLocal = vi.fn();
    const stopFlightLoopSound = vi.fn();
    const stopPreviewAudio = vi.fn();
    const clearAllSequences = vi.fn();
    const clearFlightQueue = vi.fn();
    const clearFlightStreak = vi.fn(async () => {});
    const stopAllCountdowns = vi.fn();
    const showToast = vi.fn();
    const close = vi.fn(async () => {});

    initEmergency({
      getModal: () => ({ classList: { contains: () => true } }),
      getSettingsModal: () => ({ classList: { contains: () => true } }),
      stopLoopSoundLocal,
      stopFlightLoopSound,
      stopPreviewAudio,
      clearAllSequences,
      clearFlightQueue,
      clearFlightStreak,
      stopAllCountdowns,
      getWebviewWindows: async () => [
        { label: 'flight-1', close },
        { label: 'main', close: vi.fn() },
      ],
      showToast,
      emergencyBtn: { addEventListener: vi.fn() },
      tasksRef: () => [{ id: 1 }],
    });

    await triggerEmergencyLanding([{ id: 1 }]);

    expect(stopLoopSoundLocal).toHaveBeenCalled();
    expect(stopFlightLoopSound).toHaveBeenCalled();
    expect(stopPreviewAudio).toHaveBeenCalled();
    expect(clearAllSequences).toHaveBeenCalled();
    expect(clearFlightQueue).toHaveBeenCalled();
    expect(clearFlightStreak).toHaveBeenCalled();
    expect(stopAllCountdowns).toHaveBeenCalledWith([{ id: 1 }]);
    expect(close).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('已紧急降落');
  });

  it('allows Escape shortcut only when not blocked', () => {
    initEmergency({
      getModal: () => ({ classList: { contains: () => true } }),
      getSettingsModal: () => ({ classList: { contains: () => true } }),
      stopLoopSoundLocal: vi.fn(),
      stopFlightLoopSound: vi.fn(),
      stopPreviewAudio: vi.fn(),
      clearAllSequences: vi.fn(),
      clearFlightQueue: vi.fn(),
      clearFlightStreak: vi.fn(),
      stopAllCountdowns: vi.fn(),
      getWebviewWindows: vi.fn(async () => []),
      showToast: vi.fn(),
      emergencyBtn: { addEventListener: vi.fn() },
      tasksRef: () => [],
    });

    expect(shouldHandleEmergencyShortcut({ key: 'Enter', target: null })).toBe(false);
    expect(shouldHandleEmergencyShortcut({ key: 'Escape', target: { tagName: 'INPUT' } })).toBe(false);

    setEmergencyCooldown(1000);
    expect(shouldHandleEmergencyShortcut({ key: 'Escape', target: null })).toBe(false);
  });
});
