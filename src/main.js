import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, resetStreak } from './storage.js';
import { getRandomQuote } from './quotes.js';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';

function safeGetCurrentWebviewWindow() {
  try {
    return getCurrentWebviewWindow();
  } catch (e) {
    return null;
  }
}

const appWindow = safeGetCurrentWebviewWindow();
const isTauriRuntime = !!appWindow;

const HOLIDAY_PRESETS = {
  // Solar holidays
  new_year: { label: '元旦', month: 1, day: 1 },
  valentine: { label: '情人节', month: 2, day: 14 },
  women_day: { label: '妇女节', month: 3, day: 8 },
  qingming: { label: '清明节', month: 4, day: 5 },
  labour_day: { label: '劳动节', month: 5, day: 1 },
  youth_day: { label: '青年节', month: 5, day: 4 },
  children_day: { label: '儿童节', month: 6, day: 1 },
  party_day: { label: '建党节', month: 7, day: 1 },
  army_day: { label: '建军节', month: 8, day: 1 },
  teacher_day: { label: '教师节', month: 9, day: 10 },
  national_day: { label: '国庆节', month: 10, day: 1 },
  christmas: { label: '圣诞节', month: 12, day: 25 },
  // 24 Solar terms
  lichun: { label: '立春', month: 2, day: 4, approximate: true },
  yushui: { label: '雨水', month: 2, day: 19, approximate: true },
  jingzhe: { label: '惊蛰', month: 3, day: 6, approximate: true },
  chunfen: { label: '春分', month: 3, day: 21, approximate: true },
  qingming_jieqi: { label: '清明', month: 4, day: 5, approximate: true },
  guyu: { label: '谷雨', month: 4, day: 20, approximate: true },
  lixia: { label: '立夏', month: 5, day: 6, approximate: true },
  xiaoman: { label: '小满', month: 5, day: 21, approximate: true },
  mangzhong: { label: '芒种', month: 6, day: 6, approximate: true },
  xiazhi: { label: '夏至', month: 6, day: 21, approximate: true },
  xiaoshu: { label: '小暑', month: 7, day: 7, approximate: true },
  dashu: { label: '大暑', month: 7, day: 23, approximate: true },
  liqiu: { label: '立秋', month: 8, day: 7, approximate: true },
  chushu: { label: '处暑', month: 8, day: 23, approximate: true },
  bailu: { label: '白露', month: 9, day: 8, approximate: true },
  qiufen: { label: '秋分', month: 9, day: 23, approximate: true },
  hanlu: { label: '寒露', month: 10, day: 8, approximate: true },
  shuangjiang: { label: '霜降', month: 10, day: 23, approximate: true },
  lidong: { label: '立冬', month: 11, day: 7, approximate: true },
  xiaoxue: { label: '小雪', month: 11, day: 22, approximate: true },
  daxue: { label: '大雪', month: 12, day: 7, approximate: true },
  dongzhi: { label: '冬至', month: 12, day: 22, approximate: true },
  xiaohan: { label: '小寒', month: 1, day: 6, approximate: true },
  dahan: { label: '大寒', month: 1, day: 20, approximate: true },
};

