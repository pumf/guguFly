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
let updateAvailable = null;

export function setUpdateStatusEl(el) { updateStatus = el; }

function renderMarkdown(md) {
  if (!md) return '';
  const html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = html.split('\n');
  let out = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { out += '</ul>\n'; inList = false; }
      continue;
    }
    if (trimmed.startsWith('```')) {
      if (inList) { out += '</ul>\n'; inList = false; }
      let code = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code += lines[i] + '\n';
        i++;
      }
      out += '<pre><code>' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>\n';
      continue;
    }
    if (trimmed.startsWith('### ')) {
      if (inList) { out += '</ul>\n'; inList = false; }
      out += '<h4>' + trimmed.slice(4) + '</h4>\n';
    } else if (trimmed.startsWith('## ')) {
      if (inList) { out += '</ul>\n'; inList = false; }
      out += '<h3>' + trimmed.slice(3) + '</h3>\n';
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { out += '<ul>\n'; inList = true; }
      out += '<li>' + trimmed.slice(2) + '</li>\n';
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      // numbered list - handle as regular paragraph for simplicity
      if (inList) { out += '</ul>\n'; inList = false; }
      out += '<p>' + trimmed + '</p>\n';
    } else {
      if (inList) { out += '</ul>\n'; inList = false; }
      out += '<p>' + trimmed + '</p>\n';
    }
  }
  if (inList) out += '</ul>\n';

  return out
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      const trimmed = href.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return `<a href="${trimmed}">${text}</a>`;
      }
      return text;
    });
}

function setReleaseNotes(container, notes) {
  if (!container) return;
  container.innerHTML = '';
  container.innerHTML = renderMarkdown(notes);
}

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
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauri) {
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
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauri) {
    invoke('open_url_in_browser', { url: GITHUB_DOWNLOAD_URL }).catch(err => console.warn('open download page failed:', err));
  } else {
    window.open(GITHUB_DOWNLOAD_URL, '_blank');
  }
}

async function checkUpdaterPlugin() {
  if (!isTauriRuntime()) return null;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      // Extract download URL from platforms based on current OS/arch
      let downloadUrl = '';
      if (update.platforms) {
        const ua = navigator.userAgent;
        const isMac = ua.includes('Mac');
        const isWin = ua.includes('Win');
        const isLinux = ua.includes('Linux') && !ua.includes('Android');
        const isArm = ua.includes('ARM') || ua.includes('aarch64') || (isMac && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isMac) {
          downloadUrl = isArm 
            ? (update.platforms['darwin-aarch64']?.url || '')
            : (update.platforms['darwin-x86_64']?.url || '');
        } else if (isWin) {
          downloadUrl = update.platforms['windows-x86_64']?.url || '';
        } else if (isLinux) {
          downloadUrl = update.platforms['linux-x86_64']?.url || '';
        }
      }
      
      return {
        available: true,
        version: update.version,
        notes: update.body || '',
        url: downloadUrl,
        downloadAndInstall: async (onProgress) => {
          let total = 0;
          let downloaded = 0;
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                total = event.data.contentLength || 0;
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                if (onProgress) onProgress(total > 0 ? Math.round((downloaded / total) * 100) : 0);
                break;
              case 'Finished':
                if (onProgress) onProgress(100);
                break;
            }
          });
        },
      };
    }
    return { available: false };
  } catch (error) {
    console.warn('updater plugin check failed:', error);
    return null;
  }
}

let isDownloading = false;
let pluginDownloadFn = null;

