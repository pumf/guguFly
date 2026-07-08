import { t } from '../i18n/index.js';
import { invoke } from '@tauri-apps/api/core';
import { compareVersions } from '../tasks/TaskUtils.js';
import { isTauriRuntime } from '../utils.js';

const GITHUB_REPO = 'pumf/guguFly';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const GITHUB_ISSUES_URL = `https://github.com/${GITHUB_REPO}/issues/new/choose`;
const UPDATE_CACHE_KEY = '_updateCache';

let updateStatus = null;

export function setUpdateStatusEl(el) { updateStatus = el; }

function getCachedUpdate() {
  try {
    const raw = localStorage.getItem(UPDATE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > 86400000) return null;
    return cache;
  } catch { return null; }
}

function setCachedUpdate(data) {
  try {
    localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch (error) {
    console.error('cache update state failed:', error);
  }
}

function showUpdateIndicator(show) {
  const settingsUpdateDot = document.getElementById('settingsUpdateDot');
  const updateSectionDot = document.getElementById('updateSectionDot');
  settingsUpdateDot?.classList.toggle('hidden', !show);
  updateSectionDot?.classList.toggle('hidden', !show);
}

export async function getCurrentVersion() {
  const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauriRuntime) {
    try {
      return await invoke('get_app_version');
    } catch (error) {
      console.error('get app version failed:', error);
      return '0.0.0';
    }
  }
  return '0.0.0';
}

export function openReleasePage() {
  const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauriRuntime) {
    invoke('open_url_in_browser', { url: GITHUB_DOWNLOAD_URL }).catch(err => console.warn('open download page failed:', err));
  } else {
    window.open(GITHUB_DOWNLOAD_URL, '_blank');
  }
}

export async function autoCheckForUpdate() {
  if (!isTauriRuntime()) return;
  const currentVer = await getCurrentVersion();
  const cached = getCachedUpdate();

  if (cached && cached.version === currentVer) {
    localStorage.removeItem(UPDATE_CACHE_KEY);
    if (updateStatus) updateStatus.textContent = t('update.status_latest');
    showUpdateIndicator(false);
    return;
  }

  if (cached && compareVersions('v' + cached.version, 'v' + currentVer) > 0) {
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: cached.version });
    showUpdateIndicator(true);
    void checkForUpdate();
    return;
  }

  try {
    const release = await invoke('check_latest_release');
    const latestVer = release.version || '';
    if (!latestVer || compareVersions('v' + latestVer, 'v' + currentVer) <= 0) {
      if (updateStatus) updateStatus.textContent = t('update.status_latest');
      return;
    }
    setCachedUpdate({ version: latestVer, url: release.html_url || GITHUB_DOWNLOAD_URL, notes: release.notes || '' });
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: latestVer });
    showUpdateIndicator(true);
    void checkForUpdate();
  } catch {
    if (updateStatus) updateStatus.textContent = t('update.status_unavailable');
  }
}

