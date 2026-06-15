import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, resetStreak, recordFlightTrigger, computeFlightStats, loadFlightLog } from './storage.js';
import { getRandomQuote } from './quotes.js';
import { SOUND_PRESETS, playPreset as playPresetSound } from './sounds.js';
import { exportTasksAsJson, readBackupFromFile } from './backup.js';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import { HOLIDAY_PRESETS } from './tasks/HolidayPresets.js';
import { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask, setNextId } from './tasks/TaskFactory.js';
import { getDateKey, dayDiff, getCleanTasks, hydrateTasks, formatHolidayLabel, isAlarmDueToday, normalizeRepeat } from './tasks/TaskUtils.js';
import { DEFAULT_FLIGHT_SETTINGS, FLIGHT_PRESETS } from './flight/FlightPresets.js';
import { initFlightOrchestrator, queueFlight, clearFlightQueue, clearAllSequences, stopPreviewAudio, validateCustomAudioPreview, setCustomImageData, setCustomAudioData, setCustomAudioObjectUrl, setMuted, triggerFlightWithMode, initFlightListeners, setToastFn, buildCustomAudioObjectUrl } from './flight/FlightOrchestrator.js';
import { renderTasks, updateCountdownTaskUI } from './ui/TaskRenderer.js';
import { initCountdownTimer, startCountdown, pauseCountdown, stopCountdown, stopAllCountdowns } from './tasks/CountdownTimer.js';
import { initAlarmChecker, getNextUpcomingTask, startAlarmChecker } from './tasks/AlarmChecker.js';
import { openEditModal, openNewModal, closeModal, saveModal, deleteTask, validateUpload, initHolidayChecklist } from './ui/ModalController.js';
import { renderStats, setStatsTasks } from './ui/StatsPanel.js';
import { renderTaskHistory, setHistoryTasks } from './ui/HistoryPanel.js';
import { initAudioSystem, unlockAudioIfNeeded, revokeCustomAudioObjectUrl, stopLoopSoundLocal, updateSoundMeta, previewCustomSound, resetAudioPreview, syncAudioObjectUrlTo } from './ui/AudioSystem.js';
import { createMiniWindow, closeMiniWindow, positionMiniWindow, updateMiniWindow, updateMiniPosGridActive, getMiniPositions } from './ui/MiniWindow.js';
import { applyTheme, initSystemThemeWatcher } from './settings/ThemeManager.js';
import { loadSettings, persistSetting, persistFlightSettings, isInQuietHours } from './settings/SettingsManager.js';
import { getCurrentVersion, autoCheckForUpdate, checkForUpdate, openReleasePage, openFeedbackPage, setUpdateStatusEl } from './settings/UpdateManager.js';
import { initNotificationPermission, notifyFlightTriggered } from './ui/NotificationManager.js';
import { parseDeepLinkUrl, buildTaskFromDeepLink } from './flight/DeepLink.js';
import { initEmergency, triggerEmergencyLanding } from './flight/Emergency.js';
import { initFlightSync, syncEffectPicker, syncPresetButtons, applyPreset } from './settings/FlightSync.js';
import { initColorPicker as initColorPickerModule, getSelectedEditColor, selectColor } from './ui/ColorPicker.js';
import { initHeroSection, updateHeroStatus, updateNextUpcoming } from './ui/HeroSection.js';
import { initFlightTrigger, registerFlightTrigger, clearFlightStreak, doTriggerFlight } from './flight/FlightTrigger.js';
import { initFlightPreview, previewFlight, resetFlightSettings } from './ui/FlightPreview.js';
import { initLogo, updateTitleLogo, syncMuteToTray, closeSettingsModal } from './ui/Logo.js';
import { initTauriListeners } from './flight/TauriListeners.js';
import { initToast, showToast } from './ui/Toast.js';
import { initMediaUpload } from './ui/MediaUpload.js';
import { initTaskFilter } from './ui/TaskFilter.js';
import { initSettingsPanel } from './ui/SettingsPanel.js';
import { initModalEvents } from './ui/ModalEvents.js';
import { initWindowEvents } from './ui/WindowEvents.js';

const isTauriRuntime = (() => {
  try {
    getCurrentWebviewWindow();
    return true;
  } catch (e) {
    return false;
  }
})();

