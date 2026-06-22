let ctx;

export function initHeroSection(c) {
  ctx = c;
}

export function updateHeroStatus() {
  if (!ctx) return;
  if (ctx.heroStatusEl) {
    const tasks = ctx.tasksRef ? ctx.tasksRef.get() : [];
    const runningCountdown = tasks.find(t => t.type === 'countdown' && t._status === 'running');
    const todayCountEl = document.getElementById('todayCount');
    if (runningCountdown) {
      ctx.heroStatusEl.textContent = '飞行中';
      ctx.heroStatusEl.title = `倒计时中 · ${runningCountdown.label || '未命名'}`;
    } else {
      const enabledCount = tasks.filter(t => t.enabled).length;
      ctx.heroStatusEl.textContent = enabledCount === 0
        ? '等待'
        : `${enabledCount} 条`;
      ctx.heroStatusEl.title = enabledCount === 0
        ? '暂无启用的任务'
        : `已启用 ${enabledCount} 条任务`;
    }
    if (todayCountEl) {
      const count = todayCountEl.textContent.replace(/\D/g, '');
      todayCountEl.title = `今日飞行 ${count} 次`;
    }
  }
  updateNextUpcoming();
}

export async function updateNextUpcoming() {
  if (!ctx) return;
  const el = document.getElementById('nextUpcoming');
  if (!el) return;
  const msgEl = el.querySelector('.next-msg');
  if (!msgEl) return;
  const tasks = ctx.tasksRef ? ctx.tasksRef.get() : [];
  const runningCountdown = tasks.find(t => t.type === 'countdown' && t._status === 'running');
  if (runningCountdown) {
    const label = runningCountdown.label || '倒计时';
    msgEl.textContent = `⏱ ${label} · 倒计时中`;
    msgEl.classList.remove('hidden');
    return;
  }
  const upcoming = await ctx.getNextUpcomingTask();
  if (upcoming && upcoming.minutes <= 1440) {
    const { task, minutes } = upcoming;
    const label = task.label || '提醒';
    const typeIcon = task.type === 'alarm' ? '⏰' : task.type === 'countdown' ? '⏱' : '📅';
    if (minutes < 1) msgEl.textContent = `${typeIcon} ${label} · 即将起飞`;
    else if (minutes < 60) msgEl.textContent = `${typeIcon} ${label} · ${minutes} 分钟后`;
    else {
      const h = Math.floor(minutes / 60);
      const mm = minutes % 60;
      msgEl.textContent = `${typeIcon} ${label} · ${h} 小时${mm > 0 ? mm + ' 分钟' : ''}后`;
    }
    msgEl.classList.remove('hidden');
  } else {
    msgEl.classList.add('hidden');
  }
}
