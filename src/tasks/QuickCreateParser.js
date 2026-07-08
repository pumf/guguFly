import { t, ta } from '../i18n/index.js';

const WEEKDAY_MAP = {
  '周一': 1, '星期一': 1, '礼拜一': 1,
  '周二': 2, '星期二': 2, '礼拜二': 2,
  '周三': 3, '星期三': 3, '礼拜三': 3,
  '周四': 4, '星期四': 4, '礼拜四': 4,
  '周五': 5, '星期五': 5, '礼拜五': 5,
  '周六': 6, '星期六': 6, '礼拜六': 6,
  '周日': 0, '星期日': 0, '星期天': 0, '礼拜天': 0, '礼拜日': 0,
  'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0,
  'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0,
};

const CN_NUM_MAP = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
  '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30,
  '三十一': 31, '三十二': 32, '三十三': 33, '三十四': 34, '三十五': 35,
  '三十六': 36, '三十七': 37, '三十八': 38, '三十九': 39, '四十': 40,
  '四十一': 41, '四十二': 42, '四十三': 43, '四十四': 44, '四十五': 45,
  '四十六': 46, '四十七': 47, '四十八': 48, '四十九': 49, '五十': 50,
  '五十一': 51, '五十二': 52, '五十三': 53, '五十四': 54, '五十五': 55,
  '五十六': 56, '五十七': 57, '五十八': 58, '五十九': 59,
};