// DOM refs
const taskListEl = document.getElementById('taskList');
const addTaskBtn = document.getElementById('addTaskBtn');
const modal = document.getElementById('taskModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalError = document.getElementById('modalError');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const editLabel = document.getElementById('editLabel');
const editMsg = document.getElementById('editMsg');
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
const deleteTaskBtn = document.getElementById('deleteTaskBtn');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const todayCountEl = document.getElementById('todayCount');
const heroStatusEl = document.getElementById('heroStatus');
const streakDisplay = document.getElementById('streakDisplay');
const toastEl = document.getElementById('toast');
const muteBtn = document.getElementById('muteBtn');
const emergencyBtn = document.getElementById('emergencyBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const autostartToggle = document.getElementById('autostartToggle');
const speedSelect = document.getElementById('speedSelect');
const heightSelect = document.getElementById('heightSelect');
const configToggle = document.getElementById('configToggle');
const configPanel = document.getElementById('configPanel');
const configArrow = document.getElementById('configArrow');
const planeSelect = document.getElementById('planeSelect');
const particleSelect = document.getElementById('particleSelect');
const bubbleSelect = document.getElementById('bubbleSelect');
const imageBtn = document.getElementById('imageBtn');
const imageInput = document.getElementById('imageInput');
const clearImageBtn = document.getElementById('clearImageBtn');
const imagePreview = document.getElementById('imagePreview');
const useImageCheckbox = document.getElementById('useImageCheckbox');
const soundSelect = document.getElementById('soundSelect');
const soundModeSelect = document.getElementById('soundModeSelect');
const soundBtn = document.getElementById('soundBtn');
const soundInput = document.getElementById('soundInput');
const clearSoundBtn = document.getElementById('clearSoundBtn');
const validationFields = [editAnniMonth, editAnniDay, imageInput, soundInput];

// State
let tasks = [];
let nextId = 1;
let editingId = null;
let expandedTaskId = null;
let isMuted = false;
let isConfigOpen = false;
let customImageData = '';
let customAudioData = '';
let loopAudio = null;
let loopOscInterval = null;
let sharedAudioCtx = null;
let toastTimer = null;
const flightSequences = new Map();
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_AUDIO_SIZE = 3 * 1024 * 1024;
const VALID_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);
const VALID_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg']);

function createSequenceId(taskId) {
  return `seq-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSequence(sequenceId) {
  if (!sequenceId) return null;
  return flightSequences.get(sequenceId) || null;
}

function clearSequence(sequenceId) {
  const state = getSequence(sequenceId);
  if (!state) return;
  if (state.intervalId) clearTimeout(state.intervalId);
  if (state.timeoutId) clearTimeout(state.timeoutId);
  flightSequences.delete(sequenceId);
}

function clearAllSequences() {
  for (const [sequenceId, state] of flightSequences.entries()) {
    if (state.intervalId) clearTimeout(state.intervalId);
    if (state.timeoutId) clearTimeout(state.timeoutId);
    flightSequences.delete(sequenceId);
  }
}

function hasActiveSequences() {
  return flightSequences.size > 0;
}

async function persistSetting(key, value) {
  await set(key, value);
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDiff(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const [fromY, fromM, fromD] = fromKey.split('-').map(Number);
  const [toY, toM, toD] = toKey.split('-').map(Number);
  const from = new Date(fromY, fromM - 1, fromD);
  const to = new Date(toY, toM - 1, toD);
  return Math.round((to - from) / 86400000);
}

function getMaxDayForMonth(month) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 31;
}

function parseAnniversaryValues() {
  const month = Math.min(12, Math.max(1, parseInt(editAnniMonth.value) || 1));
  const day = Math.min(31, Math.max(1, parseInt(editAnniDay.value) || 1));
  const hour = Math.min(23, Math.max(0, parseInt(editAnniHour.value) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(editAnniMinute.value) || 0));
  return { month, day, hour, minute };
}

function validateAnniversaryValues({ month, day }) {
  if (day > getMaxDayForMonth(month)) {
    markFieldError([editAnniMonth, editAnniDay]);
    showModalError(`该日期不存在：${month} 月最多只有 ${getMaxDayForMonth(month)} 天`);
    return false;
  }
  return true;
}

function validateUpload(file, validTypes, maxSize, kindLabel) {
  if (!file) return false;
  if (!validTypes.has(file.type)) {
    markFieldError([kindLabel === '图片' ? imageBtn : soundBtn]);
    showModalError(`${kindLabel}格式不支持，请选择应用允许的文件类型。`);
    return false;
  }
  if (file.size > maxSize) {
    markFieldError([kindLabel === '图片' ? imageBtn : soundBtn]);
    showModalError(`${kindLabel}过大，请控制在 ${Math.round(maxSize / 1024 / 1024)}MB 以内。`);
    return false;
  }
  return true;
}

function isApproximatePreset(key) {
  return !!HOLIDAY_PRESETS[key]?.approximate;
}

function formatHolidayLabel(preset) {
  if (!preset) return '节日';
  return preset.approximate ? `${preset.label}（按常用日期）` : preset.label;
}

async function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    try {
      await sharedAudioCtx.resume();
    } catch (e) {}
  }
  return sharedAudioCtx;
}

async function registerFlightTrigger() {
  const count = await incrementTodayCount();
  todayCountEl.textContent = count;

  const today = getDateKey();
  const lastStreakDate = await get('streakLastDate');
  let streak = await get('streak');

  if (!lastStreakDate) {
    streak = 1;
  } else {
    const diff = dayDiff(lastStreakDate, today);
    if (diff === 0 || diff === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  }

  await set('streak', streak);
  await set('streakLastDate', today);
  updateStreak(streak);
}

async function clearFlightStreak() {
  await resetStreak();
  await set('streakLastDate', null);
  updateStreak(0);
}

function updateTitleLogo() {
  const el = document.getElementById('titleLogo');
  if (customImageData) {
    el.innerHTML = `<img src="${customImageData}" style="width:18px;height:18px;border-radius:4px;object-fit:cover;vertical-align:middle">`;
  } else {
    el.innerHTML = `<img src="/logo.png" style="width:18px;height:18px;border-radius:4px;object-fit:cover;vertical-align:middle">`;
  }
}

// --- Task data model ---

function createAlarmTask() {
  return {
    id: nextId++,
    type: 'alarm',
    label: '',
    msg: '',
    enabled: true,
    flightMode: 'once',
    loopCount: 3,
    loopInterval: 5,
    intervalCount: 10,
    hour: 12,
    minute: 0,
    repeat: [],
    _lastTriggeredDate: null,
  };
}

function createCountdownTask() {
  return {
    id: nextId++,
    type: 'countdown',
    label: '',
    msg: '',
    enabled: true,
    flightMode: 'once',
    loopCount: 3,
    loopInterval: 5,
    intervalCount: 10,
    duration: 1800,
    _remaining: 1800,
    _status: 'idle',
    _timer: null,
  };
}

function createHolidayTask() {
  return {
    id: nextId++,
    type: 'holiday',
    label: '元旦',
    msg: '',
    enabled: true,
    flightMode: 'once',
    loopCount: 3,
    loopInterval: 5,
    intervalCount: 10,
    holidayKey: 'new_year',
    month: 1,
    day: 1,
    hour: 9,
    minute: 0,
    _lastTriggeredDate: null,
  };
}

function createAnniversaryTask() {
  const d = new Date();
  return {
    id: nextId++,
    type: 'anniversary',
    label: '',
    msg: '',
    enabled: true,
    flightMode: 'once',
    loopCount: 3,
    loopInterval: 5,
    intervalCount: 10,
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: 9,
    minute: 0,
    _lastTriggeredDate: null,
  };
}

function cloneTask(t) {
  return {
    ...t,
    _remaining: t.duration,
    _status: 'idle',
    _timer: null,
  };
}

function nextTriggerText(task) {
  if (task._lastTriggeredDate) {
    const today = new Date().toDateString();
    if (task._lastTriggeredDate === today) return '今天已触发';
  }
  const now = new Date();
  const todayMin = now.getHours() * 60 + now.getMinutes();
  const taskMin = task.hour * 60 + task.minute;

  if (task.repeat.length === 0) {
    if (taskMin > todayMin) {
      return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;
    }
    return '已过期';
  }

  if (task.repeat.includes(now.getDay()) && taskMin > todayMin) {
    return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;
  }

  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (task.repeat.includes(d.getDay())) {
      return `${['日','一','二','三','四','五','六'][d.getDay()]} ${pad2(task.hour)}:${pad2(task.minute)}`;
    }
  }
  return '';
}

function repeatSummary(task) {
  const r = task.repeat;
  if (!r || r.length === 0) return '仅一次';
  if (r.length === 7) return '每天';
  if (r.length === 5 && r.every(d => d >= 1 && d <= 5)) return '工作日';
  if (r.length === 2 && r.includes(6) && r.includes(0)) return '周末';
  return r.sort().map(d => ['日','一','二','三','四','五','六'][d]).join('');
}

// --- Render ---

function pad2(n) { return String(n).padStart(2, '0'); }

function showModalError(message) {
  modalError.textContent = message;
  modalError.classList.remove('hidden');
}

function clearModalError() {
  modalError.textContent = '';
  modalError.classList.add('hidden');
  clearFieldErrors();
}

function markFieldError(elements) {
  elements.filter(Boolean).forEach(el => el.classList.add('field-error'));
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastEl.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    setTimeout(() => toastEl.classList.add('hidden'), 220);
  }, 1800);
}

function getTaskTypeMeta(task) {
  const meta = {
    alarm: { label: '定时', className: 'alarm' },
    countdown: { label: '倒计时', className: 'countdown' },
    holiday: { label: '节假日', className: 'holiday' },
    anniversary: { label: '纪念日', className: 'anniversary' },
  };
  return meta[task.type] || { label: '任务', className: 'generic' };
}

function getTaskStatusLabel(task) {
  if (!task.enabled) return '已停用';
  if (task._status === 'running') return '进行中';
  if (task._status === 'paused') return '已暂停';
  if (task._status === 'completed') return '刚完成';
  if (task.type === 'alarm') return nextTriggerText(task) || '等待触发';
  if (task.type === 'holiday' || task.type === 'anniversary') return '等待日期';
  return '待命';
}

function updateHeroStatus() {
  const runningCountdown = tasks.find(task => task.type === 'countdown' && task._status === 'running');
  if (runningCountdown) {
    heroStatusEl.textContent = `倒计时进行中 · ${runningCountdown.label || '未命名任务'}`;
    return;
  }
  const enabledCount = tasks.filter(task => task.enabled).length;
  if (enabledCount === 0) {
    heroStatusEl.textContent = '还没有航线，先创建一条提醒吧';
    return;
  }
  heroStatusEl.textContent = `已启用 ${enabledCount} 条航线，等待下一次起飞`;
}

function getCountdownInfoText(task) {
  if (task._status === 'running') return `剩余 ${formatDuration(task._remaining)}`;
  if (task._status === 'paused') return `暂停于 ${formatDuration(task._remaining)}`;
  return `时长 ${formatDuration(task.duration)}`;
}

function getTaskInfoText(task) {
  let infoText = '';

  if (task.type === 'alarm') {
    infoText = `${pad2(task.hour)}:${pad2(task.minute)} · ${repeatSummary(task)}`;
  } else if (task.type === 'countdown') {
    infoText = getCountdownInfoText(task);
  } else if (task.type === 'holiday') {
    const preset = HOLIDAY_PRESETS[task.holidayKey];
    infoText = `${formatHolidayLabel(preset)} ${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
  } else if (task.type === 'anniversary') {
    infoText = `${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
  }

  const modeLabel = { once: '', loop_times: ' 🔁循环', loop_interval: ' ⏰间隔' };
  if (task.flightMode !== 'once') infoText += modeLabel[task.flightMode];
  if (task.msg) infoText += ` 💬${task.msg}`;
  return infoText;
}

function updateCountdownActionUI(task, actionsEl) {
  if (!actionsEl) return;

  const statusEl = actionsEl.querySelector('.task-countdown-status');
  const playBtn = actionsEl.querySelector('.task-play-btn');
  const stopBtn = actionsEl.querySelector('.task-stop-btn');

  if (statusEl) {
    statusEl.classList.remove('running');
    if (task._status === 'running') {
      statusEl.textContent = formatDuration(task._remaining);
      statusEl.classList.add('running');
    } else if (task._status === 'paused') {
      statusEl.textContent = `暂停 ${formatDuration(task._remaining)}`;
    } else {
      statusEl.textContent = '';
    }
  }

  if (playBtn) {
    playBtn.classList.remove('active');
    if (task._status === 'running') {
      playBtn.classList.add('active');
      playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      playBtn.title = '暂停';
    } else {
      playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      playBtn.title = task._status === 'paused' ? '继续' : '开始';
    }
  }

  if (stopBtn) {
    const canStop = task._status === 'running' || task._status === 'paused';
    stopBtn.classList.toggle('hidden', !canStop);
    stopBtn.disabled = !canStop;
    stopBtn.title = '停止';
  }
}

function updateCountdownTaskUI(task) {
  if (task.type !== 'countdown') return;

  const card = taskListEl.querySelector(`[data-task-id="${task.id}"]`);
  if (!card) return;

  card.classList.toggle('active', task._status === 'running');
  card.classList.toggle('completed', task._status === 'completed');

  const infoEl = card.querySelector('.task-info');
  const statusBadge = card.querySelector('.task-status-badge');

  if (infoEl) infoEl.textContent = getTaskInfoText(task);
  if (statusBadge) statusBadge.textContent = getTaskStatusLabel(task);

  updateCountdownActionUI(task, card.querySelector('.task-actions'));
}

function getTaskSortScore(task) {
  let base = 0;
  if (!task.enabled) base += 4000;
  if (task._status === 'running') base -= 2000;
  if (task._status === 'paused') base -= 1200;
  if (task.type === 'countdown') base -= 500;
  if (task.type === 'alarm') base -= 200;
  return base;
}

function getTaskTimeAnchor(task) {
  if (task.type === 'alarm') return task.hour * 60 + task.minute;
  if (task.type === 'countdown') return task._remaining ?? task.duration;
  if (task.type === 'holiday' || task.type === 'anniversary') return ((task.month || 1) * 100 + (task.day || 1));
  return 999999;
}

function getTaskGroupKey(task) {
  if (!task.enabled) return 'disabled';
  if (task._status === 'running' || task._status === 'paused') return 'in_progress';
  if (task.type === 'holiday' || task.type === 'anniversary') return 'special_dates';
  return 'upcoming';
}

function getTaskGroupMeta(groupKey, count) {
  const labels = {
    in_progress: { title: '正在进行', subtitle: `需要你现在关注的 ${count} 条任务` },
    upcoming: { title: '近期提醒', subtitle: `按触发顺序排好的 ${count} 条航线` },
    special_dates: { title: '特殊日期', subtitle: `节日与纪念日共 ${count} 条` },
    disabled: { title: '已停用', subtitle: `当前关闭的 ${count} 条任务` },
  };
  return labels[groupKey];
}

function getTaskDetailLines(task) {
  const lines = [];
  if (task.type === 'alarm') {
    lines.push(`重复：${repeatSummary(task)}`);
    lines.push(`下次：${nextTriggerText(task) || '等待触发'}`);
  } else if (task.type === 'countdown') {
    lines.push(`默认时长：${formatDuration(task.duration)}`);
    lines.push(`当前状态：${getTaskStatusLabel(task)}`);
  } else if (task.type === 'holiday') {
    lines.push(`日期：${task.month}月${task.day}日`);
    lines.push(`说明：${HOLIDAY_PRESETS[task.holidayKey]?.approximate ? '按常用日期提醒' : '固定阳历日期提醒'}`);
  } else if (task.type === 'anniversary') {
    lines.push(`日期：${task.month}月${task.day}日`);
    lines.push(`提醒时间：${pad2(task.hour)}:${pad2(task.minute)}`);
  }
  lines.push(`飞行：${task.flightMode === 'once' ? '一次性' : task.flightMode === 'loop_times' ? `连续 ${task.loopCount} 次` : `每 ${task.loopInterval} 分钟，共 ${task.intervalCount} 次`}`);
  if (task.msg) {
    lines.push(`文案：${task.msg}`);
  }
  return lines;
}

function toggleTaskExpanded(taskId) {
  expandedTaskId = expandedTaskId === taskId ? null : taskId;
  renderTasks();
}

function setGroupEnabled(groupTasks, enabled) {
  groupTasks.forEach(task => {
    task.enabled = enabled;
    if (!enabled && task.type === 'countdown' && (task._status === 'running' || task._status === 'paused')) {
      stopCountdown(task);
    }
  });
  saveTasks(getCleanTasks());
  renderTasks();
  showToast(enabled ? `已启用 ${groupTasks.length} 条任务` : `已停用 ${groupTasks.length} 条任务`);
}

function renderTasks() {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = '<div class="empty-hint"><span class="big-icon">🛩</span><strong>任务列表会展示在这里</strong><span>暂无任务，点击「新建任务」开始添加提醒。</span></div>';
    updateHeroStatus();
    return;
  }

  const orderedTasks = [...tasks].sort((a, b) => {
    const scoreDiff = getTaskSortScore(a) - getTaskSortScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    const timeDiff = getTaskTimeAnchor(a) - getTaskTimeAnchor(b);
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  });

  const grouped = orderedTasks.reduce((acc, task) => {
    const key = getTaskGroupKey(task);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  ['in_progress', 'upcoming', 'special_dates', 'disabled'].forEach(groupKey => {
    const groupTasks = grouped[groupKey];
    if (!groupTasks?.length) return;

    const groupMeta = getTaskGroupMeta(groupKey, groupTasks.length);
    const section = document.createElement('section');
    section.className = `task-group task-group--${groupKey}`;

    const header = document.createElement('div');
    header.className = 'task-group-head';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'task-group-copy';

    const title = document.createElement('h3');
    title.className = 'task-group-title';
    title.textContent = groupMeta.title;

    const subtitle = document.createElement('p');
    subtitle.className = 'task-group-subtitle';
    subtitle.textContent = groupMeta.subtitle;

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const actions = document.createElement('div');
    actions.className = 'task-group-actions';

    const enableBtn = document.createElement('button');
    enableBtn.className = 'task-group-btn';
    enableBtn.textContent = '全部启用';
    enableBtn.addEventListener('click', () => setGroupEnabled(groupTasks, true));

    const disableBtn = document.createElement('button');
    disableBtn.className = 'task-group-btn';
    disableBtn.textContent = '全部停用';
    disableBtn.addEventListener('click', () => setGroupEnabled(groupTasks, false));

    actions.appendChild(enableBtn);
    actions.appendChild(disableBtn);

    header.appendChild(titleWrap);
    header.appendChild(actions);
    section.appendChild(header);

    groupTasks.forEach(task => {
    const typeMeta = getTaskTypeMeta(task);
    const card = document.createElement('div');
    card.className = `task-card task-card--${typeMeta.className}`;
    card.dataset.taskId = String(task.id);
    if (task._status === 'running') card.classList.add('active');
    if (task._status === 'completed') card.classList.add('completed');

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'task-toggle';
    toggle.checked = task.enabled;
    toggle.addEventListener('change', (e) => {
      task.enabled = e.target.checked;
      saveTasks(getCleanTasks());
      renderTasks();
    });
    toggle.addEventListener('click', (e) => e.stopPropagation());

    const icon = document.createElement('span');
    icon.className = 'task-icon';
    const svgClock = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const svgTimer = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 10"/></svg>';
    const svgCal = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const svgHeart = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
    icon.innerHTML = task.type === 'alarm' ? svgClock : task.type === 'countdown' ? svgTimer : task.type === 'holiday' ? svgCal : svgHeart;

    const body = document.createElement('div');
    body.className = 'task-body';

    const metaRow = document.createElement('div');
    metaRow.className = 'task-meta-row';

    const typeBadge = document.createElement('span');
    typeBadge.className = `task-badge task-badge--${typeMeta.className}`;
    typeBadge.textContent = typeMeta.label;

    const statusBadge = document.createElement('span');
    statusBadge.className = 'task-status-badge';
    statusBadge.textContent = getTaskStatusLabel(task);

    metaRow.appendChild(typeBadge);
    metaRow.appendChild(statusBadge);

    const label = document.createElement('div');
    label.className = 'task-label';
    label.textContent = task.label || (task.type === 'alarm' ? '闹钟' : task.type === 'countdown' ? '倒计时' : task.type === 'holiday' ? '节日' : '纪念日');

    const info = document.createElement('div');
    info.className = 'task-info';
    info.textContent = getTaskInfoText(task);
    body.appendChild(metaRow);
    body.appendChild(label);
    body.appendChild(info);

    if (expandedTaskId === task.id) {
      const details = document.createElement('div');
      details.className = 'task-details';
      getTaskDetailLines(task).forEach(line => {
        const detail = document.createElement('div');
        detail.className = 'task-detail-line';
        detail.textContent = line;
        details.appendChild(detail);
      });

      const detailActions = document.createElement('div');
      detailActions.className = 'task-detail-actions';

      const quickEditBtn = document.createElement('button');
      quickEditBtn.className = 'task-detail-btn';
      quickEditBtn.textContent = '快速编辑';
      quickEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task);
      });

      detailActions.appendChild(quickEditBtn);
      details.appendChild(detailActions);
      body.appendChild(details);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const expandBtn = document.createElement('button');
    expandBtn.className = 'task-expand-btn';
    expandBtn.title = expandedTaskId === task.id ? '收起详情' : '展开详情';
    expandBtn.textContent = expandedTaskId === task.id ? '收起' : '详情';
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskExpanded(task.id);
    });
    actions.appendChild(expandBtn);

    if (task.type === 'countdown') {
      const statusEl = document.createElement('span');
      statusEl.className = 'task-countdown-status';
      actions.appendChild(statusEl);

      const playBtn = document.createElement('button');
      playBtn.className = 'task-play-btn';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (task._status === 'running') {
          pauseCountdown(task);
        } else {
          startCountdown(task);
        }
      });
      actions.appendChild(playBtn);

      const stopBtn = document.createElement('button');
      stopBtn.className = 'task-stop-btn';
      stopBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopCountdown(task);
      });
      actions.appendChild(stopBtn);

      updateCountdownActionUI(task, actions);
    }

    // Takeoff button
    const takeoffBtn = document.createElement('button');
    takeoffBtn.className = 'task-takeoff-btn';
    takeoffBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
    takeoffBtn.title = '马上起飞';
    takeoffBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!task.enabled) {
        task.enabled = true;
        saveTasks(getCleanTasks());
      }
      if (task.type === 'countdown') {
        if (task._status === 'running' || task._status === 'paused') stopCountdown(task);
        task._status = 'completed';
      }
      renderTasks();
      triggerFlightWithMode(task);
    });
    actions.appendChild(takeoffBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'task-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = '删除';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task);
    });
    actions.appendChild(delBtn);

    card.appendChild(toggle);
    card.appendChild(icon);
    card.appendChild(body);
    card.appendChild(actions);

    card.addEventListener('click', () => openEditModal(task));

      section.appendChild(card);
    });

    taskListEl.appendChild(section);
  });

  updateHeroStatus();
}

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad2(m)}:${pad2(sec)}`;
}

// --- Countdown ---

function startCountdown(task) {
  let enabledChanged = false;
  if (!task.enabled) {
    task.enabled = true;
    enabledChanged = true;
  }

  if (task._status === 'paused' && task._timer) {
    task._status = 'running';
    if (enabledChanged) saveTasks(getCleanTasks());
    task._timer.resume();
    renderTasks();
    return;
  }

  const duration = (task._remaining || task.duration) * 1000;

  task._status = 'running';
  task._remaining = task._remaining || task.duration;

  task._timer = new AccurateTimer(
    duration,
    (remaining) => {
      const secs = Math.ceil(remaining / 1000);
      if (secs === task._remaining) return;
      task._remaining = secs;
      updateCountdownTaskUI(task);
    },
    () => onCountdownComplete(task)
  );
  task._timer.start();
  if (enabledChanged) saveTasks(getCleanTasks());
  renderTasks();
}

function pauseCountdown(task) {
  if (!task._timer || task._status !== 'running') return;
  task._timer.pause();
  task._status = 'paused';
  task._remaining = Math.ceil(task._timer.remaining / 1000);
  renderTasks();
}

function stopCountdown(task) {
  if (task._timer) {
    task._timer.stop();
    task._timer = null;
  }
  task._status = 'idle';
  task._remaining = task.duration;
  renderTasks();
}

async function onCountdownComplete(task) {
  task._status = 'completed';
  renderTasks();

  await triggerFlightWithMode(task);
  task._status = 'idle';
  task._remaining = task.duration;
  renderTasks();
}

// --- Alarm checker ---

let alarmInterval = null;

function startAlarmChecker() {
  if (alarmInterval) return;
  alarmInterval = setInterval(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const today = now.toDateString();
    const day = now.getDay();
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.getDate();

    tasks.forEach(task => {
      if (!task.enabled) return;
      if (task._lastTriggeredDate === today) return;

      if (task.type === 'alarm') {
        const hasRepeat = task.repeat.length > 0;
        if (hasRepeat && !task.repeat.includes(day)) return;
        if (task.hour === h && task.minute === m) {
          task._lastTriggeredDate = today;
          saveTasks(getCleanTasks());
          triggerFlightWithMode(task);
        }
      } else if (task.type === 'holiday') {
        if (task.month === todayMonth && task.day === todayDate && task.hour === h && task.minute === m) {
          task._lastTriggeredDate = today;
          saveTasks(getCleanTasks());
          triggerFlightWithMode(task);
        }
      } else if (task.type === 'anniversary') {
        if (task.month === todayMonth && task.day === todayDate && task.hour === h && task.minute === m) {
          task._lastTriggeredDate = today;
          saveTasks(getCleanTasks());
          triggerFlightWithMode(task);
        }
      }
    });
  }, 1000);
}

// --- Flight ---

async function createFlightWindow(msg, direction = 'ltr', sequenceId = '') {
  if (!isTauriRuntime) {
    return;
  }
  const speed = speedSelect.value;
  const height = heightSelect.value;
  const plane = planeSelect.value;
  const particle = particleSelect.value;
  const bubble = bubbleSelect.value;

  localStorage.setItem('_flightImage', customImageData || '');
  localStorage.setItem('_flightUseImage', useImageCheckbox.checked ? '1' : '0');

  try {
    const { width: sw, height: sh } = screen;
    const params = new URLSearchParams({ w: sw, h: sh, speed, height, plane, particle, bubble, msg, dir: direction, seq: sequenceId });
    const flightWin = new WebviewWindow(`flight-${Date.now()}`, {
      url: `/flight.html?${params}`,
      width: sw, height: sh, x: 0, y: 0,
      transparent: true, decorations: false,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, visible: true, focus: false,
    });
    flightWin.once('tauri://error', (e) => console.error('flight error:', e));
  } catch (e) {
    console.error('flight error:', e);
  }
  await new Promise(r => setTimeout(r, 200));
}

async function triggerFlightWithMode(task) {
  const msg = task.msg || getRandomQuote();

  await registerFlightTrigger();

  if (!isMuted) playSound();

  const mode = task.flightMode || 'once';

  if (mode === 'once') {
    await createFlightWindow(msg, 'ltr');
    return;
  }

  if (mode === 'loop_times') {
    const sequenceId = createSequenceId(task.id);
    const totalLoopMs = task.loopCount * 10000 + 60000;
    flightSequences.set(sequenceId, {
      active: true,
      sequenceId,
      taskId: task.id,
      taskMsg: msg,
      remaining: (task.loopCount || 3),
      direction: 'ltr',
      mode: 'loop_times',
      intervalId: null,
      timeoutId: setTimeout(() => {
        const state = getSequence(sequenceId);
        if (state) {
          state.active = false;
          clearSequence(sequenceId);
          if (!hasActiveSequences()) stopLoopSound();
        }
      }, totalLoopMs),
    });
    await createFlightWindow(msg, 'ltr', sequenceId);
    return;
  }

  if (mode === 'loop_interval') {
    const sequenceId = createSequenceId(task.id);
    const totalIntervalMs = (task.intervalCount - 1) * task.loopInterval * 60 * 1000 + 60000;
    flightSequences.set(sequenceId, {
      active: true,
      sequenceId,
      taskId: task.id,
      taskMsg: msg,
      remaining: (task.intervalCount || 10),
      mode: 'loop_interval',
      intervalMs: (task.loopInterval || 5) * 60 * 1000,
      lastStart: Date.now(),
      intervalId: null,
      timeoutId: setTimeout(() => {
        const state = getSequence(sequenceId);
        if (state) {
          state.active = false;
          clearSequence(sequenceId);
          if (!hasActiveSequences()) stopLoopSound();
        }
      }, totalIntervalMs),
    });
    await createFlightWindow(msg, 'ltr', sequenceId);
    return;
  }
}

function updateStreak(n) {
  streakDisplay.textContent = n >= 2 ? `🔥 连飞 ${n} 次` : '';
}

function playSound() {
  if (isMuted) return;
  stopLoopSound();

  const sound = soundSelect.value;
  const loopMode = soundModeSelect.value === 'loop';

  if (loopMode && customAudioData) {
    const a = new Audio(customAudioData);
    a.loop = true;
    a.volume = 0.5;
    a.play().catch(() => {});
    loopAudio = a;
    return;
  }

  void playOscillator(sound);

  if (loopMode) {
    loopOscInterval = setInterval(() => { void playOscillator(sound); }, 800);
  }
}

function stopLoopSound() {
  if (loopAudio) {
    loopAudio.pause();
    loopAudio = null;
  }
  if (loopOscInterval) {
    clearInterval(loopOscInterval);
    loopOscInterval = null;
  }
}

async function playOscillator(sound) {
  try {
    const audioCtx = await getAudioContext();
    if (sound === 'whoosh') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
    } else if (sound === 'dingdong') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(784, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(988, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc1.connect(gain); osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.22);
      osc2.start(audioCtx.currentTime + 0.25);
      osc2.stop(audioCtx.currentTime + 0.5);
    } else if (sound === 'ring') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.setValueAtTime(6, audioCtx.currentTime);
      lfoGain.gain.setValueAtTime(100, audioCtx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      lfo.start(audioCtx.currentTime);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.6);
      lfo.stop(audioCtx.currentTime + 0.6);
    } else if (sound === 'soft') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, audioCtx.currentTime);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.15);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.6);
    }
  } catch (e) {}
}

