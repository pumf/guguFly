(async function(){
  var tasks = [];
  var taskIndex = 0;
  var isUrgent = false;

  function setContent(icon, text, detail) {
    try {
      if (icon !== undefined) document.getElementById('i').textContent = icon;
      if (text !== undefined) document.getElementById('t').textContent = text;
      if (detail !== undefined) document.getElementById('d').textContent = detail;
    } catch(e) {}
  }

  function showTask(index) {
    if (!tasks || tasks.length === 0) {
      setContent('📋', '暂无提醒', '');
      document.getElementById('m').classList.remove('urgent');
      return;
    }
    var t = tasks[index % tasks.length];
    setContent(t.icon, t.text, t.detail);
    isUrgent = t.urgent || false;
    document.getElementById('m').classList.toggle('urgent', isUrgent);
    document.getElementById('pulse').style.display = isUrgent ? 'block' : 'none';
  }

  function getWin() {
    try { return window.__TAURI__ && window.__TAURI__.webviewWindow ? window.__TAURI__.webviewWindow.getCurrentWebviewWindow() : null; } catch(e){ return null; }
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  try {
    if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) {
      await window.__TAURI__.event.listen('mini-set-content', function(event){
        var p = event && event.payload;
        if (!p) return;
        if (p.tasks) {
          tasks = p.tasks;
          taskIndex = 0;
          showTask(0);
        } else {
          tasks = [];
          showTask(0);
        }
      });
      await window.__TAURI__.event.listen('mini-set-position', function(event){
        var p = event && event.payload;
        if (!p) return;
        var w = getWin();
        if (w && w.setPosition && typeof p.x === 'number' && typeof p.y === 'number') {
          try { w.setPosition({ type: 'Physical', x: Math.round(p.x), y: Math.round(p.y) }); } catch(e){}
        }
      });
    }
  } catch(e) {}

  // --- Click to open main window ---
  document.addEventListener('click', function(e){
    if (dragging) return;
    try {
      if (window.__TAURI__ && window.__TAURI__.webviewWindow) {
        var mainWin = window.__TAURI__.webviewWindow.getByLabel('main');
        if (mainWin) { mainWin.show(); mainWin.setFocus(); }
      }
    } catch(e) {}
  });

  // --- Scroll wheel to navigate tasks ---
  document.addEventListener('wheel', function(e){
    if (tasks.length <= 1) return;
    if (e.deltaY > 0) {
      taskIndex = (taskIndex + 1) % tasks.length;
    } else {
      taskIndex = (taskIndex - 1 + tasks.length) % tasks.length;
    }
    showTask(taskIndex);
  }, { passive: true });

  // --- Drag to reposition + persist ---
  var dragging = false;
  var startMouseX = 0, startMouseY = 0;
  var curWinX = 0, curWinY = 0;
  var rafId = 0;
  var pendingX = 0, pendingY = 0;
  var screenW = 1440, screenH = 900;
  var winW = 240, winH = 48;
  var dragMoved = false;

  function applyPos() {
    rafId = 0;
    var w = getWin();
    if (w && w.setPosition) {
      try { w.setPosition({ type: 'Physical', x: Math.round(pendingX), y: Math.round(pendingY) }); } catch(e){}
    }
    curWinX = pendingX; curWinY = pendingY;
  }
  function schedule(x, y) {
    pendingX = x; pendingY = y;
    if (rafId) return;
    rafId = requestAnimationFrame(applyPos);
  }
  function syncWin() {
    var w = getWin();
    if (!w) return;
    if (window.__TAURI__ && window.__TAURI__.window) {
      window.__TAURI__.window.currentMonitor().then(function(m){
        if (!m) return window.__TAURI__.window.primaryMonitor();
        return m;
      }).then(function(m){
        if (m) { screenW = m.size.width; screenH = m.size.height; }
      }).catch(function(){});
    }
    w.outerPosition().then(function(p){ if (p) { curWinX = p.x; curWinY = p.y; } }).catch(function(){});
    w.outerSize().then(function(s){ if (s) { winW = s.width; winH = s.height; } }).catch(function(){});
  }

  function onMouseMove(e) {
    if (!dragging) return;
    dragMoved = true;
    var dx = e.clientX - startMouseX;
    var dy = e.clientY - startMouseY;
    var maxX = Math.max(0, screenW - winW);
    var maxY = Math.max(0, screenH - winH);
    schedule(clamp(curWinX + dx, 0, maxX), clamp(curWinY + dy, 0, maxY));
  }
  function onMouseUp() {
    var wasDragging = dragging;
    dragging = false;
    document.body.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (wasDragging && dragMoved) {
      try {
        if (window.__TAURI__ && window.__TAURI__.event) {
          window.__TAURI__.event.emit('mini-drag-end', { x: pendingX, y: pendingY });
        }
      } catch(e) {}
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
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    syncWin();
  }
  document.addEventListener('mousedown', onMouseDown);

  function onTouchMove(e) {
    if (!dragging || !e.touches[0]) return;
    dragMoved = true;
    e.preventDefault();
    var t = e.touches[0];
    var dx = t.clientX - startMouseX;
    var dy = t.clientY - startMouseY;
    var maxX = Math.max(0, screenW - winW);
    var maxY = Math.max(0, screenH - winH);
    schedule(clamp(curWinX + dx, 0, maxX), clamp(curWinY + dy, 0, maxY));
  }
  function onTouchEnd() {
    var wasDragging = dragging;
    dragging = false;
    document.body.classList.remove('dragging');
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    if (wasDragging && dragMoved) {
      try {
        if (window.__TAURI__ && window.__TAURI__.event) {
          window.__TAURI__.event.emit('mini-drag-end', { x: pendingX, y: pendingY });
        }
      } catch(e) {}
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
})();
