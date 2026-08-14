import { computeFlightStats, loadFlightLog } from '../storage.js';
import { renderStats } from '../ui/StatsPanel.js';
import { renderTaskHistory } from '../ui/HistoryPanel.js';

export async function renderStatsPanel() {
  const stats = await computeFlightStats();
  await renderStats(async () => stats);
  const flightLog = await loadFlightLog();
  renderTaskHistory(stats, flightLog);
}
