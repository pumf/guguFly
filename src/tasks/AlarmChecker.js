import { t } from '../i18n/index.js';
import { computeNextAlarmDate, isWithinMinutes } from './TaskUtils.js';
import { getNextSolarFromLunar } from './LunarUtils.js';
import { isSnoozed } from '../flight/Snooze.js';

let alarmInterval = null;
const previewedTasks = new Set();
// Track the last time the alarm check ran. Used to detect system
// sleep/wake where setInterval may have been frozen for a long time.
let lastCheckTime = 0;

let getTasksFn;
let saveTasksFn;
let getCleanTasksFn;
let doTriggerFlightFn;
let showToastFn;
let updateNextUpcomingFn;
let updateMiniWindowFn;
let normalizeRepeatFn;
let isAlarmDueTodayFn;
let renderTasksFn;
let onDateChangeFn;

let prevInProgressIds = new Set();
let lastDate = new Date().toDateString();
let lastStatusRender = 0;

let saveDebounceTimer = null;
function debouncedSave() {
  if (saveDebounceTimer) return;
  saveDebounceTimer = setTimeout(() => {
    saveTasksFn(getCleanTasksFn(getTasksFn()));
    saveDebounceTimer = null;
  }, 2000);
}

export function initAlarmChecker(ctx) {
  getTasksFn = ctx.getTasks;
  saveTasksFn = ctx.saveTasks;
  getCleanTasksFn = ctx.getCleanTasks;
  doTriggerFlightFn = ctx.doTriggerFlight;
  showToastFn = ctx.showToast;
  updateNextUpcomingFn = ctx.updateNextUpcoming;
  updateMiniWindowFn = ctx.updateMiniWindow;
  normalizeRepeatFn = ctx.normalizeRepeat;
  isAlarmDueTodayFn = ctx.isAlarmDueToday;
  renderTasksFn = ctx.renderTasks;
  onDateChangeFn = ctx.onDateChange;
}

export function destroyAlarmChecker() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  previewedTasks.clear();
}

export async function getNextUpcomingTask() {
  const now = new Date();
  let bestTask = null, bestSec = Infinity;
  for (const task of getTasksFn()) {
    if (!task.enabled) continue;
    if (task.type === 'alarm') {
      const target = computeNextAlarmDate(task, now);
      if (!target) continue;
      const diff = Math.round((target - now) / 1000);
      if (diff < bestSec) { bestSec = diff; bestTask = task; }
    } else if (task.type === 'holiday' || task.type === 'anniversary') {
      let target;
      if (task.lunar) {
        const solar = getNextSolarFromLunar(task.month, task.day, now);
        if (!solar) continue;
        target = new Date(solar.year, solar.solarMonth - 1, solar.solarDay, task.hour, task.minute);
        if (target <= now) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const solar2 = getNextSolarFromLunar(task.month, task.day, tomorrow);
          if (!solar2) continue;
          target = new Date(solar2.year, solar2.solarMonth - 1, solar2.solarDay, task.hour, task.minute);
        }
      } else {
        target = new Date(now.getFullYear(), task.month - 1, task.day, task.hour, task.minute);
        if (target <= now) target.setFullYear(target.getFullYear() + 1);
      }
      const diff = Math.round((target - now) / 1000);
      if (diff < bestSec) { bestSec = diff; bestTask = task; }
    } else if (task.type === 'countdown' && task._status === 'running') {
      const diff = Math.max(0, Math.round(task._remaining || 0));
      if (diff < bestSec) { bestSec = diff; bestTask = task; }
    }
  }
  return bestTask ? { task: bestTask, seconds: bestSec, minutes: Math.floor(bestSec / 60) } : null;
}

