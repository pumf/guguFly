let AccurateTimer;
let renderTaskViewFn;
let saveTasksFn;
let getCleanTasksFn;
let getTasksFn;
let updateCountdownTaskUIFn;
let taskListEl;
let holidayPresets;
let doTriggerFlightFn;

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
}

export function startCountdown(task) {
  let enabledChanged = false;
  if (!task.enabled) { task.enabled = true; enabledChanged = true; }
  if (task._status === 'paused' && task._timer) {
    task._status = 'running';
    if (enabledChanged) saveTasksFn(getCleanTasksFn(getTasksFn()));
    task._timer.resume();
    renderTaskViewFn();
    return;
  }
  const duration = (task._remaining || task.duration) * 1000;
  task._status = 'running';
  task._remaining = task._remaining || task.duration;
  task._timer = new AccurateTimer(duration,
    (remaining) => {
      const secs = Math.ceil(remaining / 1000);
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
  renderTaskViewFn();
}

export function stopAllCountdowns(tasks) {
  tasks.forEach(t => {
    if (t.type === 'countdown' && (t._status === 'running' || t._status === 'paused')) {
      stopCountdown(t);
    }
  });
}