// --- Modal ---

function openEditModal(task) {
  editingId = task.id;
  clearModalError();
  modalTitle.textContent = '编辑任务';

  editLabel.value = task.label;
  editMsg.value = task.msg || '';

  editFlightMode.value = task.flightMode || 'once';
  editLoopCount.value = task.loopCount || 3;
  editLoopInterval.value = task.loopInterval || 5;
  editIntervalCount.value = task.intervalCount || 10;
  loopTimesField.classList.toggle('hidden', editFlightMode.value !== 'loop_times');
  loopIntervalField.classList.toggle('hidden', editFlightMode.value !== 'loop_interval');

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === task.type);
  });
  alarmFields.classList.add('hidden');
  countdownFields.classList.add('hidden');
  holidayFields.classList.add('hidden');
  anniversaryFields.classList.add('hidden');

  if (task.type === 'alarm') {
    alarmFields.classList.remove('hidden');
    editHour.value = task.hour;
    editMinute.value = task.minute;
    document.querySelectorAll('.day-btn').forEach(b => {
      b.classList.toggle('active', task.repeat.includes(parseInt(b.dataset.day)));
    });
  } else if (task.type === 'countdown') {
    countdownFields.classList.remove('hidden');
    editMinutes.value = Math.floor(task.duration / 60);
    editSeconds.value = task.duration % 60;
  } else if (task.type === 'holiday') {
    holidayFields.classList.remove('hidden');
    holidayChecklist.querySelectorAll('input').forEach(cb => {
      cb.checked = cb.value === task.holidayKey;
    });
    editHolidayHour.value = task.hour;
    editHolidayMinute.value = task.minute;
  } else if (task.type === 'anniversary') {
    anniversaryFields.classList.remove('hidden');
    editAnniMonth.value = task.month;
    editAnniDay.value = task.day;
    editAnniHour.value = task.hour;
    editAnniMinute.value = task.minute;
  }

  deleteTaskBtn.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function openNewModal() {
  editingId = null;
  clearModalError();
  modalTitle.textContent = '新建任务';

  editLabel.value = '';
  editMsg.value = '';

  editFlightMode.value = 'once';
  editLoopCount.value = 3;
  editLoopInterval.value = 5;
  editIntervalCount.value = 10;
  loopTimesField.classList.add('hidden');
  loopIntervalField.classList.add('hidden');

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === 'alarm');
  });
  alarmFields.classList.remove('hidden');
  countdownFields.classList.add('hidden');
  holidayFields.classList.add('hidden');
  anniversaryFields.classList.add('hidden');
  editHour.value = '12';
  editMinute.value = '0';
  editMinutes.value = '25';
  editSeconds.value = '0';
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));

  editHolidayHour.value = '9';
  editHolidayMinute.value = '0';
  editAnniMonth.value = '1';
  editAnniDay.value = '1';
  editAnniHour.value = '9';
  editAnniMinute.value = '0';

  deleteTaskBtn.classList.add('hidden');
  modal.classList.remove('hidden');
}

