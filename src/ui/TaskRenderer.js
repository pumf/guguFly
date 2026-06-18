import { TASK_COLOR_VALUES } from '../tasks/TaskColors.js';
import { getTaskTypeMeta } from '../tasks/TaskFactory.js';
import {
  getTaskStatusLabel, getTaskInfoText, getTaskSortScore,
  getTaskTimeAnchor, getTaskGroupKey, getTaskDetailLines, matchesFilter, formatDuration,
} from '../tasks/TaskUtils.js';

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

  if (tasks.length === 0) {
    taskListEl.innerHTML = '<div class="empty-hint"><span class="big-icon">🛩</span><strong>任务列表会展示在这里</strong><span>暂无任务，点击「新建任务」开始添加提醒。</span></div>';
    updateHeroStatusFn();
    return;
  }

  const filteredTasks = tasks.filter(t => matchesFilter(t, filterType, filterGroup || 'all', filterKeyword));
  if (filteredTasks.length === 0) {
    taskListEl.innerHTML = '<div class="empty-hint"><span class="big-icon">🔍</span><strong>没有匹配的任务</strong><span>试试别的关键词，或清除筛选条件。</span></div>';
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
    enableBtn.textContent = '全部启用';
    enableBtn.addEventListener('click', () => setGroupEnabled(groupTasks, true, tasks, saveTasks, getCleanTasksFn, renderTasksFn));
    const disableBtn = document.createElement('button');
    disableBtn.className = 'task-group-btn';
    disableBtn.textContent = '全部停用';
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
      label.textContent = task.label || (task.type === 'alarm' ? '闹钟' : task.type === 'countdown' ? '倒计时' : task.type === 'holiday' ? '节日' : '纪念日');
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
        const groupNames = { work: '工作', health: '健康', life: '生活', other: '其他' };
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
        imgBadge.title = '此任务使用自定义图片';
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
      expandBtn.title = expandedTaskId === task.id ? '收起详情' : '展开详情';
      expandBtn.textContent = expandedTaskId === task.id ? '收起' : '详情';
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

        const stopBtn = document.createElement('button');
        stopBtn.className = 'task-stop-btn';
        stopBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
        stopBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          stopCountdownFn(task);
        });
        actionsEl.appendChild(stopBtn);

        updateCountdownActionUI(task, actionsEl);
      }

      const takeoffBtn = document.createElement('button');
      takeoffBtn.className = 'task-takeoff-btn';
      takeoffBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
      takeoffBtn.title = '马上起飞';
      takeoffBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
      actionsEl.appendChild(takeoffBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'task-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = '删除';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTaskFn(task);
      });
      actionsEl.appendChild(delBtn);

      card.appendChild(toggle);
      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(actionsEl);

      card.addEventListener('click', () => toggleTaskExpandedFn(task.id));
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
    in_progress: { title: '正在进行', subtitle: '' },
    upcoming: { title: '近期提醒', subtitle: '' },
    special_dates: { title: '特殊日期', subtitle: '' },
    disabled: { title: '已停用', subtitle: '' },
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
  quickEditBtn.textContent = '快速编辑';
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
      if (btn) { btn.textContent = '详情'; btn.title = '展开详情'; }
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
      if (btn) { btn.textContent = '收起'; btn.title = '收起详情'; }
    }
  }
}
