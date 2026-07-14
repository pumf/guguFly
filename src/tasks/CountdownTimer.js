import { getAllUpcomingTasks } from './AlarmChecker.js';

let AccurateTimer;
let renderTaskViewFn;
let saveTasksFn;
let getCleanTasksFn;
let getTasksFn;
let updateCountdownTaskUIFn;
let taskListEl;
let holidayPresets;
let doTriggerFlightFn;
let updateMiniWindowFn;

export function initCountdownTimer(ctx) {
  AccurateTimer = ctx.AccurateTimer;
  renderTaskViewFn = ctx.renderTaskView;
  saveTasksFn = ctx.saveTasks;
  getCleanTasksFn = ctx.getCleanTasks;
  getTasksFn = ctx.getTasks;
  updateCountdownTaskUIFn = ctx.updateCountdownTaskUI;
  taskListEl = ctx.taskListEl;
  holidayPresets = ctx.holidayPresets;
  doTriggerFlightFn = ctx.doTriggerFlight;
  updateMiniWindowFn = ctx.updateMiniWindow;

  // When the app comes back to the foreground, force an immediate tick
  // on all running countdowns. Browsers and Tauri may throttle
  // setTimeout in the background, so the UI can be stale. The timer
  // recalculates from Date.now(), so accuracy is preserved.
  // Also force a mini window update so the floating countdown refreshes.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const tasks = getTasksFn ? getTasksFn() : [];
      tasks.forEach(t => {
        if (t.type === 'countdown' && t._status === 'running' && t._timer && typeof t._timer.forceUpdate === 'function') {
          t._timer.forceUpdate();
        }
      });
      // Push fresh data to the mini window immediately
      if (updateMiniWindowFn && getAllUpcomingTasks) {
        try { updateMiniWindowFn(getAllUpcomingTasks()); } catch (miniErr) {
          console.error('mini window refresh failed:', miniErr);
        }
      }
    });
  }
}

export function startCountdown(task) {
  // Refuse to start during the "completed" window when a flight is
  // being triggered — this prevents the user from racing the post-
  // flight animation and overwriting the in-flight task state.
  if (task._status === 'completed') return;
  let enabledChanged = false;
  if (!task.enabled) { task.enabled = true; enabledChanged = true; }
  if (task._status === 'paused' && task._timer) {
    task._status = 'running';
    if (enabledChanged) saveTasksFn(getCleanTasksFn(getTasksFn()));
    task._timer.resume();
    renderTaskViewFn();
    return;
  }
  // Defensive: stop any existing timer before creating a new one.
  // Without this, a stray running timer can leak if startCountdown
  // is called twice in quick succession.
  if (task._timer) {
    try { task._timer.stop(); } catch (e) { console.error('stale timer stop failed:', e); }
    task._timer = null;
  }
  // Validate that we have a positive remaining value. If _remaining
  // is missing or zero (e.g., a completed countdown being restarted),
  // fall back to the full duration.
  let remaining = task._remaining;
  if (typeof remaining !== 'number' || remaining <= 0) {
    remaining = task.duration;
  }
  task._remaining = remaining;
  const duration = remaining * 1000;
  task._status = 'running';
  task._timer = new AccurateTimer(duration,
    (remaining) => {
      const secs = Math.round(remaining / 1000);
      if (secs === task._remaining) return;
      task._remaining = secs;
      updateCountdownTaskUIFn(task, { taskListEl, holidayPresets });
    },
    () => onCountdownComplete(task)
  );
  task._timer.start();
  if (enabledChanged) saveTasksFn(getCleanTasksFn(getTasksFn()));
  renderTaskViewFn();
}

export function pauseCountdown(task) {
  if (!task._timer || task._status !== 'running') return;
  task._timer.pause();
  task._status = 'paused';
  task._remaining = Math.ceil(task._timer.remaining / 1000);
  renderTaskViewFn();
}

export function stopCountdown(task) {
  if (task._timer) { task._timer.stop(); task._timer = null; }
  task._status = 'idle';
  task._remaining = task.duration;
  renderTaskViewFn();
}

export async function onCountdownComplete(task) {
  task._status = 'completed';
  renderTaskViewFn();
  if (doTriggerFlightFn) await doTriggerFlightFn(task);
  task._status = 'idle';
  task._remaining = task.duration;
  // Detach the completed timer reference so a subsequent
  // startCountdown doesn't see a stale timer.
  if (task._timer) {
    try { task._timer.stop(); } catch (e) { console.error('completed timer stop failed:', e); }
    task._timer = null;
  }
  renderTaskViewFn();
}

export function stopAllCountdowns(tasks) {
  tasks.forEach(t => {
    if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) {
      stopCountdown(t);
    }
  });
}
