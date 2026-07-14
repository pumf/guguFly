let modalEl;
let settingsModalEl;
let statsModalEl;
let updateModalEl;
let openNewModalFn;
let applyThemeFn;
let getCurrentThemeFn;
let focusSearchFn;
let focusQuickCreateFn;
let previewFlightFn;
let togglePomodoroFn;
let toggleMiniWindowFn;
let toggleStatsFn;
let triggerEmergencyFn;
let setTaskTypeFilterFn;

const SHORTCUT_HINTS = [
  { key: 'N', label: '⌘N', desc: 'shortcut.new_task' },
  { key: ',', label: '⌘,', desc: 'shortcut.settings' },
  { key: 'D', label: '⌘D', desc: 'shortcut.toggle_theme' },
  { key: 'K', label: '⌘K', desc: 'shortcut.focus_search' },
  { key: 'J', label: '⌘J', desc: 'shortcut.focus_quick_create' },
  { key: 'B', label: '⌘B', desc: 'shortcut.toggle_mini' },
  { key: 'I', label: '⌘I', desc: 'shortcut.toggle_stats' },
  { key: 'E', label: '⌘E', desc: 'shortcut.emergency' },
  { key: 'P', label: '⌘⇧P', desc: 'shortcut.toggle_pomodoro', shift: true },
  { key: 'F', label: '⌘⇧F', desc: 'shortcut.preview_flight', shift: true },
  { key: '1', label: '⌘1', desc: 'shortcut.filter_alarm' },
  { key: '2', label: '⌘2', desc: 'shortcut.filter_countdown' },
  { key: '3', label: '⌘3', desc: 'shortcut.filter_holiday' },
  { key: '4', label: '⌘4', desc: 'shortcut.filter_anniversary' },
];

export function getShortcutHints() {
  return SHORTCUTS.filter(s => s.desc);
}

const SHORTCUTS = SHORTCUT_HINTS;

export function initKeyboardShortcuts(ctx) {
  modalEl = document.getElementById('taskModal');
  settingsModalEl = document.getElementById('settingsModal');
  statsModalEl = document.getElementById('statsModal');
  updateModalEl = document.getElementById('updateModal');
  openNewModalFn = ctx.openNewModal;
  applyThemeFn = ctx.applyTheme;
  getCurrentThemeFn = ctx.getCurrentTheme;
  focusSearchFn = ctx.focusSearch;
  focusQuickCreateFn = ctx.focusQuickCreate;
  previewFlightFn = ctx.previewFlight;
  togglePomodoroFn = ctx.togglePomodoro;
  toggleMiniWindowFn = ctx.toggleMiniWindow;
  toggleStatsFn = ctx.toggleStats;
  triggerEmergencyFn = ctx.triggerEmergency;
  setTaskTypeFilterFn = ctx.setTaskTypeFilter;

  document.addEventListener('keydown', handleKeydown);
}

function isAnyModalOpen() {
  return !modalEl?.classList.contains('hidden')
    || !settingsModalEl?.classList.contains('hidden')
    || !statsModalEl?.classList.contains('hidden')
    || !updateModalEl?.classList.contains('hidden');
}

function handleKeydown(e) {
  const isMeta = e.metaKey || e.ctrlKey;
  if (!isMeta) return;

  const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

  if (e.key === 'Escape') return;

  if (isAnyModalOpen()) {
    if (e.key === 'i' || e.key === 'I') {
      if (toggleStatsFn && statsModalEl && !statsModalEl.classList.contains('hidden')) {
        e.preventDefault();
        toggleStatsFn();
      }
    }
    return;
  }

  const key = e.key.toLowerCase();
  const hasShift = e.shiftKey;

  switch (key) {
    case 'n':
      if (!hasShift) {
        e.preventDefault();
        if (openNewModalFn) openNewModalFn();
      }
      break;
    case ',':
      e.preventDefault();
      if (settingsModalEl) settingsModalEl.classList.remove('hidden');
      break;
    case 'd':
      if (!hasShift) {
        e.preventDefault();
        toggleTheme();
      }
      break;
    case 'k':
      if (!hasShift && !isInput) {
        e.preventDefault();
        if (focusSearchFn) focusSearchFn();
      }
      break;
    case 'j':
      if (!hasShift && !isInput) {
        e.preventDefault();
        if (focusQuickCreateFn) focusQuickCreateFn();
      }
      break;
    case 'b':
      if (!hasShift && !isInput) {
        e.preventDefault();
        if (toggleMiniWindowFn) toggleMiniWindowFn();
      }
      break;
    case 'i':
      if (!hasShift && !isInput) {
        e.preventDefault();
        if (toggleStatsFn) toggleStatsFn();
      }
      break;
    case 'e':
      if (!hasShift && !isInput) {
        e.preventDefault();
        if (triggerEmergencyFn) triggerEmergencyFn();
      }
      break;
    case 'p':
      if (hasShift && !isInput) {
        e.preventDefault();
        if (togglePomodoroFn) togglePomodoroFn();
      }
      break;
    case 'f':
      if (hasShift && !isInput) {
        e.preventDefault();
        if (previewFlightFn) previewFlightFn();
      }
      break;
    case '1':
    case '2':
    case '3':
    case '4':
      if (!hasShift && !isInput && setTaskTypeFilterFn) {
        e.preventDefault();
        const types = ['alarm', 'countdown', 'holiday', 'anniversary'];
        setTaskTypeFilterFn(types[parseInt(key) - 1]);
      }
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
