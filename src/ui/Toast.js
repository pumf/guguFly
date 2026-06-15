let toastEl = null;
let toastTimer = null;

export function initToast(el) {
  toastEl = el;
}

export function showToast(message, duration, onClick) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastEl.classList.add('visible');
  toastEl.style.cursor = onClick ? 'pointer' : 'default';
  toastEl.onclick = onClick || null;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    toastEl.onclick = null;
    setTimeout(() => toastEl.classList.add('hidden'), 220);
  }, duration || 1800);
}
