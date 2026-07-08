let ctx;

export function initLogo(c) {
  ctx = c;
}

export function updateTitleLogo() {
  if (!ctx) return;
  const el = document.getElementById('titleLogo');
  if (!el) return;
  const imageData = typeof ctx.getCustomImageData === 'function' ? ctx.getCustomImageData() : ctx.customImageData;
  if (imageData) {
    el.innerHTML = `<img src="${imageData}" style="width:18px;height:18px;border-radius:4px;object-fit:cover;vertical-align:middle">`;
  } else {
    el.innerHTML = '<img src="/logo.png" style="width:18px;height:18px;border-radius:4px;object-fit:cover;vertical-align:middle">';
  }
}

export function syncMuteToTray() {
  if (!ctx) return;
  if (!ctx.isTauriRuntime) return;
  void ctx.invoke('set_tray_mute_label', { muted: !!ctx.isMuted }).catch(err => console.warn('sync mute to tray failed:', err));
}

export function closeSettingsModal() {
  if (!ctx) return;
  ctx.settingsModal.classList.add('hidden');
}
