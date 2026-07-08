import { t } from '../i18n/index.js';
import { TASK_COLOR_VALUES } from '../tasks/TaskColors.js';
import { getTaskTypeMeta } from '../tasks/TaskFactory.js';
import {
  getTaskStatusLabel, getTaskInfoText, getTaskSortScore,
  getTaskTimeAnchor, getTaskGroupKey, getTaskDetailLines, matchesFilter, formatDuration,
} from '../tasks/TaskUtils.js';
import { openTaskDetailDrawer } from './TaskDetailDrawer.js';
import { isSelectionModeActive, toggleTaskSelection, isTaskSelected } from './BatchOperation.js';

const svgClock = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const svgTimer = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 10"/></svg>';
const svgCal = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const svgHeart = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';

export function renderTasks({
  tasks, taskListEl, holidayPresets, expandedTaskId, toggleTaskExpandedFn,
  openEditModalFn, deleteTaskFn, saveTasks, getCleanTasksFn,
  startCountdownFn, pauseCountdownFn, stopCountdownFn,
  triggerFlightWithModeFn, updateHeroStatusFn,
  renderTasksFn,
  filterType, filterGroup, filterKeyword,
}) {
  const fullCtx = {
    tasks, taskListEl, holidayPresets, expandedTaskId, toggleTaskExpandedFn,
    openEditModalFn, deleteTaskFn, saveTasks, getCleanTasksFn,
    startCountdownFn, pauseCountdownFn, stopCountdownFn,
    triggerFlightWithModeFn, updateHeroStatusFn,
    renderTasksFn,
    filterType, filterGroup, filterKeyword,
  };
  taskListEl.innerHTML = '';

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.task-menu-btn') && !e.target.closest('.task-dropdown')) {
      document.querySelectorAll('.task-dropdown:not(.hidden)').forEach(d => {
        d.classList.add('hidden');
        d.closest('.task-card')?.classList.remove('task-card--menu-open');
      });
    }
  });

  if (tasks.length === 0) {
    taskListEl.innerHTML = `<div class="empty-hint"><span class="big-icon">🛩</span><strong>${t('task.empty.title')}</strong><span>${t('task.empty.desc')}</span></div>`;
    updateHeroStatusFn();
    return;
  }

  const filteredTasks = tasks.filter(t => matchesFilter(t, filterType, filterGroup || 'all', filterKeyword));
  if (filteredTasks.length === 0) {
    taskListEl.innerHTML = `<div class="empty-hint"><span class="big-icon">🔍</span><strong>${t('task.empty.filtered_title')}</strong><span>${t('task.empty.filtered_desc')}</span></div>`;
    updateHeroStatusFn();
    return;
  }

  const orderedTasks = filteredTasks.sort((a, b) => {
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

    const groupMeta = getTaskGroupMeta(groupKey);
    const section = document.createElement('section');
    section.className = `task-group task-group--${groupKey}`;

    const header = document.createElement('div');
    header.className = 'task-group-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'task-group-copy';
    const title = document.createElement('h3');
    title.className = 'task-group-title';
    title.textContent = `${groupMeta.title} (${groupTasks.length})`;
    titleWrap.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'task-group-actions';
    const enableBtn = document.createElement('button');
    enableBtn.className = 'task-group-btn';
    enableBtn.textContent = t('common.enable');
    enableBtn.addEventListener('click', () => setGroupEnabled(groupTasks, true, tasks, saveTasks, getCleanTasksFn, renderTasksFn));
    const disableBtn = document.createElement('button');
    disableBtn.className = 'task-group-btn';
    disableBtn.textContent = t('common.disable');
    disableBtn.addEventListener('click', () => setGroupEnabled(groupTasks, false, tasks, saveTasks, getCleanTasksFn, renderTasksFn));
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
      if (isTaskSelected(task.id)) card.classList.add('selected');

      if (task.color && TASK_COLOR_VALUES[task.color]) {
        const bar = document.createElement('div');
        bar.className = 'task-color-bar';
        bar.style.background = TASK_COLOR_VALUES[task.color];
        card.appendChild(bar);
      }

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'task-toggle';
      toggle.checked = task.enabled;
      toggle.addEventListener('change', (e) => {
        task.enabled = e.target.checked;
        saveTasks(getCleanTasksFn(tasks));
        renderTasksFn();
      });
      toggle.addEventListener('click', (e) => e.stopPropagation());

      const icon = document.createElement('span');
      icon.className = 'task-icon';
      icon.innerHTML = task.type === 'alarm' ? svgClock : task.type === 'countdown' ? svgTimer : task.type === 'holiday' ? svgCal : svgHeart;

      const body = document.createElement('div');
      body.className = 'task-body';

      const labelRow = document.createElement('div');
      labelRow.className = 'task-label-row';

      const label = document.createElement('span');
      label.className = 'task-label';
      label.textContent = task.label || (task.type === 'alarm' ? t('task.label.alarm') : task.type === 'countdown' ? t('task.label.countdown') : task.type === 'holiday' ? t('task.label.holiday') : t('task.label.anniversary'));
      labelRow.appendChild(label);

      const typeBadge = document.createElement('span');
      typeBadge.className = `task-badge task-badge--${typeMeta.className}`;
      typeBadge.textContent = typeMeta.label;
      labelRow.appendChild(typeBadge);

      const statusBadge = document.createElement('span');
      statusBadge.className = 'task-status-badge';
      statusBadge.textContent = getTaskStatusLabel(task);
      labelRow.appendChild(statusBadge);

      body.appendChild(labelRow);

      const infoRow = document.createElement('div');
      infoRow.className = 'task-info-row';

      const info = document.createElement('span');
      info.className = 'task-info';
      info.textContent = getTaskInfoText(task, holidayPresets);
      infoRow.appendChild(info);

      if (task.group) {
        const groupMap = { work: '💼', health: '💚', life: '🏠', other: '📌' };
        const groupNames = { work: t('task.group.work'), health: t('task.group.health'), life: t('task.group.life'), other: t('task.group.other') };
        const sep = document.createElement('span');
        sep.className = 'task-info-sep';
        sep.textContent = '·';
        infoRow.appendChild(sep);
        const gb = document.createElement('span');
        gb.className = 'task-badge task-badge--group';
        gb.textContent = `${groupMap[task.group] || ''} ${groupNames[task.group] || task.group}`;
        infoRow.appendChild(gb);
      }

      if (task.imageData && task.useImage) {
        const imgBadge = document.createElement('span');
        imgBadge.className = 'task-image-badge';
        imgBadge.title = t('task.detail.custom_image');
        imgBadge.textContent = '🖼';
        infoRow.appendChild(imgBadge);
      }

      body.appendChild(infoRow);

      if (expandedTaskId === task.id) {
        const details = buildTaskDetails(task, holidayPresets, openEditModalFn);
        body.appendChild(details);
      }

      const actionsEl = document.createElement('div');
      actionsEl.className = 'task-actions';

      const expandBtn = document.createElement('button');
      expandBtn.className = 'task-expand-btn';
      expandBtn.title = expandedTaskId === task.id ? t('btn.toggle_detail_collapse_title') : t('btn.toggle_detail_title');
      expandBtn.textContent = expandedTaskId === task.id ? t('btn.toggle_detail_collapse') : t('btn.toggle_detail');
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskExpandedFn(task.id);
      });
      actionsEl.appendChild(expandBtn);

      if (task.type === 'countdown') {
        const statusEl = document.createElement('span');
        statusEl.className = 'task-countdown-status';
        actionsEl.appendChild(statusEl);

        const playBtn = document.createElement('button');
        playBtn.className = 'task-play-btn';
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (task._status === 'running') {
            pauseCountdownFn(task);
          } else {
            startCountdownFn(task);
          }
        });
        actionsEl.appendChild(playBtn);

        updateCountdownActionUI(task, actionsEl);
      }

      const menuBtn = document.createElement('button');
      menuBtn.className = 'task-menu-btn';
      menuBtn.innerHTML = '⋯';
      menuBtn.title = t('btn.more');

      const dropdown = document.createElement('div');
      dropdown.className = 'task-dropdown hidden';

      const addMenuItem = (label, icon, onClick, className) => {
        const item = document.createElement('button');
        item.className = `task-dropdown-item${className ? ' ' + className : ''}`;
        item.innerHTML = `<span class="task-dropdown-icon">${icon}</span><span>${label}</span>`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.add('hidden');
          onClick();
        });
        dropdown.appendChild(item);
      };

      addMenuItem(t('btn.copy'), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>', () => {
        copyTask(task, tasks, saveTasks, getCleanTasksFn, renderTasksFn);
      });

      addMenuItem(t('btn.takeoff'), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>', () => {
        if (!task.enabled) {
          task.enabled = true;
          saveTasks(getCleanTasksFn(tasks));
        }
        if (task.type === 'countdown') {
          if (task._status === 'running' || task._status === 'paused') stopCountdownFn(task);
          task._status = 'completed';
        }
        renderTasks(fullCtx);
        triggerFlightWithModeFn(task);
      });

      if (task.type === 'countdown') {
        addMenuItem(t('btn.add_5min'), '<span style="font-weight:700">+5</span>', () => {
          addTimeToCountdown(task, 5 * 60, tasks, saveTasks, getCleanTasksFn, renderTasksFn);
        });
        addMenuItem(t('btn.add_10min'), '<span style="font-weight:700">+10</span>', () => {
          addTimeToCountdown(task, 10 * 60, tasks, saveTasks, getCleanTasksFn, renderTasksFn);
        });
        addMenuItem(t('btn.stop'), '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>', () => {
          stopCountdownFn(task);
        });
        addMenuItem(t('btn.repeat'), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>', () => {
          repeatCountdown(task);
        });
      }

      addMenuItem(t('common.delete'), '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', () => {
        deleteTaskFn(task);
      }, 'task-dropdown-item--danger');

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.task-dropdown:not(.hidden)').forEach(d => {
          d.classList.add('hidden');
          d.closest('.task-card')?.classList.remove('task-card--menu-open');
        });
        const isOpening = dropdown.classList.toggle('hidden');
        card.classList.toggle('task-card--menu-open', !isOpening);
      });

      actionsEl.appendChild(menuBtn);
      actionsEl.appendChild(dropdown);

      card.appendChild(toggle);
      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(actionsEl);

      card.addEventListener('click', () => {
        if (isSelectionModeActive()) {
          toggleTaskSelection(task.id);
          card.classList.toggle('selected', isTaskSelected(task.id));
        } else {
          openTaskDetailDrawer(task, { onEdit: openEditModalFn, onCopy: null });
        }
      });
      card.addEventListener('dblclick', () => openEditModalFn(task));
      card.draggable = true;
      card.setAttribute('data-task-id', task.id);
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => { card.style.opacity = ''; });
      card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.opacity = '';
        const fromId = e.dataTransfer.getData('text/plain');
        if (!fromId || fromId === String(task.id)) return;
        const fromIdx = tasks.findIndex(t => String(t.id) === fromId);
        const toIdx = tasks.findIndex(t => t === task);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = tasks.splice(fromIdx, 1);
        tasks.splice(toIdx, 0, moved);
        saveTasks(getCleanTasksFn(tasks));
        renderTasks(fullCtx);
      });

      section.appendChild(card);
    });

    taskListEl.appendChild(section);
  });

  updateHeroStatusFn();
}

