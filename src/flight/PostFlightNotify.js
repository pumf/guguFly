import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../utils.js';
import { t } from '../i18n/index.js';

let pfNotifyWin = null;
let pendingPfCancel = null;
let pfAutoClosing = false;
let pfUnlistenClick = null;
let postFlightCancelled = false;
let postFlightTimeout = null;
let pendingPostFlightJob = null;
let activeFlightJobRef = null;
let pfActionHandler = null;
let showToastFn = null;

export function initPostFlightNotify(ctx) {
  activeFlightJobRef = ctx.getActiveFlightJob;
  pfActionHandler = ctx.pfActionHandler;
  showToastFn = ctx.showToast;
}

export function setPendingPfCancel(fn) { pendingPfCancel = fn; }
export function getPendingPfCancel() { return pendingPfCancel; }
export function clearPendingPfCancel() { pendingPfCancel = null; }

export function getPostFlightState() {
  return { postFlightCancelled, postFlightTimeout, pendingPostFlightJob };
}

export function setPostFlightCancelled(v) { postFlightCancelled = v; }
export function setPostFlightTimeout(v) { postFlightTimeout = v; }
export function setPendingPostFlightJob(v) { pendingPostFlightJob = v; }

export function resetPfNotifyState() {
  pfNotifyWin = null;
  pfAutoClosing = false;
  if (pfUnlistenClick) {
    try { pfUnlistenClick(); } catch (e) { console.error('pfUnlistenClick failed:', e); }
  }
}

async function cleanupPostFlightNotify() {
  if (pfUnlistenClick) {
    try { pfUnlistenClick(); } catch (error) {
      console.error('post-flight unlisten failed:', error);
    }
    pfUnlistenClick = null;
  }
  if (pfNotifyWin) {
    pfAutoClosing = true;
    try { await pfNotifyWin.close(); } catch (error) {
      console.error('post-flight close failed:', error);
    }
    pfNotifyWin = null;
  }
  pfAutoClosing = false;
}

export async function closePostFlightNotify() {
  await cleanupPostFlightNotify();
}

export async function showPostFlightNotify(action) {
  if (!isTauriRuntime()) return;
  try {
    await cleanupPostFlightNotify();

    const sw = screen.availWidth || 1440;
    const sh = screen.availHeight || 900;
    pfNotifyWin = new WebviewWindow('gugufly-pfnotify', {
      url: '/postflight-notify.html',
      width: 380, height: 80,
      x: Math.round((sw - 380) / 2), y: Math.round(sh * 0.65),
      transparent: true, decorations: false,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, focus: false, visible: true,
    });

    const job = activeFlightJobRef?.();
    const pfVideoFile = job?.postFlight?.videoFile || 'cat.mov';
    const pfEffectType = job?.postFlight?.effectType || 'fireworks';
    const builtinLabels = { 'cat.mov': t('postflight.video.cat'), 'dog.mov': t('postflight.video.dog') };
    const videoLabel = (action === 'video') ? (builtinLabels[pfVideoFile] || t('postflight.video.cat')) : '';
    const effectLabels = { fireworks: t('postflight.effect.fireworks'), firecrackers: t('postflight.effect.firecrackers'), emojis: t('postflight.effect.emojis'), rainbow: t('postflight.effect.rainbow'), bubbles: t('postflight.effect.bubbles') };
    const effectLabel = (action === 'effect') ? (effectLabels[pfEffectType] || t('postflight.effect.fireworks')) : '';
    const labels = { app: t('postflight.app'), url: t('postflight.url'), lock: t('postflight.lock'), folder: t('postflight.folder'), tts: t('postflight.tts'), script: t('postflight.script'), video: videoLabel, effect: effectLabel };
    const label = labels[action] || action;
    const fullText = t('postflight.label', { label });

    pfNotifyWin.once('tauri://created', async () => {
      try {
        await new Promise(r => setTimeout(r, 150));
        await emit('pf-notify-set-label', { label: fullText });
      } catch (error) {
        console.error('post-flight notify label failed:', error);
      }
    });

    pfNotifyWin.onCloseRequested(() => {
      if (!pfAutoClosing && pendingPfCancel) {
        pendingPfCancel();
        pendingPfCancel = null;
      }
    });
    pfNotifyWin.once('tauri://error', (error) => console.error('post-flight notify window error:', error));

    if (pfUnlistenClick) {
      try { pfUnlistenClick(); } catch (error) {
        console.error('post-flight stale unlisten failed:', error);
      }
      pfUnlistenClick = null;
    }
    const unlisten = await listen('pf-notify-clicked', async () => {
      postFlightCancelled = true;
      if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
      await cleanupPostFlightNotify();
      if (showToastFn) showToastFn(t('toast.cancelled_postflight'));
    });
    pfUnlistenClick = unlisten;

    const unlistenAction = await listen('pf-action', async (event) => {
      const { action: act, minutes } = event.payload || {};
      if (act === 'skip') {
        if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
        pendingPostFlightJob = null;
        postFlightCancelled = true;
      }
      if (pfActionHandler) {
        await pfActionHandler(act, { minutes, task: job?.task });
      }
      await cleanupPostFlightNotify();
    });
    if (pfUnlistenClick) {
      const prevUnlisten = pfUnlistenClick;
      pfUnlistenClick = () => {
        try { prevUnlisten(); } catch (_) { /* cleanup */ }
        try { unlistenAction(); } catch (_) { /* cleanup */ }
      };
    }
  } catch (e) { console.error('showPostFlightNotify failed:', e); }
}