export function getAllUpcomingTasks() {
  const now = new Date();
  const result = [];
  for (const task of getTasksFn()) {
    if (!task.enabled) continue;
    let diff = null;
    if (task.type === 'alarm') {
      const target = computeNextAlarmDate(task, now);
      if (target) diff = Math.round((target - now) / 1000);
    } else if (task.type === 'holiday' || task.type === 'anniversary') {
      let target;
      if (task.lunar) {
        const solar = getNextSolarFromLunar(task.month, task.day, now);
        if (!solar) continue;
        target = new Date(solar.year, solar.solarMonth - 1, solar.solarDay, task.hour, task.minute);
        if (target <= now) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const solar2 = getNextSolarFromLunar(task.month, task.day, tomorrow);
          if (!solar2) continue;
          target = new Date(solar2.year, solar2.solarMonth - 1, solar2.solarDay, task.hour, task.minute);
        }
      } else {
        target = new Date(now.getFullYear(), task.month - 1, task.day, task.hour, task.minute);
        if (target <= now) target.setFullYear(target.getFullYear() + 1);
      }
      if (target) diff = Math.round((target - now) / 1000);
    } else if (task.type === 'countdown' && task._status === 'running') {
      diff = Math.max(0, Math.round(task._remaining || 0));
    }
    if (diff !== null && diff <= 86400) {
      result.push({ task, seconds: diff, minutes: Math.floor(diff / 60) });
    }
  }
  result.sort((a, b) => a.seconds - b.seconds);
  return result;
}

function checkPreTrigger() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), today = now.toDateString();
  const currentMinutes = h * 60 + m;
  getTasksFn().forEach(task => {
    if (!task.enabled) return;
    if ((task.type === 'alarm' || task.type === 'holiday' || task.type === 'anniversary') && task._lastTriggeredDate === today) return;
    let triggerMin = null, previewKey = null;
    if (task.type === 'alarm') {
      const repeat = normalizeRepeatFn(task);
      if (repeat.type === 'weekly' && (!repeat.days || repeat.days.length === 0)) return;
      if (repeat.type === 'weekly' && !repeat.days.includes(now.getDay())) return;
      triggerMin = task.hour * 60 + task.minute;
    } else if (task.type === 'holiday' || task.type === 'anniversary') {
      if (task.lunar) {
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const solar = getNextSolarFromLunar(task.month, task.day, nowDate);
        if (solar && solar.solarMonth === now.getMonth() + 1 && solar.solarDay === now.getDate()) {
          triggerMin = task.hour * 60 + task.minute;
        }
      } else {
        if (task.month !== now.getMonth() + 1 || task.day !== now.getDate()) return;
        triggerMin = task.hour * 60 + task.minute;
      }
    }
    if (triggerMin == null) return;
    const diff = triggerMin - currentMinutes;
    if (diff <= 0 || diff > 5) return;
    previewKey = `${task.id}-${today}-${triggerMin}`;
    if (previewedTasks.has(previewKey)) return;
    previewedTasks.add(previewKey);
    const label = task.label || (task.type === 'holiday' ? t('task.label.holiday') : t('common.unnamed'));
    showToastFn(t('toast.holiday_reminder', { label, minutes: diff }), 3000);
  });
}

// Check and trigger any alarms due for the current minute.
// Extracted from the setInterval callback so it can also be called
// from the visibilitychange recovery path.
function runAlarmCheck() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), today = now.toDateString();
  getTasksFn().forEach(task => {
    if (!task.enabled) return;
    if (task._lastTriggeredDate === today) return;
    if (isSnoozed(task.id)) return;
    if (task.type === 'alarm') {
      if (isAlarmDueTodayFn(task, now)) {
        task._lastTriggeredDate = today;
        debouncedSave();
        doTriggerFlightFn(task);
      }
    } else if (task.type === 'holiday' || task.type === 'anniversary') {
      let lunarMatch = false;
      if (task.lunar) {
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const solar = getNextSolarFromLunar(task.month, task.day, nowDate);
        if (solar && solar.solarMonth === now.getMonth() + 1 && solar.solarDay === now.getDate()) {
          lunarMatch = true;
        }
      } else {
        lunarMatch = task.month === now.getMonth() + 1 && task.day === now.getDate();
      }
      if (lunarMatch && task.hour === h && task.minute === m) {
        task._lastTriggeredDate = today;
        debouncedSave();
        doTriggerFlightFn(task);
      }
    }
  });
}

