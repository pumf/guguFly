import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors, currentMonitor } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getRandomQuote } from '../quotes.js';
import { SOUND_PRESETS, playPreset as playPresetSound } from '../sounds.js';
import { dataUrlToArrayBuffer, isTauriRuntime } from '../utils.js';
import { getAudioContext, unlockAudioIfNeeded } from '../ui/AudioManager.js';

let activeFlightJob = null;
const flightQueue = [];
const flightSequences = new Map();
let pfNotifyWin = null;
let pendingPfCancel = null;
let pfAutoClosing = false;
let pfUnlistenClick = null;

let activeVideoWin = null;
// Cache of already-downloaded built-in video local paths, keyed by
// video name (e.g. 'cat.mov'). Filled by successful background downloads
// in the video branch, consumed by future plays to skip the network.
const builtInVideoCache = new Map();

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

export function setUpdateTaskFlightCb(cb) { updateTaskFlightCb = cb; }

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
export function setCustomAudioObjectUrl(url) { customAudioObjectUrl_ = url; }
export function setMuted(muted) { isMuted = muted; }

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

export function isMutedFn() { return isMuted; }

export function getActiveFlightJob() { return activeFlightJob; }

const KNOWN_SOUND_VALUES = new Set(SOUND_PRESETS.map(p => p.value));

function revokeCustomAudioObjectUrl() {
  if (!customAudioObjectUrl_) return;
  URL.revokeObjectURL(customAudioObjectUrl_);
  customAudioObjectUrl_ = '';
}

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
      showToast('自定义音频播放失败，已回退到内置提示音');
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

let showToast = (msg) => { console.log(msg); };
export function setToastFn(fn) { showToast = fn; }

async function showPostFlightNotify(action) {
  if (!isTauriRuntime()) return;
  try {
    if (pfNotifyWin) {
      try {
        await pfNotifyWin.close();
      } catch (error) {
        console.error('post-flight notify close failed:', error);
      }
      pfNotifyWin = null;
    }
    if (pfUnlistenClick) {
      try {
        pfUnlistenClick();
      } catch (error) {
        console.error('post-flight unlisten failed:', error);
      }
      pfUnlistenClick = null;
    }

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
    const builtinLabels = { 'cat.mov': '播放猫咪', 'dog.mov': '播放狗狗' };
    const videoLabel = (action === 'video') ? (builtinLabels[pfVideoFile] || '播放视频') : '';
    const effectLabels = { fireworks: '播放烟花', firecrackers: '播放爆竹', emojis: '播放表情包', rainbow: '播放彩虹', bubbles: '播放气泡' };
    const effectLabel = (action === 'effect') ? (effectLabels[pfEffectType] || '播放特效') : '';
    const labels = { app: '打开软件', url: '打开网页', lock: '锁屏休息', folder: '打开文件夹', tts: '语音播报', script: '运行脚本', video: videoLabel, effect: effectLabel };
    const label = labels[action] || action;
    const fullText = '飞行后' + label;

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
      try {
        pfUnlistenClick();
      } catch (error) {
        console.error('post-flight stale unlisten failed:', error);
      }
      pfUnlistenClick = null;
    }
    const unlisten = await listen('pf-notify-clicked', async () => {
      if (pendingPfCancel) {
        pendingPfCancel();
        pendingPfCancel = null;
      }
      await closePostFlightNotifyLocal();
      showToast('已取消飞行后操作');
    });
    pfUnlistenClick = unlisten;
  } catch (e) { console.error('showPostFlightNotify failed:', e); }
}

async function closePostFlightNotifyLocal() {
  if (pfUnlistenClick) {
    try {
      pfUnlistenClick();
    } catch (error) {
      console.error('post-flight local unlisten failed:', error);
    }
    pfUnlistenClick = null;
  }
  try {
    if (pfNotifyWin) {
      pfAutoClosing = true;
      await pfNotifyWin.close();
      pfNotifyWin = null;
    }
  } catch (error) {
    console.error('post-flight local close failed:', error);
  }
  pfAutoClosing = false;
}

export async function closePostFlightNotify() {
  if (pfUnlistenClick) {
    try {
      pfUnlistenClick();
    } catch (error) {
      console.error('post-flight unlisten cleanup failed:', error);
    }
    pfUnlistenClick = null;
  }
  try {
    if (pfNotifyWin) {
      pfAutoClosing = true;
      await pfNotifyWin.close();
      pfNotifyWin = null;
    }
  } catch (error) {
    console.error('post-flight close failed:', error);
  }
  pfAutoClosing = false;
}

export function setPendingPfCancel(fn) { pendingPfCancel = fn; }
export function getPendingPfCancel() { return pendingPfCancel; }