export async function installUpdate() {
  if (isDownloading) return; // Prevent double-click

  const updateProgress = document.getElementById('updateProgress');
  const updateProgressFill = document.getElementById('updateProgressFill');
  const updateProgressText = document.getElementById('updateProgressText');
  const updateInstallBtn = document.getElementById('updateInstallBtn');
  const updateDownloadBtn = document.getElementById('updateDownloadBtn');
  const updateCancelBtn = document.getElementById('updateCancelBtn');

  let progressInterval = null;
  isDownloading = true;
  if (updateInstallBtn) updateInstallBtn.disabled = true;
  if (updateDownloadBtn) updateDownloadBtn.disabled = true;
  if (updateProgress) updateProgress.classList.remove('hidden');
  if (updateProgressFill) updateProgressFill.style.width = '0%';
  if (updateProgressText) updateProgressText.textContent = t('update.downloading_wait');

  // Set up cancel button
  let cancelled = false;
  if (updateCancelBtn) {
    updateCancelBtn.classList.remove('hidden');
    const onCancel = () => {
      cancelled = true;
      isDownloading = false;
      if (updateProgressText) updateProgressText.textContent = t('update.install_cancelled');
      if (updateProgressFill) updateProgressFill.style.width = '0%';
      if (updateInstallBtn) updateInstallBtn.disabled = false;
      if (updateCancelBtn) {
        updateCancelBtn.classList.add('hidden');
        updateCancelBtn.removeEventListener('click', onCancel);
      }
      setTimeout(() => {
        if (updateProgress) updateProgress.classList.add('hidden');
      }, 1500);
    };
    updateCancelBtn.addEventListener('click', onCancel);
  }

  if (isTauriRuntime()) {
    try {
      // Prefer the updater plugin's downloadAndInstall when available
      // (real progress tracking). Fall back to custom download only
      // when the update was detected via cache or GitHub API.
      if (pluginDownloadFn) {
        if (updateProgressText) updateProgressText.textContent = t('update.downloading', { percent: 0 });
        await pluginDownloadFn((percent) => {
          if (cancelled) return;
          if (updateProgressFill) updateProgressFill.style.width = `${percent}%`;
          if (updateProgressText) updateProgressText.textContent = t('update.downloading', { percent });
        });
      } else {
        const downloadUrl = updateAvailable?.url || 'https://github.com/pumf/guguFly/releases/latest';
        if (updateProgressText) updateProgressText.textContent = t('update.downloading', { percent: 0 });
        let progress = 0;
        progressInterval = setInterval(() => {
          if (cancelled) { clearInterval(progressInterval); return; }
          if (progress < 90) {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            if (updateProgressFill) updateProgressFill.style.width = `${Math.round(progress)}%`;
            if (updateProgressText) updateProgressText.textContent = t('update.downloading', { percent: Math.round(progress) });
          }
        }, 500);
        await invoke('download_and_install_update', { url: downloadUrl });
      }

      if (progressInterval) clearInterval(progressInterval);
      if (cancelled) return;

      isDownloading = false;
      pluginDownloadFn = null;
      if (updateProgressFill) updateProgressFill.style.width = '100%';
      if (updateProgressText) updateProgressText.textContent = t('update.install_success');
      if (updateCancelBtn) updateCancelBtn.classList.add('hidden');
      setTimeout(() => {
        if (updateInstallBtn) updateInstallBtn.disabled = false;
      }, 3000);
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      isDownloading = false;
      pluginDownloadFn = null;
      console.error('download update failed:', error);
      if (!cancelled) {
        if (updateProgressText) updateProgressText.textContent = t('update.install_failed');
      }
      if (updateInstallBtn) updateInstallBtn.disabled = false;
      if (updateDownloadBtn) updateDownloadBtn.disabled = false;
      if (updateCancelBtn) updateCancelBtn.classList.add('hidden');
      if (updateProgress) updateProgress.classList.add('hidden');
    }
  } else {
    isDownloading = false;
    openReleasePage();
  }
}

export async function autoCheckForUpdate() {
  if (!isTauriRuntime()) return;
  updateAvailable = null;
  const currentVer = await getCurrentVersion();

  const updaterResult = await checkUpdaterPlugin();
  if (updaterResult && updaterResult.available) {
    updateAvailable = updaterResult;
    pluginDownloadFn = updaterResult.downloadAndInstall || null;
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: updaterResult.version });
    showUpdateIndicator(true);
    showUpdatePopup(currentVer, updaterResult);
    return;
  }

  // Plugin not available — clear plugin download function so installUpdate
  // falls back to custom download path.
  pluginDownloadFn = null;

  const cached = getCachedUpdate();

  if (cached && cached.version === currentVer) {
    localStorage.removeItem(UPDATE_CACHE_KEY);
    if (updateStatus) updateStatus.textContent = t('update.status_latest');
    showUpdateIndicator(false);
    return;
  }

  if (cached && compareVersions('v' + cached.version, 'v' + currentVer) > 0) {
    updateAvailable = null;
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: cached.version });
    showUpdateIndicator(true);
    showUpdatePopup(currentVer, { version: cached.version, notes: cached.notes, url: cached.url || GITHUB_DOWNLOAD_URL });
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
    updateAvailable = null;
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: latestVer });
    showUpdateIndicator(true);
    showUpdatePopup(currentVer, { version: latestVer, notes: release.notes || '', url: release.html_url || GITHUB_DOWNLOAD_URL });
  } catch {
    if (updateStatus) updateStatus.textContent = t('update.status_unavailable');
  }
}

