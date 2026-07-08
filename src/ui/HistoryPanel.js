import { t, ta } from '../i18n/index.js';

let _weekdayLabels = null;
function getWeekdayLabels() {
  if (!_weekdayLabels) _weekdayLabels = ta('calendar.day_labels');
  return _weekdayLabels;
}

let tasks = [];

export function setHistoryTasks(taskList) {
  tasks = taskList;
}

export function renderTaskHistory(stats, flightLog) {
  const container = document.getElementById('taskHistoryPanel');
  if (!container) return;

  const taskEntries = Object.entries(stats.taskTotals).sort((a, b) => b[1] - a[1]);
  if (taskEntries.length === 0) {
    container.innerHTML = `<div style="padding:16px;color:#b2bec3;font-size:13px;text-align:center">${t('history.no_triggers')}</div>`;
    return;
  }

  const dailyMap = buildDailyTaskMap(flightLog);

  container.innerHTML = taskEntries.map(([taskId, total]) => {
    const task = tasks.find(t => String(t.id) === String(taskId));
    const label = task ? (task.label || t('common.unnamed')) : `#${taskId}`;
    const typeIcon = getTypeIcon(task?.type);
    const dailyCounts = dailyMap.get(taskId) || [];

    const bars = dailyCounts.map(c => {
      const h = c > 0 ? Math.max(3, c * 6) : 0;
      return `<div class="hist-bar${c > 0 ? '' : ' is-empty'}" style="height:${h}px" title="${c} ${t('history.count')}"></div>`;
    }).join('');

    return `
      <div class="hist-task-row" data-task-id="${taskId}">
        <div class="hist-task-head">
          <span class="hist-task-icon">${typeIcon}</span>
          <span class="hist-task-label">${label}</span>
          <span class="hist-task-count">${total} ${t('history.count')}</span>
        </div>
        ${dailyCounts.length > 0 ? `
        <div class="hist-daily-row">
          <div class="hist-daily-bars">${bars}</div>
          <div class="hist-day-labels">
            ${dailyCounts.map((c, i) => `<span class="hist-day-label${c > 0 ? '' : ' is-empty'}">${getWeekdayLabels()[i]}</span>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
  }).join('');
}

function buildDailyTaskMap(flightLog) {
  const taskIds = new Set();
  const today = new Date();
  const dayKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayKeys.push(key);
  }
  for (const entry of flightLog) {
    if (entry.byTask) {
      for (const taskId of Object.keys(entry.byTask)) {
        taskIds.add(taskId);
      }
    }
  }
  const map = new Map();
  for (const taskId of taskIds) {
    map.set(taskId, dayKeys.map(key => {
      const day = flightLog.find(e => e.date === key);
      return day?.byTask?.[taskId] || 0;
    }));
  }
  return map;
}

function getTypeIcon(type) {
  return { alarm: '⏰', countdown: '⏳', holiday: '🎉', anniversary: '❤️' }[type] || '📋';
}
