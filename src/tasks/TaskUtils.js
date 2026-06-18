export function pad2(n) { return String(n).padStart(2, '0'); }

export function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad2(m)}:${pad2(sec)}`;
}

export function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayDiff(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const [fromY, fromM, fromD] = fromKey.split('-').map(Number);
  const [toY, toM, toD] = toKey.split('-').map(Number);
  const from = new Date(fromY, fromM - 1, fromD);
  const to = new Date(toY, toM - 1, toD);
  return Math.round((to - from) / 86400000);
}

export function getMaxDayForMonth(month) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 31;
}

export function daysUntilMonthDay(m, d) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), m - 1, d);
  if (target <= today) {
    target = new Date(now.getFullYear() + 1, m - 1, d);
  }
  return Math.ceil((target - today) / 86400000);
}

export function normalizeRepeat(task) {
  const r = task.repeat;
  if (!r || Array.isArray(r)) {
    return { type: 'weekly', days: Array.isArray(r) ? r : [] };
  }
  if (typeof r === 'object' && r.type) {
    return r;
  }
  return { type: 'weekly', days: [] };
}

function getNthWeekdayDate(year, month, week, weekday) {
  if (week === 5) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = lastDay; d >= 1; d--) {
      if (new Date(year, month - 1, d).getDay() === weekday) return d;
    }
    return lastDay;
  }
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === weekday) {
      count++;
      if (count === week) return d;
    }
  }
  return null;
}

export function computeNextAlarmDate(task, fromDate) {
  const now = fromDate || new Date();
  const repeat = normalizeRepeat(task);

  if (repeat.type === 'weekly') {
    if (!repeat.days || repeat.days.length === 0) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), task.hour, task.minute);
      if (today >= now) return today;
      return null;
    }
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      if (repeat.days.includes(d.getDay())) {
        d.setHours(task.hour, task.minute, 0, 0);
        if (d >= now) return d;
      }
    }
    return null;
  }

  if (repeat.type === 'monthly_date') {
    const day = Math.min(repeat.day || 1, 28);
    for (let offset = 0; offset <= 62; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      if (d.getDate() === day) {
        d.setHours(task.hour, task.minute, 0, 0);
        if (d >= now) return d;
      }
    }
    return null;
  }

  if (repeat.type === 'monthly_weekday') {
    const week = Math.min(Math.max(repeat.week || 1, 1), 5);
    const weekday = Math.min(Math.max(repeat.weekday || 0, 0), 6);
    for (let offset = 0; offset <= 62; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      const nthDate = getNthWeekdayDate(d.getFullYear(), d.getMonth() + 1, week, weekday);
      if (nthDate && d.getDate() === nthDate) {
        d.setHours(task.hour, task.minute, 0, 0);
        if (d >= now) return d;
      }
    }
    return null;
  }

  if (repeat.type === 'interval') {
    const interval = Math.max(repeat.interval || 1, 1);
    const origin = repeat.origin ? new Date(repeat.origin) : new Date(2024, 0, 1);
    const nowMs = now.getTime();
    const originMs = origin.getTime();
    const diffDays = Math.floor((nowMs - originMs) / 86400000);
    const nextInterval = Math.ceil((diffDays + 1) / interval) * interval;
    const nextDate = new Date(originMs + nextInterval * 86400000);
    nextDate.setHours(task.hour, task.minute, 0, 0);
    if (nextDate >= now) return nextDate;
    return new Date(originMs + (nextInterval + interval) * 86400000);
  }

  return null;
}

export function isAlarmDueToday(task, now) {
  const d = now || new Date();
  const today = d.toDateString();
  if (task._lastTriggeredDate === today) return false;
  const repeat = normalizeRepeat(task);

  if (repeat.type === 'weekly') {
    if (repeat.days.length > 0 && !repeat.days.includes(d.getDay())) return false;
    return task.hour === d.getHours() && task.minute === d.getMinutes();
  }

  const nextDate = computeNextAlarmDate(task, d);
  if (!nextDate) return false;
  return nextDate.getFullYear() === d.getFullYear()
    && nextDate.getMonth() === d.getMonth()
    && nextDate.getDate() === d.getDate()
    && task.hour === d.getHours()
    && task.minute === d.getMinutes();
}

export function compareVersions(a, b) {
  const pa = a.replace('v', '').split('.').map(Number);
  const pb = b.replace('v', '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function nextTriggerText(task) {
  if (task._lastTriggeredDate) {
    const today = new Date().toDateString();
    if (task._lastTriggeredDate === today) return '今天已触发';
  }
  const now = new Date();
  const repeat = normalizeRepeat(task);

  if (repeat.type === 'weekly' && (!repeat.days || repeat.days.length === 0)) {
    const todayMin = now.getHours() * 60 + now.getMinutes();
    const taskMin = task.hour * 60 + task.minute;
    if (taskMin > todayMin) return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;
    return '已过期';
  }

  const next = computeNextAlarmDate(task, now);
  if (!next) return '';
  const diffMs = next - now;
  if (diffMs < 60000) return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;
  if (diffMs < 86400000) return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (next.toDateString() === tomorrow.toDateString()) return `明天 ${pad2(task.hour)}:${pad2(task.minute)}`;

  if (repeat.type === 'weekly') {
    return `${['日','一','二','三','四','五','六'][next.getDay()]} ${pad2(task.hour)}:${pad2(task.minute)}`;
  }
  return `${next.getMonth() + 1}月${next.getDate()}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
}

