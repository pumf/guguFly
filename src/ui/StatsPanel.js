import { t, ta } from '../i18n/index.js';

const STATS_TYPE_LABELS = {
  alarm: () => t('task.type.alarm'),
  countdown: () => t('task.type.countdown'),
  holiday: () => t('task.type.holiday'),
  anniversary: () => t('task.type.anniversary'),
};

let tasks = [];

export function setStatsTasks(taskList) {
  tasks = taskList;
}

export function computeAchievements(stats) {
  const badges = [];
  if (stats.totalCount >= 1) badges.push({ icon: '🛫', name: t('achievement.first_flight'), desc: t('achievement.first_flight_desc') });
  if (stats.totalCount >= 10) badges.push({ icon: '✈️', name: t('achievement.new_star'), desc: t('achievement.new_star_desc') });
  if (stats.totalCount >= 100) badges.push({ icon: '🚀', name: t('achievement.century'), desc: t('achievement.century_desc') });
  if (stats.totalCount >= 500) badges.push({ icon: '👑', name: t('achievement.expert'), desc: t('achievement.expert_desc') });
  if (stats.last7Total >= 7) badges.push({ icon: '🔥', name: t('achievement.weekly_active'), desc: t('achievement.weekly_active_desc') });
  if (stats.last7Total >= 21) badges.push({ icon: '💪', name: t('achievement.high_frequency'), desc: t('achievement.high_frequency_desc') });
  if (stats.byType && Object.values(stats.byType).filter(v => v > 0).length >= 4) {
    badges.push({ icon: '🌟', name: t('achievement.all_rounder'), desc: t('achievement.all_rounder_desc') });
  }
  return badges;
}

export function renderAchievements(stats) {
  const el = document.getElementById('achievementBadges');
  if (!el) return;
  const badges = computeAchievements(stats);
  if (badges.length === 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = badges.slice(-5).map(b =>
    `<span class="achievement-badge" title="${b.name}: ${b.desc}">${b.icon} ${b.name}</span>`
  ).join(' ');
}

export async function renderStats(computeFlightStatsFn) {
  const statsPanel = document.getElementById('statsPanel');
  const statsTotalEl = document.getElementById('statsTotal');
  const statsWeekEl = document.getElementById('statsWeek');
  const statsTrendEl = document.getElementById('statsTrend');
  const statsTopTaskEl = document.getElementById('statsTopTask');
  const statsTopCountEl = document.getElementById('statsTopCount');
  const statsBarsEl = document.getElementById('statsBars');
  const statsRangeEl = document.getElementById('statsRange');
  const statsTypesEl = document.getElementById('statsTypes');
  const statsTotalSubEl = document.getElementById('statsTotalSub');
  const weeklySummaryEl = document.getElementById('weeklySummary');

  if (!statsPanel) return;
  const stats = await computeFlightStatsFn();

  if (weeklySummaryEl && stats.last7Total > 0) {
    const topId = Object.entries(stats.taskTotals).sort((a,b) => b[1]-a[1])[0]?.[0];
    const topTask = tasks.find(t => String(t.id) === topId);
    const topSuffix = topTask ? t('stats.weekly_top', { name: topTask.label || t('stats.unnamed') }) : '';
    weeklySummaryEl.innerHTML = t('stats.weekly_summary', { count: stats.last7Total, top: topSuffix });
    weeklySummaryEl.classList.remove('hidden');
  } else if (weeklySummaryEl) {
    weeklySummaryEl.classList.add('hidden');
  }

  if (statsTotalEl) statsTotalEl.textContent = String(stats.totalCount);
  if (statsWeekEl) statsWeekEl.textContent = String(stats.last7Total);

  if (statsTrendEl) {
    statsTrendEl.classList.remove('up', 'down', 'flat');
    if (stats.trend === null) {
      statsTrendEl.classList.add('flat');
      statsTrendEl.textContent = t('stats.trend_none');
    } else if (stats.trend === 0) {
      statsTrendEl.classList.add('flat');
      statsTrendEl.textContent = t('stats.trend_flat');
    } else if (stats.trend > 0) {
      statsTrendEl.classList.add('up');
      statsTrendEl.textContent = `↑ ${stats.trend}%`;
    } else {
      statsTrendEl.classList.add('down');
      statsTrendEl.textContent = `↓ ${Math.abs(stats.trend)}%`;
    }
  }

  const topEntries = Object.entries(stats.taskTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1);
  if (topEntries.length > 0 && topEntries[0][1] > 0) {
    const [topId, topCount] = topEntries[0];
    const topTask = tasks.find(t => String(t.id) === String(topId));
    if (statsTopTaskEl) statsTopTaskEl.textContent = topTask ? (topTask.label || t('stats.unnamed')) : `#${topId}`;
    if (statsTopCountEl) statsTopCountEl.textContent = t('stats.total_suffix', { count: topCount });
  } else {
    if (statsTopTaskEl) statsTopTaskEl.textContent = '—';
    if (statsTopCountEl) statsTopCountEl.textContent = t('stats.top_count');
  }

  if (statsBarsEl) {
    statsBarsEl.innerHTML = '';
    const today = new Date();
    const dayMs = 86400000;
    const weekDayLabels = ta('calendar.day_labels');
    const dailyMap = new Map();
    for (const d of stats.daily) dailyMap.set(d.date, d.totalCount);
    const todayKey = (() => {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();
    let maxCount = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const count = dailyMap.get(key) || 0;
      if (count > maxCount) maxCount = count;
    }
    if (maxCount === 0) maxCount = 1;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const count = dailyMap.get(key) || 0;
      const isToday = key === todayKey;
      const col = document.createElement('div');
      col.className = `stats-bar-col${count === 0 ? ' is-empty' : ''}`;
      const countEl = document.createElement('div');
      countEl.className = 'stats-bar-count';
      countEl.textContent = count > 0 ? String(count) : '';
      const bar = document.createElement('div');
      bar.className = 'stats-bar';
      bar.style.height = `${Math.max(2, (count / maxCount) * 56)}px`;
      const label = document.createElement('div');
      label.className = 'stats-bar-label';
      label.textContent = isToday ? t('calendar.today') : weekDayLabels[d.getDay()];
      col.appendChild(countEl);
      col.appendChild(bar);
      col.appendChild(label);
      statsBarsEl.appendChild(col);
    }
  }

  if (statsRangeEl) {
    const today = new Date();
    const start = new Date(today.getTime() - 6 * 86400000);
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    statsRangeEl.textContent = `${fmt(start)} – ${fmt(today)}`;
  }

  if (statsTypesEl) {
    statsTypesEl.innerHTML = '';
    const total = Object.values(stats.byType).reduce((s, n) => s + n, 0);
    if (statsTotalSubEl) statsTotalSubEl.textContent = total > 0 ? t('stats.total_count', { count: total }) : t('stats.no_flights');
    const types = ['alarm', 'countdown', 'holiday', 'anniversary'];
    for (const t of types) {
      const v = stats.byType[t] || 0;
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'stats-type-row';
      const name = document.createElement('div');
      name.className = 'stats-type-name';
      const labelFn = STATS_TYPE_LABELS[t];
      name.textContent = labelFn ? labelFn() : t;
      const bar = document.createElement('div');
      bar.className = 'stats-type-bar';
      const fill = document.createElement('div');
      fill.className = 'stats-type-bar-fill';
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      const p = document.createElement('div');
      p.className = 'stats-type-pct';
      p.textContent = `${pct}%`;
      row.appendChild(name);
      row.appendChild(bar);
      row.appendChild(p);
      statsTypesEl.appendChild(row);
    }
  }

  renderAchievements(stats);
}