// After a long pause (system sleep/wake), iterate through all alarms
// in the missed window and trigger any whose scheduled time has
// passed but is within the last 24 hours. This catches alarms that
// were missed while the timer was frozen.
function runSleepRecovery(fromTime, toTime) {
  if (!fromTime || !toTime || toTime <= fromTime) return;
  const today = new Date().toDateString();
  const maxWindow = 60 * 60 * 1000;
  if (toTime - fromTime > maxWindow) fromTime = toTime - maxWindow;
  const missed = [];
  getTasksFn().forEach(task => {
    if (!task.enabled) return;
    if (task._lastTriggeredDate === today) return;
    // Only recover alarm-type tasks. Holidays and anniversaries are
    // annual/one-shot events that should only trigger through the
    // normal runAlarmCheck path (exact hour:minute match on the
    // correct date). Including them here risks false triggers when
    // the recovery window spans across a date boundary.
    if (task.type !== 'alarm') return;
    const next = computeNextAlarmDate(task, new Date(fromTime));
    if (next && next.getTime() >= fromTime && next.getTime() <= toTime) {
      missed.push(task);
    }
  });
  if (missed.length === 1) {
    doTriggerFlightFn(missed[0]);
  } else if (missed.length > 1) {
    const labels = missed.map(task => task.label || t('common.unnamed')).join('、');
    if (showToastFn) {
      showToastFn(t('toast.missed_alarms', { count: missed.length, labels }), 8000);
    }
  }
}

export function startAlarmChecker() {
  if (alarmInterval) return;
  lastCheckTime = Date.now();

  const today = new Date().toDateString();
  let needsSave = false;
  getTasksFn().forEach(task => {
    if (!task._lastTriggeredDate || task._lastTriggeredDate !== today) return;
    if (task.type === 'holiday' || task.type === 'anniversary') {
      const now = new Date();
      let dateMatches = false;
      if (task.lunar) {
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const solar = getNextSolarFromLunar(task.month, task.day, nowDate);
        if (solar && solar.solarMonth === now.getMonth() + 1 && solar.solarDay === now.getDate()) {
          dateMatches = true;
        }
      } else {
        dateMatches = task.month === now.getMonth() + 1 && task.day === now.getDate();
      }
      if (!dateMatches) {
        task._lastTriggeredDate = null;
        needsSave = true;
      }
    }
  });
  if (needsSave) debouncedSave();

  checkPreTrigger();
  // Recover from any alarms missed before the app was running.
  runSleepRecovery(0, lastCheckTime);
  alarmInterval = setInterval(() => {
    const now = Date.now();
    // If the previous tick was more than 2 minutes ago, the system
    // likely slept. Run a recovery pass to catch missed alarms.
    if (lastCheckTime && now - lastCheckTime > 120000) {
      runSleepRecovery(lastCheckTime, now);
    }
    lastCheckTime = now;

    const todayStr = new Date().toDateString();
    if (todayStr !== lastDate) {
      lastDate = todayStr;
      getTasksFn().forEach(task => { task._lastTriggeredDate = null; });
      debouncedSave();
      if (renderTasksFn) renderTasksFn();
      if (onDateChangeFn) onDateChangeFn();
    }

    runAlarmCheck();
    checkPreTrigger();
    if (renderTasksFn) {
      const newInProgressIds = new Set();
      getTasksFn().forEach(task => {
        if (task.enabled && isWithinMinutes(task, 5)) {
          newInProgressIds.add(task.id);
        }
      });
      let changed = prevInProgressIds.size !== newInProgressIds.size;
      if (!changed) {
        for (const id of prevInProgressIds) {
          if (!newInProgressIds.has(id)) { changed = true; break; }
        }
      }
      if (changed) {
        prevInProgressIds = newInProgressIds;
      }
      if (changed || now - lastStatusRender > 60000) {
        lastStatusRender = now;
        if (renderTasksFn) renderTasksFn();
      }
    }
    updateNextUpcomingFn();
    const allUpcoming = getAllUpcomingTasks();
    updateMiniWindowFn(allUpcoming);
  }, 1000);
}
