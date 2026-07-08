import { t } from '../i18n/index.js';

let emergencyCooldownUntil = 0;

let getModalFn;
let getSettingsModalFn;
let stopLoopSoundLocalFn;
let stopFlightLoopSoundFn;
let stopPreviewAudioFn;
let clearAllSequencesFn;
let clearFlightQueueFn;
let clearFlightStreakFn;
let stopAllCountdownsFn;
let getWebviewWindowsFn;
let showToastFn;
let resetVideoWindowStateFn;
let resetPfNotifyStateFn;
let closePostFlightNotifyFn;
let setEmergencyLandingActiveFn;
let clearPendingPfCancelFn;
let releaseFlightQueueFn;

export function initEmergency(ctx) {
  getModalFn = ctx.getModal;
  getSettingsModalFn = ctx.getSettingsModal;
  stopLoopSoundLocalFn = ctx.stopLoopSoundLocal;
  stopFlightLoopSoundFn = ctx.stopFlightLoopSound;
  stopPreviewAudioFn = ctx.stopPreviewAudio;
  clearAllSequencesFn = ctx.clearAllSequences;
  clearFlightQueueFn = ctx.clearFlightQueue;
  clearFlightStreakFn = ctx.clearFlightStreak;
  stopAllCountdownsFn = ctx.stopAllCountdowns;
  getWebviewWindowsFn = ctx.getWebviewWindows;
  showToastFn = ctx.showToast;
  resetVideoWindowStateFn = ctx.resetVideoWindowState;
  resetPfNotifyStateFn = ctx.resetPfNotifyState;
  closePostFlightNotifyFn = ctx.closePostFlightNotify;
  setEmergencyLandingActiveFn = ctx.setEmergencyLandingActive;
  clearPendingPfCancelFn = ctx.clearPendingPfCancel;
  releaseFlightQueueFn = ctx.releaseFlightQueue;

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
  // Set the emergency-landing flag BEFORE closing flight windows so
  // that any flight-ended events fired during close are suppressed
  // from executing post-flight actions.
  if (setEmergencyLandingActiveFn) setEmergencyLandingActiveFn(true);
  try {
    if (stopLoopSoundLocalFn) stopLoopSoundLocalFn();
    if (stopFlightLoopSoundFn) stopFlightLoopSoundFn();
    if (stopPreviewAudioFn) stopPreviewAudioFn();
    if (clearAllSequencesFn) clearAllSequencesFn();
    if (clearFlightQueueFn) clearFlightQueueFn();
    // Clear pendingPfCancel so a stale closure doesn't reference a
    // no-longer-active flight job (which would mutate the wrong
    // object on user click).
    if (clearPendingPfCancelFn) clearPendingPfCancelFn();
    if (clearFlightStreakFn) await clearFlightStreakFn();
    if (stopAllCountdownsFn) stopAllCountdownsFn(tasks);
    try {
      const all = await (getWebviewWindowsFn ? getWebviewWindowsFn() : []);
      for (const w of all) {
        if (w.label.startsWith('flight-')) await w.close();
        if (w.label === 'gugufly-effect' || w.label === 'gugufly-video' || w.label === 'gugufly-pfnotify') await w.close();
      }
    } catch (error) {
      console.error('emergency close failed:', error);
    }
    // Release the flight queue and reset window state references
    // so the next flight/post-flight action doesn't try to interact
    // with the now-closed windows.
    if (releaseFlightQueueFn) releaseFlightQueueFn();
    if (resetVideoWindowStateFn) resetVideoWindowStateFn();
    if (closePostFlightNotifyFn) {
      try { await closePostFlightNotifyFn(); } catch (e) { console.error('emergency pf close failed:', e); }
    }
    if (resetPfNotifyStateFn) resetPfNotifyStateFn();
    if (showToastFn) showToastFn(t('toast.emergency_landing'));
  } finally {
    // Clear the flag after a short delay so any in-flight flight-ended
    // events from the close() calls have time to be processed and
    // suppressed. The flag is process-local; once the synchronous
    // emergency work is done, the listener will resume normal behavior.
    setTimeout(() => {
      if (setEmergencyLandingActiveFn) setEmergencyLandingActiveFn(false);
    }, 500);
  }
}