// --- DOM refs ---
const taskListEl = document.getElementById('taskList');
const statsTotalEl = document.getElementById('statsTotal');
const statsWeekEl = document.getElementById('statsWeek');
const statsTrendEl = document.getElementById('statsTrend');
const statsTopTaskEl = document.getElementById('statsTopTask');
const statsTopCountEl = document.getElementById('statsTopCount');
const statsBarsEl = document.getElementById('statsBars');
const statsRangeEl = document.getElementById('statsRange');
const statsTypesEl = document.getElementById('statsTypes');
const statsTotalSubEl = document.getElementById('statsTotalSub');
const addTaskBtn = document.getElementById('addTaskBtn');
const templateBtn = document.getElementById('templateBtn');
const templateMenu = document.getElementById('templateMenu');
const modal = document.getElementById('taskModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalError = document.getElementById('modalError');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const editLabel = document.getElementById('editLabel');
const editMsg = document.getElementById('editMsg');
const editGroup = document.getElementById('editGroup');
const alarmFields = document.getElementById('alarmFields');
const countdownFields = document.getElementById('countdownFields');
const holidayFields = document.getElementById('holidayFields');
const anniversaryFields = document.getElementById('anniversaryFields');
const editHour = document.getElementById('editHour');
const editMinute = document.getElementById('editMinute');
const editMinutes = document.getElementById('editMinutes');
const editSeconds = document.getElementById('editSeconds');
const editHolidayHour = document.getElementById('editHolidayHour');
const editHolidayMinute = document.getElementById('editHolidayMinute');
const holidayChecklist = document.getElementById('holidayChecklist');
const editAnniMonth = document.getElementById('editAnniMonth');
const editAnniDay = document.getElementById('editAnniDay');
const editAnniHour = document.getElementById('editAnniHour');
const editAnniMinute = document.getElementById('editAnniMinute');
const editFlightMode = document.getElementById('editFlightMode');
const editLoopCount = document.getElementById('editLoopCount');
const editLoopInterval = document.getElementById('editLoopInterval');
const editIntervalCount = document.getElementById('editIntervalCount');
const loopTimesField = document.getElementById('loopTimesField');
const loopIntervalField = document.getElementById('loopIntervalField');
const editPostFlightAction = document.getElementById('editPostFlightAction');
const editPostFlightAppPath = document.getElementById('editPostFlightAppPath');
const editPostFlightUrl = document.getElementById('editPostFlightUrl');
const editPostFlightFolder = document.getElementById('editPostFlightFolder');
const editPostFlightScript = document.getElementById('editPostFlightScript');
const postFlightAppField = document.getElementById('postFlightAppField');
const postFlightUrlField = document.getElementById('postFlightUrlField');
const postFlightFolderField = document.getElementById('postFlightFolderField');
const postFlightScriptField = document.getElementById('postFlightScriptField');
const selectAppBtn = document.getElementById('selectAppBtn');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const todayCountEl = document.getElementById('todayCount');
const heroStatusEl = document.getElementById('heroStatus');
const toastEl = document.getElementById('toast');
const muteBtn = document.getElementById('muteBtn');
const emergencyBtn = document.getElementById('emergencyBtn');
const settingsModal = document.getElementById('settingsModal');
const autostartToggle = document.getElementById('autostartToggle');
const quietHoursToggle = document.getElementById('quietHoursToggle');
const quietStartHour = document.getElementById('quietStartHour');
const quietEndHour = document.getElementById('quietEndHour');
const miniWindowToggle = document.getElementById('miniWindowToggle');
const updateStatus = document.getElementById('updateStatus');
const displaySelect = document.getElementById('displaySelect');
const configPanel = document.getElementById('configPanel');
const effectSelect = document.getElementById('effectSelect');
const configArrow = document.getElementById('configArrow');
const planeSelect = document.getElementById('planeSelect');
const particleSelect = document.getElementById('particleSelect');
const bubbleSelect = document.getElementById('bubbleSelect');
const bubblePositionSelect = document.getElementById('bubblePositionSelect');
const imageBtn = document.getElementById('imageBtn');
const imageInput = document.getElementById('imageInput');
const clearImageBtn = document.getElementById('clearImageBtn');
const imagePreview = document.getElementById('imagePreview');
const useImageCheckbox = document.getElementById('useImageCheckbox');
const editImageBtn = document.getElementById('editImageBtn');
const editImageInput = document.getElementById('editImageInput');
const editClearImageBtn = document.getElementById('editClearImageBtn');
const editImagePreview = document.getElementById('editImagePreview');
const editUseImageCheckbox = document.getElementById('editUseImageCheckbox');
const editColorPicker = document.getElementById('editColorPicker');
const soundSelect = document.getElementById('soundSelect');
const soundModeSelect = document.getElementById('soundModeSelect');
const soundBtn = document.getElementById('soundBtn');
const soundInput = document.getElementById('soundInput');
const clearSoundBtn = document.getElementById('clearSoundBtn');
const useSoundCheckbox = document.getElementById('useSoundCheckbox');
const soundMeta = document.getElementById('soundMeta');
const soundNameEl = document.getElementById('soundName');
const previewSoundBtn = document.getElementById('previewSoundBtn');

// --- State ---
let tasks = [];
let editingId = null;
let expandedTaskId = null;
let isMuted = false;
let isConfigOpen = false;
let customImageData = '';
let editImageData = '';
let customAudioData = '';
let customAudioName = '';
let isStatsOpen = false;
let getTaskFilterState = null;

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

// --- Render task list ---
// see functions: renderTaskView, toggleTaskExpandedFn, openEditModalFn, deleteTaskFn
function renderTaskView() {
  const filters = getTaskFilterState ? getTaskFilterState() : {};
  const ctx = {
    tasks,
    taskListEl,
    holidayPresets: HOLIDAY_PRESETS,
    expandedTaskId,
    toggleTaskExpandedFn,
    openEditModalFn,
    deleteTaskFn,
    saveTasks,
    getCleanTasksFn: (ts) => getCleanTasks(ts),
    startCountdownFn: startCountdown,
    pauseCountdownFn: pauseCountdown,
    stopCountdownFn: stopCountdown,
    triggerFlightWithModeFn: doTriggerFlight,
    updateHeroStatusFn: updateHeroStatus,
    filterType: filters.taskTypeFilter || 'all',
    filterGroup: filters.taskGroupFilter || 'all',
    filterKeyword: filters.taskSearchKeyword || '',
  };
  renderTasks(ctx);
  setStatsTasks(tasks);
  setHistoryTasks(tasks);
}

function toggleTaskExpandedFn(taskId) {
  expandedTaskId = expandedTaskId === taskId ? null : taskId;
  renderTaskView();
}

function openEditModalFn(task) {
  editingId = task.id;
  const ctx = {
    modal, modalTitle, modalError, editLabel, editMsg, editGroup,
    editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
    loopTimesField, loopIntervalField,
    editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
    editPostFlightFolder, editPostFlightScript, postFlightAppField,
    postFlightUrlField, postFlightFolderField, postFlightScriptField,
    alarmFields, countdownFields, holidayFields, anniversaryFields,
    editHour, editMinute, editMinutes, editSeconds,
    editHolidayHour, editHolidayMinute, holidayChecklist, HOLIDAY_PRESETS,
    editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
    editImagePreview, editClearImageBtn, editUseImageCheckbox, editImageInput,
    deleteTaskBtn, editImageData, editingId, selectedEditColor: getSelectedEditColor(),
  };
  openEditModal(task, editingId, selectColor, ctx);
}

function deleteTaskFn(task) {
  deleteTask(task, tasks, () => closeModal(modal, modalError), saveTasks, (ts) => getCleanTasks(ts), renderTaskView, stopCountdown);
}

// --- Modal save ---
function saveModalHandler() {
  const ctx = {
    modal, modalError, tasks, saveTasks, getCleanTasksFn: (ts) => getCleanTasks(ts), renderTasksFn: renderTaskView,
    editLabel, editMsg, editGroup, editingId,
    editFlightMode, editLoopCount, editLoopInterval, editIntervalCount,
    editPostFlightAction, editPostFlightAppPath, editPostFlightUrl,
    editPostFlightFolder, editPostFlightScript,
    editHour, editMinute, editMinutes, editSeconds,
    editHolidayHour, editHolidayMinute, holidayChecklist, HOLIDAY_PRESETS,
    editAnniMonth, editAnniDay, editAnniHour, editAnniMinute,
    editImagePreview, editUseImageCheckbox, selectedEditColor: getSelectedEditColor(), editImageData,
    stopCountdownFn: stopCountdown,
  };
  saveModal(editingId, ctx);
  editingId = null;
  saveModal(editingId, ctx);
}

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
  // Load tasks
  const saved = await loadTasks();
  const { tasks: hydrated, maxId } = hydrateTasks(saved);
  tasks = hydrated;
  setNextId(maxId);

  // Restore settings
  const cfg = await loadSettings();

  isMuted = cfg.muted;
  muteBtn.innerHTML = isMuted ? MUTED_ICON : UNMUTED_ICON;
  setMuted(isMuted);
  initLogo({
    getCustomImageData: () => customImageData, isTauriRuntime, invoke, isMuted, settingsModal,
  });
  initFlightSync({
    speedSelect, heightSelect, effectSelect,
    planeSelect, particleSelect, bubbleSelect, bubblePositionSelect,
    soundSelect, soundModeSelect, useSoundCheckbox, useImageCheckbox,
    effectCards: (document.getElementById('effectPicker')?.querySelectorAll('.effect-card')) || [],
    presetButtons: document.querySelectorAll('.preset-btn'),
    presetWatchSelectors: [speedSelect, heightSelect, effectSelect, planeSelect, particleSelect, bubbleSelect, bubblePositionSelect, soundSelect, soundModeSelect],
    FLIGHT_PRESETS, persistFlightSettings, persistSetting, showToast,
  });
  initFlightTrigger({
    incrementTodayCount, todayCountEl, getDateKey, get, set,
    resetStreak, dayDiff, isInQuietHours, quietHoursToggle, quietStartHour, quietEndHour,
    getRandomQuote, recordFlightTrigger, notifyFlightTriggered,
    renderStatsPanel: () => renderStatsPanel(),
    triggerFlightWithMode,
  });
  initAudioSystem({
    soundSelect, soundModeSelect, useSoundCheckbox,
    soundMeta, soundNameEl, previewSoundBtn,
    getCustomAudioData: () => customAudioData,
    getCustomAudioName: () => customAudioName,
    showToast,
    SOUND_PRESETS, playPresetSound: playPresetSound,
    buildCustomAudioObjectUrl,
    stopPreviewAudio,
  });
  syncMuteToTray();
  todayCountEl.textContent = cfg.todayCount;
  if (cfg.speed) speedSelect.value = cfg.speed;
  if (cfg.height) heightSelect.value = cfg.height;
  if (cfg.display) displaySelect.value = cfg.display;
  if (cfg.effect) { effectSelect.value = cfg.effect; syncEffectPicker(cfg.effect); }
  if (cfg.plane) planeSelect.value = cfg.plane;
  if (cfg.particle) particleSelect.value = cfg.particle;
  if (cfg.bubble) bubbleSelect.value = cfg.bubble;
  if (cfg.bubblePosition) bubblePositionSelect.value = cfg.bubblePosition;
  if (cfg.sound) soundSelect.value = cfg.sound;
  if (cfg.soundMode) soundModeSelect.value = cfg.soundMode;
  useSoundCheckbox.checked = !!cfg.useSound && !!cfg.customAudio;
  customImageData = cfg.customImage || '';
  customAudioData = cfg.customAudio || '';
  customAudioName = cfg.customAudioName || '';
  if (customAudioData) {
    syncAudioObjectUrlTo(buildCustomAudioObjectUrl());
  } else {
    revokeCustomAudioObjectUrl();
  }
  clearImageBtn.classList.toggle('hidden', !customImageData);
  clearSoundBtn.classList.toggle('hidden', !customAudioData);
  updateSoundMeta();
  useImageCheckbox.checked = cfg.useImage === undefined ? !!customImageData : cfg.useImage;
  if (customImageData) { imagePreview.src = customImageData; imagePreview.classList.remove('hidden'); }
  useImageCheckbox.closest('.img-toggle').classList.toggle('hidden', !customImageData);
  updateTitleLogo();

  const date = new Date().toDateString();
  if (cfg.lastDate !== date) { await set('todayCount', 0); todayCountEl.textContent = '0'; }
  const streakLastDate = await get('streakLastDate');
  const streakGap = dayDiff(streakLastDate, getDateKey());
  if (streakLastDate && streakGap !== null && streakGap > 1) await clearFlightStreak();

  try {
    if (isTauriRuntime) { autostartToggle.checked = await isAutostartEnabled(); }
    else { autostartToggle.checked = false; autostartToggle.disabled = true; }
  } catch (e) {}

  if (quietHoursToggle) quietHoursToggle.checked = !!cfg.quietHoursEnabled;
  if (quietStartHour) quietStartHour.value = cfg.quietStartHour || 22;
  if (quietEndHour) quietEndHour.value = cfg.quietEndHour || 8;
  if (miniWindowToggle) miniWindowToggle.checked = !!cfg.miniWindowEnabled;
  if (cfg.miniWindowPosition) updateMiniPosGridActive(cfg.miniWindowPosition);

  initToast(toastEl);

  // Init FlightOrchestrator
  initFlightOrchestrator({
    soundSelect, soundModeSelect, useSoundCheckbox,
    speedSelect, heightSelect, effectSelect, planeSelect,
    particleSelect, bubbleSelect, bubblePositionSelect, displaySelect,
    useImageCheckbox,
  });
  setCustomImageData(customImageData);
  setCustomAudioData(customAudioData);
  setToastFn(showToast);

  initCountdownTimer({
    AccurateTimer, renderTaskView, saveTasks, getCleanTasks,
    getTasks: () => tasks, updateCountdownTaskUI, taskListEl,
    holidayPresets: HOLIDAY_PRESETS, doTriggerFlight,
  });
  initAlarmChecker({
    getTasks: () => tasks, saveTasks,
    getCleanTasks: (ts) => getCleanTasks(ts),
    doTriggerFlight,
    showToast,
    updateNextUpcoming,
    updateMiniWindow,
    isInQuietHours,
    getQuietHoursConfig: () => ({ quietHoursToggle, quietStartHour, quietEndHour }),
    normalizeRepeat,
    isAlarmDueToday,
  });
  initEmergency({
    getModal: () => modal,
    getSettingsModal: () => settingsModal,
    stopLoopSoundLocal, stopPreviewAudio,
    clearAllSequences, clearFlightQueue,
    clearFlightStreak: () => clearFlightStreak(),
    stopAllCountdowns: (ts) => stopAllCountdowns(ts),
    getWebviewWindows: () => WebviewWindow.getAll(),
    showToast,
    emergencyBtn,
    tasksRef: () => tasks,
  });

  initHeroSection({
    tasksRef: { get: () => tasks },
    heroStatusEl,
    getNextUpcomingTask,
  });

  initFlightPreview({
    isTauriRuntime, showToast, unlockAudioIfNeeded, useSoundCheckbox,
    validateCustomAudioPreview, persistFlightSettings,
    speedSelect, heightSelect, effectSelect, planeSelect, particleSelect,
    bubbleSelect, bubblePositionSelect, soundSelect, soundModeSelect,
    useImageCheckbox, queueFlight,
    DEFAULT_FLIGHT_SETTINGS,
    customImageDataRef: { get: () => customImageData, set: (v) => { customImageData = v; } },
    customAudioNameRef: { get: () => customAudioName, set: (v) => { customAudioName = v; } },
    imagePreview, clearImageBtn, imageInput,
    updateTitleLogo, persistSetting, updateSoundMeta,
  });

  renderTaskView();
  startAlarmChecker();
  initHolidayChecklist(holidayChecklist, HOLIDAY_PRESETS);
  initSystemThemeWatcher();
  setTimeout(() => {
    if (miniWindowToggle?.checked) void createMiniWindow();
  }, 2000);
  applyTheme(cfg.theme || 'system');
  initNotificationPermission();
  initColorPickerModule({ editColorPicker });

  configPanel.classList.toggle('hidden', !isConfigOpen);
  configArrow.classList.toggle('collapsed', !isConfigOpen);

  syncPresetButtons();
  await renderStatsPanel();

  // Init flight listeners
  initFlightListeners({
    saveTasks, getCleanTasks: () => getCleanTasks(tasks),
    triggerLanding: () => triggerEmergencyLanding(tasks),
    showToast,
  });

  // Tauri-specific listeners
  initTauriListeners({
    listen, isTauriRuntime, tasksRef: { get: () => tasks },
    stopLoopSoundLocal, clearAllSequences, clearFlightQueue,
    clearFlightStreak, pauseCountdown, stopCountdown, startCountdown,
    muteBtn, invoke, showToast, createCountdownTask,
    triggerEmergencyLanding, saveTasks, getCleanTasks: (ts) => getCleanTasks(ts ?? tasks), renderTaskView,
    autoCheckForUpdate,
    getCurrentWebviewWindow,
  });

  initMediaUpload({
    imageBtn, imageInput, clearImageBtn, imagePreview, useImageCheckbox,
    editImageBtn, editImageInput, editClearImageBtn, editImagePreview, editUseImageCheckbox,
    soundBtn, soundInput, clearSoundBtn, useSoundCheckbox,
    updateTitleLogo, setCustomImageData, persistSetting, showToast,
    buildCustomAudioObjectUrl, syncAudioObjectUrlTo, updateSoundMeta,
    setCustomAudioData, setCustomAudioObjectUrl,
    stopPreviewAudio, resetAudioPreview, revokeCustomAudioObjectUrl,
    unlockAudioIfNeeded, validateCustomAudioPreview,
    customImageDataRef: { get: () => customImageData, set: (v) => { customImageData = v; } },
    editImageDataRef: { get: () => editImageData, set: (v) => { editImageData = v; } },
    customAudioDataRef: { get: () => customAudioData, set: (v) => { customAudioData = v; } },
    customAudioNameRef: { get: () => customAudioName, set: (v) => { customAudioName = v; } },
  });

  initWindowEvents({
    saveTasks, getCleanTasks, tasks, set,
    speedSelect, heightSelect, effectSelect,
    planeSelect, particleSelect, bubbleSelect, bubblePositionSelect,
    soundSelect, soundModeSelect, useSoundCheckbox,
    useImageCheckbox,
    showToast,
    getCustomImageData: () => customImageData,
    getCustomAudioData: () => customAudioData,
    getCustomAudioName: () => customAudioName,
  });

  getTaskFilterState = initTaskFilter({ renderTaskView });

  initSettingsPanel({
    isTauriRuntime, isMuted, MUTED_ICON, UNMUTED_ICON, setMuted,
    syncMuteToTray, stopLoopSoundLocal, stopPreviewAudio, resetAudioPreview,
    set, persistSetting, applyTheme,
    enableAutostart, disableAutostart,
    createMiniWindow, closeMiniWindow, positionMiniWindow, getMiniPositions, updateMiniPosGridActive,
    exportTasksAsJson, getCleanTasks, saveTasks, readBackupFromFile,
    hydrateTasks, setNextId, renderTaskView,
    checkForUpdate, openFeedbackPage, openReleasePage, getCurrentVersion,
    showToast, previewCustomSound, previewFlight, resetFlightSettings,
    invoke, unlockAudioIfNeeded, persistFlightSettings,
    speedSelect, heightSelect, effectSelect, planeSelect, particleSelect,
    bubbleSelect, bubblePositionSelect, soundSelect, soundModeSelect,
    useSoundCheckbox, useImageCheckbox,
    muteBtn,
    tasksRef: { get: () => tasks, set: (v) => { tasks = v; } },
    isConfigOpenRef: { get: () => isConfigOpen, set: (v) => { isConfigOpen = v; } },
    isMutedRef: { get: () => isMuted, set: (v) => { isMuted = v; } },
    isStatsOpenRef: { get: () => isStatsOpen, set: (v) => { isStatsOpen = v; } },
  });

  initModalEvents({
    openNewModal, closeModal, openEditModal, selectColor,
    createCountdownTask, createAlarmTask,
    getCleanTasks, saveTasks, renderTaskView, showToast,
    saveModalHandler, deleteTaskFn, openDialog,
    isTauriRuntime,
    tasksRef: { get: () => tasks },
    editingIdRef: { get: () => editingId, set: (v) => { editingId = v; } },
  });

  listen('deep-link', (event) => {
    handleDeepLink(event.payload);
  }).catch(e => console.error('deep-link listen failed:', e));
}

// --- Sync mute ---
// extracted to ./ui/Logo.js

// --- Effect picker / Preset ---
// extracted to ./settings/FlightSync.js

// --- Deep link ---
// extracted to ./flight/DeepLink.js

function handleDeepLink(rawUrl) {
  const parsed = parseDeepLinkUrl(rawUrl);
  if (!parsed) return;
  if (parsed.action === 'add') {
    closeModal(modal, modalError);
    closeSettingsModal();
    const task = buildTaskFromDeepLink(parsed.params, {
      createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask,
      HOLIDAY_PRESETS, formatHolidayLabel,
    });
    tasks.push(task);
    saveTasks(getCleanTasks(tasks));
    renderTaskView();
    showToast(`已通过链接创建任务：${task.label || task.msg || '新任务'}`);
  }
}

setUpdateStatusEl(updateStatus);
init();