function openNewModalForType(type) {
  openNewModal();
  const target = document.querySelector(`.type-btn[data-type="${type}"]`);
  if (target) target.click();
}

function closeModal() {
  clearModalError();
  modal.classList.add('hidden');
}

function openSettingsModal() {
  modal.classList.add('hidden');
  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

function saveModal() {
  clearModalError();
  const type = document.querySelector('.type-btn.active').dataset.type;

  const flightMode = editFlightMode.value;
  const loopCount = parseInt(editLoopCount.value) || 3;
  const loopInterval = parseInt(editLoopInterval.value) || 5;
  const intervalCount = parseInt(editIntervalCount.value) || 10;

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (!task) return;

    if (task._status === 'running') stopCountdown(task);

    task.label = editLabel.value.trim();
    task.msg = editMsg.value.trim();
    task.type = type;
    task.flightMode = flightMode;
    task.loopCount = loopCount;
    task.loopInterval = loopInterval;
    task.intervalCount = intervalCount;

    if (type === 'alarm') {
      task.hour = Math.min(23, Math.max(0, parseInt(editHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editMinute.value) || 0));
      task.repeat = [];
      document.querySelectorAll('.day-btn.active').forEach(b => {
        task.repeat.push(parseInt(b.dataset.day));
      });
      task._lastTriggeredDate = null;
    } else if (type === 'countdown') {
      const mins = parseInt(editMinutes.value) || 0;
      const secs = Math.min(59, Math.max(0, parseInt(editSeconds.value) || 0));
      task.duration = mins * 60 + secs;
      if (task.duration <= 0) task.duration = 60;
      task._remaining = task.duration;
    } else if (type === 'holiday') {
      // Edit: single holiday
      const checkedBoxes = holidayChecklist.querySelectorAll('input:checked');
      if (checkedBoxes.length === 0) return;
      const useKey = checkedBoxes[0].value;
      const preset = HOLIDAY_PRESETS[useKey];
      task.holidayKey = useKey;
      task.month = preset ? preset.month : 1;
      task.day = preset ? preset.day : 1;
      task.hour = Math.min(23, Math.max(0, parseInt(editHolidayHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editHolidayMinute.value) || 0));
      task.label = task.label || formatHolidayLabel(preset);
      task._lastTriggeredDate = null;
    } else if (type === 'anniversary') {
      const anniversary = parseAnniversaryValues();
      if (!validateAnniversaryValues(anniversary)) return;
      task.month = anniversary.month;
      task.day = anniversary.day;
      task.hour = anniversary.hour;
      task.minute = anniversary.minute;
      task._lastTriggeredDate = null;
    }
  } else {
    let task;
    if (type === 'alarm') {
      task = createAlarmTask();
      task.label = editLabel.value.trim();
      task.msg = editMsg.value.trim();
      task.hour = Math.min(23, Math.max(0, parseInt(editHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editMinute.value) || 0));
      task.repeat = [];
      document.querySelectorAll('.day-btn.active').forEach(b => {
        task.repeat.push(parseInt(b.dataset.day));
      });
    } else if (type === 'countdown') {
      task = createCountdownTask();
      task.label = editLabel.value.trim();
      task.msg = editMsg.value.trim();
      const mins = parseInt(editMinutes.value) || 0;
      const secs = Math.min(59, Math.max(0, parseInt(editSeconds.value) || 0));
      task.duration = mins * 60 + secs;
      if (task.duration <= 0) task.duration = 60;
      task._remaining = task.duration;
    } else if (type === 'holiday') {
      const checkedBoxes = holidayChecklist.querySelectorAll('input:checked');
      if (checkedBoxes.length === 0) return;
      const hour = Math.min(23, Math.max(0, parseInt(editHolidayHour.value) || 0));
      const minute = Math.min(59, Math.max(0, parseInt(editHolidayMinute.value) || 0));
      const msg = editMsg.value.trim();
      let firstTask = null;
      checkedBoxes.forEach(cb => {
        const key = cb.value;
        const preset = HOLIDAY_PRESETS[key];
        const t = createHolidayTask();
        t.holidayKey = key;
        t.label = formatHolidayLabel(preset);
        t.msg = msg;
        t.flightMode = flightMode;
        t.loopCount = loopCount;
        t.loopInterval = loopInterval;
        t.intervalCount = intervalCount;
        t.month = preset ? preset.month : 1;
        t.day = preset ? preset.day : 1;
        t.hour = hour;
        t.minute = minute;
        tasks.push(t);
        if (!firstTask) firstTask = t;
      });
      closeModal();
      saveTasks(getCleanTasks());
      renderTasks();
      return;
    } else if (type === 'anniversary') {
      task = createAnniversaryTask();
      task.label = editLabel.value.trim() || '纪念日';
      task.msg = editMsg.value.trim();
      task.flightMode = flightMode;
      task.loopCount = loopCount;
      task.loopInterval = loopInterval;
      task.intervalCount = intervalCount;
      const anniversary = parseAnniversaryValues();
      if (!validateAnniversaryValues(anniversary)) return;
      task.month = anniversary.month;
      task.day = anniversary.day;
      task.hour = anniversary.hour;
      task.minute = anniversary.minute;
    }
    tasks.push(task);
  }

  closeModal();
  saveTasks(getCleanTasks());
  renderTasks();
}

