import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, resetStreak, recordFlightTrigger, computeFlightStats, loadFlightLog } from './storage.js';
import { getRandomQuote } from './quotes.js';
import { SOUND_PRESETS, playPreset as playPresetSound } from './sounds.js';
import { exportTasksAsJson, readBackupFromFile } from './backup.js';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { showConfirm } from './utils.js';
window.showConfirm = showConfirm;

import { HOLIDAY_PRESETS } from './tasks/HolidayPresets.js';
import { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask, setNextId } from './tasks/TaskFactory.js';
import { getDateKey, dayDiff, getCleanTasks, hydrateTasks, formatHolidayLabel, isAlarmDueToday, normalizeRepeat } from './tasks/TaskUtils.js';
import { DEFAULT_FLIGHT_SETTINGS, FLIGHT_PRESETS } from './flight/FlightPresets.js';
import { initFlightOrchestrator, queueFlight, clearFlightQueue, clearAllSequences, stopLoopSound, stopPreviewAudio, validateCustomAudioPreview, setCustomImageData, setCustomAudioData, setCustomAudioObjectUrl, setMuted, triggerFlightWithMode, initFlightListeners, setToastFn, buildCustomAudioObjectUrl, setUpdateTaskFlightCb } from './flight/FlightOrchestrator.js';
import { renderTasks, updateCountdownTaskUI, toggleTaskExpandedCard } from './ui/TaskRenderer.js';
import { initCountdownTimer, startCountdown, pauseCountdown, stopCountdown, stopAllCountdowns } from './tasks/CountdownTimer.js';
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
import { detectTauriRuntime } from './app/runtime.js';
import { getMainDomRefs } from './app/domRefs.js';
import { createAppState } from './app/state.js';
import { createTaskActions } from './app/taskActions.js';
import { applySettings, runPostInit } from './app/bootstrap.js';
import { handleDeepLink } from './app/deepLinkActions.js';
import { initCoreModules } from './app/initModules.js';

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
  postFlightVideoEnableField,
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
    postFlightVideoEnableField,
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

  setUpdateTaskFlightCb((taskId, remaining) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task._flightRemaining = remaining;
      renderTaskView();
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
