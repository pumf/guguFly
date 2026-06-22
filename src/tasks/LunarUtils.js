import { Lunar } from 'lunar-javascript';

export function lunarToSolarDate(lunarYear, lunarMonth, lunarDay) {
  try {
    const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
    const solar = lunar.getSolar();
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
  } catch {
    return null;
  }
}

export function getNextSolarFromLunar(lunarMonth, lunarDay, afterDate) {
  const now = afterDate || new Date();
  for (let year = now.getFullYear() - 1; year <= now.getFullYear() + 2; year++) {
    try {
      const lunar = Lunar.fromYmd(year, lunarMonth, lunarDay);
      const solar = lunar.getSolar();
      const sYear = solar.getYear();
      const sMonth = solar.getMonth();
      const sDay = solar.getDay();
      const candidate = new Date(sYear, sMonth - 1, sDay);
      if (candidate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        return { year: sYear, solarMonth: sMonth, solarDay: sDay };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function getLunarLabel(lunarMonth, lunarDay) {
  const monthNames = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'];
  const dayPrefixes = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  const mLabel = lunarMonth >= 1 && lunarMonth <= 12 ? monthNames[lunarMonth] : String(lunarMonth);
  const dLabel = lunarDay >= 1 && lunarDay <= 30 ? dayPrefixes[lunarDay] : String(lunarDay);
  let mPrefix = '';
  if (lunarMonth === 1) mPrefix = '正';
  else if (lunarMonth === 12) mPrefix = '腊';
  else mPrefix = mLabel;
  return `农历${mPrefix}月${dLabel}`;
}