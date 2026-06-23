export async function applySettings(ctx) {
  const {
    cfg,
    state,
    isTauriRuntime,
    invoke,
    refs,
    flightPresets,
    persistFlightSettings,
    persistSetting,
    showToast,
    incrementTodayCount,
    getDateKey,
    get,
    set,
    resetStreak,
    dayDiff,
    isInQuietHours,
    getRandomQuote,
    recordFlightTrigger,
    notifyFlightTriggered,
    renderStatsPanel,
    triggerFlightWithMode,
    soundPresets,
    playPresetSound,
    buildCustomAudioObjectUrl,
    stopPreviewAudio,
    syncMuteToTray,
    syncEffectPicker,
    updateMiniPosGridActive,
    isAutostartEnabled,
    clearFlightStreak,
    setMuted,
    initLogo,
    initFlightSync,
    initFlightTrigger,
    initAudioSystem,
    updateSoundMeta,
    revokeCustomAudioObjectUrl,
    updateTitleLogo,
    defaultFlightSettings,
  } = ctx;

  state.isMuted = cfg.muted;
  refs.muteBtn.innerHTML = state.isMuted ? refs.MUTED_ICON : refs.UNMUTED_ICON;
  setMuted(state.isMuted);

  initLogo({
    getCustomImageData: () => state.customImageData,
    isTauriRuntime,
    invoke,
    isMuted: state.isMuted,
    settingsModal: refs.settingsModal,
  });

  initFlightSync({
    speedSelect: refs.speedSelect,
    heightSelect: refs.heightSelect,
    effectSelect: refs.effectSelect,
    planeSelect: refs.planeSelect,
    planeSizeSelect: refs.planeSizeSelect,
    particleSelect: refs.particleSelect,
    bubbleSelect: refs.bubbleSelect,
    bubblePositionSelect: refs.bubblePositionSelect,
    bubbleSizeSelect: refs.bubbleSizeSelect,
    bubbleBgColor: refs.bubbleBgColor,
    bubbleFontColor: refs.bubbleFontColor,
    soundSelect: refs.soundSelect,
    soundModeSelect: refs.soundModeSelect,
    useSoundCheckbox: refs.useSoundCheckbox,
    useImageCheckbox: refs.useImageCheckbox,
    effectCards: (document.getElementById('effectPicker')?.querySelectorAll('.effect-card')) || [],
    presetButtons: document.querySelectorAll('.preset-btn'),
    presetWatchSelectors: [refs.speedSelect, refs.heightSelect, refs.effectSelect, refs.planeSelect, refs.planeSizeSelect, refs.particleSelect, refs.bubbleSelect, refs.bubblePositionSelect, refs.bubbleSizeSelect, refs.bubbleBgColor, refs.bubbleFontColor, refs.soundSelect, refs.soundModeSelect],
    FLIGHT_PRESETS: flightPresets,
    DEFAULT_FLIGHT_SETTINGS: defaultFlightSettings,
    persistFlightSettings,
    persistSetting,
    showToast,
  });

  initFlightTrigger({
    incrementTodayCount,
    todayCountEl: refs.todayCountEl,
    getDateKey,
    get,
    set,
    resetStreak,
    dayDiff,
    isInQuietHours,
    quietHoursToggle: refs.quietHoursToggle,
    quietStartHour: refs.quietStartHour,
    quietEndHour: refs.quietEndHour,
    getRandomQuote,
    recordFlightTrigger,
    notifyFlightTriggered,
    renderStatsPanel: () => renderStatsPanel(),
    triggerFlightWithMode,
  });

  initAudioSystem({
    soundSelect: refs.soundSelect,
    soundModeSelect: refs.soundModeSelect,
    useSoundCheckbox: refs.useSoundCheckbox,
    soundMeta: refs.soundMeta,
    soundName: refs.soundNameEl,
    previewSoundBtn: refs.previewSoundBtn,
    getCustomAudioData: () => state.customAudioData,
    getCustomAudioName: () => state.customAudioName,
    showToast,
    SOUND_PRESETS: soundPresets,
    playPresetSound,
    buildCustomAudioObjectUrl,
    stopPreviewAudio,
  });

  syncMuteToTray();

  refs.todayCountEl.textContent = `${cfg.todayCount} 次`;
  if (cfg.speed) refs.speedSelect.value = cfg.speed;
  if (cfg.height) refs.heightSelect.value = cfg.height;
  if (cfg.display) refs.displaySelect.value = cfg.display;
  if (cfg.effect) { refs.effectSelect.value = cfg.effect; syncEffectPicker(cfg.effect); }
  if (cfg.plane) refs.planeSelect.value = cfg.plane;
  if (cfg.planeSize) refs.planeSizeSelect.value = cfg.planeSize;
  if (cfg.bubbleSize) refs.bubbleSizeSelect.value = cfg.bubbleSize;
  if (cfg.bubbleBgColor) refs.bubbleBgColor.value = cfg.bubbleBgColor;
  if (cfg.bubbleFontColor) refs.bubbleFontColor.value = cfg.bubbleFontColor;
  if (cfg.particle) refs.particleSelect.value = cfg.particle;
  if (cfg.bubble) refs.bubbleSelect.value = cfg.bubble;
  if (cfg.bubblePosition) refs.bubblePositionSelect.value = cfg.bubblePosition;
  if (cfg.sound) refs.soundSelect.value = cfg.sound;
  if (cfg.soundMode) refs.soundModeSelect.value = cfg.soundMode;
  refs.useSoundCheckbox.checked = !!cfg.useSound && !!cfg.customAudio;
  state.customImageData = cfg.customImage || '';
  state.customAudioData = cfg.customAudio || '';
  state.customAudioName = cfg.customAudioName || '';

  if (state.customAudioData) {
    buildCustomAudioObjectUrl();
  } else {
    revokeCustomAudioObjectUrl();
  }

  refs.clearImageBtn.classList.toggle('hidden', !state.customImageData);
  refs.clearSoundBtn.classList.toggle('hidden', !state.customAudioData);
  updateSoundMeta();
  refs.useImageCheckbox.checked = cfg.useImage === undefined ? !!state.customImageData : cfg.useImage;
  if (state.customImageData) {
    refs.imagePreview.src = state.customImageData;
    refs.imagePreview.classList.remove('hidden');
  }
  refs.useImageCheckbox.closest('.img-toggle').classList.toggle('hidden', !state.customImageData);
  if (state.customImageData && refs.customizeImageBtn && refs.imageCollapse) {
    refs.imageCollapse.classList.remove('hidden');
    refs.customizeImageBtn.classList.add('is-open');
    refs.customizeImageBtn.textContent = '▾ 收起';
  }
  if (state.customAudioData && refs.customizeSoundBtn && refs.soundCollapse) {
    refs.soundCollapse.classList.remove('hidden');
    refs.customizeSoundBtn.classList.add('is-open');
    refs.customizeSoundBtn.textContent = '▾ 收起';
  }
  updateTitleLogo();

  const date = new Date().toDateString();
  if (cfg.lastDate !== date) {
    await set('todayCount', 0);
    refs.todayCountEl.textContent = '0 次';
  }

  const streakLastDate = await get('streakLastDate');
  const streakGap = dayDiff(streakLastDate, getDateKey());
  if (streakLastDate && streakGap !== null && streakGap > 1) await clearFlightStreak();

  try {
    if (isTauriRuntime) refs.autostartToggle.checked = await isAutostartEnabled();
    else {
      refs.autostartToggle.checked = false;
      refs.autostartToggle.disabled = true;
    }
  } catch (error) {
    console.error('autostart state failed:', error);
  }

  if (refs.quietHoursToggle) refs.quietHoursToggle.checked = !!cfg.quietHoursEnabled;
  if (refs.quietStartHour) refs.quietStartHour.value = cfg.quietStartHour || 22;
  if (refs.quietEndHour) refs.quietEndHour.value = cfg.quietEndHour || 8;
  if (refs.miniWindowToggle) refs.miniWindowToggle.checked = !!cfg.miniWindowEnabled;
  if (cfg.miniWindowPosition) updateMiniPosGridActive(cfg.miniWindowPosition);
}

export async function runPostInit(ctx) {
  const {
    cfg,
    state,
    refs,
    renderTaskView,
    startAlarmChecker,
    initHolidayChecklist,
    holidayPresets,
    initSystemThemeWatcher,
    createMiniWindow,
    applyTheme,
    syncThemeButtons,
    initNotificationPermission,
    initColorPickerModule,
    syncPresetButtons,
    renderStatsPanel,
  } = ctx;

  renderTaskView();
  startAlarmChecker();
  initHolidayChecklist(refs.holidayChecklist, holidayPresets);
  initSystemThemeWatcher();
  setTimeout(() => {
    if (refs.miniWindowToggle?.checked) void createMiniWindow();
  }, 2000);
  applyTheme(cfg.theme || 'system');
  syncThemeButtons();
  initNotificationPermission();
  initColorPickerModule({ editColorPicker: refs.editColorPicker });
  refs.configPanel.classList.toggle('hidden', !state.isConfigOpen);
  refs.configArrow.classList.toggle('collapsed', !state.isConfigOpen);
  syncPresetButtons();
  await renderStatsPanel();
}
