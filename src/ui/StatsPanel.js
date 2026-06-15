const STATS_TYPE_LABELS = {
  alarm: '定时', countdown: '倒计时',
  holiday: '节假日', anniversary: '纪念日',
};

let tasks = [];
let cachedStats = null;

export function setStatsTasks(taskList) {
  tasks = taskList;
}

export function computeAchievements(stats) {
  const badges = [];
  if (stats.totalCount >= 1) badges.push({ icon: '🛫', name: '首次起飞', desc: '完成第 1 次飞行' });
  if (stats.totalCount >= 10) badges.push({ icon: '✈️', name: '飞行新星', desc: '累计飞行 10 次' });
  if (stats.totalCount >= 100) badges.push({ icon: '🚀', name: '百次飞行', desc: '累计飞行 100 次' });
  if (stats.totalCount >= 500) badges.push({ icon: '👑', name: '飞行达人', desc: '累计飞行 500 次' });
  if (stats.last7Total >= 7) badges.push({ icon: '🔥', name: '周活跃', desc: '本周飞行 7 次以上' });
  if (stats.last7Total >= 21) badges.push({ icon: '💪', name: '高频飞行', desc: '本周飞行 21 次以上' });
  if (stats.byType && Object.values(stats.byType).filter(v => v > 0).length >= 4) {
    badges.push({ icon: '🌟', name: '全能机长', desc: '使用过全部 4 种任务类型' });
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
  cachedStats = stats;

  if (weeklySummaryEl && stats.last7Total > 0) {
    const topId = Object.entries(stats.taskTotals).sort((a,b) => b[1]-a[1])[0]?.[0];
    const topTask = tasks.find(t => String(t.id) === topId);
    weeklySummaryEl.innerHTML = `✈ 本周已飞行 <em>${stats.last7Total}</em> 次${topTask ? ` · 最常触发 <em>${topTask.label || '未命名'}</em>` : ''}`;
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
      statsTrendEl.textContent = '— 暂无对比';
    } else if (stats.trend === 0) {
      statsTrendEl.classList.add('flat');
      statsTrendEl.textContent = '→ 持平';
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
    if (statsTopTaskEl) statsTopTaskEl.textContent = topTask ? (topTask.label || '未命名') : `#${topId}`;
    if (statsTopCountEl) statsTopCountEl.textContent = `${topCount} 次飞行`;
  } else {
    if (statsTopTaskEl) statsTopTaskEl.textContent = '—';
    if (statsTopCountEl) statsTopCountEl.textContent = '暂无数据';
  }

  if (statsBarsEl) {
    statsBarsEl.innerHTML = '';
    const today = new Date();
    const dayMs = 86400000;
    const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六'];
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
      label.textContent = isToday ? '今' : weekDayLabels[d.getDay()];
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
    if (statsTotalSubEl) statsTotalSubEl.textContent = total > 0 ? `总计 ${total} 次` : '暂无飞行';
    const types = ['alarm', 'countdown', 'holiday', 'anniversary'];
    for (const t of types) {
      const v = stats.byType[t] || 0;
      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'stats-type-row';
      const name = document.createElement('div');
      name.className = 'stats-type-name';
      name.textContent = STATS_TYPE_LABELS[t] || t;
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
