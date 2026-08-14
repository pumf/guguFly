import { t } from '../i18n/index.js';

let AccurateTimer;
let renderTaskViewFn;
let saveTasksFn;
let getCleanTasksFn;
let getTasksFn;
let doTriggerFlightFn;
let showToastFn;
let updateMiniWindowFn;
let onTickFn = null;
let onBreakStartFn = null;

const POMODORO_CONFIG = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  roundsBeforeLong: 4,
};

let pomodoroState = {
  active: false,
  phase: 'work',
  round: 1,
  totalRounds: POMODORO_CONFIG.roundsBeforeLong,
  remaining: POMODORO_CONFIG.work,
  timer: null,
  task: null,
};

export function initPomodoroTimer(ctx) {
  AccurateTimer = ctx.AccurateTimer;
  renderTaskViewFn = ctx.renderTaskView;
  saveTasksFn = ctx.saveTasks;
  getCleanTasksFn = ctx.getCleanTasks;
  getTasksFn = ctx.getTasks;
  doTriggerFlightFn = ctx.doTriggerFlight;
  showToastFn = ctx.showToast;
  updateMiniWindowFn = ctx.updateMiniWindow;
}

export function setPomodoroTickCallback(fn) {
  onTickFn = fn;
}

export function setPomodoroBreakStartCallback(fn) {
  onBreakStartFn = fn;
}

export function getPomodoroState() {
  return { ...pomodoroState };
}

export function isPomodoroActive() {
  return pomodoroState.active;
}

export function startPomodoro(workMinutes = 25) {
  if (pomodoroState.active) return;

  pomodoroState.active = true;
  pomodoroState.phase = 'work';
  pomodoroState.round = 1;
  pomodoroState.remaining = workMinutes * 60;
  pomodoroState.task = {
    id: Date.now(),
    type: 'countdown',
    label: t('pomodoro.work'),
    duration: workMinutes * 60,
    _remaining: workMinutes * 60,
    _status: 'running',
  };

  startPomodoroPhase();
  renderTaskViewFn();
  showToastFn(t('pomodoro.started', { minutes: workMinutes }));
}

function startPomodoroPhase() {
  const duration = pomodoroState.remaining * 1000;
  pomodoroState.timer = new AccurateTimer(
    duration,
    (remaining) => {
      const secs = Math.round(remaining / 1000);
      pomodoroState.remaining = secs;
      if (pomodoroState.task) {
        pomodoroState.task._remaining = secs;
      }
      if (onTickFn) onTickFn();
    },
    () => onPomodoroPhaseComplete()
  );
  pomodoroState.timer.start();
}

function onPomodoroPhaseComplete() {
  const { phase, round, totalRounds } = pomodoroState;

  if (pomodoroState.task && doTriggerFlightFn) {
    doTriggerFlightFn(pomodoroState.task);
  }

  if (phase === 'work') {
    if (round % totalRounds === 0) {
      pomodoroState.phase = 'longBreak';
      pomodoroState.remaining = POMODORO_CONFIG.longBreak;
      showToastFn(t('pomodoro.long_break', { minutes: POMODORO_CONFIG.longBreak / 60 }));
    } else {
      pomodoroState.phase = 'shortBreak';
      pomodoroState.remaining = POMODORO_CONFIG.shortBreak;
      showToastFn(t('pomodoro.short_break', { minutes: POMODORO_CONFIG.shortBreak / 60 }));
    }
    if (onBreakStartFn) onBreakStartFn();
  } else {
    const wasLongBreak = phase === 'longBreak';
    pomodoroState.phase = 'work';
    pomodoroState.remaining = POMODORO_CONFIG.work;
    if (wasLongBreak) {
      pomodoroState.round = 1;
    } else {
      pomodoroState.round++;
    }
    showToastFn(t('pomodoro.work_resume', { round: pomodoroState.round }));
  }

  if (pomodoroState.task) {
    pomodoroState.task.label = getPhaseLabel();
    pomodoroState.task.duration = pomodoroState.remaining;
    pomodoroState.task._remaining = pomodoroState.remaining;
  }

  startPomodoroPhase();
  renderTaskViewFn();
}

function getPhaseLabel() {
  const { phase, round } = pomodoroState;
  if (phase === 'work') return t('pomodoro.work_round', { round });
  if (phase === 'shortBreak') return t('pomodoro.short_break');
  return t('pomodoro.long_break');
}

export function pausePomodoro() {
  if (!pomodoroState.active || !pomodoroState.timer) return;
  pomodoroState.timer.pause();
  if (pomodoroState.task) {
    pomodoroState.task._status = 'paused';
  }
  renderTaskViewFn();
}

export function resumePomodoro() {
  if (!pomodoroState.active || !pomodoroState.timer) return;
  pomodoroState.timer.resume();
  if (pomodoroState.task) {
    pomodoroState.task._status = 'running';
  }
  renderTaskViewFn();
}

export function stopPomodoro() {
  if (!pomodoroState.active) return;
  if (pomodoroState.timer) {
    pomodoroState.timer.stop();
    pomodoroState.timer = null;
  }
  pomodoroState.active = false;
  pomodoroState.phase = 'work';
  pomodoroState.round = 1;
  pomodoroState.remaining = POMODORO_CONFIG.work;
  pomodoroState.task = null;
  renderTaskViewFn();
  showToastFn(t('pomodoro.stopped'));
}

export function skipPomodoroPhase() {
  if (!pomodoroState.active || !pomodoroState.timer) return;
  pomodoroState.timer.stop();
  pomodoroState.timer = null;
  onPomodoroPhaseComplete();
}

export function getPomodoroTask() {
  return pomodoroState.task;
}

export function isPomodoroInWorkPhase() {
  return pomodoroState.active && pomodoroState.phase === 'work';
}

export function getPomodoroPhase() {
  return pomodoroState.active ? pomodoroState.phase : null;
}

export { POMODORO_CONFIG };
