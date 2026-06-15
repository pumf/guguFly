export function initWindowEvents(ctx) {
  const { saveTasks, getCleanTasks, tasks, set, speedSelect, heightSelect, effectSelect,
    planeSelect, particleSelect, bubbleSelect, bubblePositionSelect, soundSelect, soundModeSelect,
    useSoundCheckbox, useImageCheckbox,
    showToast, getCustomImageData, getCustomAudioData, getCustomAudioName } = ctx;

  window.addEventListener('beforeunload', async () => {
    await saveTasks(getCleanTasks(tasks));
    await set('speed', speedSelect.value);
    await set('height', heightSelect.value);
    await set('effect', effectSelect.value);
    await set('plane', planeSelect.value);
    await set('particle', particleSelect.value);
    await set('bubble', bubbleSelect.value);
    await set('bubblePosition', bubblePositionSelect.value);
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
    if (typeof showToast === 'function') showToast(`后台任务出错了：${reason?.message || reason}`);
  });

  window.addEventListener('error', (event) => {
    console.error('[window.onerror]', event.error || event.message);
  });
}
