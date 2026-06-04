import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { AccurateTimer } from './timer.js';
import { get, set, loadTasks, saveTasks, incrementTodayCount, incrementStreak } from './storage.js';
import { getRandomQuote } from './quotes.js';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';

const appWindow = getCurrentWebviewWindow();

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
  lichun: { label: '立春', month: 2, day: 4 },
  yushui: { label: '雨水', month: 2, day: 19 },
  jingzhe: { label: '惊蛰', month: 3, day: 6 },
  chunfen: { label: '春分', month: 3, day: 21 },
  qingming_jieqi: { label: '清明', month: 4, day: 5 },
  guyu: { label: '谷雨', month: 4, day: 20 },
  lixia: { label: '立夏', month: 5, day: 6 },
  xiaoman: { label: '小满', month: 5, day: 21 },
  mangzhong: { label: '芒种', month: 6, day: 6 },
  xiazhi: { label: '夏至', month: 6, day: 21 },
  xiaoshu: { label: '小暑', month: 7, day: 7 },
  dashu: { label: '大暑', month: 7, day: 23 },
  liqiu: { label: '立秋', month: 8, day: 7 },
  chushu: { label: '处暑', month: 8, day: 23 },
  bailu: { label: '白露', month: 9, day: 8 },
  qiufen: { label: '秋分', month: 9, day: 23 },
  hanlu: { label: '寒露', month: 10, day: 8 },
  shuangjiang: { label: '霜降', month: 10, day: 23 },
  lidong: { label: '立冬', month: 11, day: 7 },
  xiaoxue: { label: '小雪', month: 11, day: 22 },
  daxue: { label: '大雪', month: 12, day: 7 },
  dongzhi: { label: '冬至', month: 12, day: 22 },
  xiaohan: { label: '小寒', month: 1, day: 6 },
  dahan: { label: '大寒', month: 1, day: 20 },
};