const WEEKDAY_NAMES = ['日','一','二','三','四','五','六'];
const WEEK_NAMES = { 1: '第一个', 2: '第二个', 3: '第三个', 4: '第四个', 5: '最后一个' };

export function repeatSummary(task) {
  const repeat = normalizeRepeat(task);
  if (repeat.type === 'weekly') {
    const days = repeat.days || [];
    if (!days || days.length === 0) return '仅一次';
    if (days.length === 7) return '每天';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return '工作日';
    if (days.length === 2 && days.includes(6) && days.includes(0)) return '周末';
    return days.sort().map(d => WEEKDAY_NAMES[d]).join('');
  }
  if (repeat.type === 'monthly_date') {
    return `每月${repeat.day}号`;
  }
  if (repeat.type === 'monthly_weekday') {
    return `每月${WEEK_NAMES[repeat.week] || '第' + repeat.week + '个'}${WEEKDAY_NAMES[repeat.weekday]}`;
  }
  if (repeat.type === 'interval') {
    return `每${repeat.interval}天`;
  }
  return '仅一次';
}

export function getTaskStatusLabel(task) {
  if (!task.enabled) return '已停用';
  if (task._status === 'running') return '进行中';
  if (task._status === 'paused') return '已暂停';
  if (task._status === 'completed') return '刚完成';
  if (task.type === 'alarm') return nextTriggerText(task) || '等待触发';
  if (task.type === 'holiday' || task.type === 'anniversary') {
    const today = new Date().toDateString();
    if (task._lastTriggeredDate === today) return '今天已触发';
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), task.month - 1, task.day, task.hour, task.minute);
    const isToday = now.getFullYear() === targetDate.getFullYear()
      && now.getMonth() === targetDate.getMonth()
      && now.getDate() === targetDate.getDate();
    if (isToday) {
      const diffMs = targetDate - now;
      if (diffMs <= 0) {
        const days = daysUntilMonthDay(task.month, task.day);
        return `还有 ${days} 天`;
      }
      return `今天 ${pad2(task.hour)}:${pad2(task.minute)}`;
    }
    const days = daysUntilMonthDay(task.month, task.day);
    if (days === 0) return '今天';
    return `还有 ${days} 天`;
  }
  return '待命';
}

