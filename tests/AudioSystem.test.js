import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/ui/AudioManager.js', () => ({
  getAudioContext: vi.fn(() => ({
    decodeAudioData: vi.fn(async () => ({})),
    createBufferSource: vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    destination: {},
    currentTime: 0,
  })),
  unlockAudioIfNeeded: vi.fn(async () => true),
}));

import {
  initAudioSystem,
  updateSoundMeta,
  previewCustomSound,
  playSound,
  setMuted,
  setCustomAudioObjectUrl,
  syncAudioObjectUrlTo,
  resetAudioPreview,
} from '../src/ui/AudioSystem.js';

describe('AudioSystem', () => {
  let originalAudio;

  beforeEach(() => {
    originalAudio = globalThis.Audio;
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
  });

  it('updates sound meta for custom audio', () => {
    const soundName = { textContent: '', title: '' };
    const previewSoundBtn = { disabled: false, textContent: '' };

    initAudioSystem({
      soundSelect: { value: 'whoosh' },
      soundModeSelect: { value: 'once' },
      soundName,
      previewSoundBtn,
      useSoundCheckbox: { checked: false },
      getCustomAudioData: () => 'data:audio/mpeg;base64,abc',
      getCustomAudioName: () => 'sound.mp3',
      showToast: vi.fn(),
      SOUND_PRESETS: [{ value: 'whoosh' }],
      playPresetSound: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:audio'),
      stopPreviewAudio: vi.fn(),
    });

    updateSoundMeta();

    expect(soundName.textContent).toBe('sound.mp3');
    expect(previewSoundBtn.disabled).toBe(false);
    expect(previewSoundBtn.textContent).toBe('试听');
  });

  it('shows warning when previewing without audio', async () => {
    const showToast = vi.fn();
    initAudioSystem({
      soundSelect: { value: 'whoosh' },
      soundModeSelect: { value: 'once' },
      soundName: { textContent: '', title: '' },
      previewSoundBtn: { disabled: false, textContent: '' },
      useSoundCheckbox: { checked: false },
      getCustomAudioData: () => '',
      getCustomAudioName: () => '',
      showToast,
      SOUND_PRESETS: [{ value: 'whoosh' }],
      playPresetSound: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:audio'),
      stopPreviewAudio: vi.fn(),
    });

    await previewCustomSound();

    expect(showToast).toHaveBeenCalledWith('请先选择一段自定义音频');
  });

  it('plays custom audio preview and can stop it', async () => {
    const showToast = vi.fn();
    const pause = vi.fn();
    globalThis.Audio = class {
      constructor() {
        this.loop = false;
        this.volume = 0;
        this.preload = '';
        this.currentTime = 0;
        this.addEventListener = vi.fn((type, handler) => {
          if (type === 'ended') this._ended = handler;
        });
        this.play = vi.fn(async () => {});
        this.pause = pause;
        this.src = '';
      }
    };

    initAudioSystem({
      soundSelect: { value: 'whoosh' },
      soundModeSelect: { value: 'once' },
      soundName: { textContent: '', title: '' },
      previewSoundBtn: { disabled: false, textContent: '' },
      useSoundCheckbox: { checked: true },
      getCustomAudioData: () => 'data:audio/mpeg;base64,abc',
      getCustomAudioName: () => 'sound.mp3',
      showToast,
      SOUND_PRESETS: [{ value: 'whoosh' }],
      playPresetSound: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:audio'),
      stopPreviewAudio: vi.fn(),
    });

    await previewCustomSound();
    expect(showToast).toHaveBeenCalledWith('正在试听自定义音频');

    await previewCustomSound();
    expect(showToast).toHaveBeenCalledWith('已结束试听');
  });

  it('ignores playSound when muted', async () => {
    const playPresetSound = vi.fn();
    initAudioSystem({
      soundSelect: { value: 'whoosh' },
      soundModeSelect: { value: 'once' },
      soundName: { textContent: '', title: '' },
      previewSoundBtn: { disabled: false, textContent: '' },
      useSoundCheckbox: { checked: false },
      getCustomAudioData: () => '',
      getCustomAudioName: () => '',
      showToast: vi.fn(),
      SOUND_PRESETS: [{ value: 'whoosh' }],
      playPresetSound,
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:audio'),
      stopPreviewAudio: vi.fn(),
    });

    setMuted(true);
    await playSound('whoosh');
    setMuted(false);

    expect(playPresetSound).not.toHaveBeenCalled();
  });

  it('syncs and resets custom audio object url', () => {
    setCustomAudioObjectUrl('blob:1');
    expect(syncAudioObjectUrlTo('blob:2')).toBeUndefined();
    resetAudioPreview();
  });
});
