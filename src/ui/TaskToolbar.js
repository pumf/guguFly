import { isCompactMode, setCompactMode } from './TaskRenderer.js';
import { toggleSelectionMode } from './BatchOperation.js';

export function initTaskToolbar(ctx) {
  const { renderTaskView } = ctx;

  const batchSelectBtn = document.getElementById('batchSelectBtn');
  batchSelectBtn?.addEventListener('click', () => toggleSelectionMode());

  const compactModeBtn = document.getElementById('compactModeBtn');
  function syncCompactBtn() {
    if (!compactModeBtn) return;
    compactModeBtn.classList.toggle('is-active', isCompactMode());
  }
  compactModeBtn?.addEventListener('click', () => {
    setCompactMode(!isCompactMode());
    syncCompactBtn();
    renderTaskView();
  });
  syncCompactBtn();
}
