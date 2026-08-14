import { shouldPauseFlight, getPauseReason, postponeFlight } from '../smart-pause/SmartPause.js';
import { isPomodoroInWorkPhase, getPomodoroTask } from '../tasks/PomodoroTimer.js';
import { shouldDeferFlight } from '../smart-pause/NaturalBreak.js';
import { isWithinWorkSchedule } from '../settings/SettingsManager.js';

let ctx;
let _t;

export function initFlightTrigger(c) {
  ctx = c;
  _t = c.t;
}

export async function registerFlightTrigger() {
  if (!ctx) return 0;
  const count = await ctx.incrementTodayCount();
  if (ctx.todayCountEl) ctx.todayCountEl.textContent = _t ? _t('hero.today_count', { count }) : `${count} flights`;
  const today = ctx.getDateKey();
  const lastStreakDate = await ctx.get('streakLastDate');
  let streak = await ctx.get('streak');
  if (!lastStreakDate) streak = 1;
  else {
    const diff = ctx.dayDiff(lastStreakDate, today);
    if (diff === 1) streak += 1;
    else if (diff !== 0) streak = 1;
  }
  await ctx.set('streak', streak);
  await ctx.set('streakLastDate', today);
}

export async function clearFlightStreak() {
  if (!ctx) return;
  await ctx.resetStreak();
  await ctx.set('streakLastDate', null);
}

export async function doTriggerFlight(task) {
  if (!ctx) return;
  if (ctx.isInQuietHours(ctx.quietHoursToggle, ctx.quietStartHour, ctx.quietEndHour)) return;

  if (shouldPauseFlight(task)) {
    const reason = getPauseReason();
    postponeFlight({ task, reason });
    return;
  }

  if (shouldDeferFlight()) {
    postponeFlight({ task, reason: 'user_active' });
    return;
  }

  const workScheduleEnabled = await ctx.get('workScheduleEnabled');
  if (workScheduleEnabled) {
    const workSchedule = await ctx.get('workSchedule');
    if (workSchedule && !isWithinWorkSchedule(workSchedule)) {
      postponeFlight({ task, reason: 'work_schedule' });
      return;
    }
  }

  const pomodoroTask = getPomodoroTask();
  if (isPomodoroInWorkPhase() && task && pomodoroTask && task.id !== pomodoroTask.id) {
    postponeFlight({ task, reason: 'pomodoro_focus' });
    return;
  }

  const msg = task.msg || ctx.getRandomQuote();
  await registerFlightTrigger();
  await ctx.recordFlightTrigger(task);
  await ctx.notifyFlightTriggered(task.label, msg, task.type);
  await ctx.renderStatsPanel();
  ctx.triggerFlightWithMode(task, null, null, null, null);
}
