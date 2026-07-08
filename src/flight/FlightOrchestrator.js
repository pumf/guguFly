import { t } from '../i18n/index.js';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors, currentMonitor } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getRandomQuote } from '../quotes.js';
import { SOUND_PRESETS, playPreset as playPresetSound } from '../sounds.js';
import { dataUrlToArrayBuffer, isTauriRuntime } from '../utils.js';
import { getAudioContext, unlockAudioIfNeeded } from '../ui/AudioManager.js';
import { setMuted as setAudioSystemMuted, setCustomAudioObjectUrl as setAudioSystemObjectUrl, revokeCustomAudioObjectUrl as revokeAudioSystemObjectUrl } from '../ui/AudioSystem.js';

let activeFlightJob = null;
const flightQueue = [];
const flightSequences = new Map();
let pfNotifyWin = null;
let pendingPfCancel = null;
let pfAutoClosing = false;
let pfUnlistenClick = null;

// Set to true while an emergency landing is in progress. Used by the
// flight-ended listener to suppress post-flight actions that would
// otherwise create new video/effect windows while we're cleaning up.
let emergencyLandingActive = false;

export function setEmergencyLandingActive(active) {
  emergencyLandingActive = !!active;
}

export function isEmergencyLandingActive() {
  return emergencyLandingActive;
}

let activeVideoWin = null;
// Simple mutex guard for the activeVideoWin check-and-close pattern.
// Prevents TOCTOU races when two post-flight actions fire concurrently.
let videoWinMutex = false;
const builtInVideoCache = new Map();
// In-flight cache lookups. If multiple flights fire simultaneously
// and request the same video, share a single backend call instead of
// each one calling download_builtin_video independently.
const builtInVideoCacheInFlight = new Map();

let isMuted = false;
let soundSelectEl = null;
let soundModeSelectEl = null;
let useSoundCheckboxEl = null;
let customAudioData_ = '';
let customAudioObjectUrl_ = '';
let speedSelectEl = null;
let heightSelectEl = null;
let effectSelectEl = null;
let planeSelectEl = null;
let planeSizeSelectEl = null;
let particleSelectEl = null;
let bubbleSelectEl = null;
let bubblePositionSelectEl = null;
let bubbleSizeSelectEl = null;
let bubbleBgColorEl = null;
let bubbleFontColorEl = null;
let displaySelectEl = null;
let customImageData_ = '';
let useImageCheckboxEl = null;

let loopAudio = null;
let loopOscInterval = null;
let customAudioProbe = null;
let previewAudioHandle = null;

let updateTaskFlightCb = null;
let isInQuietHoursFn = null;
let skipPostFlight = false; // Set by skipCurrentFlight to suppress post-flight

export function setUpdateTaskFlightCb(cb) { updateTaskFlightCb = cb; }
export function setIsInQuietHoursFn(fn) { isInQuietHoursFn = fn; }
export function setSkipPostFlight(skip) { skipPostFlight = !!skip; }

export function initFlightOrchestrator(config) {
  soundSelectEl = config.soundSelect;
  soundModeSelectEl = config.soundModeSelect;
  useSoundCheckboxEl = config.useSoundCheckbox;
  speedSelectEl = config.speedSelect;
  heightSelectEl = config.heightSelect;
  effectSelectEl = config.effectSelect;
  planeSelectEl = config.planeSelect;
  planeSizeSelectEl = config.planeSizeSelect;
  particleSelectEl = config.particleSelect;
  bubbleSelectEl = config.bubbleSelect;
  bubblePositionSelectEl = config.bubblePositionSelect;
  bubbleSizeSelectEl = config.bubbleSizeSelect;
  bubbleBgColorEl = config.bubbleBgColor;
  bubbleFontColorEl = config.bubbleFontColor;
  displaySelectEl = config.displaySelect;
  useImageCheckboxEl = config.useImageCheckbox;
}

function stopSource(source) {
  try {
    source.stop();
  } catch {
    // Source may already be stopped.
  }
}

export function setCustomImageData(data) { customImageData_ = data; }
export function setCustomAudioData(data) { customAudioData_ = data; }
export function setCustomAudioObjectUrl(url) {
  // Revoke the previous URL before overwriting to avoid leaking the
  // blob-backed ObjectURL each time the audio is changed. This is
  // the canonical setter — use it from any module to update the
  // shared ObjectURL reference.
  if (customAudioObjectUrl_ && customAudioObjectUrl_ !== url) {
    try { URL.revokeObjectURL(customAudioObjectUrl_); } catch (e) {
      console.error('revoke old custom audio URL failed:', e);
    }
  }
  customAudioObjectUrl_ = url || '';
  // Keep AudioSystem in sync — both modules hold the same ObjectURL
  // so that playCustomAudio and revokeCustomAudioObjectUrl see the
  // same value in either context. AudioSystem's setter also revokes
  // its previous URL, but since the URLs are the same instance we
  // don't double-revoke.
  setAudioSystemObjectUrl(url);
}

