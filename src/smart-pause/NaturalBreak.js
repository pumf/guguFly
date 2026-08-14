import { invoke } from '@tauri-apps/api/core';

let enabled = false;
let idleThreshold = 30;
let checkInterval = null;
let lastIdleTime = 0;
let showToastFn = null;

const CHECK_INTERVAL_MS = 5000;
const IDLE_THRESHOLD_DEFAULT = 30;

export function initNaturalBreak(ctx) {
  showToastFn = ctx.showToast;
}

export function setNaturalBreakEnabled(val) {
  enabled = !!val;
  if (enabled && !checkInterval) {
    startPolling();
  } else if (!enabled && checkInterval) {
    stopPolling();
  }
}

export function isNaturalBreakEnabled() {
  return enabled;
}

export function setIdleThreshold(seconds) {
  idleThreshold = Math.max(10, Math.min(300, seconds || IDLE_THRESHOLD_DEFAULT));
}

export function getIdleThreshold() {
  return idleThreshold;
}

export function isUserIdle() {
  return lastIdleTime >= idleThreshold;
}

export function getLastIdleTime() {
  return lastIdleTime;
}

export function shouldDeferFlight() {
  if (!enabled) return false;
  return lastIdleTime < idleThreshold;
}

async function checkIdleTime() {
  try {
    const idle = await invoke('get_idle_time');
    lastIdleTime = typeof idle === 'number' ? idle : 0;
  } catch (err) {
    console.error('[NaturalBreak] check failed:', err);
  }
}

function startPolling() {
  checkIdleTime();
  checkInterval = setInterval(checkIdleTime, CHECK_INTERVAL_MS);
}

function stopPolling() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

export function destroy() {
  stopPolling();
  lastIdleTime = 0;
}
