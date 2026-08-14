import { onLanguageChange, translateDOM } from '../i18n/index.js';
import { HOLIDAY_PRESETS } from '../tasks/HolidayPresets.js';

export function initLanguageHandler(ctx) {
  const {
    renderTaskView, renderStatsPanel, updateHeroStatus,
    refreshDrawer, initHolidayChecklist, holidayChecklist,
  } = ctx;

  onLanguageChange(() => {
    try { renderTaskView(); } catch (e) { console.error('lang renderTaskView error:', e); }
    try { renderStatsPanel(); } catch (e) { console.error('lang renderStatsPanel error:', e); }
    try { updateHeroStatus(); } catch (e) { console.error('lang updateHeroStatus error:', e); }
    try { refreshDrawer(); } catch (e) { console.error('lang refreshDrawer error:', e); }
    try { initHolidayChecklist(holidayChecklist, HOLIDAY_PRESETS); } catch (e) { console.error('lang initHolidayChecklist error:', e); }
    requestAnimationFrame(() => translateDOM());
  });
}
