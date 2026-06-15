let ctx;

export function initFlightSync(c) {
  ctx = c;
  initEventListeners();
}

function initEventListeners() {
  ctx.effectCards.forEach(card => {
    card.addEventListener('click', () => {
      const effect = card.dataset.effect;
      ctx.effectSelect.value = effect;
      syncEffectPicker(effect);
      ctx.persistSetting('effect', effect);
    });
  });

  ctx.presetButtons.forEach(btn => btn.addEventListener('click', () => applyPreset(btn.dataset.preset)));

  ctx.presetWatchSelectors.forEach(sel => sel.addEventListener('change', () => syncPresetButtons()));
}

export function syncEffectPicker(effect) {
  if (!ctx || !ctx.effectCards.length) return;
  ctx.effectCards.forEach(c => c.classList.toggle('is-active', c.dataset.effect === effect));
}

function detectActivePreset() {
  const current = {
    speed: ctx.speedSelect.value, height: ctx.heightSelect.value, effect: ctx.effectSelect.value,
    plane: ctx.planeSelect.value, particle: ctx.particleSelect.value, bubble: ctx.bubbleSelect.value,
    bubblePosition: ctx.bubblePositionSelect.value, sound: ctx.soundSelect.value, soundMode: ctx.soundModeSelect.value,
  };
  for (const [key, preset] of Object.entries(ctx.FLIGHT_PRESETS)) {
    const matches = ['speed', 'height', 'effect', 'plane', 'particle', 'bubble', 'bubblePosition', 'sound', 'soundMode']
      .every(k => current[k] === preset[k]);
    if (matches) return key;
  }
  return null;
}

export function syncPresetButtons() {
  const active = detectActivePreset();
  ctx.presetButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.preset === active));
}

export function applyPreset(presetKey) {
  const preset = ctx.FLIGHT_PRESETS[presetKey];
  if (!preset) return;
  ctx.speedSelect.value = preset.speed;
  ctx.heightSelect.value = preset.height;
  ctx.effectSelect.value = preset.effect;
  ctx.planeSelect.value = preset.plane;
  ctx.particleSelect.value = preset.particle;
  ctx.bubbleSelect.value = preset.bubble;
  ctx.bubblePositionSelect.value = preset.bubblePosition;
  ctx.soundSelect.value = preset.sound;
  ctx.soundModeSelect.value = preset.soundMode;
  syncEffectPicker(preset.effect);
  syncPresetButtons();
  ctx.persistFlightSettings({
    speed: preset.speed, height: preset.height, effect: preset.effect,
    plane: preset.plane, particle: preset.particle, bubble: preset.bubble,
    bubblePosition: preset.bubblePosition, sound: preset.sound,
    soundMode: preset.soundMode, useSound: ctx.useSoundCheckbox.checked,
    useImage: ctx.useImageCheckbox.checked,
  });
  ctx.showToast(`已应用预设：${preset.label}`);
}