function deleteTask(task) {
  if (task._status === 'running') stopCountdown(task);
  tasks = tasks.filter(t => t.id !== task.id);
  closeModal();
  saveTasks(getCleanTasks());
  renderTasks();
}

function getCleanTasks() {
  return tasks.map(t => {
    const base = { id: t.id, type: t.type, label: t.label, msg: t.msg, enabled: t.enabled, flightMode: t.flightMode || 'once', loopCount: t.loopCount || 3, loopInterval: t.loopInterval || 5, intervalCount: t.intervalCount || 10 };
    if (t.type === 'alarm') return { ...base, hour: t.hour, minute: t.minute, repeat: t.repeat, _lastTriggeredDate: t._lastTriggeredDate };
    if (t.type === 'countdown') return { ...base, duration: t.duration };
    if (t.type === 'holiday') return { ...base, holidayKey: t.holidayKey, month: t.month, day: t.day, hour: t.hour, minute: t.minute, _lastTriggeredDate: t._lastTriggeredDate };
    if (t.type === 'anniversary') return { ...base, month: t.month, day: t.day, hour: t.hour, minute: t.minute, _lastTriggeredDate: t._lastTriggeredDate };
    return base;
  });
}

// --- Init ---

async function init() {
  // Load tasks
  const saved = await loadTasks();
  tasks = saved.map(t => ({
    ...t,
    flightMode: t.flightMode || 'once',
    loopCount: t.loopCount || 3,
    loopInterval: t.loopInterval || 5,
    intervalCount: t.intervalCount || 10,
    _remaining: t.duration || t.duration,
    _status: 'idle',
    _timer: null,
  }));
  nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;

  // Restore settings
  const cfg = await loadSettings();

  isMuted = cfg.muted;
  muteBtn.innerHTML = isMuted
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
  todayCountEl.textContent = cfg.todayCount;
  if (cfg.speed) speedSelect.value = cfg.speed;
  if (cfg.height) heightSelect.value = cfg.height;
  if (cfg.plane) planeSelect.value = cfg.plane;
  if (cfg.particle) particleSelect.value = cfg.particle;
  if (cfg.bubble) bubbleSelect.value = cfg.bubble;
  if (cfg.sound) soundSelect.value = cfg.sound;
  if (cfg.soundMode) soundModeSelect.value = cfg.soundMode;
  customImageData = cfg.customImage || '';
  customAudioData = cfg.customAudio || '';
  clearImageBtn.classList.toggle('hidden', !customImageData);
  clearSoundBtn.classList.toggle('hidden', !customAudioData);
  useImageCheckbox.checked = cfg.useImage === undefined ? !!customImageData : cfg.useImage;
  if (customImageData) {
    imagePreview.src = customImageData;
    imagePreview.classList.remove('hidden');
  }
  useImageCheckbox.closest('.img-toggle').classList.toggle('hidden', !customImageData);
  updateTitleLogo();

  const date = new Date().toDateString();
  if (cfg.lastDate !== date) {
    await set('todayCount', 0);
    todayCountEl.textContent = '0';
  }
  const streakLastDate = await get('streakLastDate');
  const streakGap = dayDiff(streakLastDate, getDateKey());
  if (streakLastDate && streakGap !== null && streakGap > 1) {
    await clearFlightStreak();
  } else {
    updateStreak(cfg.streak);
  }

  // Load autostart state
  try {
    if (isTauriRuntime) {
      const auto = await isAutostartEnabled();
      autostartToggle.checked = auto;
    } else {
      autostartToggle.checked = false;
      autostartToggle.disabled = true;
    }
  } catch (e) {}

  renderTasks();
  startAlarmChecker();
  initHolidayChecklist();

  // Apply config panel state
  configPanel.classList.toggle('hidden', !isConfigOpen);
  configArrow.classList.toggle('collapsed', !isConfigOpen);
}

