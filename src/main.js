import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, resetStreak, recordFlightTrigger, computeFlightStats, loadFlightLog, setStorageQuotaHandler, setStoreFailureHandler } from './storage.js';
import { getRandomQuote } from './quotes.js';
import { SOUND_PRESETS, playPreset as playPresetSound } from './sounds.js';
import { exportTasksAsJson, readBackupFromFile } from './backup.js';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { showConfirm, setConfirmI18n } from './utils.js';
window.showConfirm = showConfirm;

import { HOLIDAY_PRESETS } from './tasks/HolidayPresets.js';
import { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask, setNextId } from './tasks/TaskFactory.js';
import { getDateKey, dayDiff, getCleanTasks, hydrateTasks, formatHolidayLabel, isAlarmDueToday, normalizeRepeat } from './tasks/TaskUtils.js';
import { DEFAULT_FLIGHT_SETTINGS, FLIGHT_PRESETS } from './flight/FlightPresets.js';
import { initFlightOrchestrator, queueFlight, clearFlightQueue, clearAllSequences, stopLoopSound, stopPreviewAudio, validateCustomAudioPreview, setCustomImageData, setCustomAudioData, setCustomAudioObjectUrl, setMuted, triggerFlightWithMode, initFlightListeners, setToastFn, buildCustomAudioObjectUrl, setUpdateTaskFlightCb, resetVideoWindowState, resetPfNotifyState, closePostFlightNotify, setEmergencyLandingActive, isEmergencyLandingActive, setIsInQuietHoursFn, setSkipPostFlight, clearPendingPfCancel, releaseFlightQueue, setPfActionHandler } from './flight/FlightOrchestrator.js';
import { renderTasks, updateCountdownTaskUI, toggleTaskExpandedCard, isCompactMode, setCompactMode, copyTask } from './ui/TaskRenderer.js';
import { initCountdownTimer, startCountdown, pauseCountdown, stopCountdown, stopAllCountdowns } from './tasks/CountdownTimer.js';
import { initPomodoroTimer, startPomodoro, pausePomodoro, resumePomodoro, stopPomodoro, skipPomodoroPhase, getPomodoroState, isPomodoroActive, setPomodoroTickCallback } from './tasks/PomodoroTimer.js';
import { initAlarmChecker, getNextUpcomingTask, startAlarmChecker } from './tasks/AlarmChecker.js';
import { openEditModal, openNewModal, closeModal, saveModal, deleteTask, initHolidayChecklist } from './ui/ModalController.js';
import { renderStats, setStatsTasks } from './ui/StatsPanel.js';
import { renderTaskHistory, setHistoryTasks } from './ui/HistoryPanel.js';
import { initAudioSystem, revokeCustomAudioObjectUrl, stopLoopSoundLocal, updateSoundMeta, previewCustomSound, resetAudioPreview, syncAudioObjectUrlTo } from './ui/AudioSystem.js';
import { unlockAudioIfNeeded } from './ui/AudioManager.js';
import { createMiniWindow, closeMiniWindow, positionMiniWindow, updateMiniWindow, updateMiniPosGridActive, getMiniPositions } from './ui/MiniWindow.js';
import { applyTheme, syncThemeButtons, initSystemThemeWatcher } from './settings/ThemeManager.js';
import { loadSettings, persistSetting, persistFlightSettings, isInQuietHours } from './settings/SettingsManager.js';
import { getCurrentVersion, autoCheckForUpdate, checkForUpdate, openReleasePage, openFeedbackPage, setUpdateStatusEl } from './settings/UpdateManager.js';
import { initNotificationPermission, notifyFlightTriggered } from './ui/NotificationManager.js';
import { parseDeepLinkUrl, buildTaskFromDeepLink } from './flight/DeepLink.js';
import { initEmergency, triggerEmergencyLanding } from './flight/Emergency.js';
import { initFlightSync, syncEffectPicker, syncPresetButtons } from './settings/FlightSync.js';
import { initColorPicker as initColorPickerModule, getSelectedEditColor, selectColor } from './ui/ColorPicker.js';
import { initHeroSection, updateHeroStatus, updateNextUpcoming } from './ui/HeroSection.js';
import { initFlightTrigger, clearFlightStreak, doTriggerFlight } from './flight/FlightTrigger.js';
import { initFlightPreview, previewFlight, resetFlightSettings } from './ui/FlightPreview.js';
import { initLogo, updateTitleLogo, syncMuteToTray, closeSettingsModal } from './ui/Logo.js';
import { initTauriListeners } from './flight/TauriListeners.js';
import { initToast, showToast } from './ui/Toast.js';
import { initMediaUpload } from './ui/MediaUpload.js';
import { initTaskFilter } from './ui/TaskFilter.js';
import { initSettingsPanel } from './ui/SettingsPanel.js';
import { initModalEvents } from './ui/ModalEvents.js';
import { initWindowEvents } from './ui/WindowEvents.js';
import { initQuickCreate, setQuickCreateDeps } from './ui/QuickCreateBar.js';
import { initTaskDetailDrawer, refreshDrawer } from './ui/TaskDetailDrawer.js';
import { initKeyboardShortcuts } from './ui/KeyboardShortcuts.js';
import { initBatchOperation, enterSelectionMode, toggleSelectionMode, isSelectionModeActive, toggleTaskSelection, isTaskSelected } from './ui/BatchOperation.js';
import { initOnboarding, checkAndShowOnboarding } from './ui/Onboarding.js';
import { detectTauriRuntime } from './app/runtime.js';
import { getMainDomRefs } from './app/domRefs.js';
import { createAppState } from './app/state.js';
import { createTaskActions } from './app/taskActions.js';
import { applySettings, runPostInit } from './app/bootstrap.js';
import { handleDeepLink } from './app/deepLinkActions.js';
import { initCoreModules } from './app/initModules.js';
import { t, initI18n, setLanguage, onLanguageChange, translateDOM } from './i18n/index.js';

