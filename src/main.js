import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, resetStreak, recordFlightTrigger, computeFlightStats, setStorageQuotaHandler, setStoreFailureHandler } from './storage.js';
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
import { renderTasks, updateCountdownTaskUI, toggleTaskExpandedCard, copyTask } from './ui/TaskRenderer.js';
import { initCountdownTimer, startCountdown, pauseCountdown, stopCountdown, stopAllCountdowns } from './tasks/CountdownTimer.js';
import { initPomodoroTimer, startPomodoro, pausePomodoro, resumePomodoro, stopPomodoro, skipPomodoroPhase, getPomodoroState, isPomodoroActive, setPomodoroTickCallback, setPomodoroBreakStartCallback } from './tasks/PomodoroTimer.js';
import { initAlarmChecker, getNextUpcomingTask, getAllUpcomingTasks, startAlarmChecker } from './tasks/AlarmChecker.js';
import { openEditModal, openNewModal, closeModal, saveModal, deleteTask, initHolidayChecklist } from './ui/ModalController.js';
import { setStatsTasks } from './ui/StatsPanel.js';
import { setHistoryTasks } from './ui/HistoryPanel.js';
import { initAudioSystem, revokeCustomAudioObjectUrl, stopLoopSoundLocal, updateSoundMeta, previewCustomSound, resetAudioPreview, syncAudioObjectUrlTo } from './ui/AudioSystem.js';
import { initHeroTerminal, updateHeroTask, startFlipClock, stopFlipClock } from './ui/HeroTerminal.js';
import { initFlightBoard, renderFlightBoard } from './ui/FlightBoard.js';
import { setFlightBoardRenderer } from './app/taskActions.js';
import { snoozeTask } from './flight/Snooze.js';
import { initCommandPalette, openPalette, closePalette } from './ui/CommandPalette.js';
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
import { initTaskDetailDrawer, refreshDrawer, openTaskDetailDrawer } from './ui/TaskDetailDrawer.js';
import { initKeyboardShortcuts } from './ui/KeyboardShortcuts.js';
import { initBatchOperation } from './ui/BatchOperation.js';
import { initOnboarding, checkAndShowOnboarding } from './ui/Onboarding.js';
import { initPomodoroUI } from './ui/PomodoroUI.js';
import { initPostFlightHandler } from './app/postFlightHandler.js';
import { initLanguageHandler } from './app/languageHandler.js';
import { renderStatsPanel } from './app/statsPanel.js';
import { initTaskToolbar } from './ui/TaskToolbar.js';
import { detectTauriRuntime } from './app/runtime.js';
import { getMainDomRefs } from './app/domRefs.js';
import { createAppState } from './app/state.js';
import { createTaskActions } from './app/taskActions.js';
import { applySettings, runPostInit } from './app/bootstrap.js';
import { handleDeepLink } from './app/deepLinkActions.js';
import { initCoreModules } from './app/initModules.js';
import { initSmartPause, setSmartPauseEnabled, getPostponedFlights, clearPostponedFlights } from './smart-pause/SmartPause.js';
import { initNaturalBreak, setNaturalBreakEnabled, setIdleThreshold } from './smart-pause/NaturalBreak.js';
import { t, initI18n, setLanguage } from './i18n/index.js';