function initHolidayChecklist() {
  holidayChecklist.innerHTML = '';
  for (const [key, preset] of Object.entries(HOLIDAY_PRESETS)) {
    const label = document.createElement('label');
    label.className = 'holiday-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = key;
    label.appendChild(cb);
    const suffix = preset.approximate ? '，按常用日期' : '';
    label.appendChild(document.createTextNode(`${preset.label} (${preset.month}月${preset.day}日${suffix})`));
    holidayChecklist.appendChild(label);
  }
}

async function loadSettings() {
  return {
    muted: await get('muted'),
    todayCount: await get('todayCount'),
    streak: await get('streak'),
    lastDate: await get('lastDate'),
    speed: await get('speed'),
    height: await get('height'),
    plane: await get('plane'),
    particle: await get('particle'),
    bubble: await get('bubble'),
    sound: await get('sound'),
    soundMode: await get('soundMode'),
    customImage: await get('customImage'),
    customAudio: await get('customAudio'),
    useImage: await get('useImage'),
  };
}

// --- Events ---

addTaskBtn.addEventListener('click', openNewModal);
validationFields.forEach(field => {
  field?.addEventListener('input', () => {
    field.classList.remove('field-error');
    if (modalError.textContent) modalError.classList.add('hidden');
  });
  field?.addEventListener('change', () => {
    field.classList.remove('field-error');
    if (modalError.textContent) modalError.classList.add('hidden');
  });
});
imageBtn.addEventListener('click', () => imageBtn.classList.remove('field-error'));
soundBtn.addEventListener('click', () => soundBtn.classList.remove('field-error'));
modalOverlay.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);
saveTaskBtn.addEventListener('click', saveModal);
deleteTaskBtn.addEventListener('click', () => {
  if (editingId !== null) {
    const task = tasks.find(t => t.id === editingId);
    if (task) deleteTask(task);
  }
});