const isTauriRuntime = detectTauriRuntime();

const {
  taskListEl,
  modal,
  modalTitle,
  modalError,
  editLabel,
  editMsg,
  editGroup,
  alarmFields,
  countdownFields,
  holidayFields,
  anniversaryFields,
  editHour,
  editMinute,
  editMinutes,
  editSeconds,
  editHolidayHour,
  editHolidayMinute,
  holidayChecklist,
  editAnniMonth,
  editAnniDay,
  editAnniHour,
  editAnniMinute,
  editAnniLunar,
  editFlightMode,
  editLoopCount,
  editLoopInterval,
  editIntervalCount,
  loopTimesField,
  loopIntervalField,
  editPostFlightAction,
  editPostFlightAppPath,
  editPostFlightUrl,
  editPostFlightFolder,
  editPostFlightScript,
  postFlightAppField,
  postFlightUrlField,
  postFlightFolderField,
  postFlightScriptField,
  editPostFlightVideoEnable,
  editPostFlightVideoSelect,
  editPostFlightVideoPath,
  editPostFlightVideoDurationMin,
  editPostFlightVideoDurationSec,
  postFlightVideoSelectField,
  postFlightVideoCustomField,
  postFlightVideoDurationField,
  editPostFlightVideoSpeed,
  postFlightVideoSpeedField,
  editPostFlightVideoScale,
  postFlightVideoScaleField,
  editPostFlightEffectType,
  postFlightEffectField,
  editPostFlightEffectDuration,
  postFlightEffectDurationField,
  deleteTaskBtn,
  todayCountEl,
  heroStatusEl,
  toastEl,
  muteBtn,
  emergencyBtn,
  settingsModal,
  autostartToggle,
  quietHoursToggle,
  quietStartHour,
  quietEndHour,
  miniWindowToggle,
  updateStatus,
  speedSelect,
  heightSelect,
  displaySelect,
  configPanel,
  configArrow,
  effectSelect,
  planeSelect,
  planeSizeSelect,
  particleSelect,
  bubbleSelect,
  bubblePositionSelect,
  bubbleSizeSelect,
  bubbleBgColor,
  bubbleFontColor,
  imageBtn,
  imageInput,
  clearImageBtn,
  imagePreview,
  useImageCheckbox,
  customizeImageBtn,
  imageCollapse,
  editImageBtn,
  editImageInput,
  editClearImageBtn,
  editImagePreview,
  editUseImageCheckbox,
  editColorPicker,
  soundSelect,
  soundModeSelect,
  soundBtn,
  soundInput,
  clearSoundBtn,
  useSoundCheckbox,
  soundMeta,
  soundNameEl,
  previewSoundBtn,
  customizeSoundBtn,
  soundCollapse,
} = getMainDomRefs();

