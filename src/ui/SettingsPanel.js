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
    speedSelect, heightSelect, effectSelect, planeSelect, particleSelect,
    bubbleSelect, bubblePositionSelect, soundSelect, soundModeSelect,
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
  particleSelect.addEventListener('change', () => persistSetting('particle', particleSelect.value));
  bubbleSelect.addEventListener('change', () => persistSetting('bubble', bubbleSelect.value));
  bubblePositionSelect.addEventListener('change', () => persistSetting('bubblePosition', bubblePositionSelect.value));
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

  exportTasksBtn?.addEventListener('click', async () => {
    const version = await getCurrentVersion();
    const count = exportTasksAsJson(getCleanTasks(tasksRef.get()), {
      speed: speedSelect.value, height: heightSelect.value, effect: effectSelect.value,
      plane: planeSelect.value, particle: particleSelect.value, bubble: bubbleSelect.value,
      bubblePosition: bubblePositionSelect.value, sound: soundSelect.value,
      soundMode: soundModeSelect.value, useSound: useSoundCheckbox.checked,
      useImage: useImageCheckbox.checked, muted: isMutedRef.get(),
    }, version);
    showToast(`已导出 ${count} 条任务到下载文件夹`);
  });
  importTasksBtn?.addEventListener('click', () => {
    importTasksInput.value = '';
    importTasksInput.click();
  });
  importTasksInput?.addEventListener('change', async () => {
    const file = importTasksInput.files?.[0];
    if (!file) return;
    try {
      const data = await readBackupFromFile(file);
      const count = Array.isArray(data.tasks) ? data.tasks.length : 0;
      if (count === 0) { showToast('备份里没有任务数据'); return; }
      const proceed = isTauriRuntime
        ? window.confirm(`将导入 ${count} 条任务，导入后当前任务将被替换。是否继续？`)
        : window.confirm(`将导入 ${count} 条任务，导入后当前任务将被替换。是否继续？`);
      if (!proceed) return;
      const { tasks: imported, maxId } = hydrateTasks(data.tasks);
      tasksRef.set(imported);
      setNextId(maxId);
      await saveTasks(getCleanTasks(imported));
      if (data.settings && typeof data.settings === 'object') {
        const s = data.settings;
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
      showToast(`已导入 ${count} 条任务`);
    } catch (e) { showToast(`导入失败：${e.message || '未知错误'}`); }
  });

  repoLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isTauriRuntime) invoke('open_url_in_browser', { url: 'https://github.com/pumf/guguFly' }).catch(() => {});
    else window.open('https://github.com/pumf/guguFly', '_blank');
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
