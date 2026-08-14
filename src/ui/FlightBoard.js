import { t } from '../i18n/index.js';
import { escapeHtml } from '../utils.js';
import { isSnoozed, getSnoozedUntil } from '../flight/Snooze.js';

let onFlightAction = null;
let flightBoardState = {};

const STATUS_ORDER = { boarding: 0, ontime: 0, hold: 1, delayed: 2, done: 3, off: 4 };
const BOARDING_SECS = 300; // 5 min before → boarding status

export function initFlightBoard(ctx) {
  onFlightAction = ctx.onFlightAction || null;
}

/**
 * @param {Array} tasks
 * @param {HTMLElement} container
 * @param {Object} opts
 * @param {Array} opts.upcomingList - result of getAllUpcomingTasks()
 * @param {string} opts.filterKeyword
 * @param {string} opts.filterType - all / alarm / countdown / holiday / anniversary
 * @param {string} opts.filterGroup - all / upcoming / special / disabled
 * @param {boolean} opts.boardMode - true→fully replace old list with board; false→don't render board
 */
export function renderFlightBoard(tasks, container, opts = {}) {
  if (!container || !tasks) return;

  flightBoardState = opts;

  // Apply filters
  let rendered = [...tasks];
  const fw = (opts.filterKeyword || '').trim().toLowerCase();
  if (fw) {
    rendered = rendered.filter(t =>
      (t.label || '').toLowerCase().includes(fw) ||
      (t.msg || '').toLowerCase().includes(fw),
    );
  }
  if (opts.filterType && opts.filterType !== 'all') {
    rendered = rendered.filter(t => t.type === opts.filterType);
  }
  if (opts.filterGroup === 'disabled') {
    rendered = rendered.filter(t => t.enabled === false);
  } else if (opts.filterGroup === 'special') {
    rendered = rendered.filter(t => t.enabled !== false && (t.type === 'holiday' || t.type === 'anniversary'));
  } else if (opts.filterGroup === 'upcoming') {
    rendered = rendered.filter(t => t.enabled !== false && t._status !== 'completed');
    // Upcoming = sort by closest trigger, keep top
  } else {
    rendered = rendered.filter(t => t.enabled !== false || opts.filterGroup === 'all');
  }

  if (rendered.length === 0) {
    container.innerHTML = `<div class="flight-empty" style="text-align:center;padding:48px 20px;color:var(--text-3)">
      <div style="font-size:40px;margin-bottom:14px">🛫</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">${t('flight.no_flights')}</div>
      <div style="font-size:12px">${t('flight.no_flights_hint')}</div>
    </div>`;
    return;
  }

  // Compute upcoming lookup map for remaining seconds
  const upcomingMap = new Map();
  if (opts.upcomingList) {
    for (const u of opts.upcomingList) {
      upcomingMap.set(u.task.id, u.seconds);
    }
  }

  const sorted = sortTasksByStatus(rendered, upcomingMap);
  container.innerHTML = sorted.map((task, i) => renderFlightRow(task, i, upcomingMap)).join('');

  container.querySelectorAll('.flight-row').forEach(row => {
    const taskId = Number(row.dataset.taskId);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    row.querySelector('.op-fly')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlightAction?.('fly', task);
    });

    row.querySelector('.op-restore')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlightAction?.('restore', task);
    });

    row.querySelector('.op-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlightAction?.('toggle', task);
    });

    row.querySelector('.op-postpone')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlightAction?.('postpone', task);
    });

    row.querySelector('.op-detail')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlightAction?.('menu', task, e.currentTarget);
    });

    row.addEventListener('dblclick', () => {
      onFlightAction?.('edit', task);
    });
  });
}

function getTaskStatus(task, upcomingMap) {
  if (task.enabled === false) return 'off';
  if (task._status === 'completed') return 'done';
  if (isSnoozed(task.id)) return 'delayed';
  const remaining = upcomingMap.get(task.id);
  if (remaining != null && remaining <= BOARDING_SECS) return 'boarding';
  // Not in upcoming list but enabled → far future (hold 候机中)
  if (remaining == null && task.type !== 'countdown') return 'hold';
  return 'ontime';
}

function sortTasksByStatus(tasks, upcomingMap) {
  return [...tasks].sort((a, b) => {
    const sa = getTaskStatus(a, upcomingMap);
    const sb = getTaskStatus(b, upcomingMap);
    const oa = STATUS_ORDER[sa] != null ? STATUS_ORDER[sa] : 5;
    const ob = STATUS_ORDER[sb] != null ? STATUS_ORDER[sb] : 5;
    if (oa !== ob) return oa - ob;
    // Within same status, sort by remaining ascending
    const ra = upcomingMap.get(a.id) ?? 999999;
    const rb = upcomingMap.get(b.id) ?? 999999;
    return ra - rb;
  });
}