// Look up (or fetch) the local cached path for a built-in video.
// Returns the absolute path on disk if the file exists or after
// downloading it; returns null on error. Multiple concurrent callers
// requesting the same video share a single backend invocation.
export async function resolveBuiltinVideoPath(name) {
  if (!name || !isTauriRuntime()) return null;
  // In-memory cache hit — instant, no IPC.
  const cached = builtInVideoCache.get(name);
  if (cached) return cached;
  // Dedup: share a single in-flight lookup if one is already running.
  const inFlight = builtInVideoCacheInFlight.get(name);
  if (inFlight) return inFlight;
  // Otherwise call the backend. Rust returns immediately if the file
  // is already on disk, so this is fast for warm-cache scenarios.
  const { invoke } = await import('@tauri-apps/api/core');
  const promise = (async () => {
    try {
      const path = await invoke('download_builtin_video', { name });
      builtInVideoCache.set(name, path);
      return path;
    } catch (e) {
      console.warn('resolveBuiltinVideoPath failed for', name, e);
      return null;
    } finally {
      builtInVideoCacheInFlight.delete(name);
    }
  })();
  builtInVideoCacheInFlight.set(name, promise);
  return promise;
}
export function revokeCustomAudioObjectUrl() {
  if (customAudioObjectUrl_) {
    URL.revokeObjectURL(customAudioObjectUrl_);
    customAudioObjectUrl_ = '';
  }
  // Also clear AudioSystem's copy so revoke is consistent.
  revokeAudioSystemObjectUrl();
}
export function setMuted(muted) {
  isMuted = muted;
  // Keep AudioSystem in sync so that AudioSystem.playCustomAudio
  // (used in modal preview) honors the same mute state.
  setAudioSystemMuted(muted);
}

