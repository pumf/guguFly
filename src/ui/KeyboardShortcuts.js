import { t } from '../i18n/index.js';

let modalEl;
let settingsModalEl;
let openNewModalFn;
let applyThemeFn;
let getCurrentThemeFn;

export function initKeyboardShortcuts(ctx) {
  modalEl = document.getElementById('taskModal');
  settingsModalEl = document.getElementById('settingsModal');
  openNewModalFn = ctx.openNewModal;
  applyThemeFn = ctx.applyTheme;
  getCurrentThemeFn = ctx.getCurrentTheme;

  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  const isMeta = e.metaKey || e.ctrlKey;
  if (!isMeta) return;

  const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
  if (isInput) return;

  const isModalOpen = !modalEl?.classList.contains('hidden') || !settingsModalEl?.classList.contains('hidden');
  if (isModalOpen && e.key !== 'Escape') return;

  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault();
      if (openNewModalFn) openNewModalFn();
      break;
    case ',':
      e.preventDefault();
      if (settingsModalEl) settingsModalEl.classList.remove('hidden');
      break;
    case 'd':
      e.preventDefault();
      toggleTheme();
      break;
  }
}

function toggleTheme() {
  if (!applyThemeFn || !getCurrentThemeFn) return;
  const current = getCurrentThemeFn();
  const next = current === 'dark' ? 'light' : 'dark';
  applyThemeFn(next);
}

export function destroyKeyboardShortcuts() {
  document.removeEventListener('keydown', handleKeydown);
}
