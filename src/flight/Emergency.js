let emergencyCooldownUntil = 0;

let getModalFn;
let getSettingsModalFn;
let stopLoopSoundLocalFn;
let stopPreviewAudioFn;
let clearAllSequencesFn;
let clearFlightQueueFn;
let clearFlightStreakFn;
let stopAllCountdownsFn;
let getWebviewWindowsFn;
let showToastFn;

export function initEmergency(ctx) {
  getModalFn = ctx.getModal;
  getSettingsModalFn = ctx.getSettingsModal;
  stopLoopSoundLocalFn = ctx.stopLoopSoundLocal;
  stopPreviewAudioFn = ctx.stopPreviewAudio;
  clearAllSequencesFn = ctx.clearAllSequences;
  clearFlightQueueFn = ctx.clearFlightQueue;
  clearFlightStreakFn = ctx.clearFlightStreak;
  stopAllCountdownsFn = ctx.stopAllCountdowns;
  getWebviewWindowsFn = ctx.getWebviewWindows;
  showToastFn = ctx.showToast;

  const emergencyBtn = ctx.emergencyBtn;
  const tasksRef = ctx.tasksRef;

  emergencyBtn?.addEventListener('click', () => {
    emergencyCooldownUntil = Date.now() + 1500;
    triggerEmergencyLanding(tasksRef ? tasksRef() : []);
  });

  document.addEventListener('keydown', (event) => {
    if (!shouldHandleEmergencyShortcut(event)) return;
    emergencyCooldownUntil = Date.now() + 1500;
    triggerEmergencyLanding(tasksRef ? tasksRef() : []);
  });
}

export function setEmergencyCooldown(ms) {
  emergencyCooldownUntil = Date.now() + ms;
}

export function shouldHandleEmergencyShortcut(event) {
  if (event.key !== 'Escape') return false;
  if (Date.now() < emergencyCooldownUntil) return false;
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return false;
  const modal = getModalFn ? getModalFn() : null;
  const settingsModal = getSettingsModalFn ? getSettingsModalFn() : null;
  if (modal && !modal.classList.contains('hidden')) return false;
  if (settingsModal && !settingsModal.classList.contains('hidden')) return false;
  return true;
}

export async function triggerEmergencyLanding(tasks) {
  if (stopLoopSoundLocalFn) stopLoopSoundLocalFn();
  if (stopPreviewAudioFn) stopPreviewAudioFn();
  if (clearAllSequencesFn) clearAllSequencesFn();
  if (clearFlightQueueFn) clearFlightQueueFn();
  if (clearFlightStreakFn) await clearFlightStreakFn();
  if (stopAllCountdownsFn) stopAllCountdownsFn(tasks);
  try {
    const all = await (getWebviewWindowsFn ? getWebviewWindowsFn() : []);
    for (const w of all) {
      if (w.label.startsWith('flight-')) await w.close();
    }
  } catch (e) {}
  if (showToastFn) showToastFn('已紧急降落');
}