export function createSequenceId(taskId) {
  return `seq-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSequence(sequenceId) {
  if (!sequenceId) return null;
  return flightSequences.get(sequenceId) || null;
}

export function clearSequence(sequenceId) {
  const state = getSequence(sequenceId);
  if (!state) return;
  if (state.intervalId) clearTimeout(state.intervalId);
  if (state.timeoutId) clearTimeout(state.timeoutId);
  flightSequences.delete(sequenceId);
}

export function clearAllSequences() {
  for (const [sequenceId, state] of flightSequences.entries()) {
    if (state.intervalId) clearTimeout(state.intervalId);
    if (state.timeoutId) clearTimeout(state.timeoutId);
    flightSequences.delete(sequenceId);
  }
}

export function clearFlightQueue() {
  flightQueue.length = 0;
  activeFlightJob = null;
}

export function hasActiveSequences() {
  return flightSequences.size > 0;
}

// Reset video/effect window state after emergency landing.
// The window's onCloseRequested handler normally sets activeVideoWin=null,
// but in an emergency we close windows directly, so we need to reset
// the reference and the mutex to prevent stale references.
export function resetVideoWindowState() {
  activeVideoWin = null;
  videoWinMutex = false;
}

// Register cleanup hooks on a video/effect window so that the
// activeVideoWin reference is cleared whether the window is closed
// via the user (Escape key → onCloseRequested), the OS, or destroyed
// by Tauri's internals (tauri://destroyed). Without this, an
// externally-killed window leaves a stale reference and the next
// flight blocks for up to 1s on the videoWinMutex.
function bindVideoWindowCleanup(win) {
  if (!win) return;
  const clear = () => {
    if (activeVideoWin === win) {
      activeVideoWin = null;
    }
  };
  try { win.onCloseRequested(clear); } catch (e) {
    console.error('video window onCloseRequested bind failed:', e);
  }
  try { win.once('tauri://destroyed', clear); } catch (e) {
    console.error('video window destroyed bind failed:', e);
  }
}

// Wait for the video/effect mutex to release. The mutex is only held
// during window creation (a few ms), so if it's locked, the previous
// operation should complete imminently. We wait up to 1s before
// giving up. This prevents silently dropping post-flight actions when
// two flights fire in rapid succession.
async function waitForVideoMutex(timeoutMs = 1000) {
  const start = Date.now();
  while (videoWinMutex && (Date.now() - start) < timeoutMs) {
    await new Promise(r => setTimeout(r, 10));
  }
}

// Reset post-flight notify window state. Same rationale as above.
export function resetPfNotifyState() {
  pfNotifyWin = null;
  pfAutoClosing = false;
  if (pfUnlistenClick) {
    try { pfUnlistenClick(); } catch (pfErr) { console.error('pfUnlistenClick failed:', pfErr); }
  }
}

export function isMutedFn() { return isMuted; }

export function getActiveFlightJob() { return activeFlightJob; }

const KNOWN_SOUND_VALUES = new Set(SOUND_PRESETS.map(p => p.value));

function buildCustomAudioObjectUrl() {
  revokeCustomAudioObjectUrl();
  if (!customAudioData_) return '';
  const mimeMatch = customAudioData_.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] || 'audio/mpeg';
  const bytes = new Uint8Array(dataUrlToArrayBuffer(customAudioData_));
  const blob = new Blob([bytes], { type: mimeType });
  customAudioObjectUrl_ = URL.createObjectURL(blob);
  return customAudioObjectUrl_;
}

async function playCustomAudio(loopMode) {
  const objectUrl = customAudioObjectUrl_ || buildCustomAudioObjectUrl();
  const audio = new Audio(objectUrl || customAudioData_);
  audio.loop = loopMode;
  audio.volume = 0.58;
  audio.preload = 'auto';
  audio.currentTime = 0;

  try {
    await audio.play();
    if (loopMode) {
      loopAudio = audio;
    } else {
      audio.addEventListener('ended', () => { audio.src = ''; }, { once: true });
    }
    return audio;
  } catch {
    const audioCtx = await getAudioContext();
    const decoded = await audioCtx.decodeAudioData(dataUrlToArrayBuffer(customAudioData_));
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = decoded;
    source.loop = loopMode;
    gain.gain.setValueAtTime(0.52, audioCtx.currentTime);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
    if (loopMode) {
      loopAudio = { pause() { stopSource(source); } };
    }
    return { pause() { stopSource(source); } };
  }
}

export function stopLoopSound() {
  if (loopAudio) {
    loopAudio.pause();
    loopAudio = null;
  }
  if (loopOscInterval) {
    clearInterval(loopOscInterval);
    loopOscInterval = null;
  }
}

export function stopPreviewAudio() {
  if (!previewAudioHandle) return;
  try {
    previewAudioHandle.pause();
  } catch (error) {
    console.error('preview audio stop failed:', error);
  }
  previewAudioHandle = null;
}

export async function validateCustomAudioPreview() {
  if (!customAudioData_) return true;
  try {
    if (customAudioProbe) {
      customAudioProbe.pause();
      customAudioProbe.src = '';
      customAudioProbe = null;
    }
    const objectUrl = customAudioObjectUrl_ || buildCustomAudioObjectUrl();
    const probe = new Audio(objectUrl || customAudioData_);
    probe.preload = 'auto';
    customAudioProbe = probe;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        probe.removeEventListener('canplaythrough', onReady);
        probe.removeEventListener('error', onError);
      };
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('audio_load_failed')); };
      probe.addEventListener('canplaythrough', onReady, { once: true });
      probe.addEventListener('error', onError, { once: true });
      probe.load();
      setTimeout(() => { cleanup(); resolve(); }, 1200);
    });
    return true;
  } catch {
    return false;
  }
}

export { buildCustomAudioObjectUrl };

async function playSound() {
  if (isMuted) return;
  stopLoopSound();
  await unlockAudioIfNeeded();

  const sound = soundSelectEl.value;
  const loopMode = soundModeSelectEl.value === 'loop';
  const useCustomSound = useSoundCheckboxEl.checked && customAudioData_;

  if (useCustomSound) {
    void playCustomAudio(loopMode).catch(() => {
      showToast(t('toast.custom_audio_fallback'));
      void playOscillator(sound, playPresetSound);
      if (loopMode) {
        loopOscInterval = setInterval(() => { void playOscillator(sound, playPresetSound); }, 800);
      }
    });
    return;
  }

  void playOscillator(sound, playPresetSound);
  if (loopMode) {
    loopOscInterval = setInterval(() => { void playOscillator(sound, playPresetSound); }, 800);
  }
}

async function playOscillator(sound, playPresetSound) {
  try {
    if (!KNOWN_SOUND_VALUES.has(sound)) sound = 'whoosh';
    const audioCtx = await getAudioContext();
    await playPresetSound(audioCtx, sound);
  } catch (error) {
    console.error('preset sound failed:', error);
  }
}

let showToast = (msg) => { console.warn('[FlightOrchestrator] showToast called before init:', msg); };
export function setToastFn(fn) { showToast = fn; }

// Single canonical cleanup for the post-flight notify window. Closes
// the window, detaches the click listener, and clears the references.
// Callers should never duplicate this logic inline.
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

async function showPostFlightNotify(action) {
  if (!isTauriRuntime()) return;
  try {
    // Always clean up any prior notify window before creating a new one.
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

    const pfVideoFile = activeFlightJob?.postFlight?.videoFile || 'cat.mov';
    const pfEffectType = activeFlightJob?.postFlight?.effectType || 'fireworks';
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

    // Defensive: if any stale unlisten remains, clean it before registering new one.
    if (pfUnlistenClick) {
      try { pfUnlistenClick(); } catch (error) {
        console.error('post-flight stale unlisten failed:', error);
      }
      pfUnlistenClick = null;
    }
    const unlisten = await listen('pf-notify-clicked', async () => {
      // Mark as cancelled - don't clear pendingPostFlightJob yet
      // The flight-ended handler will check this flag and skip execution
      postFlightCancelled = true;
      if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
      
      // Close the popup
      await cleanupPostFlightNotify();
      
      // Show toast
      if (showToast) showToast(t('toast.cancelled_postflight'));
    });
    pfUnlistenClick = unlisten;

    const unlistenAction = await listen('pf-action', async (event) => {
      const { action, minutes } = event.payload || {};
      if (action === 'skip') {
        if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
        pendingPostFlightJob = null;
        postFlightCancelled = true;
      }
      if (pfActionHandler) {
        await pfActionHandler(action, { minutes, task: activeFlightJob?.task });
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

export async function closePostFlightNotify() {
  await cleanupPostFlightNotify();
}

export function setPendingPfCancel(fn) { pendingPfCancel = fn; }
export function getPendingPfCancel() { return pendingPfCancel; }
// Clear the pendingPfCancel without invoking it. Used by emergency
// landing to ensure stale closures don't reference a no-longer-active
// flight job.
export function clearPendingPfCancel() {
  pendingPfCancel = null;
}

let pfActionHandler = null;
let pendingPostFlightJob = null;
let postFlightTimeout = null;
let postFlightCancelled = false;

export function setPfActionHandler(handler) { pfActionHandler = handler; }

async function processFlightQueue() {
  if (activeFlightJob || !flightQueue.length) return;
  const nextJob = flightQueue.shift();
  activeFlightJob = nextJob;
  try {
    if (nextJob.playSound && !isMuted) await playSound();
    await createFlightWindow(nextJob.msg, nextJob.direction, nextJob.sequenceId, nextJob.imageData, nextJob.useImage);
    // Bail out if an emergency landing was triggered during the flight.
    // Without this, an in-flight processFlightQueue would still try
    // to open the post-flight notify window while the emergency flow
    // is closing everything.
    if (emergencyLandingActive) {
      activeFlightJob = null;
      return;
    }
    if (nextJob.postFlight && nextJob.postFlight.action !== 'none') {
      pendingPostFlightJob = nextJob;
      postFlightCancelled = false;
      pendingPfCancel = () => { 
        if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
        postFlightCancelled = true;
      };
      showPostFlightNotify(nextJob.postFlight.action);
    }
  } catch (e) {
    console.error('flight job failed:', e);
    releaseFlightQueue();
  }
}

export function queueFlight(job) {
  flightQueue.push(job);
  void processFlightQueue();
}

export function releaseFlightQueue() {
  activeFlightJob = null;
  void processFlightQueue();
}

async function createFlightWindow(msg, direction = 'ltr', sequenceId = '', taskImageData = null, taskUseImage = null) {
  if (!isTauriRuntime()) return;

  const speed = speedSelectEl.value;
  const height = heightSelectEl.value;
  const effect = effectSelectEl.value;
  const plane = planeSelectEl.value;
  const planeSize = planeSizeSelectEl?.value || '1';
  const particle = particleSelectEl.value;
  const bubble = bubbleSelectEl.value;
  const bubblePosition = bubblePositionSelectEl.value;
  const bubbleSize = bubbleSizeSelectEl?.value || '1';

  const effectiveImage = taskImageData !== null ? taskImageData : customImageData_;
  const effectiveUseImage = taskUseImage !== null ? taskUseImage : useImageCheckboxEl.checked;

  // Determine which monitors to fly on
  let monitorConfigs = [];
  if (displaySelectEl.value === 'all') {
    try {
      const monitors = await availableMonitors();
      monitorConfigs = monitors.map(m => ({
        x: m.position.x / (m.scaleFactor || 1),
        y: m.position.y / (m.scaleFactor || 1),
        w: m.size.width / (m.scaleFactor || 1),
        h: m.size.height / (m.scaleFactor || 1),
      }));
    } catch (error) {
      console.error('available monitors failed:', error);
      monitorConfigs = [{ x: 0, y: 0, w: screen.width, h: screen.height }];
    }
  } else {
    let mx = 0, my = 0, mw = screen.width, mh = screen.height;
    if (displaySelectEl.value === 'active') {
      try {
        const monitor = await currentMonitor();
        if (monitor) {
          const sf = monitor.scaleFactor || 1;
          mx = monitor.position.x / sf;
          my = monitor.position.y / sf;
          mw = monitor.size.width / sf;
          mh = monitor.size.height / sf;
        }
      } catch (error) {
        console.error('active monitor lookup failed:', error);
      }
    }
    monitorConfigs = [{ x: mx, y: my, w: mw, h: mh }];
  }

  // Store common settings once (applies to all windows)
  localStorage.setItem('_flightImage', effectiveImage || '');
  localStorage.setItem('_flightUseImage', effectiveUseImage ? '1' : '0');
  localStorage.setItem('_flightSpeed', speed);
  localStorage.setItem('_flightHeight', height);
  localStorage.setItem('_flightEffect', effect);
  localStorage.setItem('_flightPlane', plane);
  localStorage.setItem('_flightPlaneSize', planeSize);
  localStorage.setItem('_flightParticle', particle);
  localStorage.setItem('_flightBubble', bubble);
  localStorage.setItem('_flightBubblePos', bubblePosition);
  localStorage.setItem('_flightBubbleSize', bubbleSize);
  localStorage.setItem('_flightBubbleBgColor', bubbleBgColorEl?.value || '');
  localStorage.setItem('_flightBubbleFontColor', bubbleFontColorEl?.value || '');
  localStorage.setItem('_flightMsg', msg);
  localStorage.setItem('_flightDir', direction);
  localStorage.setItem('_flightSeq', sequenceId);

  const ua = navigator.userAgent;
  const isLinux = ua.includes('Linux') && !ua.includes('Android');
  if (isLinux && isTauriRuntime()) {
    try {
      const compositorOk = await invoke('is_compositor_available');
      if (!compositorOk) {
        showToast(t('error.linux_compositor'), 6000);
      }
    } catch { /* ignore */ }
  }

  const ts = Date.now();
  for (const [index, mc] of monitorConfigs.entries()) {
    localStorage.setItem('_flightW', mc.w);
    localStorage.setItem('_flightH', mc.h);

    const urlParams = new URLSearchParams({
      w: mc.w, h: mc.h,
      speed, height, effect, plane, particle,
      bubble, bubblePosition,
      msg, dir: direction, seq: sequenceId,
    }).toString();

    try {
      const flightWin = new WebviewWindow(`flight-${ts}-${index}`, {
        url: `/flight.html?${urlParams}`,
        width: mc.w, height: mc.h, x: mc.x, y: mc.y,
        transparent: true, decorations: false,
        alwaysOnTop: true, skipTaskbar: true,
        resizable: false, visible: true, focus: false,
      });
      flightWin.once('tauri://error', (e) => console.error('flight error:', e));
    } catch (e) {
      console.error('flight error:', e);
    }

    if (index < monitorConfigs.length - 1) {
      await new Promise(r => setTimeout(r, 120));
    }
  }
  await new Promise(r => setTimeout(r, 200));
}

export async function executePostFlightAction(postFlight) {
  if (!postFlight || postFlight.action === 'none') return;
  if (!isTauriRuntime()) return;
  if (emergencyLandingActive) return;
  // Respect the quiet-hours setting for post-flight actions too. The
  // user has explicitly opted out of disruptive reminders during
  // configured hours, so we suppress the follow-up as well.
  if (isInQuietHoursFn && typeof isInQuietHoursFn === 'function') {
    try {
      if (isInQuietHoursFn()) return;
    } catch (qhErr) {
      console.error('quiet hours check failed:', qhErr);
    }
  }
  try {
    if (postFlight.action === 'app' && postFlight.appPath) {
      // Reject any path with shell metacharacters to prevent command
      // injection. The Rust side has its own allowlist, but defense
      // in depth is cheap.
      if (/[;&|`$<>\\]/.test(postFlight.appPath)) {
        if (typeof showToast === 'function') showToast(t('validation.path_invalid'));
        return;
      }
      await invoke('open_app', { path: postFlight.appPath });
    } else if (postFlight.action === 'url' && postFlight.url) {
      // Restrict to http(s) URLs to prevent javascript: and other
      // dangerous schemes from being passed to the OS browser opener.
      const url = String(postFlight.url).trim();
      if (!/^https?:\/\//i.test(url)) {
        if (typeof showToast === 'function') showToast(t('validation.url_invalid'));
        return;
      }
      await invoke('open_url_in_browser', { url });
    } else if (postFlight.action === 'lock') {
      const confirmed = await window.showConfirm(t('validation.lock_confirm'));
      if (!confirmed) return;
      const ua = navigator.userAgent;
      const isWin = ua.includes('Win');
      const isLinux = ua.includes('Linux') && !ua.includes('Android');
      const lockScript = isWin
        ? 'rundll32.exe user32.dll,LockWorkStation'
        : isLinux
        ? 'xdg-screensaver lock'
        : 'pmset displaysleepnow';
      await invoke('run_script', { script: lockScript });
    } else if (postFlight.action === 'folder' && postFlight.folder) {
      await invoke('open_app', { path: postFlight.folder });
    } else if (postFlight.action === 'tts' && (postFlight.taskMsg || postFlight.script)) {
      const confirmed = await window.showConfirm(t('validation.tts_confirm'));
      if (!confirmed) return;
      const ttsText = (postFlight.script || postFlight.taskMsg || '').replace(/"/g, '\\"');
      const ua = navigator.userAgent;
      const isWin = ua.includes('Win');
      const isLinux = ua.includes('Linux') && !ua.includes('Android');
      const ttsScript = isWin
        ? `mshta vbscript:Execute("CreateObject(""SAPI.SpVoice"").Speak(""${ttsText}"" ) :close")`
        : isLinux
        ? `spd-say "${ttsText}"`
        : `say "${ttsText}"`;
      await invoke('run_script', { script: ttsScript });
    } else if (postFlight.action === 'script' && postFlight.script) {
      const confirmed = await window.showConfirm(t('validation.script_confirm'));
      if (!confirmed) return;
      await invoke('run_script', { script: postFlight.script });
    } else if (postFlight.action === 'effect') {
      if (videoWinMutex) await waitForVideoMutex();
      if (videoWinMutex) return;
      videoWinMutex = true;
      try {
        if (activeVideoWin) {
          try { await activeVideoWin.close(); } catch (e) { /* ignore */ }
          activeVideoWin = null;
        }
        const effectType = postFlight.effectType || 'fireworks';
        const effectDuration = postFlight.effectDuration || 15;
        const taskMsg = postFlight.taskMsg || '';
        const monitor = await currentMonitor().catch(() => null);
        const scale = monitor?.scaleFactor || 1;
        const sw = monitor ? Math.round(monitor.size.width / scale) : 1280;
        const sh = monitor ? Math.round(monitor.size.height / scale) : 800;
        const sx = monitor ? Math.round(monitor.position.x / scale) : 0;
        const sy = monitor ? Math.round(monitor.position.y / scale) : 0;
        const effectWin = new WebviewWindow('gugufly-effect', {
          url: `/effect.html?type=${encodeURIComponent(effectType)}&duration=${effectDuration}&msg=${encodeURIComponent(taskMsg)}&v=${Date.now()}`,
          width: sw, height: sh, x: sx, y: sy,
          transparent: true, decorations: false,
          alwaysOnTop: true, skipTaskbar: true,
          resizable: false, visible: true, focus: true, shadow: false,
        });
        effectWin.once('tauri://created', async () => {
          activeVideoWin = effectWin;
          try { await effectWin.setIgnoreCursorEvents(true); } catch (e) { /* ignore */ }
        });
        effectWin.once('tauri://error', (e) => console.error('effect window error:', e));
        bindVideoWindowCleanup(effectWin);
      } catch (e) {
        console.error('effect window creation failed:', e);
      } finally {
        videoWinMutex = false;
      }
    } else if (postFlight.action === 'video') {
      if (videoWinMutex) await waitForVideoMutex();
      if (videoWinMutex) return;
      videoWinMutex = true;
      try {
        const builtinVideos = ['cat.mov', 'dog.mov'];
        const selectedFile = postFlight.videoFile || 'cat.mov';
        const isBuiltinVideo = builtinVideos.includes(selectedFile);
        if (!isBuiltinVideo) {
          const localPath = selectedFile;
          if (activeVideoWin) {
            try { await activeVideoWin.close(); } catch (e) { /* ignore */ }
            activeVideoWin = null;
          }
          const monitor = await currentMonitor().catch(() => null);
          const scale = monitor?.scaleFactor || 1;
          const sw = monitor ? Math.round(monitor.size.width / scale) : 1280;
          const sh = monitor ? Math.round(monitor.size.height / scale) : 800;
          const sx = monitor ? Math.round(monitor.position.x / scale) : 0;
          const sy = monitor ? Math.round(monitor.position.y / scale) : 0;
          const label = postFlight.taskMsg || t('notification.rest');
          const videoWin = new WebviewWindow('gugufly-video', {
            url: `/video.html?file=${encodeURIComponent(localPath)}&duration=${postFlight.videoDuration || 30}&speed=${postFlight.videoSpeed || 1}&scale=${postFlight.videoScale || 1}&label=${encodeURIComponent(label)}&v=${Date.now()}`,
            width: sw, height: sh, x: sx, y: sy,
            transparent: true, decorations: false,
            alwaysOnTop: true, skipTaskbar: true,
            resizable: false, visible: true, focus: true, shadow: false,
          });
          videoWin.once('tauri://created', async () => {
            activeVideoWin = videoWin;
            try { await videoWin.setIgnoreCursorEvents(true); } catch (e) { /* ignore */ }
          });
          videoWin.once('tauri://error', (e) => console.error('video window error:', e));
          bindVideoWindowCleanup(videoWin);
          return;
        }
        // Fallback path: builtin video (cat.mov / dog.mov) with cache
        if (activeVideoWin) {
          try { await activeVideoWin.close(); } catch (e) { /* ignore */ }
          activeVideoWin = null;
        }
      // isBuiltinVideo is already declared above (line 603). Here we
      // know isBuiltinVideo is true (the !isBuiltinVideo branch above
      // has already returned).
      const originalFile = selectedFile;

      // For built-in videos: resolve the local path (using the cache
      // or the backend) BEFORE opening the player window. The backend
      // returns instantly when the file is already on disk, so the
      // first play after an app restart will use the local file too.
      // We still use the remote URL only when there is no local file
      // and the download would block startup — which only happens
      // when the user has explicitly cleared the cache.
      let initialFile = originalFile;
      if (isBuiltinVideo) {
        const localPath = await resolveBuiltinVideoPath(originalFile);
        if (localPath) {
          initialFile = localPath;
        } else {
          // Cache miss AND download failed — fall back to remote.
          // The video.js page will retry the download in the
          // background, so this branch is only hit on first-ever play
          // with no network.
          initialFile = 'https://fly.pumf.top/resource/' + originalFile;
        }
      }

      const monitor = await currentMonitor().catch(() => null);
      const scale = monitor?.scaleFactor || 1;
      const sw = monitor ? Math.round(monitor.size.width / scale) : 1280;
      const sh = monitor ? Math.round(monitor.size.height / scale) : 800;
      const sx = monitor ? Math.round(monitor.position.x / scale) : 0;
      const sy = monitor ? Math.round(monitor.position.y / scale) : 0;
      const label = postFlight.taskMsg || t('notification.rest');
      const videoWin = new WebviewWindow('gugufly-video', {
        url: `/video.html?file=${encodeURIComponent(initialFile)}&duration=${postFlight.videoDuration || 30}&speed=${postFlight.videoSpeed || 1}&scale=${postFlight.videoScale || 1}&label=${encodeURIComponent(label)}&v=${Date.now()}`,
        width: sw, height: sh, x: sx, y: sy,
        transparent: true, decorations: false,
        alwaysOnTop: true, skipTaskbar: true,
        resizable: false, visible: true, focus: true, shadow: false,
      });
      videoWin.once('tauri://created', async () => {
        activeVideoWin = videoWin;
        // Use OS-level ignore-cursor-events so the video window truly
        // passes mouse events through to the windows behind it (the
        // main app window).
        try { await videoWin.setIgnoreCursorEvents(true); } catch (e) { /* ignore */ }
        // The cache is now populated by resolveBuiltinVideoPath() which
        // ran above. No need to re-invoke the backend here.
      });
      videoWin.once('tauri://error', (e) => console.error('video window error:', e));
      bindVideoWindowCleanup(videoWin);
      } catch (e) {
        console.error('video window creation failed:', e);
      } finally {
        videoWinMutex = false;
      }
    }
  } catch (e) {
    console.error('Post-flight action failed:', e);
  }
}