function renderFlightRow(task, index, upcomingMap) {
  const status = getTaskStatus(task, upcomingMap);
  const flightNo = `GG${String(task.id).slice(-4).padStart(4, '0')}`;
  const timeStr = getTaskTimeStr(task, upcomingMap);
  const msgStr = escapeHtml(task.msg || '');
  const labelStr = escapeHtml(task.label || '');
  const typeLabel = taskTypeName(task.type);

  const statusClasses = {
    boarding: 'status boarding',
    ontime: 'status ontime',
    hold: 'status ontime',
    delayed: 'status delayed',
    done: 'status done',
    off: 'status off',
  };
  const tagClasses = {
    alarm: 'tag tag-alarm',
    countdown: 'tag tag-countdown',
    holiday: 'tag tag-holiday',
    anniversary: 'tag tag-anniversary',
  };
  const rowClasses = { off: ' cancelled', delayed: ' delayed' };
  const enabled = task.enabled !== false;
  const toggleIcon = enabled ? '⏻' : '⏼';
  const toggleTitle = enabled ? t('flight.disable') : t('flight.enable');

  return `
    <div class="flight-row${rowClasses[status] || ''}"
         data-task-id="${task.id}" data-status="${status}"
         style="animation-delay:${index * 0.06}s">
      <button class="op-toggle${enabled ? '' : ' off'}" title="${toggleTitle}" data-action="toggle">${toggleIcon}</button>
      <div class="fno-cell">
        <div class="fno-code">${flightNo}</div>
        <div class="ftime">${timeStr}</div>
      </div>
      <div class="fmain">
        <div class="fdest">${labelStr} <span class="${tagClasses[task.type] || tagClasses.alarm}">${typeLabel}</span></div>
        ${msgStr ? `<div class="fmsg">${escapeHtml(msgStr)}</div>` : ''}
      </div>
      <span class="${statusClasses[status] || statusClasses.ontime}">${getStatusText(status, task, upcomingMap)}</span>
      <div class="row-ops">
        ${status === 'off' ? `<button class="op-btn op-restore" title="${t('flight.restore')}">↺</button>` : ''}
        ${status !== 'off' ? `<button class="op-btn op-fly" title="${t('flight.board')}">▶</button>` : ''}
        ${status !== 'off' && status !== 'done' ? `<button class="op-btn op-postpone" title="${getPostponeTitle(task)}">⏸</button>` : ''}
        <button class="op-btn op-detail" title="${t('flight.detail')}">⋯</button>
      </div>
    </div>
  `;
}

function taskTypeName(type) {
  const map = { alarm: t('task.type.alarm'), countdown: t('task.type.countdown'), holiday: t('task.type.holiday'), anniversary: t('task.type.anniversary') };
  return map[type] || '';
}

function getPostponeTitle(task) {
  if (task.type === 'countdown') {
    return task._status === 'running' ? t('countdown.pause') : t('countdown.start');
  }
  return t('flight.postpone');
}

function getTaskTimeStr(task, upcomingMap) {
  const remaining = upcomingMap.get(task.id);
  if (task.type === 'countdown') {
    if (task._status === 'completed') return t('flight.done');
    const dur = task._remaining || task.duration || 0;
    return formatDuration(dur);
  }
  if (task.type === 'holiday' || task.type === 'anniversary') {
    if (remaining != null && remaining < 86400) {
      return formatRelativeTime(remaining);
    }
    return `${task.month}/${task.day}`;
  }
  // alarm
  if (task.hour != null && task.minute != null) {
    if (remaining != null && remaining < 86400) {
      return formatRelativeTime(remaining, task.hour, task.minute);
    }
    return `${task.hour}:${String(task.minute).padStart(2, '0')}`;
  }
  return '—';
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m > 0 ? String(m).padStart(2, '0') + 'min' : ''}`;
}

function formatRelativeTime(seconds, taskHour, taskMin) {
  if (seconds <= 60) return t('flight.less_1min');
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('flight.min_unit')}`;
  // For tasks with hour/minute, show context-aware today/tomorrow
  if (taskHour != null && taskMin != null) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), taskHour, taskMin);
    const daysAhead = Math.round((today - now) / 86400000);
    const hm = `${String(taskHour).padStart(2, '0')}:${String(taskMin).padStart(2, '0')}`;
    if (daysAhead <= 0) return `${t('flight.today')} ${hm}`;
    if (daysAhead === 1) return `${t('flight.tomorrow')} ${hm}`;
    if (daysAhead === 2) return `${t('flight.day_after')} ${hm}`;
    if (daysAhead < 7) return `${daysAhead}${t('flight.day_unit')}${hm}`;
    return hm;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h${m > 0 ? m + t('flight.min_unit') : ''}`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d}${t('flight.day_unit')}`;
}

function getStatusText(status, task, upcomingMap) {
  switch (status) {
    case 'boarding': return t('flight.boarding');
    case 'ontime': return t('flight.ontime');
    case 'hold': return t('flight.hold');
    case 'delayed': {
      const until = getSnoozedUntil(task.id);
      if (until) {
        const minLeft = Math.ceil((until - Date.now()) / 60000);
        return t('flight.delayed_snooze', { min: minLeft > 0 ? minLeft : 1 });
      }
      return t('flight.delayed');
    }
    case 'done': return t('flight.done');
    case 'off': return t('flight.cancelled');
    default: return '';
  }
}