// Type toggle in modal
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.type;
    alarmFields.classList.toggle('hidden', type !== 'alarm');
    countdownFields.classList.toggle('hidden', type !== 'countdown');
    holidayFields.classList.toggle('hidden', type !== 'holiday');
    anniversaryFields.classList.toggle('hidden', type !== 'anniversary');
    if (type === 'holiday' && !editingId) {
      const firstCb = holidayChecklist.querySelector('input');
      if (firstCb) firstCb.checked = true;
    }
  });
});

// Flight mode change
editFlightMode.addEventListener('change', () => {
  const v = editFlightMode.value;
  loopTimesField.classList.toggle('hidden', v !== 'loop_times');
  loopIntervalField.classList.toggle('hidden', v !== 'loop_interval');
});

// Day buttons
document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
  });
});

// Config toggle
configToggle.addEventListener('click', () => {
  isConfigOpen = !isConfigOpen;
  configPanel.classList.toggle('hidden', !isConfigOpen);
  configArrow.classList.toggle('collapsed', !isConfigOpen);
});

// Mute
muteBtn.addEventListener('click', async () => {
  isMuted = !isMuted;
  muteBtn.innerHTML = isMuted
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
  if (isMuted) stopLoopSound();
  await set('muted', isMuted);
});

// Emergency
emergencyBtn.addEventListener('click', async () => {
  stopLoopSound();
  clearAllSequences();
  await clearFlightStreak();
  tasks.forEach(t => {
    if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) {
      stopCountdown(t);
    }
  });
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const all = await WebviewWindow.getAll();
    for (const w of all) {
      if (w.label.startsWith('flight-')) await w.close();
    }
  } catch (e) {}
});