export async function triggerFlightWithMode(task, registerFn, recordFlightTriggerFn, notifyFn, renderStatsFn) {
  if (!task.enabled) return;
  const msg = task.msg || getRandomQuote();
  const taskImage = task.imageData || null;
  const taskUseImage = task.imageData ? !!task.useImage : null;
  const postFlight = {
    action: task.postFlightAction || 'none',
    appPath: task.postFlightAppPath || '',
    url: task.postFlightUrl || '',
    folder: task.postFlightFolder || '',
    script: task.postFlightScript || '',
    videoFile: task.postFlightVideoFile || 'cat.mov',
    videoDuration: task.postFlightVideoDuration || 30,
    videoSpeed: parseFloat(task.postFlightVideoSpeed) || 1,
    videoScale: parseFloat(task.postFlightVideoScale) || 1,
    effectType: task.postFlightEffectType || 'fireworks',
    effectDuration: task.postFlightEffectDuration || 15,
    taskMsg: msg,
  };

  if (registerFn) await registerFn();
  if (recordFlightTriggerFn) await recordFlightTriggerFn(task);
  if (notifyFn) notifyFn(task.label, msg);
  if (renderStatsFn) await renderStatsFn();

  const mode = task.flightMode || 'once';

  if (mode === 'once') {
    queueFlight({ msg, direction: 'ltr', sequenceId: '', playSound: true, imageData: taskImage, useImage: taskUseImage, postFlight });
    return;
  }

  if (mode === 'loop_times') {
    const sequenceId = createSequenceId(task.id);
    // Single-loop duration depends on speed and effect config. The
    // worst case is 4600ms durationBase / 0.1 speedFactor = 46000ms.
    // Use 60s per loop iteration as a safe upper bound so the
    // sequence timeout fires after all loops are done, even on
    // very slow speeds.
    const perLoopMs = 60000;
    const totalLoopMs = task.loopCount * perLoopMs + 60000;
    task._flightRemaining = task.loopCount || 3;
    updateTaskFlightCb?.(task.id, task._flightRemaining);
    flightSequences.set(sequenceId, {
      active: true, sequenceId, taskId: task.id, taskMsg: msg,
      taskImage, taskUseImage, postFlight,
      remaining: (task.loopCount || 3), direction: 'ltr', mode: 'loop_times',
      intervalId: null,
      timeoutId: setTimeout(() => {
        const state = getSequence(sequenceId);
        if (state) { state.active = false; clearSequence(sequenceId); if (!hasActiveSequences()) stopLoopSound(); }
      }, totalLoopMs),
    });
    queueFlight({ msg, direction: 'ltr', sequenceId, playSound: true, imageData: taskImage, useImage: taskUseImage, postFlight });
    return;
  }

  if (mode === 'loop_interval') {
    const sequenceId = createSequenceId(task.id);
    const totalIntervalMs = (task.intervalCount - 1) * task.loopInterval * 60 * 1000 + 60000;
    task._flightRemaining = task.intervalCount || 10;
    updateTaskFlightCb?.(task.id, task._flightRemaining);
    flightSequences.set(sequenceId, {
      active: true, sequenceId, taskId: task.id, taskMsg: msg,
      taskImage, taskUseImage, postFlight,
      remaining: (task.intervalCount || 10), mode: 'loop_interval',
      intervalMs: (task.loopInterval || 5) * 60 * 1000,
      lastStart: Date.now(), intervalId: null,
      timeoutId: setTimeout(() => {
        const state = getSequence(sequenceId);
        if (state) { state.active = false; clearSequence(sequenceId); if (!hasActiveSequences()) stopLoopSound(); }
      }, totalIntervalMs),
    });
    queueFlight({ msg, direction: 'ltr', sequenceId, playSound: true, imageData: taskImage, useImage: taskUseImage, postFlight });
    return;
  }
}