export async function checkForUpdate() {
  const updateModal = document.getElementById('updateModal');
  const updateLoading = document.getElementById('updateLoading');
  const updateInfo = document.getElementById('updateInfo');
  const updateNoUpdate = document.getElementById('updateNoUpdate');
  const updateError = document.getElementById('updateError');
  const updateModalTitle = document.getElementById('updateModalTitle');
  const updateCurrentVersion = document.getElementById('updateCurrentVersion');
  const updateLatestVersion = document.getElementById('updateLatestVersion');
  const updateReleaseNotes = document.getElementById('updateReleaseNotes');
  const updateDownloadBtn = document.getElementById('updateDownloadBtn');
  const updateOpenReleaseBtn = document.getElementById('updateOpenReleaseBtn');

  if (updateStatus) updateStatus.textContent = t('update.status_checking');
  if (updateModal) {
    updateModal.classList.remove('hidden');
    updateInfo.classList.add('hidden');
    updateLoading.classList.remove('hidden');
    updateNoUpdate.classList.add('hidden');
    updateError.classList.add('hidden');
    updateDownloadBtn.classList.add('hidden');
    updateOpenReleaseBtn.classList.add('hidden');
  }

  const currentVer = await getCurrentVersion();
  const cached = getCachedUpdate();

  if (cached && cached.version === currentVer) {
    localStorage.removeItem(UPDATE_CACHE_KEY);
    if (updateLoading) updateLoading.classList.add('hidden');
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.status_latest_text');
    if (updateStatus) updateStatus.textContent = t('update.status_latest');
    return;
  }

  let latestVer = cached ? cached.version : '';
  let htmlUrl = cached ? cached.url : GITHUB_DOWNLOAD_URL;
  let notes = cached ? cached.notes : '';
  const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

  try {
    if (isTauriRuntime) {
      const release = await invoke('check_latest_release');
      latestVer = release.version || '';
      htmlUrl = release.html_url || GITHUB_DOWNLOAD_URL;
      notes = release.notes || '';
    } else {
      const resp = await fetch(GITHUB_RELEASES_URL, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'guguFly-desktop' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      latestVer = (data.tag_name || '').replace(/^v/, '');
      htmlUrl = data.html_url || GITHUB_DOWNLOAD_URL;
      notes = data.body || '';
    }
  } catch {
    if (updateLoading) updateLoading.classList.add('hidden');
    if (cached) {
      if (updateInfo) updateInfo.classList.remove('hidden');
      if (updateModalTitle) updateModalTitle.textContent = t('update.title_cached');
      if (updateCurrentVersion) updateCurrentVersion.textContent = `v${currentVer}`;
      if (updateLatestVersion) updateLatestVersion.textContent = `v${cached.version}`;
      if (updateReleaseNotes) {
        updateReleaseNotes.textContent = '';
        (cached.notes || '').split('\n').filter(l => l.trim()).forEach(line => {
          const p = document.createElement('p');
          p.textContent = line;
          updateReleaseNotes.appendChild(p);
        });
      }
      if (updateDownloadBtn) {
        updateDownloadBtn.classList.remove('hidden');
        updateDownloadBtn.dataset.url = cached.url || GITHUB_DOWNLOAD_URL;
      }
      if (updateStatus) updateStatus.textContent = t('update.status_found', { version: cached.version });
      showUpdateIndicator(false);
      return;
    }
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.check_title');
    const noUpdateIcon = document.getElementById('updateNoUpdateIcon');
    const noUpdateText = document.getElementById('updateNoUpdateText');
    if (noUpdateIcon) noUpdateIcon.textContent = '🌐';
    if (noUpdateText) noUpdateText.textContent = t('update.network_error');
    if (updateOpenReleaseBtn) updateOpenReleaseBtn.classList.remove('hidden');
    if (updateStatus) updateStatus.textContent = t('update.status_unavailable');
    return;
  }

  if (!latestVer) {
    if (updateLoading) updateLoading.classList.add('hidden');
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.check_title');
    const noUpdateIcon = document.getElementById('updateNoUpdateIcon');
    const noUpdateText = document.getElementById('updateNoUpdateText');
    if (noUpdateIcon) noUpdateIcon.textContent = '📭';
    if (noUpdateText) noUpdateText.textContent = t('update.no_release');
    if (updateOpenReleaseBtn) updateOpenReleaseBtn.classList.remove('hidden');
    if (updateStatus) updateStatus.textContent = t('update.status_unavailable');
    return;
  }

  setCachedUpdate({ version: latestVer, url: htmlUrl, notes });
  if (updateLoading) updateLoading.classList.add('hidden');

  if (compareVersions('v' + latestVer, 'v' + currentVer) > 0) {
    showUpdateIndicator(false);
    if (updateInfo) updateInfo.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.title');
    if (updateCurrentVersion) updateCurrentVersion.textContent = `v${currentVer}`;
    if (updateLatestVersion) updateLatestVersion.textContent = `v${latestVer}`;
    if (updateReleaseNotes) {
      updateReleaseNotes.textContent = '';
      notes.split('\n').filter(l => l.trim()).forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        updateReleaseNotes.appendChild(p);
      });
    }
    if (updateDownloadBtn) {
      updateDownloadBtn.classList.remove('hidden');
      updateDownloadBtn.dataset.url = htmlUrl;
    }
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: latestVer });
  } else {
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.status_latest_text');
    if (updateStatus) updateStatus.textContent = t('update.status_latest');
  }
}

export function openFeedbackPage() {
  const isTauriRuntime = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauriRuntime) {
    invoke('open_url_in_browser', { url: GITHUB_ISSUES_URL }).catch(() => window.open(GITHUB_ISSUES_URL, '_blank'));
  } else {
    window.open(GITHUB_ISSUES_URL, '_blank');
  }
}