const state = createAppState();

const MUTED_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
const UNMUTED_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';

// --- Toast ---
// extracted to ./ui/Toast.js

// --- Audio helpers ---
// extracted to ./ui/AudioSystem.js

// --- Countdown ---
// extracted to ./tasks/CountdownTimer.js

// --- Alarm checker ---
// extracted to ./tasks/AlarmChecker.js

// --- Hero / next upcoming ---
// extracted to ./ui/HeroSection.js

// --- Flight trigger ---
// extracted to ./flight/FlightTrigger.js

const taskActions = createTaskActions({
  state,
  dom: {
    taskListEl,
    modal,
    modalTitle,
    modalError,
    editLabel,
    editMsg,
    editGroup,
    alarmFields,
    countdownFields,
    holidayFields,
    anniversaryFields,
    editHour,
    editMinute,
    editMinutes,
    editSeconds,
    editHolidayHour,
    editHolidayMinute,
    holidayChecklist,
    editAnniMonth,
    editAnniDay,
    editAnniHour,
    editAnniMinute,
    editAnniLunar,
    editFlightMode,
    editLoopCount,
    editLoopInterval,
    editIntervalCount,
    loopTimesField,
    loopIntervalField,
    editPostFlightAction,
    editPostFlightAppPath,
    editPostFlightUrl,
    editPostFlightFolder,
    editPostFlightScript,
    postFlightAppField,
    postFlightUrlField,
    postFlightFolderField,
    postFlightScriptField,
    editPostFlightVideoEnable,
    editPostFlightVideoSelect,
    editPostFlightVideoPath,
    editPostFlightVideoDurationMin,
    editPostFlightVideoDurationSec,
    postFlightVideoSelectField,
    postFlightVideoCustomField,
    postFlightVideoDurationField,
    editPostFlightVideoSpeed,
    postFlightVideoSpeedField,
    editPostFlightVideoScale,
    postFlightVideoScaleField,
    editPostFlightEffectType,
    postFlightEffectField,
    editPostFlightEffectDuration,
    postFlightEffectDurationField,
    deleteTaskBtn,
    editImagePreview,
    editClearImageBtn,
    editUseImageCheckbox,
    editImageInput,
  },
  holidayPresets: HOLIDAY_PRESETS,
  renderTasks,
  setStatsTasks,
  setHistoryTasks,
  toggleTaskExpandedCard,
  openEditModal,
  closeModal,
  saveModal,
  deleteTask,
  getSelectedEditColor,
  selectColor,
  saveTasks,
  getCleanTasks,
  startCountdown,
  pauseCountdown,
  stopCountdown,
  doTriggerFlight,
  updateHeroStatus,
});

const {
  renderTaskView,
  deleteTaskFn,
  saveModalHandler,
} = taskActions;

// --- Color picker ---
// extracted to ./ui/ColorPicker.js

// --- Stats ---
async function renderStatsPanel() {
  const stats = await computeFlightStats();
  await renderStats(async () => stats);
  const flightLog = await loadFlightLog();
  renderTaskHistory(stats, flightLog);
}

// --- Preview / Reset flight ---
// extracted to ./ui/FlightPreview.js

