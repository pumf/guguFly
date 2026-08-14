/**
 * Lightweight in-memory snooze hub.
 * Tasks postponed via the FlightBoard «⏸» button are stored here.
 * AlarmChecker.runAlarmCheck skips snoozed tasks during the quiet window.
 */
const snoozeMap = new Map(); // taskId → untilTs (ms)

export function snoozeTask(id, minutes = 10) {
  snoozeMap.set(id, Date.now() + minutes * 60000);
}

export function isSnoozed(id) {
  const until = snoozeMap.get(id);
  if (!until) return false;
  if (Date.now() >= until) {
    snoozeMap.delete(id);
    return false;
  }
  return true;
}

export function getSnoozedUntil(id) {
  return snoozeMap.get(id) || null;
}

export function clearSnooze(id) {
  snoozeMap.delete(id);
}

export function clearAllSnoozes() {
  snoozeMap.clear();
}