function updateCountdownActionUI(task, actionsEl) {
  if (!actionsEl) return;
  const statusEl = actionsEl.querySelector('.task-countdown-status');
  const playBtn = actionsEl.querySelector('.task-play-btn');

  const isRunning = task._status === 'running';
  const isPaused = task._status === 'paused';

  if (statusEl) {
    statusEl.classList.remove('running');
    if (isRunning) {
      statusEl.textContent = formatDuration(task._remaining);
      statusEl.classList.add('running');
    } else if (isPaused) {
      statusEl.textContent = t('duration.paused_at', { time: formatDuration(task._remaining) });
    } else {
      statusEl.textContent = '';
    }
  }

  if (playBtn) {
    playBtn.classList.remove('active');
    if (isRunning) {
      playBtn.classList.add('active');
      playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      playBtn.title = t('btn.pause');
    } else {
      playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      playBtn.title = isPaused ? t('btn.resume') : t('btn.start');
    }
  }
}

export function updateCountdownTaskUI(task, renderCtx) {
  if (task.type !== 'countdown') return;
  const card = renderCtx.taskListEl.querySelector(`[data-task-id="${task.id}"]`);
  if (!card) return;

  card.classList.toggle('active', task._status === 'running');
  card.classList.toggle('completed', task._status === 'completed');

  const infoEl = card.querySelector('.task-info');
  const statusBadge = card.querySelector('.task-status-badge');

  if (infoEl) infoEl.textContent = getTaskInfoText(task, renderCtx.holidayPresets);
  if (statusBadge) statusBadge.textContent = getTaskStatusLabel(task);

  updateCountdownActionUI(task, card.querySelector('.task-actions'));
}

