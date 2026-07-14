import { t as _t } from '../i18n/index.js';

// Hold unlisten functions for all event subscriptions so that
// repeated calls to initTauriListeners (e.g., during HMR or tests)
// do not accumulate duplicate listeners.
let unlistenFns = [];
let initialized = false;

export function disposeTauriListeners() {
  unlistenFns.forEach(fn => { try { fn(); } catch (e) { console.error('unlisten failed:', e); } });
  unlistenFns = [];
  initialized = false;
}

export function initTauriListeners(ctx) {
  const { listen, isTauriRuntime, tasksRef, stopLoopSoundLocal, clearAllSequences, clearFlightQueue, clearFlightStreak,
    pauseCountdown, stopCountdown, startCountdown, muteBtn, invoke, showToast, createCountdownTask,
    triggerEmergencyLanding, setSkipPostFlight, saveTasks, getCleanTasks, renderTaskView,
    autoCheckForUpdate,
    getCurrentWebviewWindow } = ctx;

  if (!isTauriRuntime) return;
  // Prevent double-subscription if init runs more than once.
  if (initialized) return;
  initialized = true;

  const addUnlisten = (p) => {
    if (p && typeof p.then === 'function') {
      p.then(fn => { if (typeof fn === 'function') unlistenFns.push(fn); }).catch(err => console.warn('event listener registration failed:', err));
    }
  };

  addUnlisten(listen('timer-start', () => {
    const tasks = tasksRef.get();
    tasks.forEach(t => { if (t.type === 'countdown' && t.enabled && (t._status === 'idle' || t._status === 'paused')) startCountdown(t); });
  }));
  addUnlisten(listen('timer-pause', () => {
    stopLoopSoundLocal();
    const tasks = tasksRef.get();
    tasks.forEach(t => { if (t.type === 'countdown' && t._status === 'running') pauseCountdown(t); });
  }));
  addUnlisten(listen('timer-stop', () => {
    stopLoopSoundLocal();
    clearAllSequences(); clearFlightQueue(); clearFlightStreak();
    const tasks = tasksRef.get();
    tasks.forEach(t => { if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) stopCountdown(t); });
  }));
  addUnlisten(listen('toggle-mute', () => muteBtn.click()));
  addUnlisten(listen('skip-current-flight', () => {
    stopLoopSoundLocal(); clearFlightQueue();
    // Set the skip flag BEFORE closing flight windows. When the
    // flight-ended event fires from the close, the listener will see
    // the flag and suppress the post-flight action (video/effect/etc).
    if (setSkipPostFlight) setSkipPostFlight(true);
    invoke('close_flight_windows').catch(err => console.warn('close flight windows failed:', err));
    showToast(_t('flight.skipped'));
  }));
  addUnlisten(listen('emergency-landing', () => { void triggerEmergencyLanding(tasksRef.get()); }));
  addUnlisten(listen('quick-countdown', (event) => {
    const duration = event.payload;
    const task = createCountdownTask();
    const mins = Math.floor(duration / 60);
    task.label = _t('flight.quick_countdown_label', { mins });
    task.duration = duration; task._remaining = duration; task._status = 'idle';
    const tasks = tasksRef.get();
    tasks.push(task);
    saveTasks(getCleanTasks(tasks));
    startCountdown(task);
    renderTaskView();
    showToast(_t('flight.quick_countdown_started', { mins }));
  }));

  const w = getCurrentWebviewWindow();
  addUnlisten(w.onCloseRequested(async (e) => {
    e.preventDefault();
    await saveTasks(getCleanTasks(tasksRef.get()));
    await w.hide();
  }));

  setTimeout(() => { void autoCheckForUpdate(); }, 3000);
}
