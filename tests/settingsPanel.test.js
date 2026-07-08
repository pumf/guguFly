import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSettingsPanel } from '../src/ui/SettingsPanel.js';

function makeEl() {
  const handlers = {};
  return {
    value: '',
    checked: false,
    disabled: false,
    files: [],
    innerHTML: '',
    textContent: '',
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    addEventListener: vi.fn((_type, _handler) => {
      handlers[_type] = _handler;
    }),
    _handlers: handlers,
    click: vi.fn(),
  };
}

describe('initSettingsPanel import flow', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    globalThis.window = { showConfirm: vi.fn().mockResolvedValue(true) };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('replaces tasks and restores settings after confirmed import', async () => {
    const elements = new Map();
    const ids = [
      'configToggle', 'configPanel', 'configArrow', 'settingsBtn', 'settingsModal', 'settingsOverlay', 'settingsCloseBtn',
      'autostartToggle', 'quietHoursToggle', 'quietStartHour', 'quietEndHour', 'miniWindowToggle', 'miniPosGrid',
      'exportTasksBtn', 'importTasksBtn', 'importTasksInput', 'appVersionDisplay', 'checkUpdateBtn', 'feedbackBtn',
      'repoLink', 'updateModal', 'updateOverlay', 'updateCloseBtn', 'updateCloseActionBtn', 'updateDownloadBtn',
      'updateOpenReleaseBtn', 'statsToggle', 'statsPanel', 'statsArrow', 'taskModal', 'previewSoundBtn', 'previewFlightBtn',
      'resetFlightBtn', 'displaySelect',
      'importPreviewModal', 'importPreviewOverlay', 'importPreviewCloseBtn',
      'importPreviewSummary', 'importPreviewTasks', 'importPreviewCancelBtn', 'importPreviewConfirmBtn',
    ];

    ids.forEach(id => elements.set(id, makeEl()));
    const themeButtons = [];
    globalThis.document = {
      getElementById: vi.fn((id) => elements.get(id) || null),
      querySelectorAll: vi.fn((selector) => (selector === '.theme-btn' ? themeButtons : [])),
      querySelector: vi.fn((selector) => {
        if (selector === 'input[name="importStrategy"]:checked') {
          return { value: 'overwrite' };
        }
        return null;
      }),
    };
    globalThis.window = { showConfirm: vi.fn().mockResolvedValue(true), open: vi.fn() };

    const importTasksInput = elements.get('importTasksInput');
    const speedSelect = { value: 'slow', addEventListener: vi.fn() };
    const heightSelect = { value: 'top', addEventListener: vi.fn() };
    const effectSelect = { value: 'steady', addEventListener: vi.fn() };
    const planeSelect = { value: 'rocket', addEventListener: vi.fn() };
    const planeSizeSelect = { value: '1', addEventListener: vi.fn() };
    const particleSelect = { value: 'spark', addEventListener: vi.fn() };
    const bubbleSelect = { value: 'glass', addEventListener: vi.fn() };
    const bubblePositionSelect = { value: 'bottom', addEventListener: vi.fn() };
    const bubbleSizeSelect = { value: '1', addEventListener: vi.fn() };
    const bubbleBgColor = { value: '#ffffff', addEventListener: vi.fn() };
    const bubbleFontColor = { value: '#333333', addEventListener: vi.fn() };
    const soundSelect = { value: 'ring', addEventListener: vi.fn() };
    const soundModeSelect = { value: 'loop', addEventListener: vi.fn() };
    const useSoundCheckbox = { checked: false, addEventListener: vi.fn() };
    const useImageCheckbox = { checked: false, addEventListener: vi.fn() };
    const muteBtn = { innerHTML: '', addEventListener: vi.fn() };

    const tasksRef = {
      value: [{ id: 1 }],
      get() { return this.value; },
      set(v) { this.value = v; },
    };

    const saveTasks = vi.fn();
    const persistFlightSettings = vi.fn();
    const set = vi.fn();
    const renderTaskView = vi.fn();
    const showToast = vi.fn();
    const setNextId = vi.fn();

    const importedTasks = [{ id: 5, type: 'alarm', label: '导入' }];
    const readBackupFromFile = vi.fn(async () => ({
      tasks: importedTasks,
      settings: {
        speed: 'fast',
        sound: 'bell',
        useSound: true,
        useImage: true,
        muted: true,
      },
    }));

    initSettingsPanel({
      isTauriRuntime: false,
      MUTED_ICON: 'muted',
      UNMUTED_ICON: 'unmuted',
      setMuted: vi.fn(),
      syncMuteToTray: vi.fn(),
      stopLoopSoundLocal: vi.fn(),
      stopPreviewAudio: vi.fn(),
      resetAudioPreview: vi.fn(),
      set,
      persistSetting: vi.fn(),
      applyTheme: vi.fn(),
      enableAutostart: vi.fn(),
      disableAutostart: vi.fn(),
      createMiniWindow: vi.fn(),
      closeMiniWindow: vi.fn(),
      positionMiniWindow: vi.fn(),
      getMiniPositions: vi.fn(() => ({})),
      updateMiniPosGridActive: vi.fn(),
      exportTasksAsJson: vi.fn(),
      getCleanTasks: (tasks) => tasks,
      tasksRef,
      saveTasks,
      readBackupFromFile,
      hydrateTasks: vi.fn(() => ({ tasks: importedTasks, maxId: 6 })),
      setNextId,
      renderTaskView,
      checkForUpdate: vi.fn(),
      openFeedbackPage: vi.fn(),
      openReleasePage: vi.fn(),
      getCurrentVersion: vi.fn(async () => '0.5.0'),
      showToast,
      previewCustomSound: vi.fn(),
      previewFlight: vi.fn(),
      resetFlightSettings: vi.fn(),
      invoke: vi.fn(),
      unlockAudioIfNeeded: vi.fn(),
      persistFlightSettings,
      speedSelect,
      heightSelect,
      effectSelect,
      planeSelect,
      planeSizeSelect,
      particleSelect,
      bubbleSelect,
      bubblePositionSelect,
      bubbleSizeSelect,
      bubbleBgColor,
      bubbleFontColor,
      soundSelect,
      soundModeSelect,
      useSoundCheckbox,
      useImageCheckbox,
      muteBtn,
      isConfigOpenRef: { get: () => false, set: vi.fn() },
      isMutedRef: { get: () => false, set: vi.fn() },
      isStatsOpenRef: { get: () => false, set: vi.fn() },
    });

    importTasksInput.files = [{ name: 'backup.json' }];
    await importTasksInput._handlers.change();

    const importPreviewConfirmBtn = elements.get('importPreviewConfirmBtn');
    await importPreviewConfirmBtn._handlers.click();

    expect(readBackupFromFile).toHaveBeenCalled();
    expect(tasksRef.get()).toEqual(importedTasks);
    expect(setNextId).toHaveBeenCalledWith(7);
    expect(saveTasks).toHaveBeenCalledWith(importedTasks);
    expect(speedSelect.value).toBe('fast');
    expect(soundSelect.value).toBe('bell');
    expect(useSoundCheckbox.checked).toBe(true);
    expect(useImageCheckbox.checked).toBe(true);
    expect(muteBtn.innerHTML).toBe('muted');
    expect(persistFlightSettings).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith('muted', true);
    expect(renderTaskView).toHaveBeenCalled();
  });
});
