let tasks = [];
let taskIndex = 0;
let isUrgent = false;
let lastScrollTime = 0;
let countdownTimer = null;

function formatTime(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'min';
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? h + 'h' + m + 'm' : h + 'h';
  }
  const d = Math.floor(sec / 86400);
  return d + 'd';
}

function setContent(icon, text, detail) {
  try {
    if (icon !== undefined) document.getElementById('i').textContent = icon;
    if (text !== undefined) document.getElementById('t').textContent = text;
    if (detail !== undefined) document.getElementById('d').textContent = detail;
  } catch { /* ignore */ }
}

function showTask(index) {
  if (!tasks || tasks.length === 0) {
    setContent('📋', '暂无提醒', '');
    document.getElementById('m').classList.remove('urgent');
    return;
  }
  const t = tasks[index % tasks.length];
  const detail = (typeof t._localRemaining === 'number')
    ? formatTime(t._localRemaining)
    : t.detail;
  setContent(t.icon, t.text, detail);
  isUrgent = t.urgent || false;
  document.getElementById('m').classList.toggle('urgent', isUrgent);
  document.getElementById('pulse').style.display = isUrgent ? 'block' : 'none';
  const hintEl = document.getElementById('hint');
  if (hintEl) hintEl.style.display = tasks.length > 1 ? '' : 'none';
}

function startLocalCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  countdownTimer = setInterval(() => {
    if (!tasks.length) return;
    const now = Date.now();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (typeof t.rawSeconds === 'number' && typeof t._receivedAt === 'number') {
        const elapsed = Math.floor((now - t._receivedAt) / 1000);
        t._localRemaining = Math.max(0, t.rawSeconds - elapsed);
      }
    }
    showTask(taskIndex);
  }, 1000);
}

function getWin() {
  try { return window.__TAURI__ && window.__TAURI__.webviewWindow ? window.__TAURI__.webviewWindow.getCurrentWebviewWindow() : null; } catch { return null; }
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

async function init() {
  try {
    if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) {
      await window.__TAURI__.event.listen('mini-set-content', (event) => {
        const p = event && event.payload;
        if (!p) return;
        if (p.tasks) {
          const now = Date.now();
          tasks = p.tasks.map((t) => {
            let existing = null;
            for (let i = 0; i < tasks.length; i++) {
              if (tasks[i].text === t.text && tasks[i].icon === t.icon) {
                existing = tasks[i];
                break;
              }
            }
            if (existing && typeof t.rawSeconds === 'number' &&
                typeof existing.rawSeconds === 'number' &&
                Math.abs(t.rawSeconds - existing.rawSeconds) <= 2) {
              return { rawSeconds: t.rawSeconds, _receivedAt: now, icon: t.icon, text: t.text, detail: t.detail, urgent: t.urgent };
            }
            if (typeof t.rawSeconds === 'number') {
              return { rawSeconds: t.rawSeconds, _receivedAt: now, icon: t.icon, text: t.text, detail: t.detail, urgent: t.urgent };
            }
            return t;
          });
          if (Date.now() - lastScrollTime > 3000) {
            taskIndex = 0;
          }
          showTask(taskIndex);
          startLocalCountdown();
        } else {
          tasks = [];
          showTask(0);
          if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        }
      });
      await window.__TAURI__.event.listen('mini-set-position', (event) => {
        const p = event && event.payload;
        if (!p) return;
        const w = getWin();
        if (w && w.setPosition && typeof p.x === 'number' && typeof p.y === 'number') {
          try { w.setPosition({ type: 'Physical', x: Math.round(p.x), y: Math.round(p.y) }); } catch { /* ignore */ }
        }
      });
    }
  } catch { /* ignore */ }
}

// --- Click to open main window ---
document.addEventListener('click', () => {
  if (dragging) return;
  try {
    if (window.__TAURI__ && window.__TAURI__.webviewWindow) {
      const mainWin = window.__TAURI__.webviewWindow.getByLabel('main');
      if (mainWin) { mainWin.show(); mainWin.setFocus(); }
    }
  } catch { /* ignore */ }
});

