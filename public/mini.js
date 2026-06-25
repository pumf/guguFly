(async function(){
  var tasks = [];
  var taskIndex = 0;
  var isUrgent = false;
  var lastScrollTime = 0;
  var countdownTimer = null;

  function formatTime(sec) {
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'min';
    if (sec < 86400) {
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      return m > 0 ? h + 'h' + m + 'm' : h + 'h';
    }
    var d = Math.floor(sec / 86400);
    return d + 'd';
  }

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
    // Use locally computed remaining if available, otherwise use detail
    var detail = (typeof t._localRemaining === 'number')
      ? formatTime(t._localRemaining)
      : t.detail;
    setContent(t.icon, t.text, detail);
    isUrgent = t.urgent || false;
    document.getElementById('m').classList.toggle('urgent', isUrgent);
    document.getElementById('pulse').style.display = isUrgent ? 'block' : 'none';
    var hintEl = document.getElementById('hint');
    if (hintEl) hintEl.style.display = tasks.length > 1 ? '' : 'none';
  }

  function startLocalCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    countdownTimer = setInterval(function() {
      if (!tasks.length) return;
      var now = Date.now();
      for (var i = 0; i < tasks.length; i++) {
        var t = tasks[i];
        if (typeof t.rawSeconds === 'number' && typeof t._receivedAt === 'number') {
          var elapsed = Math.floor((now - t._receivedAt) / 1000);
          t._localRemaining = Math.max(0, t.rawSeconds - elapsed);
        }
      }
      showTask(taskIndex);
    }, 1000);
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
          var now = Date.now();
          tasks = p.tasks.map(function(t) {
            // Preserve local countdown state if task already exists
            var existing = null;
            for (var i = 0; i < tasks.length; i++) {
              if (tasks[i].text === t.text && tasks[i].icon === t.icon) {
                existing = tasks[i];
                break;
              }
            }
            // If receiving updated rawSeconds from main window, resync
            if (existing && typeof t.rawSeconds === 'number' &&
                typeof existing.rawSeconds === 'number' &&
                Math.abs(t.rawSeconds - existing.rawSeconds) <= 2) {
              // Main window sent a fresh value — resync to it
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
    lastScrollTime = Date.now();
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
  var scaleFactor = 1;
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
        if (m) {
          screenW = m.size.width;
          screenH = m.size.height;
          scaleFactor = m.scaleFactor || 1;
        }
      }).catch(function(){});
    }
    w.outerPosition().then(function(p){ if (p) { curWinX = p.x; curWinY = p.y; } }).catch(function(){});
    w.outerSize().then(function(s){ if (s) { winW = s.width; winH = s.height; } }).catch(function(){});
  }

  function onMouseMove(e) {
    if (!dragging) return;
    dragMoved = true;
    var dx = (e.clientX - startMouseX) * scaleFactor;
    var dy = (e.clientY - startMouseY) * scaleFactor;
    var maxX = Math.max(0, screenW - winW);
    var maxY = Math.max(0, screenH - winH);
    schedule(clamp(curWinX + dx, 0, maxX), clamp(curWinY + dy, 0, maxY));
  }
  function onMouseUp() {
    var wasDragging = dragging;
    dragging = false;
    document.body.classList.remove('dragging');
    window.removeEventListener('mousemove', onMouseMove, { capture: true });
    window.removeEventListener('mouseup', onMouseUp, { capture: true });
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
    // Listen on window (not document) and use capture so we keep
    // receiving events even when the cursor leaves the mini window
    // bounds — this is critical on Windows where the cursor can
    // temporarily leave the WebView during fast drags.
    window.addEventListener('mousemove', onMouseMove, { capture: true });
    window.addEventListener('mouseup', onMouseUp, { capture: true });
    syncWin();
  }
  document.addEventListener('mousedown', onMouseDown);

  function onTouchMove(e) {
    if (!dragging || !e.touches[0]) return;
    dragMoved = true;
    e.preventDefault();
    var t = e.touches[0];
    var dx = (t.clientX - startMouseX) * scaleFactor;
    var dy = (t.clientY - startMouseY) * scaleFactor;
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