async function processFlightQueue() {
  if (activeFlightJob || !flightQueue.length) return;
  const nextJob = flightQueue.shift();
  activeFlightJob = nextJob;
  if (nextJob.playSound && !isMuted) await playSound();
  await createFlightWindow(nextJob.msg, nextJob.direction, nextJob.sequenceId, nextJob.imageData, nextJob.useImage);
  if (nextJob.postFlight && nextJob.postFlight.action !== 'none') {
    pendingPfCancel = () => { nextJob.postFlight.action = 'none'; };
    showPostFlightNotify(nextJob.postFlight.action);
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
        showToast('Linux 环境下透明窗口需要桌面合成器支持，如飞行动画显示为黑屏请启用合成器（如 picom/mutter/kwin）', 6000);
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
  try {
    if (postFlight.action === 'app' && postFlight.appPath) {
      await invoke('open_app', { path: postFlight.appPath });
    } else if (postFlight.action === 'url' && postFlight.url) {
      await invoke('open_url_in_browser', { url: postFlight.url });
    } else if (postFlight.action === 'lock') {
      const confirmed = await window.showConfirm('即将锁屏，是否继续？');
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
      const confirmed = await window.showConfirm('将执行语音播报，是否继续？');
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
      const confirmed = await window.showConfirm('将执行自定义脚本，是否继续？');
      if (!confirmed) return;
      await invoke('run_script', { script: postFlight.script });
    } else if (postFlight.action === 'effect') {
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
      const effectWin = new WebviewWindow('gugufly-video', {
        url: `/effect.html?type=${encodeURIComponent(effectType)}&duration=${effectDuration}&msg=${encodeURIComponent(taskMsg)}&v=${Date.now()}`,
        width: sw, height: sh, x: sx, y: sy,
        transparent: true, decorations: false,
        alwaysOnTop: true, skipTaskbar: true,
        resizable: false, visible: true, focus: true, shadow: false,
      });
      effectWin.once('tauri://created', () => {
        activeVideoWin = effectWin;
        // Note: we do NOT call setIgnoreCursorEvents here. The effect.html
        // CSS already handles event pass-through via pointer-events:none
        // on body and canvas, with pointer-events:auto only on the close
        // button. setIgnoreCursorEvents would override that and break
        // the close button.
      });
      effectWin.once('tauri://error', (e) => console.error('effect window error:', e));
      effectWin.onCloseRequested(() => { activeVideoWin = null; });
    } else if (postFlight.action === 'video') {
      if (postFlight.videoEnable === false) return;
      if (activeVideoWin) {
        try { await activeVideoWin.close(); } catch (e) { /* ignore */ }
        activeVideoWin = null;
      }
      const originalFile = postFlight.videoFile || 'cat.mov';
      const builtinVideos = ['cat.mov', 'dog.mov'];
      const isBuiltin = builtinVideos.includes(originalFile);

      // For built-in videos: try to use the in-memory cache of
      // downloaded local paths to play from disk immediately. The
      // cache is populated by background downloads on previous plays.
      // If the cache is cold (first play, or cache cleared on app
      // restart), the cache lookup will return undefined — in that
      // case we open the player with a remote URL and trigger a
      // background download to warm the cache for the next play.
      //
      // We NEVER block on the download here; the player always opens
      // immediately. The user's experience is:
      //   1st play: remote URL plays, file downloads in background
      //   2nd+ play: cached local file plays instantly, no network
      let initialFile = originalFile;
      let needsBackgroundDownload = false;
      if (isBuiltin) {
        const cachedLocalPath = builtInVideoCache.get(originalFile);
        if (cachedLocalPath) {
          initialFile = cachedLocalPath;
        } else {
          // Cold cache. Open with remote URL so the user sees something
          // immediately, and start the download in the background.
          initialFile = 'https://fly.pumf.top/resource/' + originalFile;
          needsBackgroundDownload = true;
        }
      }

      const monitor = await currentMonitor().catch(() => null);
      const scale = monitor?.scaleFactor || 1;
      const sw = monitor ? Math.round(monitor.size.width / scale) : 1280;
      const sh = monitor ? Math.round(monitor.size.height / scale) : 800;
      const sx = monitor ? Math.round(monitor.position.x / scale) : 0;
      const sy = monitor ? Math.round(monitor.position.y / scale) : 0;
      const label = postFlight.taskMsg || '休息一下';
      const videoWin = new WebviewWindow('gugufly-video', {
        url: `/video.html?file=${encodeURIComponent(initialFile)}&duration=${postFlight.videoDuration || 30}&speed=${postFlight.videoSpeed || 1}&scale=${postFlight.videoScale || 1}&label=${encodeURIComponent(label)}&v=${Date.now()}`,
        width: sw, height: sh, x: sx, y: sy,
        transparent: true, decorations: false,
        alwaysOnTop: true, skipTaskbar: true,
        resizable: false, visible: true, focus: true, shadow: false,
      });
      videoWin.once('tauri://created', () => {
        activeVideoWin = videoWin;
        // Note: we do NOT call setIgnoreCursorEvents here. The video.html
        // CSS already handles event pass-through via pointer-events:none
        // on body and canvas, with pointer-events:auto only on the close
        // button. setIgnoreCursorEvents would override the HTML-level
        // pointer-events and break the close button.
        // Background cache warm-up. We always kick this off for built-in
        // videos — if it's already cached, the backend returns the
        // local path immediately (free). If not, it downloads in the
        // background and we cache the result for the next play.
        if (isBuiltin && isTauriRuntime()) {
          invoke('download_builtin_video', { name: originalFile })
            .then((localPath) => {
              builtInVideoCache.set(originalFile, localPath);
            })
            .catch((e) => console.warn('background video download failed:', e));
        }
      });
      videoWin.once('tauri://error', (e) => console.error('video window error:', e));
      videoWin.onCloseRequested(() => { activeVideoWin = null; });
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
    videoEnable: task.postFlightVideoEnable !== false,
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
    const totalLoopMs = task.loopCount * 10000 + 60000;
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

export async function initFlightListeners() {
  if (!isTauriRuntime()) return;

  listen('flight-ended', async (event) => {
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
    await closePostFlightNotify();
    if (continued) return;

    if (inLoop && loopState) {
      await executePostFlightAction(loopState.postFlight);
    } else {
      await executePostFlightAction(oncePostFlight);
    }
  });
}
