export function isTauriRuntime() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

export function showConfirm(message, title = '确认') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:24px;max-width:360px;width:90%;color:#e0e0e0;font-family:system-ui';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:12px;color:#fff';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size:14px;line-height:1.5;margin-bottom:20px;white-space:pre-wrap;color:#ccc';
    msgEl.textContent = message;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding:6px 18px;border-radius:6px;border:1px solid #555;background:transparent;color:#aaa;cursor:pointer;font-size:14px';
    cancelBtn.onclick = () => { overlay.remove(); resolve(false); };

    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.cssText = 'padding:6px 18px;border-radius:6px;border:none;background:#4fc3f7;color:#000;cursor:pointer;font-weight:600;font-size:14px';
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
