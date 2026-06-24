(function(){
  var params = new URLSearchParams(location.search);
  var videoFile = params.get('file') || 'cat.mov';
  var duration = parseInt(params.get('duration')) || 30;
  var speed = parseFloat(params.get('speed')) || 1;
  var scale = parseFloat(params.get('scale')) || 1;
  var label = params.get('label') || '';

  var BUILTIN_VIDEO_BASE = 'https://fly.pumf.top/resource';
  var builtinNames = ['cat.mov', 'dog.mov'];
  // Note: FlightOrchestrator already handles built-in video URL
  // selection (local cache vs remote). We only fall back to the
  // remote URL here if the param somehow still has a bare 'cat.mov'
  // / 'dog.mov' string (e.g. opened directly without going through
  // the orchestrator).
  if (builtinNames.includes(videoFile)) {
    videoFile = BUILTIN_VIDEO_BASE + '/' + videoFile;
  }

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d', { alpha: true });
  var remainingEl = document.getElementById('remaining');
  var clockEl = document.getElementById('clock');
  var labelEl = document.getElementById('label');
  var closeBtn = document.getElementById('close-btn');
  var loadingEl = document.getElementById('loading');
  var stallHintEl = document.getElementById('stall-hint');

  if (label) labelEl.textContent = label;

  function fmtTime(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }

  try {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.convertFileSrc && videoFile.startsWith('/')) {
      console.log('[video] original path:', videoFile);
      videoFile = window.__TAURI__.core.convertFileSrc(videoFile);
      console.log('[video] convertFileSrc result:', videoFile);
    }
  } catch(e) { console.error('[video] convertFileSrc error:', e); }

  function resize() {
    canvas.width = window.innerWidth + 2;
    canvas.height = window.innerHeight + 2;
  }
  resize();
  window.addEventListener('resize', resize);

  ctx.imageSmoothingEnabled = false;

  try {
    if (window.__TAURI__ && window.__TAURI__.window) {
      var appWindow = window.__TAURI__.window.getCurrentWindow();
      if (appWindow && appWindow.setShadow) appWindow.setShadow(false);
    }
  } catch(e) {}

  var video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsinline = true;
  video.preload = 'auto';
  console.log('[video] final src:', videoFile);
  video.src = videoFile;
  video.load();

  video.addEventListener('error', function(e){
    console.error('[video] video element error:', video.error, 'code:', video.error?.code, 'message:', video.error?.message);
    // If the source URL was a remote fallback and it failed, immediately
    // try to download a local cached copy. This avoids the user seeing
    // a stuck "loading" state when the remote host is unreachable.
    if (!localRetryAttempted && builtinNames.includes(originalFile) && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      localRetryAttempted = true;
      loadingEl.innerHTML = '<div class="spinner"></div><div>正在下载本地缓存…</div>';
      window.__TAURI__.core.invoke('download_builtin_video', { name: originalFile })
        .then(function(localPath) {
          console.log('[video] error fallback: switching to local file', localPath);
          switchToLocalFile(localPath);
        })
        .catch(function(e2) {
          console.error('[video] error fallback download failed:', e2);
          loadingEl.innerHTML = '<div>⚠️ 视频加载失败</div>';
        });
    } else {
      loadingEl.innerHTML = '<div>⚠️ 视频加载失败</div>';
    }
  });

  // Fallback timeout: if the video hasn't started playing after 8
  // seconds, try fetching a local cached copy and switching to it.
  // This handles cases where the initial URL (e.g. remote fallback)
  // is unreachable due to network issues.
  setTimeout(function() {
    if (ready) return;
    if (localRetryAttempted) return;
    localRetryAttempted = true;
    // Only attempt if the original file was a built-in video
    if (builtinNames.includes(originalFile) && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>正在下载本地缓存…</div>';
      window.__TAURI__.core.invoke('download_builtin_video', { name: originalFile })
        .then(function(localPath) {
          if (ready) return; // Video started playing while we were downloading
          console.log('[video] timeout fallback: switching to local file', localPath);
          switchToLocalFile(localPath);
        })
        .catch(function(e) {
          console.error('[video] timeout fallback download failed:', e);
          loadingEl.innerHTML = '<div>⚠️ 视频加载失败</div><div style="font-size:12px;margin-top:8px;opacity:0.7">请检查网络连接</div>';
        });
    } else {
      loadingEl.innerHTML = '<div>⚠️ 视频加载失败</div><div style="font-size:12px;margin-top:8px;opacity:0.7">请检查网络连接</div>';
    }
  }, 8000);

  var frameId = null;
  var ready = false;
  var stallTimer = null;
  var stallCount = 0;
  var lastFrameTime = 0;

  // Track if we've already retried with a local file
  var localRetryAttempted = false;
  // Function to switch to a local cached file
  function switchToLocalFile(localPath) {
    if (!localPath || !window.__TAURI__ || !window.__TAURI__.core) return false;
    try {
      var converted = window.__TAURI__.core.convertFileSrc(localPath);
      if (converted) {
        console.log('[video] switching to local cached file:', converted);
        ready = false;
        loadingEl.classList.remove('hidden');
        loadingEl.innerHTML = '<div class="spinner"></div><div>正在切换到本地缓存…</div>';
        video.src = converted;
        video.load();
        return true;
      }
    } catch (e) {
      console.error('[video] switchToLocalFile error:', e);
    }
    return false;
  }

  video.addEventListener('canplay', function(){
    ready = true;
    loadingEl.classList.add('hidden');
  });

  video.addEventListener('canplaythrough', function(){
    ready = true;
    loadingEl.classList.add('hidden');
  });

  video.addEventListener('waiting', function(){
    stallHintEl.classList.remove('hidden');
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      stallHintEl.classList.add('hidden');
    }, 3000);
  });

  video.addEventListener('playing', function(){
    stallHintEl.classList.add('hidden');
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
  });

  video.addEventListener('stalled', function(){
    stallHintEl.classList.remove('hidden');
    stallCount++;
    if (stallCount > 3) {
      video.pause();
      setTimeout(function(){
        video.currentTime = video.currentTime || 0;
        video.play().catch(function(){});
      }, 500);
    }
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      stallHintEl.classList.add('hidden');
    }, 4000);
  });

  function drawFrame() {
    if (!video.paused && !video.ended) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var scaledW = Math.round(canvas.width * scale);
      var scaledH = Math.round(canvas.height * scale);
      var offsetX = Math.round((canvas.width - scaledW) / 2);
      var offsetY = Math.round((canvas.height - scaledH) / 2);
      ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);
    }
    frameId = requestAnimationFrame(drawFrame);
  }

  video.addEventListener('play', function(){
    video.playbackRate = speed;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(drawFrame);
  });

  video.addEventListener('pause', function(){
    if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
  });

  var remaining = duration;
  remainingEl.textContent = fmtTime(remaining);

  function updateClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    clockEl.textContent = h + ':' + m + ':' + s;
  }

  function closeWindow() {
    if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
    video.pause();
    video.src = '';
    video.load();
    try {
      if (window.__TAURI__ && window.__TAURI__.window) {
        window.__TAURI__.window.getCurrentWindow().close();
      } else {
        try { window.close(); } catch(e) {}
      }
    } catch(e) { try { window.close(); } catch(_) {} }
  }

  updateClock();
  var clockTimer = setInterval(updateClock, 1000);

  var countdownTimer = setInterval(function(){
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      clearInterval(countdownTimer);
      clearInterval(clockTimer);
      setTimeout(closeWindow, 500);
    }
    remainingEl.textContent = fmtTime(remaining);
  }, 1000);

  closeBtn.addEventListener('click', function(){
    clearInterval(countdownTimer);
    clearInterval(clockTimer);
    closeWindow();
  });
  closeBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  closeBtn.addEventListener('mouseup', function(e) { e.stopPropagation(); });

  // Note: close button clickability is handled entirely via CSS in
  // video.html: body and canvas have pointer-events:none, while
  // #close-btn has pointer-events:auto. This lets the rest of the
  // screen pass mouse events through to the main app while the
  // close button remains clickable. We previously used
  // setIgnoreCursorEvents but that blocks ALL mouse events at the
  // webview level, including the close button itself.

  setTimeout(function(){
    if (!ready) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>视频加载较慢，请耐心等待…</div>';
    }
  }, 5000);
})();