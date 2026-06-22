import { computeNextAlarmDate } from './TaskUtils.js';
import { getNextSolarFromLunar } from './LunarUtils.js';

let alarmInterval = null;
const previewedTasks = new Set();

let getTasksFn;
let saveTasksFn;
let getCleanTasksFn;
let doTriggerFlightFn;
let showToastFn;
let updateNextUpcomingFn;
let updateMiniWindowFn;
let normalizeRepeatFn;
let isAlarmDueTodayFn;

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
    const label = task.label || (task.type === 'holiday' ? '节日' : '提醒');
    showToastFn(`⏰ ${label} · ${diff} 分钟后起飞`, 3000);
  });
}

export function startAlarmChecker() {
  if (alarmInterval) return;
  checkPreTrigger();
  alarmInterval = setInterval(() => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), today = now.toDateString();
    getTasksFn().forEach(task => {
      if (!task.enabled) return;
      if (task._lastTriggeredDate === today) return;
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
    checkPreTrigger();
    updateNextUpcomingFn();
    updateMiniWindowFn(getNextUpcomingTask);
  }, 1000);
}
