import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForUpdate, setUpdateStatusEl, openReleasePage, openFeedbackPage } from '../src/settings/UpdateManager.js';

function createClassList() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
  };
}

function createEl() {
  return {
    textContent: '',
    dataset: {},
    classList: createClassList(),
    appendChild: vi.fn(),
  };
}

describe('UpdateManager', () => {
  let originalWindow;
  let originalDocument;
  let originalLocalStorage;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    originalLocalStorage = globalThis.localStorage;

    const elements = new Map();
    [
      'updateModal', 'updateLoading', 'updateInfo', 'updateNoUpdate', 'updateError',
      'updateModalTitle', 'updateCurrentVersion', 'updateLatestVersion', 'updateReleaseNotes',
      'updateDownloadBtn', 'updateOpenReleaseBtn', 'settingsUpdateDot', 'updateSectionDot',
      'updateNoUpdateIcon', 'updateNoUpdateText',
    ].forEach((id) => elements.set(id, createEl()));

    globalThis.document = {
      getElementById: vi.fn((id) => elements.get(id) || null),
      createElement: vi.fn(() => createEl()),
    };

    const storage = new Map();
    globalThis.localStorage = {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => { storage.set(key, value); }),
    };

    globalThis.window = { open: vi.fn() };
    setUpdateStatusEl(createEl());
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.localStorage = originalLocalStorage;
  });

  it('shows cached newer release info without network request', async () => {
    globalThis.localStorage.setItem('_updateCache', JSON.stringify({
      version: '0.6.0',
      url: 'https://example.com/release',
      notes: 'Fix A\nFix B',
      timestamp: Date.now(),
    }));

    await checkForUpdate();

    expect(document.getElementById('updateModalTitle').textContent).toBe('发现新版本');
    expect(document.getElementById('updateLatestVersion').textContent).toBe('v0.6.0');
    expect(document.getElementById('updateDownloadBtn').dataset.url).toBe('https://example.com/release');
    expect(document.getElementById('updateInfo').classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('shows already-latest when cached version equals current version', async () => {
    globalThis.localStorage.setItem('_updateCache', JSON.stringify({
      version: '0.0.0',
      url: 'https://example.com/release',
      notes: '',
      timestamp: Date.now(),
    }));

    await checkForUpdate();

    expect(document.getElementById('updateModalTitle').textContent).toBe('已是最新版本');
    expect(document.getElementById('updateNoUpdate').classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('opens release and feedback pages in browser mode', () => {
    openReleasePage();
    openFeedbackPage();

    expect(globalThis.window.open).toHaveBeenCalledTimes(2);
  });
});
