import { t } from '../i18n/index.js';

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
      ctx.heroStatusEl.textContent = t('hero.status.flying');
      ctx.heroStatusEl.title = t('hero.status.countdown', { name: runningCountdown.label || t('common.unnamed') });
    } else {
      const enabledCount = tasks.filter(t => t.enabled).length;
      ctx.heroStatusEl.textContent = enabledCount === 0
        ? t('hero.status.waiting')
        : t('hero.status.enabled', { count: enabledCount });
      ctx.heroStatusEl.title = enabledCount === 0
        ? t('hero.title.no_tasks')
        : t('hero.title.has_tasks', { count: enabledCount });
    }
    if (todayCountEl) {
      const count = todayCountEl.textContent.replace(/\D/g, '');
      todayCountEl.title = t('hero.today_count', { count });
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
    const label = runningCountdown.label || t('hero.next.countdown').split(' ')[0];
    msgEl.textContent = t('hero.next.countdown', { label });
    msgEl.classList.remove('hidden');
    return;
  }
  const upcoming = await ctx.getNextUpcomingTask();
  if (upcoming && upcoming.minutes <= 1440) {
    const { task, minutes } = upcoming;
    const label = task.label || t('common.unnamed');
    const typeIcon = task.type === 'alarm' ? '⏰' : task.type === 'countdown' ? '⏱' : '📅';
    if (minutes < 1) msgEl.textContent = `${typeIcon} ${label} · ${t('hero.next.takeoff')}`;
    else if (minutes < 60) msgEl.textContent = `${typeIcon} ${label} · ${t('hero.next.minutes', { minutes })}`;
    else {
      const h = Math.floor(minutes / 60);
      const mm = minutes % 60;
      msgEl.textContent = `${typeIcon} ${label} · ${t('hero.next.hours', { hours: h, minutes: mm > 0 ? ' ' + mm + t('modal.field.minute') : '' })}`;
    }
    msgEl.classList.remove('hidden');
  } else {
    msgEl.classList.add('hidden');
  }
}
