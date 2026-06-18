export function isTauriRuntime() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

export function showConfirm(message, title = '确认') {
  let cardBg = '#1a1a2e', border = '#333', textColor = '#213047', softMuted = '#94a2b8', accent = '#4fc3f7';
  try {
    const s = getComputedStyle(document.documentElement);
    cardBg = s.getPropertyValue('--panel-strong').trim() || cardBg;
    border = s.getPropertyValue('--border').trim() || border;
    textColor = s.getPropertyValue('--text').trim() || textColor;
    softMuted = s.getPropertyValue('--soft-muted').trim() || softMuted;
    accent = s.getPropertyValue('--accent').trim() || accent;
  } catch {}
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center';

    const box = document.createElement('div');
    box.style.background = cardBg;
    box.style.border = `1px solid ${border}`;
    box.style.borderRadius = '12px';
    box.style.padding = '24px';
    box.style.maxWidth = '360px';
    box.style.width = '90%';
    box.style.fontFamily = 'system-ui';

    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '15px';
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '12px';
    titleEl.style.color = textColor;
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.style.fontSize = '14px';
    msgEl.style.lineHeight = '1.5';
    msgEl.style.marginBottom = '20px';
    msgEl.style.whiteSpace = 'pre-wrap';
    msgEl.style.color = softMuted;
    msgEl.textContent = message;

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    btnRow.style.justifyContent = 'flex-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.padding = '6px 18px';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.border = `1px solid ${border}`;
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = textColor;
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.onclick = () => { overlay.remove(); resolve(false); };

    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.padding = '6px 18px';
    okBtn.style.borderRadius = '6px';
    okBtn.style.border = 'none';
    okBtn.style.background = accent;
    okBtn.style.color = '#000';
    okBtn.style.cursor = 'pointer';
    okBtn.style.fontWeight = '700';
    okBtn.style.fontSize = '14px';
    okBtn.onclick = () => { overlay.remove(); resolve(true); };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(titleEl);
    box.appendChild(msgEl);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

export function dataUrlToArrayBuffer(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid data URL');
  const raw = atob(dataUrl.slice(comma + 1));
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}