function buildDemoTasks() {
  return [
    { id: 1, type: 'alarm', label: '晨会', msg: '准时上线哦', hour: 9, minute: 0, enabled: true, repeat: { type: 'weekly', days: [1,2,3,4,5] }, _status: 'idle', color: 0 },
    { id: 2, type: 'alarm', label: '喝水', msg: '记得补水', hour: 15, minute: 0, enabled: true, repeat: { type: 'weekly', days: [1,2,3,4,5] }, _status: 'idle', color: 3 },
    { id: 3, type: 'countdown', label: '番茄钟', duration: 1500, _remaining: 1500, enabled: true, _status: 'idle', color: 5 },
    { id: 4, type: 'alarm', label: '站会', msg: '每日站会', hour: 10, minute: 30, enabled: true, repeat: { type: 'weekly', days: [1,2,3,4,5] }, _status: 'idle', color: 1 },
    { id: 5, type: 'holiday', label: '国庆节', month: 10, day: 1, hour: 9, minute: 0, enabled: true, _status: 'idle', color: 2 },
    { id: 6, type: 'anniversary', label: '结婚纪念日', msg: '我们的日子', month: 8, day: 15, hour: 10, minute: 0, enabled: true, _status: 'idle', color: 6 },
    { id: 7, type: 'alarm', label: '健身房', msg: '该动一动了', hour: 18, minute: 30, enabled: false, repeat: { type: 'weekly', days: [1,3,5] }, _status: 'idle', color: 4 },
    { id: 8, type: 'alarm', label: '下班', msg: '收工！', hour: 18, minute: 0, enabled: true, repeat: { type: 'weekly', days: [1,2,3,4,5] }, _status: 'idle', color: 7 },
  ];
}

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

  // Demo mode: inject sample tasks when ?demo=1 is in URL and storage is empty
  const urlParams = new URLSearchParams(window.location.search);
  const demoMode = urlParams.get('demo') === '1';
  if (demoMode) {
    // Skip onboarding flow and force dark theme for the demo screenshot
    localStorage.setItem('onboarding_completed', 'true');
    await set('theme', 'dark');
  }
  let saved = await loadTasks();
  if (demoMode && (!saved || saved.length === 0)) {
    saved = buildDemoTasks();
    await set('_tasks', saved);
  }
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

  // Register flight board renderer AFTER runPostInit (which triggers the
  // first renderTaskView) so the board can take over subsequent renders.
  // The first render only paints old task cards; data mutations and the
  // initial render call later will paint the flight board.
  function refreshBoard() {
    const boardEl = document.querySelector('.task-list');
    if (!boardEl) return;
    const filterState = state.getTaskFilterState ? state.getTaskFilterState() : {};
    const upcomingList = getAllUpcomingTasks();
    renderFlightBoard(state.tasks, boardEl, {
      upcomingList,
      filterKeyword: filterState.taskSearchKeyword || '',
      filterType: filterState.taskTypeFilter || 'all',
      filterGroup: filterState.taskGroupFilter || 'all',
      boardMode: true,
    });
  }
  setFlightBoardRenderer(() => { refreshBoard(); });
  // Re-render board immediately to replace the placeholder cards
  refreshBoard();

  async function refreshFooter() {
    const weekEl = document.getElementById('statWeekFlights');
    const streakEl = document.getElementById('statStreak');
    const barsEl = document.getElementById('statWeekBars');
    if (!weekEl && !streakEl) return;

    try {
      const stats = await computeFlightStats();
      // Compute real Mon-Sun week total (not last7Total which shifts daily)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now); monday.setDate(now.getDate() + mondayOffset); monday.setHours(0,0,0,0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

      let weekTotal = 0;
      const dailyCounts = Array(7).fill(0);
      for (const d of (stats.daily || [])) {
        const dayDate = new Date(d.date);
        if (dayDate >= monday && dayDate <= sunday) {
          weekTotal += d.totalCount;
          const idx = dayDate.getDay(); // 0=Sun, 1=Mon...6=Sat
          dailyCounts[idx === 0 ? 6 : idx - 1] = d.totalCount;
        }
      }
      if (weekEl) weekEl.textContent = String(weekTotal);

      // Mini bar chart
      if (barsEl) {
        const maxCount = Math.max(1, ...dailyCounts);
        barsEl.innerHTML = dailyCounts.map(c =>
          `<i style="height:${Math.max(3, Math.round((c/maxCount)*18))}px;${c===0?'opacity:.3':''}"></i>`
        ).join('');
      }
    } catch { /* stats load optional */ }
    try {
      const streak = await get('streak');
      if (streakEl) streakEl.textContent = String(streak || 0);
    } catch { /* streak load optional */ }
  }
  refreshFooter();
  // Periodic refresh keeps footer in sync with background flights
  setInterval(() => { refreshFooter(); }, 30000);

  // Row popup menu (⋮ → 编辑 / 复制 / 启用·停用 / 删除)
  let rowMenuTask = null;
  function showRowMenu(task, anchorEl) {
    const menu = document.getElementById('rowMenu');
    if (!menu) return;
    rowMenuTask = task;
    menu.hidden = false;
    const r = anchorEl.getBoundingClientRect();
    const menuW = 168;
    let left = r.right - menuW;
    let top = r.bottom + 6;
    if (left < 8) left = r.left;
    if (top + 180 > window.innerHeight) top = r.top - 180;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    // Toggle button reflects current state
    const toggleBtn = menu.querySelector('[data-action="toggle"] span:last-child');
    if (toggleBtn) {
      toggleBtn.textContent = task.enabled !== false ? t('flight.menu.toggle_off') : t('flight.menu.toggle_on');
    }
  }
  function hideRowMenu() {
    const menu = document.getElementById('rowMenu');
    if (menu) menu.hidden = true;
    rowMenuTask = null;
  }
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('rowMenu');
    if (menu && !menu.hidden && !menu.contains(e.target)) hideRowMenu();
  });
  document.getElementById('rowMenu')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !rowMenuTask) return;
    const task = rowMenuTask;
    hideRowMenu();
    const action = btn.dataset.action;
    if (action === 'edit') {
      openEditModal(task, task.id, selectColor, {
        tasks: state.tasks, saveTasks, getCleanTasks: (v) => getCleanTasks(v),
        renderTaskView, modal, modalError, editLabel, editMsg, editGroup,
        editHour, editMinute, editMinutes, editSeconds, editHolidayHour, editHolidayMinute,
        editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
        editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
        editPostFlightAction, editPostFlightAppPath, editPostFlightUrl, editPostFlightFolder,
        editPostFlightScript, editPostFlightVideoSelect, editPostFlightVideoPath,
        holidayChecklist: document.getElementById('holidayChecklist'),
        HOLIDAY_PRESETS, editUseImageCheckbox: document.getElementById('editUseImageCheckbox'),
        editImageData: state.editImageData, stopCountdownFn: stopCountdown,
      });
    } else if (action === 'copy') {
      copyTask(task, state.tasks, saveTasks, (tasks) => getCleanTasks(tasks), renderTaskView);
    } else if (action === 'toggle') {
      task.enabled = !task.enabled;
      saveTasks(getCleanTasks(state.tasks));
      refreshBoard();
    } else if (action === 'delete') {
      window.showConfirm(t('modal.delete_confirm', { name: task.label || task.msg || t('common.unnamed_task') })).then(ok => {
        if (!ok) return;
        const idx = state.tasks.findIndex(t => t.id === task.id);
        if (idx >= 0) {
          state.tasks.splice(idx, 1);
          saveTasks(getCleanTasks(state.tasks));
          refreshBoard();
        }
      }).catch(() => {});
    }
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

  initTaskToolbar({ renderTaskView });

  // Hide batch/compact buttons in flight board mode (not yet supported on board)
  document.getElementById('batchSelectBtn')?.classList.add('hidden');
  document.getElementById('compactModeBtn')?.classList.add('hidden');

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

  const { updatePomodoroUI } = initPomodoroUI({
    getPomodoroState, startPomodoro, pausePomodoro, resumePomodoro,
    stopPomodoro, skipPomodoroPhase, setPomodoroTickCallback, isPomodoroActive,
  });

  setPomodoroBreakStartCallback(() => {
    const postponed = getPostponedFlights();
    if (postponed.length > 0) {
      const pomodoroPostponed = postponed.filter(f => f.reason === 'pomodoro_focus');
      if (pomodoroPostponed.length > 0) {
        showToast(t('pomodoro.focus_resume', { count: pomodoroPostponed.length }));
        for (const f of pomodoroPostponed) {
          if (f.task) doTriggerFlight(f.task);
        }
      }
      clearPostponedFlights();
    }
  });

  setUpdateTaskFlightCb((taskId, remaining) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task._flightRemaining = remaining;
      renderTaskView();
    }
  });

  initHeroTerminal({});
  startFlipClock();

  function refreshHero() {
    getNextUpcomingTask().then(upcoming => {
      if (upcoming && upcoming.task) {
        const task = upcoming.task;
        const d = new Date(Date.now() + upcoming.seconds * 1000);
        const departTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        updateHeroTask({
          seconds: upcoming.seconds,
          flightNo: `GG${String(task.id).slice(-4).padStart(4, '0')}`,
          label: task.label || t('common.unnamed'),
          msg: task.msg ? `「 ${task.msg} 」` : '',
          departInfo: `${t('flight.expected')} <b>${departTime}</b> · ${t('flight.runway_n', { n: (task.id % 4) + 1 })}`,
        });
      } else {
        updateHeroTask(null);
      }
    }).catch(() => updateHeroTask(null));
  }
  refreshHero();
  setInterval(refreshHero, 5000);

  initFlightBoard({
    onFlightAction: (action, task, buttonEl) => {
      if (action === 'fly') {
        doTriggerFlight(task);
      } else if (action === 'restore') {
        task.enabled = true;
        saveTasks(getCleanTasks(state.tasks));
        refreshBoard();
        showToast(t('flight.restored', { label: task.label || t('common.unnamed') }));
      } else if (action === 'toggle') {
        task.enabled = !task.enabled;
        saveTasks(getCleanTasks(state.tasks));
        refreshBoard();
      } else if (action === 'menu') {
        showRowMenu(task, buttonEl);
      } else if (action === 'postpone') {
        if (task.type === 'countdown') {
          if (task._status === 'running') {
            pauseCountdown(task);
            showToast(t('countdown.paused'));
          } else {
            startCountdown(task);
            showToast(t('countdown.started'));
          }
        } else {
          snoozeTask(task.id, 10);
          showToast(t('smart_pause.snoozed', { label: task.label || t('common.unnamed'), min: 10 }));
        }
        refreshBoard();
      } else if (action === 'edit') {
        openEditModal(task, task.id, selectColor, {
          tasks: state.tasks, saveTasks, getCleanTasks: (v) => getCleanTasks(v),
          renderTaskView, modal, modalError, editLabel, editMsg, editGroup,
          editHour, editMinute, editMinutes, editSeconds, editHolidayHour, editHolidayMinute,
          editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
          editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
          editPostFlightAction, editPostFlightAppPath, editPostFlightUrl, editPostFlightFolder,
          editPostFlightScript, editPostFlightVideoSelect, editPostFlightVideoPath,
          holidayChecklist: document.getElementById('holidayChecklist'),
          HOLIDAY_PRESETS, editUseImageCheckbox: document.getElementById('editUseImageCheckbox'),
          editImageData: state.editImageData, stopCountdownFn: stopCountdown,
        });
      }
    },
  });

  initCommandPalette({
    onExecute: (action) => {
      if (action === 'new') {
        openNewModal();
      } else if (action === 'fly') {
        getNextUpcomingTask().then(upcoming => {
          if (upcoming && upcoming.task) doTriggerFlight(upcoming.task);
        }).catch(() => {});
      } else if (action === 'pomodoro') {
        if (!isPomodoroActive()) startPomodoro(25);
      } else if (action === 'quiet') {
        setMuted(!state.isMuted);
      } else if (action === 'skin') {
        document.getElementById('configToggle')?.click();
      } else if (action === 'settings') {
        document.getElementById('settingsBtn')?.click();
      } else if (action === 'emergency') {
        triggerEmergencyLanding();
      } else if (action === 'stats') {
        const statsModal = document.getElementById('statsModal');
        if (statsModal) statsModal.classList.remove('hidden');
      }
    },
  });

  document.getElementById('searchTrigger')?.addEventListener('click', () => openPalette());

  document.getElementById('focusModeBtn')?.addEventListener('click', () => {
    if (!isPomodoroActive()) startPomodoro(25);
  });

  const searchTrigger = document.getElementById('searchTrigger');

  // Wire quiet-hours check to FlightOrchestrator so post-flight
  // actions (video, effect, app, url, etc.) respect the same setting
  // as the initial flight trigger.
  setIsInQuietHoursFn(() => isInQuietHours(quietHoursToggle, quietStartHour, quietEndHour));

  const pauseBannerEl = document.getElementById('pauseBanner');
  const pauseBannerMsg = document.getElementById('pauseBannerMsg');
  const pauseBannerResumeBtn = document.getElementById('pauseBannerResume');

  function showPauseBanner(reason, count) {
    if (!pauseBannerEl || !pauseBannerMsg) return;
    const reasonMap = {
      dnd: t('smart_pause.reason_dnd'),
      meeting: t('smart_pause.reason_meeting'),
      fullscreen: t('smart_pause.reason_fullscreen'),
      recording: t('smart_pause.reason_recording'),
    };
    const reasonText = reasonMap[reason] || reason || t('smart_pause.reason_default');
    pauseBannerMsg.textContent = t('smart_pause.banner_msg', { count, reason: reasonText });
    pauseBannerEl.classList.add('show');
    if (pauseBannerResumeBtn) pauseBannerResumeBtn.textContent = t('smart_pause.resume_now');
  }

  function hidePauseBanner() {
    if (pauseBannerEl) pauseBannerEl.classList.remove('show');
  }

  if (pauseBannerResumeBtn) {
    pauseBannerResumeBtn.addEventListener('click', () => {
      const flights = getPostponedFlights();
      if (flights.length > 0) {
        for (const f of flights) {
          if (f.task) doTriggerFlight(f.task);
        }
        clearPostponedFlights();
        showToast(t('smart_pause.resolved', { count: flights.length }));
      }
      hidePauseBanner();
    });
  }

  initSmartPause({
    showToast,
    onContextChange: (ctx) => {
      const reasonMap = {
        dnd: t('smart_pause.reason_dnd'),
        meeting: t('smart_pause.reason_meeting'),
        fullscreen: t('smart_pause.reason_fullscreen'),
        recording: t('smart_pause.reason_recording'),
      };
      const isPaused = ctx.dnd || ctx.in_meeting || ctx.fullscreen || ctx.screen_recording;
      if (isPaused) {
        const reason = Object.entries(ctx).find(([, v]) => v)?.[0];
        const postponed = getPostponedFlights();
        if (postponed.length > 0) {
          showToast(t('smart_pause.postponed', { count: postponed.length, reason: reasonMap[reason] || reason }));
          showPauseBanner(reason, postponed.length);
        }
      } else {
        hidePauseBanner();
      }
    },
    onPostponeResolved: (flights) => {
      hidePauseBanner();
      if (flights.length > 0) {
        showToast(t('smart_pause.resolved', { count: flights.length }));
        for (const f of flights) {
          if (f.task) {
            doTriggerFlight(f.task);
          }
        }
        clearPostponedFlights();
      }
    },
  });

  if (cfg.smartPauseEnabled) {
    setSmartPauseEnabled(true);
  }

  initNaturalBreak({
    showToast,
  });

  if (cfg.naturalBreakEnabled) {
    setNaturalBreakEnabled(true);
    if (cfg.naturalBreakThreshold) {
      setIdleThreshold(cfg.naturalBreakThreshold);
    }
  }

  setPfActionHandler(initPostFlightHandler({
    state, saveTasks, renderTaskView, startCountdown, showToast,
    triggerFlightWithMode, recordFlightTrigger, setSkipPostFlight, t,
  }));

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

initLanguageHandler({
  renderTaskView, renderStatsPanel, updateHeroStatus,
  refreshDrawer, initHolidayChecklist, holidayChecklist,
});