function cnToNum(str) {
  if (CN_NUM_MAP[str] !== undefined) return CN_NUM_MAP[str];
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

function parseDuration(str) {
  const parts = [];
  const hMatch = str.match(/(\d+|零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)\s*(?:小时|hour|h)/i);
  const mMatch = str.match(/(\d+|零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一|三十二|三十三|三十四|三十五|三十六|三十七|三十八|三十九|四十|四十一|四十二|四十三|四十四|四十五|四十六|四十七|四十八|四十九|五十|五十一|五十二|五十三|五十四|五十五|五十六|五十七|五十八|五十九)\s*(?:分钟|分|min|m)(?!o)/i);
  const sMatch = str.match(/(\d+)\s*(?:秒|sec|s)(?!e)/i);
  if (hMatch) parts.push(cnToNum(hMatch[1]) * 3600);
  if (mMatch) parts.push(cnToNum(mMatch[1]) * 60);
  if (sMatch) parts.push(parseInt(sMatch[1]));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

export function parseQuickInput(text) {
  if (!text || !text.trim()) return null;
  const input = text.trim();

  const weekdays = [];
  for (const [label, val] of Object.entries(WEEKDAY_MAP)) {
    if (input.includes(label)) weekdays.push(val);
  }
  const uniqueWeekdays = [...new Set(weekdays)].sort((a, b) => a - b);

  const duration = parseDuration(input);
  if (duration && duration > 0) {
    const label = extractLabel(input, [
      /\d+\s*(?:小时|hour|h)/i,
      /\d+\s*(?:分钟|分|min|m)(?!o)/i,
      /\d+\s*(?:秒|sec|s)(?!e)/i,
      /之后|以后|后/i,
    ]);
    return {
      type: 'countdown',
      label: label || `${duration >= 60 ? Math.floor(duration / 60) + t('video.duration_min') : duration + t('video.duration_sec')}${t('quick_create.after')}`,
      duration,
      msg: '',
    };
  }

  if (uniqueWeekdays.length > 0) {
    const time = parseTime(input);
    const label = extractLabel(input, [
      ...Object.keys(WEEKDAY_MAP).map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
      /每天|每周|each/i,
      /之后|以后|后/i,
    ]);
    const dayNames = ta('calendar.day_labels');
    return {
      type: 'alarm',
      label: label || `${t('task.status.weekday')} ${uniqueWeekdays.map(d => dayNames[d]).join('/')}`,
      hour: time.hour,
      minute: time.minute,
      repeat: { type: 'weekly', days: uniqueWeekdays },
      msg: '',
    };
  }

  if (input.match(/每天|每日|daily|each\s*day/i)) {
    const time = parseTime(input);
    const label = extractLabel(input, [
      /每天|每日|daily|each\s*day/i,
      /之后|以后|后/i,
    ]);
    const weekdays = [1, 2, 3, 4, 5];
    return {
      type: 'alarm',
      label: label || t('pomodoro.started', { minutes: 0 }).replace(/\d+/, '').trim() || t('task.status.everyday'),
      hour: time.hour,
      minute: time.minute,
      repeat: { type: 'weekly', days: weekdays },
      msg: '',
    };
  }

  const time = parseTime(input);
  if (time) {
    const label = extractLabel(input, [
      /\d{1,2}\s*[:：.]\s*\d{2}/,
      /\d{1,2}\s*[点时]\s*\d{0,2}\s*分?/,
      /\d{1,2}\s*[点时]\s*半/,
      /(?:零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)\s*[点时]\s*(?:零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一|三十二|三十三|三十四|三十五|三十六|三十七|三十八|三十九|四十|四十一|四十二|四十三|四十四|四十五|四十六|四十七|四十八|四十九|五十|五十一|五十二|五十三|五十四|五十五|五十六|五十七|五十八|五十九)\s*分?/,
      /(?:零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)\s*[点时]\s*半/,
      /下午|晚上|上午|早上|早晨/,
      /明天|今天|tomorrow|today/i,
    ]);
    const isTomorrow = /明天|tomorrow/i.test(input);
    return {
      type: 'alarm',
      label: label || `${isTomorrow ? '明天' : '今天'} ${time.hour}:${String(time.minute).padStart(2, '0')}`,
      hour: time.hour,
      minute: time.minute,
      repeat: { type: 'weekly', days: [] },
      msg: '',
      isTomorrow,
    };
  }

  return {
    type: 'countdown',
    label: input,
    duration: 1800,
    msg: input,
  };
}

function parseTime(input) {
  const m = input.match(/(\d{1,2})\s*[:：.]\s*(\d{2})/);
  if (m) return { hour: parseInt(m[1]), minute: parseInt(m[2]) };

  const cnHourPattern = '(?:零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)';
  const cnMinPattern = '(?:零|一|二|两|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一|三十二|三十三|三十四|三十五|三十六|三十七|三十八|三十九|四十|四十一|四十二|四十三|四十四|四十五|四十六|四十七|四十八|四十九|五十|五十一|五十二|五十三|五十四|五十五|五十六|五十七|五十八|五十九)';

  const cnHm = input.match(new RegExp(`${cnHourPattern}\\s*[点时]\\s*${cnMinPattern}\\s*分?`));
  if (cnHm) {
    let hour = cnToNum(cnHm[0].match(new RegExp(cnHourPattern))[0]);
    const minMatch = cnHm[0].match(new RegExp(cnMinPattern));
    let minute = minMatch ? cnToNum(minMatch[0]) : 0;
    if (input.match(/下午|晚[上间]/) && hour < 12) hour += 12;
    if (input.match(/上午|早[上晨]/) && hour === 12) hour = 0;
    return { hour, minute };
  }

  const cnHalf = input.match(new RegExp(`${cnHourPattern}\\s*[点时]\\s*半`));
  if (cnHalf) {
    let hour = cnToNum(cnHalf[0].match(new RegExp(cnHourPattern))[0]);
    if (input.match(/下午|晚[上间]/) && hour < 12) hour += 12;
    if (input.match(/上午|早[上晨]/) && hour === 12) hour = 0;
    return { hour, minute: 30 };
  }

  const cnHourOnly = input.match(new RegExp(`${cnHourPattern}\\s*[点时]钟?`));
  if (cnHourOnly) {
    let hour = cnToNum(cnHourOnly[0].match(new RegExp(cnHourPattern))[0]);
    if (input.match(/下午|晚[上间]/) && hour < 12) hour += 12;
    if (input.match(/上午|早[上晨]/) && hour === 12) hour = 0;
    return { hour, minute: 0 };
  }

  const hm = input.match(/(\d{1,2})\s*[点时]\s*(\d{1,2})?\s*分?/);
  if (hm) {
    let hour = parseInt(hm[1]);
    let minute = parseInt(hm[2] || 0);
    if (input.match(/下午|晚[上间]/) && hour < 12) hour += 12;
    if (input.match(/上午|早[上晨]/) && hour === 12) hour = 0;
    return { hour, minute };
  }

  const halfMatch = input.match(/(\d{1,2})\s*[点时]\s*半/);
  if (halfMatch) {
    let hour = parseInt(halfMatch[1]);
    if (input.match(/下午|晚[上间]/) && hour < 12) hour += 12;
    if (input.match(/上午|早[上晨]/) && hour === 12) hour = 0;
    return { hour, minute: 30 };
  }

  return { hour: 12, minute: 0 };
}

function extractLabel(input, skipPatterns) {
  let cleaned = input;
  for (const p of skipPatterns) {
    cleaned = cleaned.replace(p, ' ');
  }
  cleaned = cleaned.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 1 || cleaned.length > 30) return '';
  return cleaned;
}

export function formatPreview(result) {
  if (!result) return '';
  const typeLabel = {
    alarm: `⏰ ${t('task.type.alarm')}`,
    countdown: `⏱ ${t('task.type.countdown')}`,
    holiday: `📅 ${t('task.type.holiday')}`,
    anniversary: `💝 ${t('task.type.anniversary')}`,
  }[result.type] || `📋 ${t('task.type.default')}`;

  let detail = '';
  if (result.type === 'alarm') {
    const timeStr = `${result.hour}:${String(result.minute).padStart(2, '0')}`;
    if (result.repeat?.type === 'weekly' && result.repeat.days?.length > 0) {
      const dayNames = ta('calendar.day_labels');
      detail = `${t('task.status.weekday')} ${result.repeat.days.map(d => dayNames[d]).join('/')} ${timeStr}`;
    } else {
      detail = timeStr;
    }
  } else if (result.type === 'countdown') {
    const mins = Math.floor(result.duration / 60);
    const secs = result.duration % 60;
    detail = mins > 0 ? `${mins}${t('video.duration_min')}${secs > 0 ? secs + t('video.duration_sec') : ''}` : `${secs}${t('video.duration_sec')}`;
  }

  return `${typeLabel} · ${result.label}${detail ? ' · ' + detail : ''}`;
}
