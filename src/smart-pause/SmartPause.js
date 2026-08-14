import { invoke } from '@tauri-apps/api/core';

let enabled = false;
let checkInterval = null;
let currentContext = {
  fullscreen: false,
  in_meeting: false,
  screen_recording: false,
  dnd: false,
};
let previousContext = { ...currentContext };

const CHECK_INTERVAL_MS = 5000;

let onContextChange = null;
let onPostponeResolved = null;
let postponedFlights = [];
let showToastFn = null;

export function initSmartPause(ctx) {
  showToastFn = ctx.showToast;
  onContextChange = ctx.onContextChange || null;
  onPostponeResolved = ctx.onPostponeResolved || null;
}

export function setSmartPauseEnabled(val) {
  enabled = !!val;
  if (enabled && !checkInterval) {
    startPolling();
  } else if (!enabled && checkInterval) {
    stopPolling();
  }
}

export function isSmartPauseEnabled() {
  return enabled;
}

export function getSmartPauseContext() {
  return { ...currentContext };
}

export function shouldPauseFlight(task) {
  if (!enabled) return false;

  if (currentContext.dnd) return true;
  if (currentContext.in_meeting) return true;
  if (currentContext.fullscreen) return true;
  if (currentContext.screen_recording) return true;

  return false;
}

export function getPauseReasonLabel(reason) {
  const reasonMap = {
    dnd: 'smart_pause.reason_dnd',
    meeting: 'smart_pause.reason_meeting',
    fullscreen: 'smart_pause.reason_fullscreen',
    recording: 'smart_pause.reason_recording',
    pomodoro_focus: 'pomodoro.focus_mode',
  };
  return reasonMap[reason] || reason;
}

export function getPauseReason() {
  if (currentContext.dnd) return 'dnd';
  if (currentContext.in_meeting) return 'meeting';
  if (currentContext.fullscreen) return 'fullscreen';
  if (currentContext.screen_recording) return 'recording';
  return null;
}

export function postponeFlight(flight) {
  postponedFlights.push({
    ...flight,
    postponedAt: Date.now(),
  });
}

export function getPostponedFlights() {
  return [...postponedFlights];
}

export function clearPostponedFlights() {
  postponedFlights = [];
}

async function checkContext() {
  try {
    const ctx = await invoke('check_system_context');
    previousContext = { ...currentContext };
    currentContext = {
      fullscreen: !!ctx.fullscreen,
      in_meeting: !!ctx.in_meeting,
      screen_recording: !!ctx.screen_recording,
      dnd: !!ctx.dnd,
    };

    const wasPaused = isContextPaused(previousContext);
    const isPaused = isContextPaused(currentContext);

    if (wasPaused && !isPaused) {
      onPostponeResolved?.(postponedFlights);
      postponedFlights = [];
    }

    if (JSON.stringify(previousContext) !== JSON.stringify(currentContext)) {
      onContextChange?.(currentContext);
    }
  } catch (err) {
    console.error('[SmartPause] check failed:', err);
  }
}

function isContextPaused(ctx) {
  return ctx.dnd || ctx.in_meeting || ctx.fullscreen || ctx.screen_recording;
}

function startPolling() {
  checkContext();
  checkInterval = setInterval(checkContext, CHECK_INTERVAL_MS);
}

function stopPolling() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

export function destroy() {
  stopPolling();
  postponedFlights = [];
}
