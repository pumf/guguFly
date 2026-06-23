(function(){
  var params = new URLSearchParams(location.search);
  var videoFile = params.get('file') || 'cat.mov';
  var duration = parseInt(params.get('duration')) || 30;
  var speed = parseFloat(params.get('speed')) || 1;
  var scale = parseFloat(params.get('scale')) || 1;
  var label = params.get('label') || '';

  // Built-in videos are hosted remotely
  var BUILTIN_VIDEO_BASE = 'https://fly.pumf.top/resource';
  var builtinNames = ['cat.mov', 'dog.mov'];
  if (builtinNames.includes(videoFile)) {
    videoFile = BUILTIN_VIDEO_BASE + '/' + videoFile;
  }

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d', { alpha: true });
  var remainingEl = document.getElementById('remaining');
  var clockEl = document.getElementById('clock');
  var labelEl = document.getElementById('label');
  var closeBtn = document.getElementById('close-btn');

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
  console.log('[video] final src:', videoFile);
  video.src = videoFile;
  video.load();

  video.addEventListener('error', function(e){
    console.error('[video] video element error:', video.error, 'code:', video.error?.code, 'message:', video.error?.message);
  });

  var frameId = null;

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
})();
