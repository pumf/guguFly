import { t, setLanguage } from '../i18n/index.js';

export function initSettingsPanel(ctx) {
  const {
    isTauriRuntime, MUTED_ICON, UNMUTED_ICON, setMuted,
    syncMuteToTray, stopLoopSoundLocal, stopPreviewAudio, resetAudioPreview,
    set, persistSetting,     applyTheme, syncThemeButtons,
    enableAutostart, disableAutostart,
    createMiniWindow, closeMiniWindow, positionMiniWindow, getMiniPositions, updateMiniPosGridActive,
    exportTasksAsJson, getCleanTasks, tasksRef, saveTasks, readBackupFromFile,
    hydrateTasks, setNextId, renderTaskView,
    checkForUpdate, openFeedbackPage, openReleasePage, getCurrentVersion,
    showToast, previewCustomSound, previewFlight, resetFlightSettings,
    invoke,
    speedSelect, heightSelect, effectSelect, planeSelect, planeSizeSelect, particleSelect,
    bubbleSelect, bubblePositionSelect, bubbleSizeSelect, bubbleBgColor, bubbleFontColor, soundSelect, soundModeSelect,
    useSoundCheckbox, useImageCheckbox,
    isConfigOpenRef, isMutedRef, muteBtn,
    persistFlightSettings,
  } = ctx;

  const configToggle = document.getElementById('configToggle');
  const configPanel = document.getElementById('configPanel');
  const configArrow = document.getElementById('configArrow');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const autostartToggle = document.getElementById('autostartToggle');
  const quietHoursToggle = document.getElementById('quietHoursToggle');
  const quietStartHour = document.getElementById('quietStartHour');
  const quietEndHour = document.getElementById('quietEndHour');
  const miniWindowToggle = document.getElementById('miniWindowToggle');
  const miniPosGrid = document.getElementById('miniPosGrid');
  const themeButtons = document.querySelectorAll('.theme-btn');
  const exportTasksBtn = document.getElementById('exportTasksBtn');
  const importTasksBtn = document.getElementById('importTasksBtn');
  const importTasksInput = document.getElementById('importTasksInput');
  const appVersionDisplay = document.getElementById('appVersionDisplay');
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  const feedbackBtn = document.getElementById('feedbackBtn');
  const repoLink = document.getElementById('repoLink');
  const updateModal = document.getElementById('updateModal');
  const updateOverlay = document.getElementById('updateOverlay');
  const updateCloseBtn = document.getElementById('updateCloseBtn');
  const updateCloseActionBtn = document.getElementById('updateCloseActionBtn');
  const updateDownloadBtn = document.getElementById('updateDownloadBtn');
  const updateOpenReleaseBtn = document.getElementById('updateOpenReleaseBtn');
  const statsToggle = document.getElementById('statsToggle');
  const modal = document.getElementById('taskModal');
  const previewSoundBtn = document.getElementById('previewSoundBtn');
  const previewFlightBtn = document.getElementById('previewFlightBtn');
  const resetFlightBtn = document.getElementById('resetFlightBtn');
  const displaySelect = document.getElementById('displaySelect');

  configToggle.addEventListener('click', () => {
    const next = !isConfigOpenRef.get();
    isConfigOpenRef.set(next);
    configPanel.classList.toggle('hidden', !next);
    configArrow.classList.toggle('collapsed', !next);
  });

  const settingsTabs = document.querySelectorAll('.settings-tab');
  const settingsTabPanels = {
    general: document.getElementById('settingsTabGeneral'),
    data: document.getElementById('settingsTabData'),
    about: document.getElementById('settingsTabAbout'),
  };
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      Object.entries(settingsTabPanels).forEach(([key, panel]) => {
        if (panel) panel.classList.toggle('hidden', key !== tabId);
      });
    });
  });

  muteBtn.addEventListener('click', async () => {
    await ctx.unlockAudioIfNeeded();
    const next = !isMutedRef.get();
    isMutedRef.set(next);
    muteBtn.innerHTML = next ? MUTED_ICON : UNMUTED_ICON;
    setMuted(next);
    syncMuteToTray();
    if (next) { stopLoopSoundLocal(); stopPreviewAudio(); resetAudioPreview(); }
    await set('muted', next);
  });

  settingsBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    settingsModal.classList.remove('hidden');
  });
  settingsOverlay.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsCloseBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  autostartToggle.addEventListener('change', async () => {
    if (!isTauriRuntime) { autostartToggle.checked = false; return; }
    try {
      if (autostartToggle.checked) await enableAutostart();
      else await disableAutostart();
    } catch (e) { console.error('autostart error:', e); }
  });

  quietHoursToggle?.addEventListener('change', () => persistSetting('quietHoursEnabled', quietHoursToggle.checked));
  quietStartHour?.addEventListener('change', () => persistSetting('quietStartHour', parseInt(quietStartHour.value) || 22));
  quietEndHour?.addEventListener('change', () => persistSetting('quietEndHour', parseInt(quietEndHour.value) || 8));

  miniWindowToggle?.addEventListener('change', () => {
    persistSetting('miniWindowEnabled', miniWindowToggle.checked);
    if (miniWindowToggle.checked) void createMiniWindow();
    else void closeMiniWindow();
  });

  if (miniPosGrid) {
    miniPosGrid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mini-pos-cell');
      if (!btn) return;
      const pos = btn.dataset.pos;
      if (!pos || !getMiniPositions()[pos]) return;
      await persistSetting('miniWindowPosition', pos);
      updateMiniPosGridActive(pos);
      void positionMiniWindow(pos);
    });
  }

  speedSelect.addEventListener('change', () => persistSetting('speed', speedSelect.value));
  heightSelect.addEventListener('change', () => persistSetting('height', heightSelect.value));
  displaySelect.addEventListener('change', () => persistSetting('display', displaySelect.value));
  effectSelect.addEventListener('change', () => persistSetting('effect', effectSelect.value));
  planeSelect.addEventListener('change', () => persistSetting('plane', planeSelect.value));
  planeSizeSelect.addEventListener('change', () => persistSetting('planeSize', planeSizeSelect.value));
  particleSelect.addEventListener('change', () => persistSetting('particle', particleSelect.value));
  bubbleSelect.addEventListener('change', () => persistSetting('bubble', bubbleSelect.value));
  bubblePositionSelect.addEventListener('change', () => persistSetting('bubblePosition', bubblePositionSelect.value));
  bubbleSizeSelect.addEventListener('change', () => persistSetting('bubbleSize', bubbleSizeSelect.value));
  bubbleBgColor.addEventListener('input', () => persistSetting('bubbleBgColor', bubbleBgColor.value));
  bubbleFontColor.addEventListener('input', () => persistSetting('bubbleFontColor', bubbleFontColor.value));
  soundSelect.addEventListener('change', () => persistSetting('sound', soundSelect.value));
  soundModeSelect.addEventListener('change', () => persistSetting('soundMode', soundModeSelect.value));
  useSoundCheckbox.addEventListener('change', () => persistSetting('useSound', useSoundCheckbox.checked));
  useImageCheckbox.addEventListener('change', () => persistSetting('useImage', useImageCheckbox.checked));

  previewSoundBtn?.addEventListener('click', () => { void previewCustomSound(); });
  previewFlightBtn?.addEventListener('click', () => { void previewFlight(); });
  resetFlightBtn?.addEventListener('click', () => { resetFlightSettings(); });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      syncThemeButtons();
      void set('theme', theme);
    });
  });

  const langButtons = document.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (!lang) return;
      setLanguage(lang, { persist: true });
      ctx.persistSetting('language', lang);
    });
  });

  exportTasksBtn?.addEventListener('click', async () => {
    const version = await getCurrentVersion();
    const count = exportTasksAsJson(getCleanTasks(tasksRef.get()), {
      speed: speedSelect.value, height: heightSelect.value, effect: effectSelect.value,
      plane: planeSelect.value, particle: particleSelect.value, bubble: bubbleSelect.value,
      bubblePosition: bubblePositionSelect.value, sound: soundSelect.value,
      soundMode: soundModeSelect.value, useSound: useSoundCheckbox.checked,
      useImage: useImageCheckbox.checked, muted: isMutedRef.get(),
    }, version);
    showToast(t('settings.export_success', { count }));
  });
  importTasksBtn?.addEventListener('click', () => {
    importTasksInput.value = '';
    importTasksInput.click();
  });

  const importPreviewModal = document.getElementById('importPreviewModal');
  const importPreviewOverlay = document.getElementById('importPreviewOverlay');
  const importPreviewCloseBtn = document.getElementById('importPreviewCloseBtn');
  const importPreviewSummary = document.getElementById('importPreviewSummary');
  const importPreviewTasks = document.getElementById('importPreviewTasks');
  const importPreviewCancelBtn = document.getElementById('importPreviewCancelBtn');
  const importPreviewConfirmBtn = document.getElementById('importPreviewConfirmBtn');

  let pendingImportData = null;

  function closeImportPreview() {
    importPreviewModal?.classList.add('hidden');
    pendingImportData = null;
  }

  function showImportPreview(data) {
    pendingImportData = data;
    const tasks = data.tasks || [];
    importPreviewSummary.textContent = t('import.summary', { count: tasks.length });

    const typeIcons = { alarm: '⏰', countdown: '⏱', holiday: '📅', anniversary: '💝' };
    importPreviewTasks.innerHTML = tasks.slice(0, 20).map(task => {
      const icon = typeIcons[task.type] || '📋';
      const time = task.type === 'alarm' ? `${task.hour}:${String(task.minute).padStart(2, '0')}` :
                   task.type === 'countdown' ? t('import.countdown_minutes', { minutes: Math.floor((task.duration || 0) / 60) }) :
                   task.type === 'holiday' ? `${task.month}/${task.day}` :
                   `${task.month}/${task.day}`;
      return `<div class="import-preview-task">
        <span class="import-preview-task-type">${icon}</span>
        <span class="import-preview-task-label">${task.label || t('common.unnamed_task')}</span>
        <span class="import-preview-task-time">${time}</span>
      </div>`;
    }).join('') + (tasks.length > 20 ? `<div class="import-preview-task" style="justify-content:center;color:var(--muted)">${t('import.more_tasks', { count: tasks.length - 20 })}</div>` : '');

    importPreviewModal?.classList.remove('hidden');
  }

  importPreviewOverlay?.addEventListener('click', closeImportPreview);
  importPreviewCloseBtn?.addEventListener('click', closeImportPreview);
  importPreviewCancelBtn?.addEventListener('click', closeImportPreview);

  importPreviewConfirmBtn?.addEventListener('click', async () => {
    if (!pendingImportData) return;
    const strategy = document.querySelector('input[name="importStrategy"]:checked')?.value || 'overwrite';
    const { tasks: imported, maxId } = hydrateTasks(pendingImportData.tasks);
    const currentTasks = tasksRef.get();

    let resultTasks;
    let added = 0;
    let skipped = 0;

    if (strategy === 'overwrite') {
      resultTasks = imported;
      added = imported.length;
    } else if (strategy === 'merge') {
      const existingIds = new Set(currentTasks.map(t => t.id));
      resultTasks = [...currentTasks];
      for (const task of imported) {
        if (existingIds.has(task.id)) {
          skipped++;
        } else {
          resultTasks.push(task);
          added++;
        }
      }
    } else {
      const existingLabels = new Set(currentTasks.map(t => `${t.type}:${t.label}:${t.hour}:${t.minute}`));
      resultTasks = [...currentTasks];
      for (const task of imported) {
        const key = `${task.type}:${task.label}:${task.hour}:${task.minute}`;
        if (existingLabels.has(key)) {
          skipped++;
        } else {
          resultTasks.push(task);
          added++;
          existingLabels.add(key);
        }
      }
    }

    tasksRef.set(resultTasks);
    setNextId(Math.max(maxId, ...resultTasks.map(t => t.id)) + 1);
    await saveTasks(getCleanTasks(resultTasks));

    if (strategy === 'overwrite' && pendingImportData.settings && typeof pendingImportData.settings === 'object') {
      const s = pendingImportData.settings;
      if (s.speed) speedSelect.value = s.speed;
      if (s.height) heightSelect.value = s.height;
      if (s.effect) effectSelect.value = s.effect;
      if (s.plane) planeSelect.value = s.plane;
      if (s.particle) particleSelect.value = s.particle;
      if (s.bubble) bubbleSelect.value = s.bubble;
      if (s.bubblePosition) bubblePositionSelect.value = s.bubblePosition;
      if (s.sound) soundSelect.value = s.sound;
      if (s.soundMode) soundModeSelect.value = s.soundMode;
      if (typeof s.useSound === 'boolean') useSoundCheckbox.checked = s.useSound;
      if (typeof s.useImage === 'boolean') useImageCheckbox.checked = s.useImage;
      if (typeof s.muted === 'boolean') { isMutedRef.set(s.muted); muteBtn.innerHTML = s.muted ? MUTED_ICON : UNMUTED_ICON; setMuted(s.muted); }
      await persistFlightSettings({
        speed: speedSelect.value, height: heightSelect.value, effect: effectSelect.value,
        plane: planeSelect.value, particle: particleSelect.value, bubble: bubbleSelect.value,
        bubblePosition: bubblePositionSelect.value, sound: soundSelect.value,
        soundMode: soundModeSelect.value, useSound: useSoundCheckbox.checked,
        useImage: useImageCheckbox.checked,
      });
      await set('muted', s.muted);
    }

    renderTaskView();
    const msgKey = strategy === 'overwrite' ? 'import.result_overwrite' :
                   strategy === 'merge' ? 'import.result_merge' : 'import.result_add_only';
    showToast(t(msgKey, { count: added + skipped, added, skipped }));
    closeImportPreview();
  });

  importTasksInput?.addEventListener('change', async () => {
    const file = importTasksInput.files?.[0];
    if (!file) return;
    try {
      const data = await readBackupFromFile(file);
      const count = Array.isArray(data.tasks) ? data.tasks.length : 0;
      if (count === 0) { showToast(t('settings.import_no_data')); return; }
      showImportPreview(data);
    } catch (e) { showToast(t('settings.import_failed', { error: e.message || t('error.unknown') })); }
  });

  repoLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isTauriRuntime) invoke('open_url_in_browser', { url: 'https://github.com/pumf/guguFly' }).catch(err => console.warn('open repo link failed:', err));
    else window.open('https://github.com/pumf/guguFly', '_blank');
  });

  // Video cache management
  const videoCacheList = document.getElementById('videoCacheList');
  const refreshCacheBtn = document.getElementById('refreshCacheBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  async function refreshVideoCache() {
    if (!isTauriRuntime || !videoCacheList) return;
    try {
      const files = await invoke('get_video_cache_info');
      if (!files || files.length === 0) {
        videoCacheList.innerHTML = `<div class="settings-item" style="color:var(--text-muted)">${t('settings.video_cache_empty')}</div>`;
        return;
      }
      const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
      videoCacheList.innerHTML = files.map(f =>
        `<div class="settings-item" style="display:flex;justify-content:space-between;align-items:center">
          <span>${f.name}</span>
          <span style="color:var(--text-muted);font-size:12px">${formatBytes(f.size || 0)}</span>
        </div>`
      ).join('') + `<div class="settings-item" style="color:var(--text-muted);font-size:12px">${t('settings.video_cache_summary', { count: files.length, size: formatBytes(totalSize) })}</div>`;
    } catch (e) {
      console.error('refresh cache info failed:', e);
    }
  }

  refreshCacheBtn?.addEventListener('click', () => { void refreshVideoCache(); });

  clearCacheBtn?.addEventListener('click', async () => {
    if (!isTauriRuntime) return;
    const proceed = await window.showConfirm(t('settings.video_cache_clear_confirm'));
    if (!proceed) return;
    try {
      await invoke('clear_video_cache');
      showToast(t('settings.video_cache_cleared'));
      refreshVideoCache();
    } catch (e) {
      showToast(t('error.cache_clear_failed', { error: e.message || e }));
    }
  });

  // Auto-load cache info when settings modal opens
  settingsBtn?.addEventListener('click', () => {
    setTimeout(() => { void refreshVideoCache(); }, 100);
  });

  if (statsToggle) {
    statsToggle.addEventListener('click', () => {
      const statsModal = document.getElementById('statsModal');
      if (statsModal) statsModal.classList.remove('hidden');
    });
  }

  const statsOverlay = document.getElementById('statsOverlay');
  const statsCloseBtn = document.getElementById('statsCloseBtn');
  statsOverlay?.addEventListener('click', () => {
    const statsModal = document.getElementById('statsModal');
    if (statsModal) statsModal.classList.add('hidden');
  });
  statsCloseBtn?.addEventListener('click', () => {
    const statsModal = document.getElementById('statsModal');
    if (statsModal) statsModal.classList.add('hidden');
  });

  if (isTauriRuntime) {
    getCurrentVersion().then(v => { if (appVersionDisplay) appVersionDisplay.textContent = `v${v}`; });
  }
  checkUpdateBtn?.addEventListener('click', () => { void checkForUpdate(); });
  feedbackBtn?.addEventListener('click', () => { void openFeedbackPage(); });
  updateOverlay?.addEventListener('click', () => updateModal.classList.add('hidden'));
  updateCloseBtn?.addEventListener('click', () => updateModal.classList.add('hidden'));
  updateCloseActionBtn?.addEventListener('click', () => updateModal.classList.add('hidden'));
  updateDownloadBtn?.addEventListener('click', () => {
    openReleasePage();
    updateModal.classList.add('hidden');
  });
  updateOpenReleaseBtn?.addEventListener('click', () => {
    openReleasePage();
    updateModal.classList.add('hidden');
  });
}