// --- Scroll wheel to navigate tasks ---
document.addEventListener('wheel', (e) => {
  if (tasks.length <= 1) return;
  if (e.deltaY > 0) {
    taskIndex = (taskIndex + 1) % tasks.length;
  } else {
    taskIndex = (taskIndex - 1 + tasks.length) % tasks.length;
  }
  lastScrollTime = Date.now();
  showTask(taskIndex);
}, { passive: true });

// --- Drag to reposition + persist ---
let dragging = false;
let startMouseX = 0, startMouseY = 0;
let curWinX = 0, curWinY = 0;
let rafId = 0;
let pendingX = 0, pendingY = 0;
let screenW = 1440, screenH = 900;
let winW = 240, winH = 48;
let scaleFactor = 1;
let dragMoved = false;

function applyPos() {
  rafId = 0;
  const w = getWin();
  if (w && w.setPosition) {
    try { w.setPosition({ type: 'Physical', x: Math.round(pendingX), y: Math.round(pendingY) }); } catch { /* ignore */ }
  }
  curWinX = pendingX; curWinY = pendingY;
}
function schedule(x, y) {
  pendingX = x; pendingY = y;
  if (rafId) return;
  rafId = requestAnimationFrame(applyPos);
}
function syncWin() {
  const w = getWin();
  if (!w) return;
  if (window.__TAURI__ && window.__TAURI__.window) {
    window.__TAURI__.window.currentMonitor().then((m) => {
      if (!m) return window.__TAURI__.window.primaryMonitor();
      return m;
    }).then((m) => {
      if (m) {
        screenW = m.size.width;
        screenH = m.size.height;
        scaleFactor = m.scaleFactor || 1;
      }
    }).catch(() => {});
  }
  w.outerPosition().then((p) => { if (p) { curWinX = p.x; curWinY = p.y; } }).catch(() => {});
  w.outerSize().then((s) => { if (s) { winW = s.width; winH = s.height; } }).catch(() => {});
}

function onMouseMove(e) {
  if (!dragging) return;
  dragMoved = true;
  const dx = (e.clientX - startMouseX) * scaleFactor;
  const dy = (e.clientY - startMouseY) * scaleFactor;
  const maxX = Math.max(0, screenW - winW);
  const maxY = Math.max(0, screenH - winH);
  schedule(clamp(curWinX + dx, 0, maxX), clamp(curWinY + dy, 0, maxY));
}
function onMouseUp() {
  const wasDragging = dragging;
  dragging = false;
  document.body.classList.remove('dragging');
  window.removeEventListener('mousemove', onMouseMove, { capture: true });
  window.removeEventListener('mouseup', onMouseUp, { capture: true });
  if (wasDragging && dragMoved) {
    try {
      if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.emit('mini-drag-end', { x: pendingX, y: pendingY });
      }
    } catch { /* ignore */ }
  }
  dragMoved = false;
}
function onMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  dragMoved = false;
  startMouseX = e.clientX;
  startMouseY = e.clientY;
  dragging = true;
  document.body.classList.add('dragging');
  window.addEventListener('mousemove', onMouseMove, { capture: true });
  window.addEventListener('mouseup', onMouseUp, { capture: true });
  syncWin();
}
document.addEventListener('mousedown', onMouseDown);

function onTouchMove(e) {
  if (!dragging || !e.touches[0]) return;
  dragMoved = true;
  e.preventDefault();
  const t = e.touches[0];
  const dx = (t.clientX - startMouseX) * scaleFactor;
  const dy = (t.clientY - startMouseY) * scaleFactor;
  const maxX = Math.max(0, screenW - winW);
  const maxY = Math.max(0, screenH - winH);
  schedule(clamp(curWinX + dx, 0, maxX), clamp(curWinY + dy, 0, maxY));
}
function onTouchEnd() {
  const wasDragging = dragging;
  dragging = false;
  document.body.classList.remove('dragging');
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  if (wasDragging && dragMoved) {
    try {
      if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.emit('mini-drag-end', { x: pendingX, y: pendingY });
      }
    } catch { /* ignore */ }
  }
  dragMoved = false;
}
function onTouchStart(e) {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  dragMoved = false;
  startMouseX = e.touches[0].clientX;
  startMouseY = e.touches[0].clientY;
  dragging = true;
  document.body.classList.add('dragging');
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  syncWin();
}
document.addEventListener('touchstart', onTouchStart, { passive: false });

setTimeout(syncWin, 200);
init();