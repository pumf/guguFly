import { t, ta } from '../i18n/index.js';
import { getTaskTypeMeta } from '../tasks/TaskFactory.js';
import { getTaskDetailLines, getTaskStatusLabel, formatDuration } from '../tasks/TaskUtils.js';
import { loadFlightLog } from '../storage.js';

function labelOnly(key) {
  return t(key).replace(/\s*[：:]\s*\{\{[^}]+\}\}$/, '');
}

let drawerEl;
let overlayEl;
let closeBtn;
let iconEl;
let titleEl;
let infoEl;
let statsEl;
let editBtn;
let copyBtn;
let currentTask = null;
let onEditFn = null;
let onCopyFn = null;

export function initTaskDetailDrawer(ctx) {
  drawerEl = document.getElementById('taskDetailDrawer');
  overlayEl = document.getElementById('taskDetailDrawerOverlay');
  closeBtn = document.getElementById('taskDetailDrawerClose');
  iconEl = document.getElementById('taskDetailDrawerIcon');
  titleEl = document.getElementById('taskDetailDrawerTitle');
  infoEl = document.getElementById('taskDetailDrawerInfo');
  statsEl = document.getElementById('taskDetailDrawerStats');
  editBtn = document.getElementById('taskDetailDrawerEdit');
  copyBtn = document.getElementById('taskDetailDrawerCopy');
  onEditFn = ctx.onEdit;
  onCopyFn = ctx.onCopy;

  overlayEl?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  editBtn?.addEventListener('click', () => {
    if (currentTask && onEditFn) {
      onEditFn(currentTask);
      closeDrawer();
    }
  });
  copyBtn?.addEventListener('click', () => {
    if (currentTask && onCopyFn) {
      onCopyFn(currentTask);
      closeDrawer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawerEl?.classList.contains('hidden')) {
      closeDrawer();
    }
  });
}

export function openTaskDetailDrawer(task, ctx) {
  if (!drawerEl || !task) return;
  currentTask = task;

  const typeMeta = getTaskTypeMeta(task);
  const typeIcons = { alarm: '⏰', countdown: '⏱', holiday: '📅', anniversary: '💝' };
  iconEl.textContent = typeIcons[task.type] || '📋';
  titleEl.textContent = task.label || t('common.unnamed_task');

  infoEl.innerHTML = '';
  const infoItems = [
    { label: labelOnly('task.detail.type'), value: typeMeta.label },
    { label: labelOnly('task.detail.status'), value: getTaskStatusLabel(task) },
  ];

  if (task.type === 'alarm') {
    const repeat = task.repeat;
    if (repeat?.type === 'daily') {
      infoItems.push({ label: labelOnly('task.detail.repeat'), value: t('task.status.everyday') });
    } else if (repeat?.type === 'weekly' && repeat.days?.length > 0) {
      const dayNames = ta('calendar.day_labels');
      infoItems.push({ label: labelOnly('task.detail.repeat'), value: repeat.days.map(d => dayNames[d]).join('/') });
    } else if (repeat?.type === 'monthly_date') {
      infoItems.push({ label: labelOnly('task.detail.repeat'), value: t('repeat.monthly_date', { day: repeat.day }) });
    } else if (repeat?.type === 'yearly') {
      infoItems.push({ label: labelOnly('task.detail.repeat'), value: t('repeat.yearly') });
    } else if (repeat?.type === 'interval') {
      infoItems.push({ label: labelOnly('task.detail.repeat'), value: t('repeat.interval', { interval: repeat.interval }) });
    }
    infoItems.push({ label: labelOnly('task.detail.remind_time'), value: `${String(task.hour).padStart(2, '0')}:${String(task.minute).padStart(2, '0')}` });
  } else if (task.type === 'countdown') {
    infoItems.push({ label: labelOnly('task.detail.duration'), value: formatDuration(task.duration) });
    if (task._remaining != null && task._remaining > 0) {
      infoItems.push({ label: labelOnly('task.detail.remaining'), value: formatDuration(task._remaining) });
    }
  } else if (task.type === 'holiday' || task.type === 'anniversary') {
    infoItems.push({ label: labelOnly('task.detail.date'), value: `${task.month}/${task.day}` });
    infoItems.push({ label: labelOnly('task.detail.remind_time'), value: `${String(task.hour).padStart(2, '0')}:${String(task.minute).padStart(2, '0')}` });
  }

  if (task.msg) {
    infoItems.push({ label: labelOnly('task.detail.msg'), value: task.msg });
  }
  if (task.group) {
    const groupNames = { work: t('task.group.work'), health: t('task.group.health'), life: t('task.group.life'), other: t('task.group.other') };
    infoItems.push({ label: labelOnly('task.detail.group'), value: groupNames[task.group] || task.group });
  }

  infoItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'task-drawer-info-item';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'task-drawer-info-label';
    labelSpan.textContent = item.label;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'task-drawer-info-value';
    valueSpan.textContent = item.value;
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    infoEl.appendChild(row);
  });

  statsEl.innerHTML = `<div class="task-drawer-stats-title">${t('stats.flight_count')}</div><div class="task-drawer-stats-value">${t('stats.loading')}</div>`;
  
  loadFlightLog().then(log => {
    let triggerCount = 0;
    if (Array.isArray(log)) {
      log.forEach(day => {
        if (day.byTask && day.byTask[task.id]) {
          triggerCount += day.byTask[task.id];
        }
      });
    }
    statsEl.innerHTML = `
      <div class="task-drawer-stats-title">${t('stats.flight_count')}</div>
      <div class="task-drawer-stats-value">${t('stats.times', { count: triggerCount })}</div>
    `;
  }).catch((err) => {
    console.error('loadFlightLog failed:', err);
    statsEl.innerHTML = `
      <div class="task-drawer-stats-title">${t('stats.flight_count')}</div>
      <div class="task-drawer-stats-value">${t('stats.times', { count: 0 })}</div>
    `;
  });

  drawerEl.classList.remove('hidden');
}

export function closeDrawer() {
  if (drawerEl) {
    drawerEl.classList.add('hidden');
    currentTask = null;
  }
}

export function isDrawerOpen() {
  return !drawerEl?.classList.contains('hidden');
}

export function refreshDrawer() {
  if (currentTask && !drawerEl?.classList.contains('hidden')) {
    openTaskDetailDrawer(currentTask, { onEdit: onEditFn, onCopy: onCopyFn });
  }
}