// DOM refs
const taskListEl = document.getElementById('taskList');
const addTaskBtn = document.getElementById('addTaskBtn');
const modal = document.getElementById('taskModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
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
const streakDisplay = document.getElementById('streakDisplay');
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

// State
let tasks = [];
let nextId = 1;
let editingId = null;
let isMuted = false;
let isConfigOpen = false;
let customImageData = '';
let customAudioData = '';
let loopAudio = null;
let loopOscInterval = null;
let loopState = null;

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

function renderTasks() {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = '<div class="empty-hint"><span class="big-icon">🛩</span><span>暂无任务，点击下方「+ 新建任务」开始</span></div>';
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'task-card';
    if (task._status === 'running') card.classList.add('active');
    if (task._status === 'completed') card.classList.add('completed');

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'task-toggle';
    toggle.checked = task.enabled;
    toggle.addEventListener('change', (e) => {
      task.enabled = e.target.checked;
      saveTasks(getCleanTasks());
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

    const label = document.createElement('div');
    label.className = 'task-label';
    label.textContent = task.label || (task.type === 'alarm' ? '闹钟' : task.type === 'countdown' ? '倒计时' : task.type === 'holiday' ? '节日' : '纪念日');

    const info = document.createElement('div');
    info.className = 'task-info';

    if (task.type === 'alarm') {
      info.textContent = `${pad2(task.hour)}:${pad2(task.minute)} · ${repeatSummary(task)}`;
    } else if (task.type === 'countdown') {
      if (task._status === 'running') {
        info.textContent = `剩余 ${formatDuration(task._remaining)}`;
      } else {
        info.textContent = `时长 ${formatDuration(task.duration)}`;
      }
    } else if (task.type === 'holiday') {
      const preset = HOLIDAY_PRESETS[task.holidayKey];
      info.textContent = `${preset ? preset.label : '节日'} ${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
    } else if (task.type === 'anniversary') {
      info.textContent = `${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
    }
    const modeLabel = { once: '', loop_times: ' 🔁循环', loop_interval: ' ⏰间隔' };
    if (task.flightMode !== 'once') info.textContent += modeLabel[task.flightMode];
    if (task.msg) info.textContent += ` 💬${task.msg}`;
    body.appendChild(label);
    body.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    if (task.type === 'countdown') {
      const statusEl = document.createElement('span');
      statusEl.className = 'task-countdown-status';
      if (task._status === 'running') {
        statusEl.textContent = formatDuration(task._remaining);
        statusEl.classList.add('running');
      } else if (task._status === 'idle') {
        statusEl.textContent = '';
      }
      actions.appendChild(statusEl);

      const playBtn = document.createElement('button');
      playBtn.className = 'task-play-btn';
      if (task._status === 'running') {
        playBtn.classList.add('active');
        playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        playBtn.title = '停止';
      } else {
        playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        playBtn.title = '开始';
      }
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (task._status === 'running') {
          stopCountdown(task);
        } else {
          startCountdown(task);
        }
      });
      actions.appendChild(playBtn);
    }

    // Takeoff button
    const takeoffBtn = document.createElement('button');
    takeoffBtn.className = 'task-takeoff-btn';
    takeoffBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
    takeoffBtn.title = '马上起飞';
    takeoffBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (task.type === 'countdown') {
        if (task._status === 'running') stopCountdown(task);
        task._status = 'completed';
      }
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

    taskListEl.appendChild(card);
  });
}

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad2(m)}:${pad2(sec)}`;
}

// --- Countdown ---

function startCountdown(task) {
  if (!task.enabled) {
    task.enabled = true;
  }

  const duration = task.duration * 1000;

  task._status = 'running';
  task._remaining = task.duration;

  task._timer = new AccurateTimer(
    duration,
    (remaining) => {
      const secs = Math.ceil(remaining / 1000);
      task._remaining = secs;
      renderTasks();
    },
    () => onCountdownComplete(task)
  );
  task._timer.start();
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

async function createFlightWindow(msg, direction = 'ltr') {
  const speed = speedSelect.value;
  const height = heightSelect.value;
  const plane = planeSelect.value;
  const particle = particleSelect.value;
  const bubble = bubbleSelect.value;

  localStorage.setItem('_flightImage', customImageData || '');
  localStorage.setItem('_flightUseImage', useImageCheckbox.checked ? '1' : '0');

  try {
    const { width: sw, height: sh } = screen;
    const params = new URLSearchParams({ w: sw, h: sh, speed, height, plane, particle, bubble, msg, dir: direction });
    const flightWin = new WebviewWindow(`flight-${Date.now()}`, {
      url: `/flight.html?${params}`,
      width: sw, height: sh, x: 0, y: 0,
      transparent: true, decorations: false,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, visible: true,
    });
    flightWin.once('tauri://error', (e) => console.error('flight error:', e));
  } catch (e) {
    console.error('flight error:', e);
  }
  await new Promise(r => setTimeout(r, 200));
}

async function triggerFlightWithMode(task) {
  const msg = task.msg || getRandomQuote();

  const count = await incrementTodayCount();
  todayCountEl.textContent = count;
  const streak = await incrementStreak();
  updateStreak(streak);

  if (!isMuted) playSound();

  const mode = task.flightMode || 'once';

  if (mode === 'once') {
    await createFlightWindow(msg, 'ltr');
    setTimeout(() => {
      if (loopState) {
        loopState = null;
        stopLoopSound();
      }
    }, 30000);
    return;
  }

  if (mode === 'loop_times') {
    const totalLoopMs = task.loopCount * 10000 + 60000;
    loopState = {
      active: true,
      taskId: task.id,
      taskMsg: msg,
      remaining: (task.loopCount || 3),
      direction: 'ltr',
      mode: 'loop_times',
      intervalId: null,
      timeoutId: setTimeout(() => { if (loopState) { loopState.active = false; loopState = null; stopLoopSound(); } }, totalLoopMs),
    };
    await createFlightWindow(msg, 'ltr');
    return;
  }

  if (mode === 'loop_interval') {
    const totalIntervalMs = (task.intervalCount - 1) * task.loopInterval * 60 * 1000 + 60000;
    loopState = {
      active: true,
      taskId: task.id,
      taskMsg: msg,
      remaining: (task.intervalCount || 10),
      mode: 'loop_interval',
      intervalMs: (task.loopInterval || 5) * 60 * 1000,
      lastStart: Date.now(),
      intervalId: null,
      timeoutId: setTimeout(() => { if (loopState) { loopState.active = false; loopState = null; stopLoopSound(); } }, totalIntervalMs),
    };
    await createFlightWindow(msg, 'ltr');
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

  playOscillator(sound);

  if (loopMode) {
    loopOscInterval = setInterval(() => playOscillator(sound), 800);
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

function playOscillator(sound) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

function closeModal() {
  modal.classList.add('hidden');
}

function saveModal() {
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
      task.label = task.label || (preset ? preset.label : '节日');
      task._lastTriggeredDate = null;
    } else if (type === 'anniversary') {
      task.month = Math.min(12, Math.max(1, parseInt(editAnniMonth.value) || 1));
      task.day = Math.min(31, Math.max(1, parseInt(editAnniDay.value) || 1));
      task.hour = Math.min(23, Math.max(0, parseInt(editAnniHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editAnniMinute.value) || 0));
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
        t.label = preset ? preset.label : '节日';
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
      task.month = Math.min(12, Math.max(1, parseInt(editAnniMonth.value) || 1));
      task.day = Math.min(31, Math.max(1, parseInt(editAnniDay.value) || 1));
      task.hour = Math.min(23, Math.max(0, parseInt(editAnniHour.value) || 0));
      task.minute = Math.min(59, Math.max(0, parseInt(editAnniMinute.value) || 0));
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
  updateStreak(cfg.streak);

  // Load autostart state
  try {
    const auto = await isAutostartEnabled();
    autostartToggle.checked = auto;
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
    label.appendChild(document.createTextNode(`${preset.label} (${preset.month}月${preset.day}日)`));
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
  await set('muted', isMuted);
});

// Emergency
emergencyBtn.addEventListener('click', async () => {
  stopLoopSound();
  if (loopState) {
    if (loopState.intervalId) clearTimeout(loopState.intervalId);
    if (loopState.timeoutId) clearTimeout(loopState.timeoutId);
    loopState = null;
  }
  tasks.forEach(t => {
    if (t.type === 'countdown' && t._status === 'running') {
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
settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
settingsOverlay.addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsCloseBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

autostartToggle.addEventListener('change', async () => {
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

// Image upload
imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    customImageData = e.target.result;
    clearImageBtn.classList.remove('hidden');
    imagePreview.src = customImageData;
    imagePreview.classList.remove('hidden');
    useImageCheckbox.closest('.img-toggle').classList.remove('hidden');
    useImageCheckbox.checked = true;
    updateTitleLogo();
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
});

// Sound upload
soundBtn.addEventListener('click', () => soundInput.click());
soundInput.addEventListener('change', () => {
  const file = soundInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    customAudioData = e.target.result;
    clearSoundBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});
clearSoundBtn.addEventListener('click', () => {
  customAudioData = '';
  clearSoundBtn.classList.add('hidden');
  soundInput.value = '';
});

// Shortcuts
listen('timer-start', () => {
  tasks.forEach(t => {
    if (t.type === 'countdown' && t.enabled && t._status === 'idle') {
      startCountdown(t);
    }
  });
});
listen('timer-pause', () => {
  stopLoopSound();
  tasks.forEach(t => {
    if (t.type === 'countdown' && t._status === 'running') {
      stopCountdown(t);
    }
  });
});
listen('timer-stop', () => {
  stopLoopSound();
  if (loopState) {
    if (loopState.intervalId) clearTimeout(loopState.intervalId);
    if (loopState.timeoutId) clearTimeout(loopState.timeoutId);
    loopState = null;
  }
  tasks.forEach(t => {
    if (t.type === 'countdown' && t._status === 'running') {
      stopCountdown(t);
    }
  });
});
listen('toggle-mute', () => muteBtn.click());

listen('flight-ended', async () => {
  localStorage.removeItem('_flightImage');
  localStorage.removeItem('_flightUseImage');
  const inLoop = loopState && loopState.active;

  if (!inLoop) stopLoopSound();

  if (inLoop && loopState.mode === 'loop_times') {
    loopState.remaining--;
    if (loopState.remaining > 0) {
      loopState.direction = loopState.direction === 'ltr' ? 'rtl' : 'ltr';
      createFlightWindow(loopState.taskMsg, loopState.direction);
      return;
    }
    if (loopState.timeoutId) clearTimeout(loopState.timeoutId);
    loopState = null;
    stopLoopSound();
  } else if (inLoop && loopState.mode === 'loop_interval') {
    loopState.remaining--;
    if (loopState.remaining > 0) {
      stopLoopSound();
      const elapsed = Date.now() - loopState.lastStart;
      let waitMs = loopState.intervalMs - elapsed;
      if (waitMs < 0) waitMs = 0;
      loopState.intervalId = setTimeout(() => {
        if (loopState && loopState.active) {
          loopState.lastStart = Date.now();
          if (!isMuted) playSound();
          createFlightWindow(loopState.taskMsg, 'ltr');
        }
      }, waitMs);
      return;
    }
    if (loopState.timeoutId) clearTimeout(loopState.timeoutId);
    loopState = null;
    stopLoopSound();
  } else {
    loopState = null;
  }

  if (await appWindow.isVisible()) {
    await appWindow.setFocus();
  }
});

// Close to tray
appWindow.onCloseRequested(async (e) => {
  e.preventDefault();
  await appWindow.hide();
});

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