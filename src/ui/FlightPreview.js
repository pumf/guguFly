let ctx;

export function initFlightPreview(c) {
  ctx = c;
}

export async function previewFlight() {
  if (!ctx.isTauriRuntime) { ctx.showToast('预览仅在桌面应用内可用'); return; }
  await ctx.unlockAudioIfNeeded();
  if (ctx.useSoundCheckbox.checked && !(await ctx.validateCustomAudioPreview())) return;
  await ctx.persistFlightSettings({
    speed: ctx.speedSelect.value, height: ctx.heightSelect.value, effect: ctx.effectSelect.value,
    plane: ctx.planeSelect.value, particle: ctx.particleSelect.value, bubble: ctx.bubbleSelect.value,
    bubblePosition: ctx.bubblePositionSelect.value, sound: ctx.soundSelect.value,
    soundMode: ctx.soundModeSelect.value, useSound: ctx.useSoundCheckbox.checked,
    useImage: ctx.useImageCheckbox.checked,
  });
  ctx.queueFlight({ msg: '预览当前飞行效果', direction: 'ltr', sequenceId: '', playSound: true });
}

export async function resetFlightSettings() {
  const D = ctx.DEFAULT_FLIGHT_SETTINGS;
  ctx.speedSelect.value = D.speed;
  ctx.heightSelect.value = D.height;
  ctx.effectSelect.value = D.effect;
  ctx.planeSelect.value = D.plane;
  ctx.particleSelect.value = D.particle;
  ctx.bubbleSelect.value = D.bubble;
  ctx.bubblePositionSelect.value = D.bubblePosition;
  ctx.soundSelect.value = D.sound;
  ctx.soundModeSelect.value = D.soundMode;
  ctx.useSoundCheckbox.checked = D.useSound;
  ctx.customImageDataRef.set('');
  ctx.customAudioNameRef.set('');
  ctx.useImageCheckbox.checked = false;
  ctx.imagePreview.src = '';
  ctx.imagePreview.classList.add('hidden');
  ctx.clearImageBtn.classList.add('hidden');
  ctx.useImageCheckbox.closest('.img-toggle').classList.add('hidden');
  ctx.imageInput.value = '';
  ctx.updateTitleLogo();
  await ctx.persistSetting('customImage', '');
  await ctx.persistFlightSettings({
    speed: ctx.speedSelect.value, height: ctx.heightSelect.value, effect: ctx.effectSelect.value,
    plane: ctx.planeSelect.value, particle: ctx.particleSelect.value, bubble: ctx.bubbleSelect.value,
    bubblePosition: ctx.bubblePositionSelect.value, sound: ctx.soundSelect.value,
    soundMode: ctx.soundModeSelect.value, useSound: ctx.useSoundCheckbox.checked,
    useImage: ctx.useImageCheckbox.checked,
  });
  await ctx.persistSetting('customAudioName', '');
  ctx.updateSoundMeta();
  ctx.showToast('已恢复推荐飞行设置');
}
