import { t } from '../i18n/index.js';
import { dataUrlToArrayBuffer } from '../utils.js';
import { getAudioContext, unlockAudioIfNeeded } from './AudioManager.js';

let customAudioObjectUrl = '';
let previewAudioHandle = null;
let loopAudio = null;
let loopOscInterval = null;
let isMuted = false;

let soundSelectEl;
let soundModeSelectEl;
let soundNameEl;
let previewSoundBtnEl;
let useSoundCheckboxEl;
let getCustomAudioDataFn;
let getCustomAudioNameFn;
let showToastFn;
let stopPreviewAudioFn;

const SOUND_PRESETS_REF = [];
let playPresetSoundFn;
let buildCustomAudioObjectUrlFn;

function stopSource(source) {
  try {
    source.stop();
  } catch {
    // Source may already be stopped.
  }
}

export function initAudioSystem(ctx) {
  soundSelectEl = ctx.soundSelect;
  soundModeSelectEl = ctx.soundModeSelect;
  soundNameEl = ctx.soundName;
  previewSoundBtnEl = ctx.previewSoundBtn;
  useSoundCheckboxEl = ctx.useSoundCheckbox;
  getCustomAudioDataFn = ctx.getCustomAudioData;
  getCustomAudioNameFn = ctx.getCustomAudioName || (() => '');
  showToastFn = ctx.showToast;
  SOUND_PRESETS_REF.length = 0;
  SOUND_PRESETS_REF.push(...(ctx.SOUND_PRESETS || []));
  playPresetSoundFn = ctx.playPresetSound;
  buildCustomAudioObjectUrlFn = ctx.buildCustomAudioObjectUrl;
  stopPreviewAudioFn = ctx.stopPreviewAudio;
}

export function setMuted(val) { isMuted = val; }
export function isAudioMuted() { return isMuted; }
export function setCustomAudioObjectUrl(url) { customAudioObjectUrl = url; }
export function getCustomAudioObjectUrl() { return customAudioObjectUrl; }

export function revokeCustomAudioObjectUrl() {
  if (!customAudioObjectUrl) return;
  URL.revokeObjectURL(customAudioObjectUrl);
  customAudioObjectUrl = '';
}

export async function playCustomAudio(loopMode) {
  const data = getCustomAudioDataFn();
  const objectUrl = customAudioObjectUrl || buildCustomAudioObjectUrlFn();
  const audio = new Audio(objectUrl || data);
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
    const data = getCustomAudioDataFn();
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(dataUrlToArrayBuffer(data));
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = decoded;
    source.loop = loopMode;
    gain.gain.setValueAtTime(0.52, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    if (loopMode) {
      loopAudio = { pause() { stopSource(source); } };
    }
    return { pause() { stopSource(source); } };
  }
}

export function stopLoopSoundLocal() {
  if (loopAudio) { loopAudio.pause(); loopAudio = null; }
  if (loopOscInterval) { clearInterval(loopOscInterval); loopOscInterval = null; }
}

export async function playSound(soundVal) {
  if (isMuted) return;
  stopLoopSoundLocal();
  await unlockAudioIfNeeded();
  const sound = soundVal || soundSelectEl.value;
  const loopMode = soundModeSelectEl.value === 'loop';
  if (useSoundCheckboxEl.checked && getCustomAudioDataFn()) {
    void playCustomAudio(loopMode).catch(() => {
      showToastFn(t('toast.custom_audio_fallback'));
      playPresetSoundAt(sound);
      if (loopMode) loopOscInterval = setInterval(() => playPresetSoundAt(sound), 800);
    });
    return;
  }
  playPresetSoundAt(sound);
  if (loopMode) loopOscInterval = setInterval(() => playPresetSoundAt(sound), 800);
}

export async function playPresetSoundAt(sound) {
  try {
    if (!SOUND_PRESETS_REF.some(p => p.value === sound)) sound = 'whoosh';
    await playPresetSoundFn(getAudioContext(), sound);
  } catch (error) {
    console.error('preset audio failed:', error);
  }
}

export function updateSoundMeta() {
  const hasAudio = !!getCustomAudioDataFn();
  const audioName = getCustomAudioNameFn();
  if (soundNameEl) {
    soundNameEl.textContent = hasAudio ? (audioName || t('sound.selected')) : t('sound.no_selection');
    soundNameEl.title = audioName || '';
  }
  if (previewSoundBtnEl) {
    previewSoundBtnEl.disabled = !hasAudio;
    previewSoundBtnEl.textContent = hasAudio ? (previewAudioHandle ? t('sound.preview_stop') : t('sound.preview_play')) : t('sound.preview_unselected');
  }
}

export async function previewCustomSound() {
  const data = getCustomAudioDataFn();
  if (!data) { showToastFn(t('sound.preview_hint')); return; }
  if (previewAudioHandle) {
    try { previewAudioHandle.pause(); } catch (e) { console.error('preview pause failed:', e); }
    previewAudioHandle = null;
    showToastFn(t('sound.preview_ended'));
    updateSoundMeta();
    return;
  }
  stopLoopSoundLocal();
  await unlockAudioIfNeeded();
  try {
    previewAudioHandle = await playCustomAudio(false);
    if (previewAudioHandle && 'addEventListener' in previewAudioHandle) {
      previewAudioHandle.addEventListener('ended', () => { previewAudioHandle = null; updateSoundMeta(); }, { once: true });
    }
    updateSoundMeta();
    showToastFn(t('sound.preview_playing'));
  } catch {
    previewAudioHandle = null;
    updateSoundMeta();
    showToastFn(t('sound.preview_failed'));
  }
}

export function resetAudioPreview() {
  previewAudioHandle = null;
}

export function syncAudioObjectUrlTo(value) {
  // Revoke the previous URL before overwriting so we don't leak the
  // blob-backed ObjectURL each time the user changes the audio file.
  if (customAudioObjectUrl && customAudioObjectUrl !== value) {
    try { URL.revokeObjectURL(customAudioObjectUrl); } catch (e) {
      console.error('revoke old audio URL failed:', e);
    }
  }
  customAudioObjectUrl = value || '';
}
