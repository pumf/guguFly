import { t } from '../i18n/index.js';

let overlay = null;
let input = null;
let list = null;
let isOpen = false;
let selectedIndex = 0;
let commands = [];
let onExecute = null;

export function initCommandPalette(ctx) {
  onExecute = ctx.onExecute || null;

  overlay = document.getElementById('paletteOverlay');
  input = document.getElementById('paletteInput');
  list = document.getElementById('paletteList');

  if (!overlay || !input || !list) return;

  commands = [
    { icon: '＋', name: t('command.new_flight'), action: 'new', kbd: '⌘N' },
    { icon: '🛫', name: t('command.fly_now'), action: 'fly' },
    { icon: '🍅', name: t('command.focus_mode'), action: 'pomodoro', kbd: '⌘F' },
    { icon: '⏸', name: t('command.quiet_1h'), action: 'quiet' },
    { icon: '📊', name: t('command.stats'), action: 'stats' },
    { icon: '🎨', name: t('command.skin'), action: 'skin' },
    { icon: '⚙️', name: t('command.settings'), action: 'settings', kbd: '⌘,' },
    { icon: '🚨', name: t('command.emergency'), action: 'emergency', kbd: 'ESC' },
  ];

  input.addEventListener('input', () => renderPalette(input.value));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.pal-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        const action = items[selectedIndex].dataset.action;
        executeCommand(action);
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen ? closePalette() : openPalette();
    }
  });
}

function renderPalette(filter = '') {
  if (!list) return;
  const f = filter.trim().toLowerCase();
  const filtered = commands.filter(c => !f || c.name.toLowerCase().includes(f));

  list.innerHTML = filtered.length
    ? filtered.map((c, i) => `
        <div class="pal-item${i === selectedIndex ? ' active' : ''}" data-action="${c.action}">
          <span class="pi">${c.icon}</span>
          ${c.name}
          ${c.kbd ? `<kbd>${c.kbd}</kbd>` : ''}
        </div>
      `).join('')
    : `<div class="pal-item" style="cursor:default;color:var(--text-3)">${t('command.no_results')}</div>`;

  list.querySelectorAll('.pal-item[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      executeCommand(item.dataset.action);
    });
  });
}

function updateSelection(items) {
  items.forEach((item, i) => {
    item.classList.toggle('active', i === selectedIndex);
  });
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }
}

function executeCommand(action) {
  closePalette();
  onExecute?.(action);
}

export function openPalette() {
  if (!overlay || !input) return;
  isOpen = true;
  overlay.classList.add('open');
  input.value = '';
  selectedIndex = 0;
  renderPalette();
  setTimeout(() => input.focus(), 30);
}

export function closePalette() {
  if (!overlay) return;
  isOpen = false;
  overlay.classList.remove('open');
}

export function isPaletteOpen() {
  return isOpen;
}