// Hold the unlisten function for the flight-ended listener so that
// repeated init calls do not accumulate duplicate listeners.
let flightEndedUnlisten = null;
let flightListenersInitialized = false;

export function disposeFlightListeners() {
  if (flightEndedUnlisten) {
    try { flightEndedUnlisten(); } catch (e) { console.error('flightEnded unlisten failed:', e); }
    flightEndedUnlisten = null;
  }
  flightListenersInitialized = false;
}

export async function initFlightListeners() {
  if (!isTauriRuntime()) return;
  if (flightListenersInitialized) return;
  flightListenersInitialized = true;

  const p = listen('flight-ended', async (event) => {
    // During emergency landing, suppress post-flight actions that would
    // create new video/effect windows. The emergency flow handles all
    // cleanup itself; we just need to release the flight queue.
    if (emergencyLandingActive) {
      releaseFlightQueue();
      await closePostFlightNotify();
      return;
    }
    localStorage.removeItem('_flightImage');
    localStorage.removeItem('_flightUseImage');
    const sequenceId = event.payload?.sequenceId || '';
    const loopState = getSequence(sequenceId);
    const inLoop = !!(loopState && loopState.active);
    const oncePostFlight = activeFlightJob?.postFlight || null;
    let continued = false;

    if (!inLoop) stopLoopSound();

    if (inLoop && loopState.mode === 'loop_times') {
      loopState.remaining--;
      updateTaskFlightCb?.(loopState.taskId, loopState.remaining);
      if (loopState.remaining > 0) {
        loopState.direction = loopState.direction === 'ltr' ? 'rtl' : 'ltr';
        continued = true;
        queueFlight({ msg: loopState.taskMsg, direction: loopState.direction, sequenceId, playSound: false, imageData: loopState.taskImage, useImage: loopState.taskUseImage });
      } else {
        clearSequence(sequenceId);
        if (!hasActiveSequences()) stopLoopSound();
      }
    } else if (inLoop && loopState.mode === 'loop_interval') {
      loopState.remaining--;
      updateTaskFlightCb?.(loopState.taskId, loopState.remaining);
      if (loopState.remaining > 0) {
        stopLoopSound();
        const elapsed = Date.now() - loopState.lastStart;
        let waitMs = loopState.intervalMs - elapsed;
        if (waitMs < 0) waitMs = 0;
        loopState.intervalId = setTimeout(() => {
          const state = getSequence(sequenceId);
          if (state && state.active) {
            state.lastStart = Date.now();
            queueFlight({ msg: state.taskMsg, direction: 'ltr', sequenceId, playSound: true, imageData: state.taskImage, useImage: state.taskUseImage });
          }
        }, waitMs);
      } else {
        clearSequence(sequenceId);
        if (!hasActiveSequences()) stopLoopSound();
      }
    }

    releaseFlightQueue();
    if (continued) return;

    // If the user clicked "skip current flight", suppress the
    // post-flight action so they don't see the video/effect anyway.
    if (skipPostFlight) {
      skipPostFlight = false;
      await closePostFlightNotify();
      return;
    }

    // Check if there's a pending post-flight job from processFlightQueue
    if (pendingPostFlightJob) {
      const job = pendingPostFlightJob;
      pendingPostFlightJob = null;
      if (postFlightTimeout) { clearTimeout(postFlightTimeout); postFlightTimeout = null; }
      
      // Execute the post-flight action after a short delay
      // This gives the user time to click cancel on the popup
      postFlightTimeout = setTimeout(async () => {
        postFlightTimeout = null;
        // Check if the user cancelled while we were waiting
        if (postFlightCancelled) {
          postFlightCancelled = false;
          pendingPostFlightJob = null;
          return;
        }
        pendingPostFlightJob = null;
        await closePostFlightNotify();
        if (inLoop && loopState) {
          await executePostFlightAction(loopState.postFlight);
        } else {
          await executePostFlightAction(job.postFlight);
        }
      }, 200);
      return;
    }

    await closePostFlightNotify();
    if (inLoop && loopState) {
      await executePostFlightAction(loopState.postFlight);
    } else {
      await executePostFlightAction(oncePostFlight);
    }
  });
  flightEndedUnlisten = p;
}
