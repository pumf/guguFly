import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalPosition } from '@tauri-apps/api/window';
import { get } from '../storage.js';
import { isTauriRuntime } from '../utils.js';

let miniWindow = null;

const MINI_POSITIONS = {
  'top-left': { x: 12, y: 12 },
  'top-center': { x: 'center-x', y: 12 },
  'top-right': { x: 'right-12', y: 12 },
  'bottom-left': { x: 12, y: 'bottom-12' },
  'bottom-center': { x: 'center-x', y: 'bottom-12' },
  'bottom-right': { x: 'right-12', y: 'bottom-12' },
};

const MINI_WIN_WIDTH = 240;
const MINI_WIN_HEIGHT = 48;

export function getMiniPositions() { return MINI_POSITIONS; }

async function computeMiniPos(posKey) {
  const pos = MINI_POSITIONS[posKey] || MINI_POSITIONS['top-right'];
  let screenX = 0, screenY = 0, screenW = 1440, screenH = 900;
  try {
    const { currentMonitor, primaryMonitor } = await import('@tauri-apps/api/window');
    const m = (await currentMonitor()) || (await primaryMonitor());
    if (m) {
      screenX = m.position.x;
      screenY = m.position.y;
      screenW = m.size.width;
      screenH = m.size.height;
    }
  } catch (error) {
    console.error('mini monitor lookup failed:', error);
  }
  const margin = 12;
  const maxX = screenX + screenW - MINI_WIN_WIDTH - margin;
  const maxY = screenY + screenH - MINI_WIN_HEIGHT - margin;
  let x = screenX + margin;
  let y = screenY + margin;
  if (pos.x === 'center-x') x = screenX + Math.round((screenW - MINI_WIN_WIDTH) / 2);
  else if (pos.x === 'right-12') x = maxX;
  else if (typeof pos.x === 'number') x = screenX + pos.x;
  if (pos.y === 'bottom-12') y = maxY;
  else if (typeof pos.y === 'number') y = screenY + pos.y;
  if (x < screenX) x = screenX;
  if (y < screenY) y = screenY;
  if (x > maxX) x = maxX;
  if (y > maxY) y = maxY;
  return { x, y };
}

export async function createMiniWindow() {
  if (!isTauriRuntime()) return;
  if (miniWindow) {
    try {
      await miniWindow.show();
    } catch (error) {
      console.error('mini show failed:', error);
    }
    return;
  }
  try {
    const pos = await computeMiniPos(await get('miniWindowPosition') || 'top-right');
    miniWindow = new WebviewWindow('gugufly-mini', {
      url: '/mini.html',
      width: MINI_WIN_WIDTH, height: MINI_WIN_HEIGHT,
      x: pos.x, y: pos.y,
      transparent: true, decorations: false,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, focus: false, visible: true,
    });
    miniWindow.once('tauri://error', (e) => console.error('mini error:', e));
  } catch (e) { console.error('mini create failed:', e); miniWindow = null; }
}

export async function closeMiniWindow() {
  if (!miniWindow) return;
  try {
    await miniWindow.hide();
    await miniWindow.close();
  } catch (error) {
    console.error('mini close failed:', error);
  }
  miniWindow = null;
}

export async function positionMiniWindow(posKey) {
  if (!miniWindow) return;
  try {
    const key = posKey || (await get('miniWindowPosition')) || 'top-right';
    const p = await computeMiniPos(key);
    await miniWindow.setPosition(new LogicalPosition(p.x, p.y));
  } catch (error) {
    console.error('mini position failed:', error);
  }
}

export function formatUpcomingTime(sec) {
  if (sec < 60) return sec + '秒后';
  if (sec < 3600) return Math.floor(sec / 60) + '分钟后';
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? h + '小时' + m + '分钟后' : h + '小时后';
  }
  const d = Math.floor(sec / 86400);
  return d + '天后';
}

export async function updateMiniWindow(getNextUpcomingTaskFn) {
  if (!miniWindow) return;
  const upcoming = await getNextUpcomingTaskFn();
  try {
    const { emit } = await import('@tauri-apps/api/event');
    if (upcoming && upcoming.seconds <= 86400) {
      const icon = upcoming.task.type === 'alarm' ? '⏰' : upcoming.task.type === 'countdown' ? '⏱' : '📅';
      const label = upcoming.task.label || '提醒';
      const time = formatUpcomingTime(upcoming.seconds);
      await emit('mini-set-content', { icon, text: label, detail: time });
    } else {
      await emit('mini-set-content', { icon: '📋', text: '暂无提醒', detail: '' });
    }
  } catch (error) {
    console.error('mini update failed:', error);
  }
}

export function updateMiniPosGridActive(posKey) {
  const grid = document.getElementById('miniPosGrid');
  if (!grid) return;
  grid.querySelectorAll('.mini-pos-cell').forEach(c => {
    c.classList.toggle('active', c.dataset.pos === posKey);
  });
}
