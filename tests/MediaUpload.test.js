import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initMediaUpload } from '../src/ui/MediaUpload.js';

function createButtonLike() {
  const handlers = {};
  return {
    handlers,
    addEventListener: vi.fn((type, handler) => { handlers[type] = handler; }),
    classList: { add: vi.fn(), remove: vi.fn() },
    click: vi.fn(),
  };
}

describe('MediaUpload', () => {
  let OriginalFileReader;

  beforeEach(() => {
    OriginalFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.onload = null;
      }
      readAsDataURL(file) {
        this.onload?.({ target: { result: file.mockDataUrl } });
      }
    };
  });

  afterEach(() => {
    globalThis.FileReader = OriginalFileReader;
  });

  it('updates image state and persistence after valid image upload', () => {
    const imageBtn = createButtonLike();
    const imageInput = createButtonLike();
    imageInput.files = [{ type: 'image/png', size: 100, name: 'plane.png', mockDataUrl: 'data:image/png;base64,abc' }];
    imageInput.value = '';
    const clearImageBtn = createButtonLike();
    const imagePreview = { src: '', classList: { add: vi.fn(), remove: vi.fn() } };
    const useImageCheckbox = { checked: false, closest: () => ({ classList: { add: vi.fn(), remove: vi.fn() } }) };
    const persistSetting = vi.fn();
    const customImageDataRef = { set: vi.fn(), get: vi.fn() };

    initMediaUpload({
      imageBtn,
      imageInput,
      clearImageBtn,
      imagePreview,
      useImageCheckbox,
      editImageBtn: null,
      editImageInput: null,
      editClearImageBtn: null,
      editImagePreview: null,
      editUseImageCheckbox: null,
      soundBtn: createButtonLike(),
      soundInput: createButtonLike(),
      clearSoundBtn: createButtonLike(),
      useSoundCheckbox: { checked: false },
      updateTitleLogo: vi.fn(),
      setCustomImageData: vi.fn(),
      persistSetting,
      showToast: vi.fn(),
      buildCustomAudioObjectUrl: vi.fn(),
      syncAudioObjectUrlTo: vi.fn(),
      updateSoundMeta: vi.fn(),
      setCustomAudioData: vi.fn(),
      setCustomAudioObjectUrl: vi.fn(),
      stopPreviewAudio: vi.fn(),
      resetAudioPreview: vi.fn(),
      revokeCustomAudioObjectUrl: vi.fn(),
      unlockAudioIfNeeded: vi.fn(),
      validateCustomAudioPreview: vi.fn(),
      customImageDataRef,
      editImageDataRef: { set: vi.fn(), get: vi.fn() },
      customAudioDataRef: { set: vi.fn(), get: vi.fn() },
      customAudioNameRef: { set: vi.fn(), get: vi.fn() },
    });

    imageInput.handlers.change();

    expect(customImageDataRef.set).toHaveBeenCalledWith('data:image/png;base64,abc');
    expect(imagePreview.src).toBe('data:image/png;base64,abc');
    expect(useImageCheckbox.checked).toBe(true);
    expect(persistSetting).toHaveBeenCalledWith('customImage', 'data:image/png;base64,abc');
    expect(persistSetting).toHaveBeenCalledWith('useImage', true);
  });

  it('updates audio state and persistence after valid audio upload', () => {
    const soundBtn = createButtonLike();
    const soundInput = createButtonLike();
    soundInput.files = [{ type: 'audio/mpeg', size: 100, name: 'sound.mp3', mockDataUrl: 'data:audio/mpeg;base64,xyz' }];
    soundInput.value = '';
    const clearSoundBtn = createButtonLike();
    const useSoundCheckbox = { checked: false };
    const persistSetting = vi.fn();
    const showToast = vi.fn();
    const customAudioDataRef = { set: vi.fn(), get: vi.fn() };
    const customAudioNameRef = { set: vi.fn(), get: vi.fn() };

    initMediaUpload({
      imageBtn: createButtonLike(),
      imageInput: createButtonLike(),
      clearImageBtn: createButtonLike(),
      imagePreview: { src: '', classList: { add: vi.fn(), remove: vi.fn() } },
      useImageCheckbox: { checked: false, closest: () => ({ classList: { add: vi.fn(), remove: vi.fn() } }) },
      editImageBtn: null,
      editImageInput: null,
      editClearImageBtn: null,
      editImagePreview: null,
      editUseImageCheckbox: null,
      soundBtn,
      soundInput,
      clearSoundBtn,
      useSoundCheckbox,
      updateTitleLogo: vi.fn(),
      setCustomImageData: vi.fn(),
      persistSetting,
      showToast,
      buildCustomAudioObjectUrl: vi.fn(() => 'blob:audio'),
      syncAudioObjectUrlTo: vi.fn(),
      updateSoundMeta: vi.fn(),
      setCustomAudioData: vi.fn(),
      setCustomAudioObjectUrl: vi.fn(),
      stopPreviewAudio: vi.fn(),
      resetAudioPreview: vi.fn(),
      revokeCustomAudioObjectUrl: vi.fn(),
      unlockAudioIfNeeded: vi.fn(),
      validateCustomAudioPreview: vi.fn(),
      customImageDataRef: { set: vi.fn(), get: vi.fn() },
      editImageDataRef: { set: vi.fn(), get: vi.fn() },
      customAudioDataRef,
      customAudioNameRef,
    });

    soundInput.handlers.change();

    expect(customAudioDataRef.set).toHaveBeenCalledWith('data:audio/mpeg;base64,xyz');
    expect(customAudioNameRef.set).toHaveBeenCalledWith('sound.mp3');
    expect(useSoundCheckbox.checked).toBe(true);
    expect(persistSetting).toHaveBeenCalledWith('customAudio', 'data:audio/mpeg;base64,xyz');
    expect(persistSetting).toHaveBeenCalledWith('customAudioName', 'sound.mp3');
    expect(persistSetting).toHaveBeenCalledWith('useSound', true);
    expect(showToast).toHaveBeenCalledWith('已添加音频：sound.mp3');
  });
});
