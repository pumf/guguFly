export function parseDeepLinkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'gugufly:') return null;
    const action = url.host || url.pathname.replace(/^\/+/, '') || '';
    const params = Object.fromEntries(url.searchParams.entries());
    return { action, params };
  } catch {
    return null;
  }
}

export function buildTaskFromDeepLink(params, ctx) {
  const { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask, HOLIDAY_PRESETS, formatHolidayLabel } = ctx;
  const type = ['alarm', 'countdown', 'holiday', 'anniversary'].includes(params.type) ? params.type : 'alarm';
  const msg = (params.msg || '').trim();
  const hour = Math.min(23, Math.max(0, parseInt(params.hour, 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(params.minute, 10) || 0));
  const mins = Math.min(999, Math.max(0, parseInt(params.mins, 10) || 0));
  const secs = Math.min(59, Math.max(0, parseInt(params.secs, 10) || 0));
  let task;
  if (type === 'countdown') {
    task = createCountdownTask();
    task.duration = mins * 60 + secs;
    if (task.duration <= 0) task.duration = 60;
    task._remaining = task.duration;
  } else if (type === 'holiday') {
    task = createHolidayTask();
    const presetKey = params.holidayKey && HOLIDAY_PRESETS[params.holidayKey] ? params.holidayKey : 'new_year';
    const preset = HOLIDAY_PRESETS[presetKey];
    task.holidayKey = presetKey; task.label = formatHolidayLabel(preset);
    task.month = preset.month; task.day = preset.day;
    task.hour = hour; task.minute = minute;
    if (msg) task.msg = msg;
    return task;
  } else if (type === 'anniversary') {
    task = createAnniversaryTask();
    const d = new Date();
    task.month = Math.min(12, Math.max(1, parseInt(params.month, 10) || (d.getMonth() + 1)));
    task.day = Math.min(31, Math.max(1, parseInt(params.day, 10) || d.getDate()));
    task.hour = hour; task.minute = minute;
    if (msg) task.msg = msg;
    return task;
  } else {
    task = createAlarmTask();
    task.hour = hour; task.minute = minute;
    const days = (params.days || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
    task.repeat = Array.from(new Set(days));
  }
  if (msg) task.msg = msg;
  return task;
}