// --- Logo ---
// extracted to ./ui/Logo.js

// --- Emergency ---
// extracted to ./flight/Emergency.js

// --- Init ---
async function init() {
  initI18n();
  setConfirmI18n(t);

  // Register storage quota handler so the user gets a visible warning
  // when localStorage is full (mainly affects browser/preview mode;
  // Tauri uses file-based store and has no quota limit).
  setStorageQuotaHandler((key) => {
    showToast(t('toast.storage_quota', { key }));
  });

  // Register store failure handler so the user gets a visible warning
  // when Tauri store fails to initialize (data persistence breaks).
  setStoreFailureHandler((err) => {
    showToast(t('toast.store_failure'), 8000);
  });

  const saved = await loadTasks();
  const { tasks: hydrated, maxId } = hydrateTasks(saved);
  state.tasks = hydrated;
  setNextId(maxId);

  const cfg = await loadSettings();
  await applySettings({
    cfg,
    state,
    isTauriRuntime,
    invoke,
    refs: {
      MUTED_ICON,
      UNMUTED_ICON,
      muteBtn,
      settingsModal,
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
      soundMeta,
      soundNameEl,
      previewSoundBtn,
      todayCountEl,
      displaySelect,
      clearImageBtn,
      clearSoundBtn,
      customizeSoundBtn,
      soundCollapse,
      imagePreview,
      customizeImageBtn,
      imageCollapse,
      autostartToggle,
      quietHoursToggle,
      quietStartHour,
      quietEndHour,
      miniWindowToggle,
    },
    flightPresets: FLIGHT_PRESETS,
    defaultFlightSettings: DEFAULT_FLIGHT_SETTINGS,
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
    soundPresets: SOUND_PRESETS,
    playPresetSound,
    buildCustomAudioObjectUrl: () => {
      const url = buildCustomAudioObjectUrl();
      syncAudioObjectUrlTo(url);
      return url;
    },
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
  });

  await initCoreModules({
    state,
    refs: {
      MUTED_ICON,
      UNMUTED_ICON,
      taskListEl,
      modal,
      modalTitle,
      modalError,
      editLabel,
      editMsg,
      editGroup,
      alarmFields,
      countdownFields,
      holidayFields,
      anniversaryFields,
      editHour,
      editMinute,
      editMinutes,
      editSeconds,
      editHolidayHour,
      editHolidayMinute,
      holidayChecklist,
      editAnniMonth,
      editAnniDay,
      editAnniHour,
      editAnniMinute,
      editAnniLunar,
      editFlightMode,
      editLoopCount,
      editLoopInterval,
      editIntervalCount,
      loopTimesField,
      loopIntervalField,
      editPostFlightAction,
      editPostFlightAppPath,
      editPostFlightUrl,
      editPostFlightFolder,
      editPostFlightScript,
      postFlightAppField,
      postFlightUrlField,
      postFlightFolderField,
      postFlightScriptField,
      deleteTaskBtn,
      heroStatusEl,
      toastEl,
      muteBtn,
      emergencyBtn,
      settingsModal,
      speedSelect,
      heightSelect,
      displaySelect,
      effectSelect,
      planeSelect,
      planeSizeSelect,
      particleSelect,
      bubbleSelect,
      bubblePositionSelect,
      bubbleSizeSelect,
      bubbleBgColor,
      bubbleFontColor,
      imageBtn,
      imageInput,
      clearImageBtn,
      imagePreview,
      useImageCheckbox,
      customizeImageBtn,
      imageCollapse,
      editImageBtn,
      editImageInput,
      editClearImageBtn,
      editImagePreview,
      editUseImageCheckbox,
      soundSelect,
      soundModeSelect,
      soundBtn,
      soundInput,
      clearSoundBtn,
      useSoundCheckbox,
      customizeSoundBtn,
      soundCollapse,
      todayCountEl,
      quietHoursToggle,
      quietStartHour,
      quietEndHour,
      soundMeta,
      soundNameEl,
      previewSoundBtn,
      autostartToggle,
      editColorPicker,
    },
    runtime: { isTauriRuntime },
    taskActions: { renderTaskView, deleteTaskFn, saveModalHandler },
    deps: {
      AccurateTimer,
      HOLIDAY_PRESETS,
      DEFAULT_FLIGHT_SETTINGS,
      initToast,
      showToast,
      initFlightOrchestrator,
      setCustomImageData,
      setCustomAudioData,
      setToastFn,
      initCountdownTimer,
      initPomodoroTimer,
      updateCountdownTaskUI,
      initAlarmChecker,
      doTriggerFlight,
      updateNextUpcoming,
      updateMiniWindow,
      isInQuietHours,
      normalizeRepeat,
      isAlarmDueToday,
      initEmergency,
      WebviewWindow,
      initHeroSection,
      getNextUpcomingTask,
      initFlightPreview,
      queueFlight,
      createMiniWindow,
      initFlightListeners,
      triggerEmergencyLanding,
      initTauriListeners,
      listen,
      resetVideoWindowState,
      resetPfNotifyState,
      closePostFlightNotify,
      setEmergencyLandingActive,
      isEmergencyLandingActive,
      setSkipPostFlight,
      clearPendingPfCancel,
      releaseFlightQueue,
      stopLoopSoundLocal,
      stopLoopSound,
      clearAllSequences,
      clearFlightQueue,
      clearFlightStreak,
      pauseCountdown,
      stopCountdown,
      startCountdown,
      stopAllCountdowns,
      invoke,
      createCountdownTask,
      saveTasks,
      getCleanTasks,
      autoCheckForUpdate,
      getCurrentWebviewWindow,
      initMediaUpload,
      buildCustomAudioObjectUrl,
      syncAudioObjectUrlTo,
      updateSoundMeta,
      setCustomAudioObjectUrl,
      stopPreviewAudio,
      resetAudioPreview,
      revokeCustomAudioObjectUrl,
      unlockAudioIfNeeded,
      validateCustomAudioPreview,
      initWindowEvents,
      set,
      initTaskFilter,
      initSettingsPanel,
      setMuted,
      syncMuteToTray,
      persistSetting,
      syncThemeButtons,
      applyTheme,
      enableAutostart,
      disableAutostart,
      closeMiniWindow,
      positionMiniWindow,
      getMiniPositions,
      updateMiniPosGridActive,
      exportTasksAsJson,
      readBackupFromFile,
      hydrateTasks,
      setNextId,
      checkForUpdate,
      openFeedbackPage,
      openReleasePage,
      getCurrentVersion,
      previewCustomSound,
      previewFlight,
      resetFlightSettings,
      persistFlightSettings,
      initModalEvents,
      openNewModal,
      closeModal,
      openEditModal,
      selectColor,
      createAlarmTask,
      updateTitleLogo,
      onDateChange: () => {
        todayCountEl.textContent = t('hero.today_count_default');
      },
    },
  });

  await runPostInit({
    cfg,
    state,
    refs: { holidayChecklist, miniWindowToggle, editColorPicker, configPanel, configArrow },
    renderTaskView,
    startAlarmChecker,
    initHolidayChecklist,
    holidayPresets: HOLIDAY_PRESETS,
    initSystemThemeWatcher,
    createMiniWindow,
    applyTheme,
    syncThemeButtons,
    initNotificationPermission,
    initColorPickerModule,
    syncPresetButtons,
    renderStatsPanel,
  });

  setQuickCreateDeps({
    showToast,
    saveTasks,
    getCleanTasks,
    renderTaskView,
    state,
  });
  initQuickCreate();
  initTaskDetailDrawer({
    onEdit: taskActions.openEditModalFn,
    onCopy: (task) => copyTask(task, state.tasks, saveTasks, (tasks) => getCleanTasks(tasks), taskActions.renderTaskView),
  });
  initKeyboardShortcuts({
    openNewModal: () => openNewModal(),
    applyTheme,
    getCurrentTheme: () => get('theme') || 'light',
    focusSearch: () => {
      const searchInput = document.getElementById('taskSearchInput');
      if (searchInput) { searchInput.focus(); searchInput.select(); }
    },
    focusQuickCreate: () => {
      const quickInput = document.getElementById('quickCreateInput');
      if (quickInput) quickInput.focus();
    },
    previewFlight: () => previewFlight(),
    togglePomodoro: () => {
      if (isPomodoroActive()) {
        stopPomodoro();
      } else {
        startPomodoro(25);
      }
      updatePomodoroUI();
    },
    toggleMiniWindow: () => {
      const miniToggle = document.getElementById('miniWindowToggle');
      if (miniToggle) miniToggle.click();
    },
    toggleStats: () => {
      const statsModal = document.getElementById('statsModal');
      if (statsModal) statsModal.classList.toggle('hidden');
    },
    triggerEmergency: () => triggerEmergencyLanding(),
    setTaskTypeFilter: (type) => {
      const typeSelect = document.getElementById('taskTypeSelect');
      if (typeSelect) {
        typeSelect.value = type;
        typeSelect.dispatchEvent(new Event('change'));
      }
    },
  });
  initBatchOperation({
    tasksRef: { get: () => state.tasks, set: (tasks) => { state.tasks = tasks; } },
    saveTasks,
    getCleanTasks,
    renderTaskView,
    showConfirm,
    showToast,
  });

  const batchSelectBtn = document.getElementById('batchSelectBtn');
  batchSelectBtn?.addEventListener('click', () => toggleSelectionMode());

  const compactModeBtn = document.getElementById('compactModeBtn');
  function syncCompactBtn() {
    if (!compactModeBtn) return;
    compactModeBtn.classList.toggle('is-active', isCompactMode());
  }
  compactModeBtn?.addEventListener('click', () => {
    setCompactMode(!isCompactMode());
    syncCompactBtn();
    renderTaskView();
  });
  syncCompactBtn();

  initOnboarding({
    onComplete: () => {},
    applyTheme,
    openNewModal: () => openNewModal(),
    previewFlight: () => previewFlight(),
    persistSetting,
  });

  setTimeout(() => {
    checkAndShowOnboarding();
  }, 500);

  const pomodoroStartBtn = document.getElementById('pomodoroStartBtn');
  const pomodoroBar = document.getElementById('pomodoroBar');
  const pomodoroPhaseEl = document.getElementById('pomodoroPhase');
  const pomodoroTimerEl = document.getElementById('pomodoroTimer');
  const pomodoroRoundEl = document.getElementById('pomodoroRound');
  const pomodoroPauseBtn = document.getElementById('pomodoroPauseBtn');
  const pomodoroSkipBtn = document.getElementById('pomodoroSkipBtn');
  const pomodoroStopBtn = document.getElementById('pomodoroStopBtn');

  function updatePomodoroUI() {
    const pState = getPomodoroState();
    if (!pState.active) {
      pomodoroBar?.classList.add('hidden');
      return;
    }
    pomodoroBar?.classList.remove('hidden');
    if (pomodoroPhaseEl) pomodoroPhaseEl.textContent = pState.phase === 'work' ? (pState.round > 0 ? t('pomodoro.focus_round', { round: pState.round }) : t('pomodoro.focusing')) : pState.phase === 'shortBreak' ? t('pomodoro.short_rest') : t('pomodoro.long_rest');
    const mins = Math.floor(pState.remaining / 60);
    const secs = pState.remaining % 60;
    if (pomodoroTimerEl) pomodoroTimerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (pomodoroRoundEl) pomodoroRoundEl.textContent = t('pomodoro.round', { round: pState.round, total: pState.totalRounds });
    if (pomodoroPauseBtn) {
      pomodoroPauseBtn.innerHTML = pState.task?._status === 'paused'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
  }

  setPomodoroTickCallback(updatePomodoroUI);

  pomodoroStartBtn?.addEventListener('click', () => {
    if (isPomodoroActive()) return;
    startPomodoro(25);
    updatePomodoroUI();
  });

  pomodoroPauseBtn?.addEventListener('click', () => {
    const pState = getPomodoroState();
    if (pState.task?._status === 'paused') {
      resumePomodoro();
    } else {
      pausePomodoro();
    }
    updatePomodoroUI();
  });

  pomodoroSkipBtn?.addEventListener('click', () => {
    skipPomodoroPhase();
    updatePomodoroUI();
  });

  pomodoroStopBtn?.addEventListener('click', () => {
    stopPomodoro();
    updatePomodoroUI();
  });

  setUpdateTaskFlightCb((taskId, remaining) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task._flightRemaining = remaining;
      renderTaskView();
    }
  });

  // Wire quiet-hours check to FlightOrchestrator so post-flight
  // actions (video, effect, app, url, etc.) respect the same setting
  // as the initial flight trigger.
  setIsInQuietHoursFn(() => isInQuietHours(quietHoursToggle, quietStartHour, quietEndHour));

  setPfActionHandler(async (action, { minutes, task }) => {
    if (!task) return;
    if (action === 'snooze') {
      const snoozeTask = createCountdownTask();
      snoozeTask.label = `${task.label}${t('task.snooze_suffix', { minutes })}`;
      snoozeTask.msg = task.msg || '';
      snoozeTask.duration = minutes * 60;
      snoozeTask._remaining = minutes * 60;
      state.tasks.push(snoozeTask);
      saveTasks(getCleanTasks(state.tasks));
      renderTaskView();
      startCountdown(snoozeTask);
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      showToast(t('toast.snoozed', { minutes, label: task.label }));
    } else if (action === 'skip') {
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      showToast(t('toast.skipped', { label: task.label }));
    } else if (action === 'repeat') {
      setSkipPostFlight(true);
      invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
      if (task.type === 'countdown') {
        const repeatTask = createCountdownTask();
        repeatTask.label = `${task.label}${t('task.repeat_suffix')}`;
        repeatTask.msg = task.msg || '';
        repeatTask.duration = task.duration;
        repeatTask._remaining = task.duration;
        state.tasks.push(repeatTask);
        saveTasks(getCleanTasks(state.tasks));
        renderTaskView();
        startCountdown(repeatTask);
        showToast(t('toast.repeated', { label: repeatTask.label }));
      } else {
        triggerFlightWithMode(task, null, recordFlightTrigger, null, null);
      }
    }
  });

  listen('deep-link', (event) => {
    void handleDeepLink({
      rawUrl: event.payload,
      isTauriRuntime,
      state,
      parseDeepLinkUrl,
      closeModal,
      modal,
      modalError,
      closeSettingsModal,
      buildTaskFromDeepLink,
      deepLinkTaskContext: {
        createAlarmTask,
        createCountdownTask,
        createHolidayTask,
        createAnniversaryTask,
        HOLIDAY_PRESETS,
        formatHolidayLabel,
      },
      saveTasks,
      getCleanTasks,
      renderTaskView,
      showToast,
    });
  }).catch(e => console.error('deep-link listen failed:', e));
}

setUpdateStatusEl(updateStatus);
init();

onLanguageChange(() => {
  try { renderTaskView(); } catch (e) { console.error('lang renderTaskView error:', e); }
  try { renderStatsPanel(); } catch (e) { console.error('lang renderStatsPanel error:', e); }
  try { updateHeroStatus(); } catch (e) { console.error('lang updateHeroStatus error:', e); }
  try { refreshDrawer(); } catch (e) { console.error('lang refreshDrawer error:', e); }
  try { initHolidayChecklist(holidayChecklist, HOLIDAY_PRESETS); } catch (e) { console.error('lang initHolidayChecklist error:', e); }
  requestAnimationFrame(() => translateDOM());
});
