let ctx;

export function initHeroSection(c) {
  ctx = c;
}

export function updateHeroStatus() {
  if (!ctx) return;
  const tasks = ctx.tasksRef ? ctx.tasksRef.get() : [];
  const runningCountdown = tasks.find(t => t.type === 'countdown' && t._status === 'running');
  if (runningCountdown) {
    ctx.heroStatusEl.textContent = `倒计时进行中 · ${runningCountdown.label || '未命名任务'}`;
  } else {
    const enabledCount = tasks.filter(t => t.enabled).length;
    ctx.heroStatusEl.textContent = enabledCount === 0
      ? '还没有航线，先创建一条提醒吧'
      : `已启用 ${enabledCount} 条航线，等待下一次起飞`;
  }
  updateNextUpcoming();
}

export async function updateNextUpcoming() {
  if (!ctx) return;
  const el = document.getElementById('nextUpcoming');
  if (!el) return;
  const upcoming = await ctx.getNextUpcomingTask();
  if (upcoming && upcoming.minutes <= 1440) {
    const { task, minutes } = upcoming;
    const label = task.label || '提醒';
    const typeIcon = task.type === 'alarm' ? '⏰' : task.type === 'countdown' ? '⏱' : '📅';
    if (minutes < 1) el.textContent = `${typeIcon} ${label} · 即将起飞`;
    else if (minutes < 60) el.textContent = `${typeIcon} ${label} · ${minutes} 分钟后`;
    else {
      const h = Math.floor(minutes / 60);
      const mm = minutes % 60;
      el.textContent = `${typeIcon} ${label} · ${h} 小时${mm > 0 ? mm + ' 分钟' : ''}后`;
    }
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