export function getTaskInfoText(task, holidayPresets) {
  let infoText = '';

  if (task.type === 'alarm') {
    infoText = `${pad2(task.hour)}:${pad2(task.minute)} · ${repeatSummary(task)}`;
  } else if (task.type === 'countdown') {
    if (task._status === 'running') infoText = `剩余 ${formatDuration(task._remaining)}`;
    else if (task._status === 'paused') infoText = `暂停于 ${formatDuration(task._remaining)}`;
    else infoText = `时长 ${formatDuration(task.duration)}`;
  } else if (task.type === 'holiday') {
    const preset = holidayPresets?.[task.holidayKey];
    infoText = `${formatHolidayLabel(preset)} ${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
  } else if (task.type === 'anniversary') {
    infoText = `${task.month}月${task.day}日 ${pad2(task.hour)}:${pad2(task.minute)}`;
  }

  const modeLabel = { once: '', loop_times: ' 🔁循环', loop_interval: ' ⏰间隔' };
  if (task.flightMode !== 'once') infoText += modeLabel[task.flightMode];
  if (task.msg) infoText += ` 💬${task.msg}`;
  return infoText;
}

export function formatHolidayLabel(preset) {
  if (!preset) return '节日';
  return preset.approximate ? `${preset.label}（按常用日期）` : preset.label;
}

export function isApproximatePreset(key, holidayPresets) {
  return !!holidayPresets[key]?.approximate;
}

export function getTaskSortScore(task) {
  let base = 0;
  if (!task.enabled) base += 4000;
  if (task._status === 'running') base -= 2000;
  if (task._status === 'paused') base -= 1200;
  if (task.type === 'countdown') base -= 500;
  if (task.type === 'alarm') base -= 200;
  return base;
}

export function getTaskTimeAnchor(task) {
  if (task.type === 'alarm') return task.hour * 60 + task.minute;
  if (task.type === 'countdown') return task._remaining ?? task.duration;
  if (task.type === 'holiday' || task.type === 'anniversary') return daysUntilMonthDay(task.month || 1, task.day || 1);
  return 999999;
}

export function getTaskGroupKey(task) {
  if (!task.enabled) return 'disabled';
  if (task._status === 'running' || task._status === 'paused') return 'in_progress';
  if (task.type === 'holiday' || task.type === 'anniversary') return 'special_dates';
  return 'upcoming';
}

export function getTaskDetailLines(task, holidayPresets) {
  const lines = [];
  if (task.type === 'alarm') {
    lines.push(`重复：${repeatSummary(task)}`);
    lines.push(`下次：${nextTriggerText(task) || '等待触发'}`);
  } else if (task.type === 'countdown') {
    lines.push(`默认时长：${formatDuration(task.duration)}`);
    lines.push(`当前状态：${getTaskStatusLabel(task)}`);
  } else if (task.type === 'holiday') {
    lines.push(`日期：${task.month}月${task.day}日`);
    lines.push(`说明：${holidayPresets?.[task.holidayKey]?.approximate ? '按常用日期提醒' : '固定阳历日期提醒'}`);
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

export function matchesFilter(task, typeFilter = 'all', groupFilter = 'all', keyword = '') {
  if (typeFilter !== 'all' && task.type !== typeFilter) return false;
  if (groupFilter !== 'all') {
    if (groupFilter === 'none' && task.group) return false;
    if (groupFilter !== 'none' && task.group !== groupFilter) return false;
  }
  if (keyword) {
    const haystack = `${task.label || ''} ${task.msg || ''}`.toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }
  return true;
}

export function getCleanTasks(tasks) {
  return tasks.map(t => {
    const base = {
      id: t.id, type: t.type, label: t.label, msg: t.msg,
      enabled: t.enabled, flightMode: t.flightMode || 'once',
      loopCount: t.loopCount || 3, loopInterval: t.loopInterval || 5,
      intervalCount: t.intervalCount || 10,
      postFlightAction: t.postFlightAction || 'none',
      postFlightAppPath: t.postFlightAppPath || '',
      postFlightUrl: t.postFlightUrl || '',
      postFlightFolder: t.postFlightFolder || '',
      postFlightScript: t.postFlightScript || '',
      group: t.group || '', imageData: t.imageData || null,
      useImage: !!t.useImage, color: t.color || null,
    };
    if (t.type === 'alarm') return { ...base, hour: t.hour, minute: t.minute, repeat: normalizeRepeat(t), _lastTriggeredDate: t._lastTriggeredDate };
    if (t.type === 'countdown') {
      const persisted = t._status === 'paused' ? t._remaining : undefined;
      return { ...base, duration: t.duration, _remaining: persisted, _status: t._status === 'paused' ? 'paused' : 'idle' };
    }
    if (t.type === 'holiday') return { ...base, holidayKey: t.holidayKey, month: t.month, day: t.day, hour: t.hour, minute: t.minute, _lastTriggeredDate: t._lastTriggeredDate };
    if (t.type === 'anniversary') return { ...base, month: t.month, day: t.day, hour: t.hour, minute: t.minute, _lastTriggeredDate: t._lastTriggeredDate };
    return base;
  });
}

export function hydrateTasks(saved) {
  let maxId = 0;
  const tasks = saved.map(t => {
    const repeat = t.repeat;
    const normalizedRepeat = repeat && typeof repeat === 'object' && !Array.isArray(repeat)
      ? repeat
      : { type: 'weekly', days: Array.isArray(repeat) ? repeat : [] };
    const task = {
      ...t,
      repeat: normalizedRepeat,
      flightMode: t.flightMode || 'once',
      loopCount: t.loopCount || 3,
      loopInterval: t.loopInterval || 5,
      intervalCount: t.intervalCount || 10,
      postFlightAction: t.postFlightAction || 'none',
      postFlightAppPath: t.postFlightAppPath || '',
      postFlightUrl: t.postFlightUrl || '',
      postFlightFolder: t.postFlightFolder || '',
      postFlightScript: t.postFlightScript || '',
      group: t.group || '',
      imageData: t.imageData || null,
      useImage: !!t.useImage,
      color: t.color || null,
      _remaining: t.type === 'countdown' ? (t._remaining ?? t.duration) : undefined,
      _status: t.type === 'countdown' && t._status === 'paused' ? 'paused' : 'idle',
      _timer: null,
    };
    if (t.id > maxId) maxId = t.id;
    return task;
  });
  return { tasks, maxId: maxId + 1 };
}
