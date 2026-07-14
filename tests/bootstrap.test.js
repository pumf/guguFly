import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applySettings } from '../src/app/bootstrap.js';

function createClassList() {
  return {
    toggle: vi.fn(),
    remove: vi.fn(),
  };
}

describe('applySettings', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    globalThis.document = {
      getElementById: vi.fn(() => ({ querySelectorAll: vi.fn(() => []) })),
      querySelectorAll: vi.fn(() => []),
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('restores persisted settings into refs and state', async () => {
    const state = { isMuted: false, customImageData: '', customAudioData: '', customAudioName: '' };
    const refs = {
      MUTED_ICON: 'muted',
      UNMUTED_ICON: 'unmuted',
      muteBtn: { innerHTML: '' },
      settingsModal: {},
      speedSelect: { value: '' },
      heightSelect: { value: '' },
      effectSelect: { value: '' },
      planeSelect: { value: '' },
      particleSelect: { value: '' },
      bubbleSelect: { value: '' },
      bubblePositionSelect: { value: '' },
      soundSelect: { value: '' },
      soundModeSelect: { value: '' },
      useSoundCheckbox: { checked: false },
      useImageCheckbox: { checked: false, closest: () => ({ classList: createClassList() }) },
      soundMeta: {},
      soundNameEl: {},
      previewSoundBtn: {},
      todayCountEl: { textContent: '' },
      displaySelect: { value: '' },
      clearImageBtn: { classList: createClassList() },
      clearSoundBtn: { classList: createClassList() },
      imagePreview: { src: '', classList: createClassList() },
      autostartToggle: { checked: false, disabled: false },
      quietHoursToggle: { checked: false },
      quietStartHour: { value: '' },
      quietEndHour: { value: '' },
      miniWindowToggle: { checked: false },
    };

    await applySettings({
      cfg: {
        muted: true,
        todayCount: 8,
        speed: 'fast',
        height: 'top',
        display: 'active',
        effect: 'steady',
        plane: 'rocket',
        particle: 'spark',
        bubble: 'glass',
        bubblePosition: 'bottom',
        sound: 'ring',
        soundMode: 'loop',
        useSound: true,
        customAudio: 'audio-data',
        customAudioName: 'test.mp3',
        customImage: 'image-data',
        useImage: true,
        lastDate: new Date().toDateString(),
        quietHoursEnabled: true,
        quietStartHour: 23,
        quietEndHour: 7,
        miniWindowEnabled: true,
        miniWindowPosition: 'bottom-right',
      },
      state,
      isTauriRuntime: false,
      invoke: vi.fn(),
      refs,
      flightPresets: {},
      persistFlightSettings: vi.fn(),
      persistSetting: vi.fn(),
      showToast: vi.fn(),
      incrementTodayCount: vi.fn(),
      getDateKey: () => '2026-06-17',
      get: vi.fn(async () => null),
      set: vi.fn(),
      resetStreak: vi.fn(),
      dayDiff: vi.fn(() => null),
      isInQuietHours: vi.fn(),
      getRandomQuote: vi.fn(),
      recordFlightTrigger: vi.fn(),
      notifyFlightTriggered: vi.fn(),
      renderStatsPanel: vi.fn(),
      triggerFlightWithMode: vi.fn(),
      soundPresets: [],
      playPresetSound: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:test'),
      stopPreviewAudio: vi.fn(),
      syncMuteToTray: vi.fn(),
      syncEffectPicker: vi.fn(),
      updateMiniPosGridActive: vi.fn(),
      isAutostartEnabled: vi.fn(),
      clearFlightStreak: vi.fn(),
      setMuted: vi.fn(),
      initLogo: vi.fn(),
      initFlightSync: vi.fn(),
      initFlightTrigger: vi.fn(),
      initAudioSystem: vi.fn(),
      updateSoundMeta: vi.fn(),
      revokeCustomAudioObjectUrl: vi.fn(),
      updateTitleLogo: vi.fn(),
    });

    expect(state.isMuted).toBe(true);
    expect(refs.muteBtn.innerHTML).toBe('muted');
    expect(refs.todayCountEl.textContent).toContain('8');
    expect(refs.speedSelect.value).toBe('fast');
    expect(refs.displaySelect.value).toBe('active');
    expect(refs.useSoundCheckbox.checked).toBe(true);
    expect(state.customAudioData).toBe('audio-data');
    expect(state.customImageData).toBe('image-data');
    expect(refs.useImageCheckbox.checked).toBe(true);
    expect(refs.quietHoursToggle.checked).toBe(true);
    expect(refs.quietStartHour.value).toBe(23);
    expect(refs.quietEndHour.value).toBe(7);
    expect(refs.miniWindowToggle.checked).toBe(true);
  });

  it('resets today count when persisted date is stale', async () => {
    const state = { isMuted: false, customImageData: '', customAudioData: '', customAudioName: '' };
    const refs = {
      MUTED_ICON: 'muted',
      UNMUTED_ICON: 'unmuted',
      muteBtn: { innerHTML: '' },
      settingsModal: {},
      speedSelect: { value: '' },
      heightSelect: { value: '' },
      effectSelect: { value: '' },
      planeSelect: { value: '' },
      particleSelect: { value: '' },
      bubbleSelect: { value: '' },
      bubblePositionSelect: { value: '' },
      soundSelect: { value: '' },
      soundModeSelect: { value: '' },
      useSoundCheckbox: { checked: false },
      useImageCheckbox: { checked: false, closest: () => ({ classList: createClassList() }) },
      soundMeta: {},
      soundNameEl: {},
      previewSoundBtn: {},
      todayCountEl: { textContent: '' },
      displaySelect: { value: '' },
      clearImageBtn: { classList: createClassList() },
      clearSoundBtn: { classList: createClassList() },
      imagePreview: { src: '', classList: createClassList() },
      autostartToggle: { checked: false, disabled: false },
      quietHoursToggle: { checked: false },
      quietStartHour: { value: '' },
      quietEndHour: { value: '' },
      miniWindowToggle: { checked: false },
    };
    const set = vi.fn();

    await applySettings({
      cfg: {
        muted: false,
        todayCount: 8,
        lastDate: 'Mon Jan 01 2024',
      },
      state,
      isTauriRuntime: false,
      invoke: vi.fn(),
      refs,
      flightPresets: {},
      persistFlightSettings: vi.fn(),
      persistSetting: vi.fn(),
      showToast: vi.fn(),
      incrementTodayCount: vi.fn(),
      getDateKey: () => '2026-06-17',
      get: vi.fn(async () => null),
      set,
      resetStreak: vi.fn(),
      dayDiff: vi.fn(() => null),
      isInQuietHours: vi.fn(),
      getRandomQuote: vi.fn(),
      recordFlightTrigger: vi.fn(),
      notifyFlightTriggered: vi.fn(),
      renderStatsPanel: vi.fn(),
      triggerFlightWithMode: vi.fn(),
      soundPresets: [],
      playPresetSound: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(),
      stopPreviewAudio: vi.fn(),
      syncMuteToTray: vi.fn(),
      syncEffectPicker: vi.fn(),
      updateMiniPosGridActive: vi.fn(),
      isAutostartEnabled: vi.fn(),
      clearFlightStreak: vi.fn(),
      setMuted: vi.fn(),
      initLogo: vi.fn(),
      initFlightSync: vi.fn(),
      initFlightTrigger: vi.fn(),
      initAudioSystem: vi.fn(),
      updateSoundMeta: vi.fn(),
      revokeCustomAudioObjectUrl: vi.fn(),
      updateTitleLogo: vi.fn(),
    });

    expect(set).toHaveBeenCalledWith('todayCount', 0);
    expect(refs.todayCountEl.textContent).toBe('0 次');
    expect(refs.autostartToggle.disabled).toBe(true);
  });
});