function showUpdatePopup(currentVer, updateInfo) {
  const updateModal = document.getElementById('updateModal');
  const updateLoading = document.getElementById('updateLoading');
  const updateInfoEl = document.getElementById('updateInfo');
  const updateNoUpdate = document.getElementById('updateNoUpdate');
  const updateError = document.getElementById('updateError');
  const updateModalTitle = document.getElementById('updateModalTitle');
  const updateCurrentVersion = document.getElementById('updateCurrentVersion');
  const updateLatestVersion = document.getElementById('updateLatestVersion');
  const updateReleaseNotes = document.getElementById('updateReleaseNotes');
  const updateInstallBtn = document.getElementById('updateInstallBtn');
  const updateDownloadBtn = document.getElementById('updateDownloadBtn');
  const updateProgress = document.getElementById('updateProgress');

  if (updateModal) {
    updateModal.classList.remove('hidden');
    updateLoading?.classList.add('hidden');
    updateNoUpdate?.classList.add('hidden');
    updateError?.classList.add('hidden');
    updateInfoEl?.classList.remove('hidden');
    updateDownloadBtn?.classList.add('hidden');
    updateInstallBtn?.classList.add('hidden');
    updateProgress?.classList.add('hidden');

    if (updateModalTitle) updateModalTitle.textContent = t('update.title');
    if (updateCurrentVersion) updateCurrentVersion.textContent = `v${currentVer}`;
    if (updateLatestVersion) updateLatestVersion.textContent = `v${updateInfo.version}`;
    if (updateReleaseNotes) {
      setReleaseNotes(updateReleaseNotes, updateInfo.notes);
    }
    // Always show the install button which handles both plugin and download flows
    if (updateInstallBtn) {
      updateInstallBtn.classList.remove('hidden');
      updateInstallBtn.onclick = () => installUpdate();
    }
    if (updateDownloadBtn) {
      updateDownloadBtn.dataset.url = updateInfo.url || GITHUB_DOWNLOAD_URL;
    }
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
  const updateInstallBtn = document.getElementById('updateInstallBtn');
  const updateOpenReleaseBtn = document.getElementById('updateOpenReleaseBtn');
  const updateProgress = document.getElementById('updateProgress');

  if (updateStatus) updateStatus.textContent = t('update.status_checking');
  updateAvailable = null;
  if (updateModal) {
    updateModal.classList.remove('hidden');
    updateInfo.classList.add('hidden');
    updateLoading.classList.remove('hidden');
    updateNoUpdate.classList.add('hidden');
    updateError.classList.add('hidden');
    updateDownloadBtn?.classList.add('hidden');
    updateInstallBtn?.classList.add('hidden');
    updateOpenReleaseBtn?.classList.add('hidden');
    updateProgress?.classList.add('hidden');
  }

  const currentVer = await getCurrentVersion();

  const updaterResult = await checkUpdaterPlugin();
  if (updaterResult && updaterResult.available) {
    updateAvailable = updaterResult;
    pluginDownloadFn = updaterResult.downloadAndInstall || null;
    if (updateLoading) updateLoading.classList.add('hidden');
    if (updateInfo) updateInfo.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.title');
    if (updateCurrentVersion) updateCurrentVersion.textContent = `v${currentVer}`;
    if (updateLatestVersion) updateLatestVersion.textContent = `v${updaterResult.version}`;
    if (updateReleaseNotes) {
      setReleaseNotes(updateReleaseNotes, updaterResult.notes);
    }
    if (updateInstallBtn) {
      updateInstallBtn.classList.remove('hidden');
      updateInstallBtn.onclick = () => installUpdate();
    }
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: updaterResult.version });
    showUpdateIndicator(false);
    return;
  }

  pluginDownloadFn = null;

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
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

  try {
    if (isTauri) {
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
        setReleaseNotes(updateReleaseNotes, cached.notes);
      }
      if (updateInstallBtn) {
        updateInstallBtn.classList.remove('hidden');
        updateInstallBtn.onclick = () => installUpdate();
      }
      if (updateDownloadBtn) {
        updateDownloadBtn.dataset.url = cached.url || GITHUB_DOWNLOAD_URL;
      }
      updateAvailable = { url: cached.url || GITHUB_DOWNLOAD_URL, notes: cached.notes };
      if (updateStatus) updateStatus.textContent = t('update.status_found', { version: cached.version });
      showUpdateIndicator(false);
      return;
    }
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.title_checking');
    const noUpdateIcon = document.getElementById('updateNoUpdateIcon');
    const noUpdateText = document.getElementById('updateNoUpdateText');
    if (noUpdateIcon) noUpdateIcon.textContent = '🌐';
    if (noUpdateText) noUpdateText.textContent = t('update.error_network');
    if (updateOpenReleaseBtn) updateOpenReleaseBtn.classList.remove('hidden');
    if (updateStatus) updateStatus.textContent = t('update.status_unavailable');
    return;
  }

  if (!latestVer) {
    if (updateLoading) updateLoading.classList.add('hidden');
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.title_checking');
    const noUpdateIcon = document.getElementById('updateNoUpdateIcon');
    const noUpdateText = document.getElementById('updateNoUpdateText');
    if (noUpdateIcon) noUpdateIcon.textContent = '📭';
    if (noUpdateText) noUpdateText.textContent = t('update.error_no_release');
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
      setReleaseNotes(updateReleaseNotes, notes);
    }
    if (updateInstallBtn) {
      updateInstallBtn.classList.remove('hidden');
      updateInstallBtn.onclick = () => installUpdate();
    }
    updateAvailable = { url: htmlUrl, notes };
    if (updateStatus) updateStatus.textContent = t('update.status_found', { version: latestVer });
  } else {
    if (updateNoUpdate) updateNoUpdate.classList.remove('hidden');
    if (updateModalTitle) updateModalTitle.textContent = t('update.status_latest_text');
    if (updateStatus) updateStatus.textContent = t('update.status_latest');
  }
}

export function openFeedbackPage() {
  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
  if (isTauri) {
    invoke('open_url_in_browser', { url: GITHUB_ISSUES_URL }).catch(() => window.open(GITHUB_ISSUES_URL, '_blank'));
  } else {
    window.open(GITHUB_ISSUES_URL, '_blank');
  }
}
