import { t } from '../i18n/index.js';

export function initWindowEvents(ctx) {
  const { saveTasks, getCleanTasks, tasks, set, speedSelect, heightSelect, effectSelect,
    planeSelect, planeSizeSelect, particleSelect, bubbleSelect, bubblePositionSelect, bubbleSizeSelect, bubbleBgColor, bubbleFontColor, soundSelect, soundModeSelect,
    useSoundCheckbox, useImageCheckbox,
    showToast, getCustomImageData, getCustomAudioData, getCustomAudioName } = ctx;

  window.addEventListener('beforeunload', () => {
    saveTasks(getCleanTasks(tasks)).catch(err => console.warn('save tasks on unload failed:', err));
    if (speedSelect) set('speed', speedSelect.value);
    if (heightSelect) set('height', heightSelect.value);
    if (effectSelect) set('effect', effectSelect.value);
    if (planeSelect) set('plane', planeSelect.value);
    if (planeSizeSelect) set('planeSize', planeSizeSelect.value);
    if (particleSelect) set('particle', particleSelect.value);
    if (bubbleSelect) set('bubble', bubbleSelect.value);
    if (bubblePositionSelect) set('bubblePosition', bubblePositionSelect.value);
    if (bubbleSizeSelect) set('bubbleSize', bubbleSizeSelect.value);
    if (bubbleBgColor) set('bubbleBgColor', bubbleBgColor.value);
    if (bubbleFontColor) set('bubbleFontColor', bubbleFontColor.value);
    if (soundSelect) set('sound', soundSelect.value);
    if (soundModeSelect) set('soundMode', soundModeSelect.value);
    if (useSoundCheckbox) set('useSound', useSoundCheckbox.checked);
    set('customImage', getCustomImageData());
    set('customAudio', getCustomAudioData());
    set('customAudioName', getCustomAudioName());
    if (useImageCheckbox) set('useImage', useImageCheckbox.checked);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    console.error('[unhandledrejection]', message);
    if (typeof showToast === 'function') {
      // Long-press / double-click on the toast copies the full stack
      // to the clipboard so the user can share it with developers.
      const brief = reason?.message || String(reason).slice(0, 80);
      const fullStack = message;
      const toastEl = showToast(t('error.background_task', { brief }));
      if (toastEl && navigator.clipboard && fullStack) {
        const onDblClick = () => {
          navigator.clipboard.writeText(fullStack).then(() => {
            showToast(t('error.stack_copied'));
          }).catch(err => console.warn('clipboard write failed:', err));
        };
        // Use both dblclick and a touch-based fallback for touchscreens
        toastEl.addEventListener('dblclick', onDblClick);
        toastEl.addEventListener('contextmenu', (e) => { e.preventDefault(); onDblClick(); });
      }
    }
  });

  window.addEventListener('error', (event) => {
    console.error('[window.onerror]', event.error || event.message);
  });
}
