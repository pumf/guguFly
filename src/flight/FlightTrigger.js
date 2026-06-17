let ctx;

export function initFlightTrigger(c) {
  ctx = c;
}

export async function registerFlightTrigger() {
  if (!ctx) return 0;
  const count = await ctx.incrementTodayCount();
  ctx.todayCountEl.textContent = count;
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
  const msg = task.msg || ctx.getRandomQuote();
  await registerFlightTrigger();
  await ctx.recordFlightTrigger(task);
  ctx.notifyFlightTriggered(task.label, msg);
  await ctx.renderStatsPanel();
  ctx.triggerFlightWithMode(task, null, null, null, null);
}
