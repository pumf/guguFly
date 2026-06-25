export function initWindowEvents(ctx) {
  const { saveTasks, getCleanTasks, tasks, set, speedSelect, heightSelect, effectSelect,
    planeSelect, planeSizeSelect, particleSelect, bubbleSelect, bubblePositionSelect, bubbleSizeSelect, bubbleBgColor, bubbleFontColor, soundSelect, soundModeSelect,
    useSoundCheckbox, useImageCheckbox,
    showToast, getCustomImageData, getCustomAudioData, getCustomAudioName } = ctx;

  window.addEventListener('beforeunload', async () => {
    await saveTasks(getCleanTasks(tasks));
    await set('speed', speedSelect.value);
    await set('height', heightSelect.value);
    await set('effect', effectSelect.value);
    await set('plane', planeSelect.value);
    await set('planeSize', planeSizeSelect.value);
    await set('particle', particleSelect.value);
    await set('bubble', bubbleSelect.value);
    await set('bubblePosition', bubblePositionSelect.value);
    await set('bubbleSize', bubbleSizeSelect.value);
    await set('bubbleBgColor', bubbleBgColor.value);
    await set('bubbleFontColor', bubbleFontColor.value);
    await set('sound', soundSelect.value);
    await set('soundMode', soundModeSelect.value);
    await set('useSound', useSoundCheckbox.checked);
    await set('customImage', getCustomImageData());
    await set('customAudio', getCustomAudioData());
    await set('customAudioName', getCustomAudioName());
    await set('useImage', useImageCheckbox.checked);
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
      const toastEl = showToast(`后台任务出错了：${brief}`);
      if (toastEl && navigator.clipboard && fullStack) {
        const onDblClick = () => {
          navigator.clipboard.writeText(fullStack).then(() => {
            showToast('错误栈已复制到剪贴板');
          }).catch(() => {});
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