function setGroupEnabled(groupTasks, enabled, tasks, saveTasks, getCleanTasksFn, renderTasksFn) {
  groupTasks.forEach(task => {
    task.enabled = enabled;
  });
  saveTasks(getCleanTasksFn(tasks));
  renderTasksFn?.();
}

function getTaskGroupMeta(groupKey) {
  const labels = {
    in_progress: { title: t('task.section.about_to_takeoff'), subtitle: '' },
    upcoming: { title: t('task.section.upcoming'), subtitle: '' },
    special_dates: { title: t('task.section.special_dates'), subtitle: '' },
    disabled: { title: t('task.section.disabled'), subtitle: '' },
  };
  return labels[groupKey];
}

function buildTaskDetails(task, holidayPresets, openEditModalFn) {
  const details = document.createElement('div');
  details.className = 'task-details';
  getTaskDetailLines(task, holidayPresets).forEach(line => {
    const detail = document.createElement('div');
    detail.className = 'task-detail-line';
    detail.textContent = line;
    details.appendChild(detail);
  });
  const detailActions = document.createElement('div');
  detailActions.className = 'task-detail-actions';
  const quickEditBtn = document.createElement('button');
  quickEditBtn.className = 'task-detail-btn';
  quickEditBtn.textContent = t('btn.quick_edit');
  quickEditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModalFn(task);
  });
  detailActions.appendChild(quickEditBtn);
  details.appendChild(detailActions);
  return details;
}

