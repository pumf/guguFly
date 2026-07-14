(function(){
  var params = new URLSearchParams(location.search);
  var videoFile = params.get('file') || 'cat.mov';
  var duration = parseInt(params.get('duration')) || 30;
  var speed = parseFloat(params.get('speed')) || 1;
  var scale = parseFloat(params.get('scale')) || 1;
  var label = params.get('label') || '';

  var isZh = navigator.language.startsWith('zh');
  var i18n = {
    switching: isZh ? '正在切换到本地缓存…' : 'Switching to local cache…',
    trying: isZh ? '正在尝试远程加载…' : 'Trying remote loading…',
    loadError: isZh ? '⚠️ 视频加载失败' : '⚠️ Video failed to load',
    networkError: isZh ? '请检查网络连接' : 'Please check your network',
    localError: isZh ? '⚠️ 本地视频文件无法访问' : '⚠️ Local file inaccessible',
    localHint: isZh ? '文件可能已被移动或删除' : 'File may have been moved or deleted',
    loadSlow: isZh ? '视频加载较慢，请耐心等待…' : 'Loading slowly, please wait…',
    'video.loading': isZh ? '正在加载视频…' : 'Loading video…',
    'video.buffering': isZh ? '⏳ 视频缓冲中，请稍候…' : '⏳ Buffering, please wait…',
    'video.rest_label': isZh ? '🐱 休息一下' : '🐱 Take a break',
    'video.countdown': isZh ? '还剩 <strong id=\"remaining\">0</strong> 秒' : '<strong id=\"remaining\">0</strong> sec remaining',
  };

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (i18n[key]) el.innerHTML = i18n[key];
  });

  var BUILTIN_VIDEO_BASE = 'https://fly.pumf.top/resource';
  var builtinNames = ['cat.mov', 'dog.mov'];
  var originalFile = videoFile;
  var isBuiltinVideo = builtinNames.includes(originalFile);
  if (isBuiltinVideo) {
    videoFile = BUILTIN_VIDEO_BASE + '/' + videoFile;
  }

  var video = document.getElementById('v');
  var remainingEl = document.getElementById('remaining');
  var clockEl = document.getElementById('clock');
  var labelEl = document.getElementById('label');
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
      videoFile = window.__TAURI__.core.convertFileSrc(videoFile);
    }
  } catch(e) { console.error('[video] convertFileSrc error:', e); }

  try {
    if (window.__TAURI__ && window.__TAURI__.window) {
      var appWindow = window.__TAURI__.window.getCurrentWindow();
      if (appWindow && appWindow.setShadow) appWindow.setShadow(false);
    }
  } catch(e) {}

  video.style.transform = 'scale(' + scale + ')';

  var ready = false;
  var stallTimer = null;
  var stallCount = 0;
  var localPath = null;
  var switchingToLocal = false;

  function startVideo(src) {
    console.log('[video] final src:', src);
    video.src = src;
    video.load();
  }

  if (isBuiltinVideo && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    window.__TAURI__.core.invoke('download_builtin_video', { name: originalFile })
      .then(function(path) {
        localPath = path;
        console.log('[video] local cache ready:', path);
        startVideo(window.__TAURI__.core.convertFileSrc(path));
      })
      .catch(function(e) {
        console.warn('[video] cache/download failed, trying remote:', e);
        startVideo(videoFile);
      });
  } else {
    startVideo(videoFile);
  }

  video.addEventListener('error', function(e){
    console.error('[video] video element error:', video.error, 'code:', video.error?.code, 'message:', video.error?.message);
    if (isBuiltinVideo && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      if (localPath) {
        loadingEl.innerHTML = '<div class="spinner"></div><div>' + i18n.trying + '</div>';
        switchToLocalFile(localPath, false);
      } else {
        loadingEl.innerHTML = '<div>' + i18n.loadError + '</div><div style="font-size:12px;margin-top:8px;opacity:0.7">' + i18n.networkError + '</div>';
      }
    } else {
      if (originalFile && originalFile.startsWith('/')) {
        loadingEl.innerHTML = '<div>' + i18n.localError + '</div><div style="font-size:12px;margin-top:8px;opacity:0.7">' + i18n.localHint + '</div>';
      } else {
        loadingEl.innerHTML = '<div>' + i18n.loadError + '</div>';
      }
    }
  });

  function switchToLocalFile(path, silent) {
    if (!path || !window.__TAURI__ || !window.__TAURI__.core) return;
    try {
      var converted = window.__TAURI__.core.convertFileSrc(path);
      if (!converted) return;
      switchingToLocal = true;
      var currentTime = video.currentTime || 0;
      var wasPlaying = !video.paused;
      console.log('[video] switching to local cached file:', converted, 'silent:', silent);
      if (!silent) {
        loadingEl.innerHTML = '<div class="spinner"></div><div>' + i18n.switching + '</div>';
        loadingEl.classList.remove('hidden');
      }
      video.src = converted;
      video.load();
      video.addEventListener('canplay', function onCanPlay() {
        video.removeEventListener('canplay', onCanPlay);
        video.currentTime = currentTime;
        if (wasPlaying) video.play().catch(function(){});
        switchingToLocal = false;
      });
    } catch (e) {
      console.error('[video] switchToLocalFile error:', e);
      switchingToLocal = false;
    }
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

  var lastRecoverTime = 0;
  video.addEventListener('stalled', function(){
    stallHintEl.classList.remove('hidden');
    stallCount++;
    if (stallCount > 3) {
      var now = Date.now();
      if (now - lastRecoverTime > 3000) {
        lastRecoverTime = now;
        video.pause();
        setTimeout(function(){
          video.currentTime = video.currentTime || 0;
          video.play().catch(function(){});
        }, 500);
      }
    }
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      stallHintEl.classList.add('hidden');
    }, 4000);
  });

  video.addEventListener('playing', function(){
    stallCount = 0;
  });

  video.addEventListener('play', function(){
    video.playbackRate = speed;
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

  var windowClosed = false;
  function scheduleClose() {
    if (windowClosed) return;
    windowClosed = true;
    clearInterval(countdownTimer);
    clearInterval(clockTimer);
    setTimeout(closeWindow, 200);
  }

  updateClock();
  var clockTimer = setInterval(updateClock, 1000);

  var countdownTimer = setInterval(function(){
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      remainingEl.textContent = fmtTime(remaining);
      scheduleClose();
      return;
    }
    remainingEl.textContent = fmtTime(remaining);
  }, 1000);

  if (typeof video.addEventListener === 'function') {
    video.addEventListener('ended', scheduleClose);
    video.addEventListener('timeupdate', function() {
      if (video.duration && isFinite(video.duration) && video.currentTime >= video.duration - 0.1) {
        scheduleClose();
      }
      if (stallCount > 0 && !video.paused) {
        stallCount = 0;
        stallHintEl.classList.add('hidden');
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      scheduleClose();
      closeWindow();
    }
  });

  setTimeout(function(){
    if (!ready) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>' + i18n.loadSlow + '</div>';
    }
  }, 5000);
})();