// Settings
settingsBtn.addEventListener('click', openSettingsModal);
settingsOverlay.addEventListener('click', closeSettingsModal);
settingsCloseBtn.addEventListener('click', closeSettingsModal);

autostartToggle.addEventListener('change', async () => {
  if (!isTauriRuntime) {
    autostartToggle.checked = false;
    return;
  }
  try {
    if (autostartToggle.checked) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
  } catch (e) {
    console.error('autostart error:', e);
  }
});

speedSelect.addEventListener('change', () => persistSetting('speed', speedSelect.value));
heightSelect.addEventListener('change', () => persistSetting('height', heightSelect.value));
planeSelect.addEventListener('change', () => persistSetting('plane', planeSelect.value));
particleSelect.addEventListener('change', () => persistSetting('particle', particleSelect.value));
bubbleSelect.addEventListener('change', () => persistSetting('bubble', bubbleSelect.value));
soundSelect.addEventListener('change', () => persistSetting('sound', soundSelect.value));
soundModeSelect.addEventListener('change', () => persistSetting('soundMode', soundModeSelect.value));
useImageCheckbox.addEventListener('change', () => persistSetting('useImage', useImageCheckbox.checked));

// Image upload
imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!validateUpload(file, VALID_IMAGE_TYPES, MAX_IMAGE_SIZE, '图片')) {
    imageInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    customImageData = e.target.result;
    clearImageBtn.classList.remove('hidden');
    imagePreview.src = customImageData;
    imagePreview.classList.remove('hidden');
    useImageCheckbox.closest('.img-toggle').classList.remove('hidden');
    useImageCheckbox.checked = true;
    updateTitleLogo();
    persistSetting('customImage', customImageData);
    persistSetting('useImage', true);
  };
  reader.readAsDataURL(file);
});
clearImageBtn.addEventListener('click', () => {
  customImageData = '';
  clearImageBtn.classList.add('hidden');
  imagePreview.classList.add('hidden');
  imagePreview.src = '';
  useImageCheckbox.closest('.img-toggle').classList.add('hidden');
  useImageCheckbox.checked = false;
  imageInput.value = '';
  updateTitleLogo();
  persistSetting('customImage', '');
  persistSetting('useImage', false);
});

// Sound upload
soundBtn.addEventListener('click', () => soundInput.click());
soundInput.addEventListener('change', () => {
  const file = soundInput.files[0];
  if (!file) return;
  if (!validateUpload(file, VALID_AUDIO_TYPES, MAX_AUDIO_SIZE, '音频')) {
    soundInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    customAudioData = e.target.result;
    clearSoundBtn.classList.remove('hidden');
    persistSetting('customAudio', customAudioData);
  };
  reader.readAsDataURL(file);
});
clearSoundBtn.addEventListener('click', () => {
  customAudioData = '';
  clearSoundBtn.classList.add('hidden');
  soundInput.value = '';
  persistSetting('customAudio', '');
});

// Shortcuts
if (isTauriRuntime) {
  listen('timer-start', () => {
    tasks.forEach(t => {
      if (t.type === 'countdown' && t.enabled && (t._status === 'idle' || t._status === 'paused')) {
        startCountdown(t);
      }
    });
  });
  listen('timer-pause', () => {
    stopLoopSound();
    tasks.forEach(t => {
      if (t.type === 'countdown' && t._status === 'running') {
        pauseCountdown(t);
      }
    });
  });
  listen('timer-stop', () => {
    stopLoopSound();
    clearAllSequences();
    clearFlightStreak();
    tasks.forEach(t => {
      if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) {
        stopCountdown(t);
      }
    });
  });
  listen('toggle-mute', () => muteBtn.click());

  listen('flight-ended', async (event) => {
    localStorage.removeItem('_flightImage');
    localStorage.removeItem('_flightUseImage');
    const sequenceId = event.payload?.sequenceId || '';
    const loopState = getSequence(sequenceId);
    const inLoop = !!(loopState && loopState.active);

    if (!inLoop) stopLoopSound();

    if (inLoop && loopState.mode === 'loop_times') {
      loopState.remaining--;
      if (loopState.remaining > 0) {
        loopState.direction = loopState.direction === 'ltr' ? 'rtl' : 'ltr';
        createFlightWindow(loopState.taskMsg, loopState.direction, sequenceId);
        return;
      }
      clearSequence(sequenceId);
      if (!hasActiveSequences()) stopLoopSound();
    } else if (inLoop && loopState.mode === 'loop_interval') {
      loopState.remaining--;
      if (loopState.remaining > 0) {
        stopLoopSound();
        const elapsed = Date.now() - loopState.lastStart;
        let waitMs = loopState.intervalMs - elapsed;
        if (waitMs < 0) waitMs = 0;
        loopState.intervalId = setTimeout(() => {
          const state = getSequence(sequenceId);
          if (state && state.active) {
            state.lastStart = Date.now();
            if (!isMuted) playSound();
            createFlightWindow(state.taskMsg, 'ltr', sequenceId);
          }
        }, waitMs);
        return;
      }
      clearSequence(sequenceId);
      if (!hasActiveSequences()) stopLoopSound();
    }

  });

  // Close to tray
  appWindow.onCloseRequested(async (e) => {
    e.preventDefault();
    await appWindow.hide();
  });
}

// Save settings on unload
window.addEventListener('beforeunload', async () => {
  await saveTasks(getCleanTasks());
  await set('speed', speedSelect.value);
  await set('height', heightSelect.value);
  await set('plane', planeSelect.value);
  await set('particle', particleSelect.value);
  await set('bubble', bubbleSelect.value);
  await set('sound', soundSelect.value);
  await set('soundMode', soundModeSelect.value);
  await set('customImage', customImageData);
  await set('customAudio', customAudioData);
  await set('useImage', useImageCheckbox.checked);
});

init();
