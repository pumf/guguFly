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

// Strict integer parsing: only accepts strings that are entirely digits.
// Returns null if the input contains any non-digit characters or is
// out of range. This prevents parseInt's loose matching (e.g.,
// parseInt('99abc') returns 99) from accepting malformed deep-link
// parameters.
function parseStrictInt(value, min, max, fallback) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const str = String(value).trim();
  if (!/^-?\d+$/.test(str)) return fallback;
  const n = parseInt(str, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function buildTaskFromDeepLink(params, ctx) {
  const { createAlarmTask, createCountdownTask, createHolidayTask, createAnniversaryTask, HOLIDAY_PRESETS, formatHolidayLabel } = ctx;
  const type = ['alarm', 'countdown', 'holiday', 'anniversary'].includes(params.type) ? params.type : 'alarm';
  const msg = (params.msg || '').trim().slice(0, 500); // bound message length
  const hour = parseStrictInt(params.hour, 0, 23, 0);
  const minute = parseStrictInt(params.minute, 0, 59, 0);
  const mins = parseStrictInt(params.mins, 0, 999, 0);
  const secs = parseStrictInt(params.secs, 0, 59, 0);
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
    task.lunar = !!preset.lunar;
    if (msg) task.msg = msg;
    return task;
  } else if (type === 'anniversary') {
    task = createAnniversaryTask();
    const d = new Date();
    task.month = parseStrictInt(params.month, 1, 12, d.getMonth() + 1);
    task.day = parseStrictInt(params.day, 1, 31, d.getDate());
    task.hour = hour; task.minute = minute;
    task.lunar = params.lunar === 'true' || params.lunar === '1';
    if (msg) task.msg = msg;
    return task;
  } else {
    task = createAlarmTask();
    task.hour = hour; task.minute = minute;
    const days = (params.days || '').split(',')
      .map(s => parseStrictInt(s.trim(), 0, 6, null))
      .filter(n => n !== null);
    task.repeat = Array.from(new Set(days));
  }
  if (msg) task.msg = msg;
  return task;
}