export function updateTaskToggleUI(task) {
  const card = document.querySelector(`[data-task-id="${task.id}"]`);
  if (!card) return;
  const badge = card.querySelector('.task-status-badge');
  if (badge) badge.textContent = getTaskStatusLabel(task);
}

export function toggleTaskExpandedCard(prevExpandedId, newExpandedId, ctx) {
  const container = ctx.taskListEl;
  if (prevExpandedId !== null && prevExpandedId !== newExpandedId) {
    const card = container.querySelector(`[data-task-id="${prevExpandedId}"]`);
    if (card) {
      const body = card.querySelector('.task-body');
      const details = body?.querySelector('.task-details');
      if (details) details.remove();
      const btn = card.querySelector('.task-expand-btn');
      if (btn) { btn.textContent = t('btn.toggle_detail'); btn.title = t('btn.toggle_detail_title'); }
    }
  }
  if (newExpandedId !== null && newExpandedId !== prevExpandedId) {
    const card = container.querySelector(`[data-task-id="${newExpandedId}"]`);
    if (card) {
      const body = card.querySelector('.task-body');
      if (body && !body.querySelector('.task-details')) {
        const task = ctx.tasks.find(t => String(t.id) === String(newExpandedId));
        if (task) {
          body.appendChild(buildTaskDetails(task, ctx.holidayPresets, ctx.openEditModalFn));
        }
      }
      const btn = card.querySelector('.task-expand-btn');
      if (btn) { btn.textContent = t('btn.toggle_detail_collapse'); btn.title = t('btn.toggle_detail_collapse_title'); }
    }
  }
}

function copyTask(task, tasks, saveTasks, getCleanTasksFn, renderTasksFn) {
  const copy = JSON.parse(JSON.stringify(task));
  copy.id = Date.now();
  copy.label = `${task.label} ${t('task.copy_suffix')}`;
  copy.enabled = true;
  if (copy._status === 'running' || copy._status === 'paused') {
    copy._status = 'idle';
    copy._remaining = copy.duration;
  }
  copy._lastTriggeredDate = null;
  copy._flightRemaining = undefined;
  tasks.push(copy);
  saveTasks(getCleanTasksFn(tasks));
  renderTasksFn();
}

function addTimeToCountdown(task, seconds, tasks, saveTasks, getCleanTasksFn, renderTasksFn) {
  if (task.type !== 'countdown') return;
  if (task._status !== 'running' && task._status !== 'paused') return;
  task._remaining = (task._remaining || 0) + seconds;
  task.duration = (task.duration || 0) + seconds;
  if (task._timer) {
    task._timer.durationMs = (task._timer.durationMs || task._timer.remaining || 0) + seconds * 1000;
    if (task._status === 'running') task._timer.forceUpdate();
  }
  saveTasks(getCleanTasksFn(tasks));
  renderTasksFn();
}

function repeatCountdown(task) {
  if (task.type !== 'countdown') return;
  task._remaining = task.duration;
  task._status = 'idle';
}
