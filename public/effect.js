(function(){
  var params = new URLSearchParams(location.search);
  var effectType = params.get('type') || 'fireworks';
  var duration = parseInt(params.get('duration')) || 15;
  var msg = params.get('msg') || '';

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d', { alpha: true });
  var W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  try {
    if (window.__TAURI__ && window.__TAURI__.window) {
      var appWindow = window.__TAURI__.window.getCurrentWindow();
      if (appWindow && appWindow.setShadow) appWindow.setShadow(false);
    }
  } catch(e) {}

  var particles = [];
  var frameId = null;
  var elapsed = 0;
  var lastTime = performance.now();

  // --- Text explosion state ---
  var textParticles = [];
  var textPhase = msg ? 'gathering' : 'done';
  var textTimer = 0;
  var textScale = 0;
  var textDone = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ==================== FIREWORKS ====================
  var fireworkColors = ['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#f368e0','#ff4757','#2ed573','#ffa502','#1e90ff','#e056fd','#fa8231'];

  function createFireworkExplosion(cx, cy, color) {
    var baseColor = color || pick(fireworkColors);
    var count = 120 + Math.floor(Math.random() * 80);
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 10;
      var isSparkle = Math.random() < 0.2;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.004 + Math.random() * 0.012,
        size: isSparkle ? 1.5 + Math.random() * 2 : 2.5 + Math.random() * 5,
        color: isSparkle ? '#fff' : baseColor,
        trail: [],
        trailLen: 4,
        type: 'particle',
        sparkle: isSparkle,
        gravity: 0.035,
      });
    }
    // Flash
    particles.push({
      x: cx, y: cy, vx: 0, vy: 0,
      life: 1, decay: 0.08, size: 30,
      color: baseColor, trail: [], trailLen: 0, type: 'flash', gravity: 0,
    });
  }

  function launchFirework() {
    var x = 80 + Math.random() * (W - 160);
    var targetY = 50 + Math.random() * (H * 0.45);
    var color = pick(fireworkColors);
    particles.push({
      x: x, y: H + 10,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(7 + Math.random() * 5),
      life: 1,
      targetY: targetY,
      color: color,
      size: 3.5,
      trail: [],
      trailLen: 5,
      type: 'rocket',
      gravity: 0,
    });
  }

  // ==================== FIRECRACKERS ====================
  var crackerColors = ['#ff4757','#ff6348','#ff6b81','#eccc68','#ffa502','#ff7f50','#ff2d55','#ff9500','#ffd700','#ff1744'];

  function createFirecrackerExplosion(x, y) {
    var baseColor = pick(crackerColors);
    for (var i = 0; i < 60; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 3 + Math.random() * 12;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.025,
        size: 2 + Math.random() * 4,
        color: Math.random() < 0.25 ? '#fff' : pick(crackerColors),
        trail: [],
        trailLen: 3,
        type: 'particle',
        gravity: 0.05,
      });
    }
    // Flash
    particles.push({
      x: x, y: y, vx: 0, vy: 0,
      life: 1, decay: 0.12, size: 25,
      color: '#fff', trail: [], trailLen: 0, type: 'flash', gravity: 0,
    });
    // Chain reaction
    if (Math.random() < 0.4) {
      setTimeout(function() {
        createFirecrackerExplosion(
          x + rand(-80, 80),
          y + rand(-60, 60)
        );
      }, 80 + Math.random() * 120);
    }
  }

  function launchFirecracker() {
    var x = 40 + Math.random() * (W - 80);
    var y = 40 + Math.random() * (H - 80);
    createFirecrackerExplosion(x, y);
  }

  // ==================== RAINBOW ====================
  // Rainbow bridge: horizontal colored bars extending from left to right,
  // forming an actual rainbow arch across the screen.
  var rainbowColors = [
    '#ff0040', // red
    '#ff7f00', // orange
    '#ffee00', // yellow
    '#00ff66', // green
    '#00ccff', // sky blue
    '#0066ff', // blue
    '#8b00ff'  // purple
  ];

  function launchRainbowBar(colorIdx) {
    // A single colored bar that extends from left edge to right edge
    // forming one stripe of the rainbow
    var c = rainbowColors[colorIdx % rainbowColors.length];
    particles.push({
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 1,
      decay: 0,
      size: 0,
      color: c,
      trail: [],
      trailLen: 0,
      type: 'rainbow-bar',
      gravity: 0,
      colorIdx: colorIdx,
      barProgress: 0,        // 0 to 1: how much the bar has extended
      barSpeed: 0.012 + Math.random() * 0.008, // extension speed
      barThickness: 8 + Math.random() * 6,
      bridgeY: 0,           // Y position of this bar in the arch (set by createRainbowBridge)
      // Wobble parameters for gentle floating motion
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 0.6,
      wobbleAmp: 4 + Math.random() * 4,
      baseY: 0,
    });
  }

  function createRainbowBridge() {
    // Create a rainbow arch: 7 wide layered bars forming a bridge.
    // Each bar has a slight vertical offset to create depth/layering.
    // The arch is a parabolic curve: y = peakY + ((x-cx)/W*2)^2 * archHeight
    var cx = W / 2;
    var peakY = H * 0.28; // top of the arch
    var endY = H * 0.82;  // where the rainbow meets the ground
    var archHeight = endY - peakY;
    // Base thickness for all bars - wide and bold
    var baseThickness = 18;

    for (var i = 0; i < rainbowColors.length; i++) {
      // Layered look: outer bars (i=0,6) are slightly wider and offset down more
      // for a 3D layered effect. Middle bars are thinner and higher.
      var layerMultiplier;
      if (i === 0 || i === rainbowColors.length - 1) {
        // outermost (red / purple) - thickest, lowest
        layerMultiplier = 1.0;
      } else if (i === 1 || i === rainbowColors.length - 2) {
        // second from edge - thick
        layerMultiplier = 0.95;
      } else {
        // middle (yellow/green/cyan) - thinnest, highest
        layerMultiplier = 0.85;
      }
      var thickness = baseThickness * layerMultiplier;

      var bar = {
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 1,
        decay: 0,
        size: 0,
        color: rainbowColors[i],
        trail: [],
        trailLen: 0,
        type: 'rainbow-bar',
        gravity: 0,
        colorIdx: i,
        barProgress: 0,
        // Slower extension: ~2.5-3s to fully extend across the screen
        barSpeed: 0.0065 + i * 0.0004,
        barThickness: thickness,
        bridgeCx: cx,
        bridgePeakY: peakY,
        bridgeEndY: endY,
        bridgeHeight: archHeight,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.5 + Math.random() * 0.3,
        wobbleAmp: 3 + Math.random() * 3,
        // Stagger: outer bars start slightly later to create layered draw-in
        startDelay: i * 0.08,
        currentDelay: 0,
        // Vertical offset for layering: outer bars sit lower at the peak
        // This creates a 3D stepped look
        layerOffset: i,
      };
      particles.push(bar);
    }
  }

  // ==================== BUBBLES ====================
  // Floating iridescent bubbles rising from the bottom
  var bubbleEmojis = ['🫧', '💧', '⭕'];

  function launchBubble() {
    var x = 30 + Math.random() * (W - 60);
    var size = 14 + Math.random() * 30;
    var bubble = {
      x: x,
      y: H + size,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(1.5 + Math.random() * 2.5),
      life: 1,
      decay: 0.001 + Math.random() * 0.001,
      size: size,
      color: pick(rainbowColors),
      trail: [],
      trailLen: 0,
      type: 'bubble',
      gravity: -0.01, // slight anti-gravity to float up
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 1.5 + Math.random() * 1,
      wobbleAmp: 0.5 + Math.random() * 1,
      popped: false,
    };
    particles.push(bubble);
  }

  function popBubble(p) {
    // Dramatic explosion when bubble pops: burst of colorful particles + flash
    var count = 20 + Math.floor(Math.random() * 12);
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1.5 + Math.random() * 5;
      particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        size: 2 + Math.random() * 3.5,
        color: i % 3 === 0 ? '#fff' : p.color,
        trail: [],
        trailLen: 2,
        type: 'particle',
        gravity: 0.035,
      });
    }
    // Central flash
    particles.push({
      x: p.x, y: p.y, vx: 0, vy: 0,
      life: 1, decay: 0.1, size: p.size * 0.8,
      color: '#fff', trail: [], trailLen: 0, type: 'flash', gravity: 0,
    });
    // Secondary rainbow sparkles
    var sparkCount = 8;
    for (var i = 0; i < sparkCount; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 4;
      var c = pick(rainbowColors);
      particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 1.5 + Math.random() * 2.5,
        color: c,
        trail: [],
        trailLen: 3,
        type: 'particle',
        gravity: 0.03,
      });
    }
  }

  // ==================== EMOJIS ====================
  var emojis = ['🎉','🎊','✨','🌟','💫','🎈','🎀','❤️','💖','🔥','⭐','🌈','🎯','💥','👍','🥳','🎄','🎃','🎁','🏆','💎','🦋','🌸','🍀','🎵','🍰','🚀','💝','🍾','🎶'];

  function launchEmojiBurst() {
    var count = 25 + Math.floor(Math.random() * 15);
    var baseX = 40 + Math.random() * (W - 80);
    for (var i = 0; i < count; i++) {
      var angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 0.6;
      var speed = 8 + Math.random() * 16;
      particles.push({
        x: baseX + (Math.random() - 0.5) * 120,
        y: H + 20,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.004 + Math.random() * 0.006,
        size: 26 + Math.random() * 24,
        emoji: pick(emojis),
        trail: [],
        trailLen: 3,
        type: 'emoji',
        gravity: 0.04,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.12,
        willExplode: true,
        explodeTime: 0.8 + Math.random() * 1.2,
        age: 0,
      });
    }
  }

  function explodeEmoji(p) {
    var count = 18;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 3 + Math.random() * 8;
      particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015 + Math.random() * 0.025,
        size: 3 + Math.random() * 4,
        color: pick(['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#ffa502','#2ed573','#fff']),
        trail: [], trailLen: 2, type: 'particle', gravity: 0.04,
      });
    }
  }

  // ==================== TEXT EXPLOSION ====================
  function initTextExplosion() {
    if (!msg) return;
    textPhase = 'gathering';
    textTimer = 0;
    textScale = 0;
    textParticles = [];

    var fontSize = Math.min(W * 0.12, H * 0.15, 80);
    if (fontSize < 28) fontSize = 28;

    // Render text to a SMALL offscreen canvas (just the text bounding area)
    // to sample pixels - this is much more reliable and faster than scanning
    // the entire screen canvas.
    var cx = W / 2;
    var cy = H / 2;

    // Measure text to determine offscreen canvas size
    var measureCanvas = document.createElement('canvas');
    var mctx = measureCanvas.getContext('2d');
    mctx.font = 'bold ' + fontSize + 'px "PingFang SC","Avenir Next",sans-serif';
    var metrics = mctx.measureText(msg);
    var textW = Math.ceil(metrics.width) + 40;
    var textH = Math.ceil(fontSize * 1.4) + 40;

    var off = document.createElement('canvas');
    off.width = textW;
    off.height = textH;
    var octx = off.getContext('2d');
    octx.font = 'bold ' + fontSize + 'px "PingFang SC","Avenir Next",sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    octx.fillText(msg, textW / 2, textH / 2);

    var imgData = octx.getImageData(0, 0, textW, textH);
    var data = imgData.data;
    var spacing = Math.max(3, fontSize * 0.12);
    var offsetX = cx - textW / 2;
    var offsetY = cy - textH / 2;

    for (var py = 0; py < textH; py += spacing) {
      for (var px = 0; px < textW; px += spacing) {
        var idx = (Math.floor(py) * textW + Math.floor(px)) * 4;
        if (data[idx + 3] > 50) {
          textParticles.push({
            targetX: offsetX + px,
            targetY: offsetY + py,
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            size: 2.5 + Math.random() * 3,
            color: pick(fireworkColors),
            life: 1,
          });
        }
      }
    }
  }

  function updateTextExplosion(dt) {
    if (textPhase === 'done' || !msg || textParticles.length === 0) return;
    textTimer += dt;

    if (textPhase === 'gathering') {
      var allArrived = true;
      for (var i = 0; i < textParticles.length; i++) {
        var p = textParticles[i];
        var dx = p.targetX - p.x;
        var dy = p.targetY - p.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 1.5) {
          allArrived = false;
          p.vx += dx * 0.04;
          p.vy += dy * 0.04;
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.x += p.vx;
          p.y += p.vy;
        } else {
          p.x = p.targetX;
          p.y = p.targetY;
          p.vx = 0;
          p.vy = 0;
        }
      }
      if (allArrived && textTimer > 0.8) {
        textPhase = 'expanding';
        textTimer = 0;
        textScale = 0.05;
      }
    } else if (textPhase === 'expanding') {
      textScale += (1 - textScale) * 0.05;
      if (textScale > 0.97 && textTimer > 3.0) {
        textPhase = 'exploding';
        textTimer = 0;
        for (var i = 0; i < textParticles.length; i++) {
          var p = textParticles[i];
          var angle = Math.atan2(p.y - H/2, p.x - W/2) + (Math.random() - 0.5) * 0.6;
          var speed = 5 + Math.random() * 15;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.decay = 0.006 + Math.random() * 0.014;
          p.gravity = 0.04;
        }
        // Flash at center
        particles.push({
          x: W/2, y: H/2, vx: 0, vy: 0,
          life: 1, decay: 0.06, size: 40,
          color: '#fff', trail: [], trailLen: 0, type: 'flash', gravity: 0,
        });
      }
    } else if (textPhase === 'exploding') {
      var allGone = true;
      for (var i = textParticles.length - 1; i >= 0; i--) {
        var p = textParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += (p.gravity || 0.04);
        p.life -= (p.decay || 0.01);
        p.size *= 0.992;
        if (p.life <= 0 || p.y > H + 50) {
          textParticles.splice(i, 1);
        } else {
          allGone = false;
        }
      }
      if (allGone) {
        if (elapsed < duration - 1.5) {
          // Restart the text animation for the next cycle
          textTimer = 0;
          initTextExplosion();
        } else {
          textPhase = 'done';
          textDone = true;
        }
      }
    }
  }

  // ==================== UPDATE ====================
  function update(dt) {
    elapsed += dt;

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      // Update trail (simple ring buffer, no array shift)
      if (p.trailLen > 0) {
        if (p.trail.length >= p.trailLen) {
          p.trail.shift();
        }
        p.trail.push({ x: p.x, y: p.y });
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.04;
      p.vx *= 0.99;
      if (p.rotSpeed) p.rot += p.rotSpeed;
      p.life -= p.decay;

      if (p.type === 'emoji' && p.willExplode) {
        p.age += dt;
        if (p.age > p.explodeTime && p.life > 0.3) {
          explodeEmoji(p);
          p.life = 0;
        }
      }

      if (p.type === 'rocket' && p.vy > -1 && !p.exploded) {
        p.exploded = true;
        createFireworkExplosion(p.x, p.y, p.color);
        p.life = 0;
      }

      // Rainbow beam: explode when it reaches its target height
      if (p.type === 'rainbow-beam' && !p.exploded && p.y <= p.endY) {
        p.exploded = true;
        createRainbowShockwave(p.x, p.y, p.color);
        p.life = 0;
      }

      // Rainbow orb: explode after max age
      if (p.type === 'rainbow-orb') {
        p.age += dt;
        if (p.age > p.maxAge) {
          createRainbowShockwave(p.x, p.y, p.color);
          p.life = 0;
        }
      }

      // Rainbow bar: extend across the screen with stagger delay, then fade out
      if (p.type === 'rainbow-bar') {
        // Stagger: each bar waits for its delay before starting to extend
        if (p.currentDelay < p.startDelay) {
          p.currentDelay += dt;
        } else {
          p.barProgress += p.barSpeed;
        }
        if (p.barProgress >= 1) {
          // Bar fully extended, hold briefly then start fading
          p.barProgress = 1;
          p.fadeTimer = (p.fadeTimer || 0) + dt;
          if (p.fadeTimer > 2.0) {
            p.life -= dt * 0.6;
          }
        }
        p.wobblePhase += dt * p.wobbleSpeed;
      }

      // Bubble: float up, wobble, pop at top
      if (p.type === 'bubble') {
        p.wobblePhase += dt * p.wobbleSpeed;
        p.x += Math.sin(p.wobblePhase) * p.wobbleAmp;
        // Pop when reaching upper portion of screen for a visible explosion
        if (p.y < p.size * 1.5 && !p.popped) {
          p.popped = true;
          popBubble(p);
          p.life = 0;
        } else if (p.y < -p.size * 2) {
          // Off-screen, just remove
          p.life = 0;
        }
      }

      if (p.life <= 0 || p.y > H + 60 || p.x < -60 || p.x > W + 60) {
        particles.splice(i, 1);
      }
    }

    // Auto-launch (reduced rates for performance)
    if (effectType === 'fireworks') {
      if (Math.random() < 0.018 && particles.length < 300) launchFirework();
    } else if (effectType === 'firecrackers') {
      if (Math.random() < 0.035 && particles.length < 250) launchFirecracker();
    } else if (effectType === 'emojis') {
      if (particles.length < 150 && Math.random() < 0.035) launchEmojiBurst();
    } else if (effectType === 'rainbow') {
      // Rainbow: extend the bar across the screen, then reset
      if (Math.random() < 0.008 && particles.length < 20) createRainbowBridge();
    } else if (effectType === 'bubbles') {
      // Bubbles: continuously spawn floating bubbles
      if (Math.random() < 0.08 && particles.length < 120) launchBubble();
    }

    updateTextExplosion(dt);
  }

  // ==================== DRAW (optimized) ====================
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // --- Batch draw trails (grouped by style) ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.trail.length < 2 || p.trailLen === 0) continue;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (var t = 1; t < p.trail.length; t++) {
        ctx.lineTo(p.trail[t].x, p.trail[t].y);
      }
      ctx.lineWidth = Math.max(1, p.size * 0.5);
      if (p.type === 'emoji') {
        ctx.strokeStyle = 'rgba(255,255,255,' + (p.life * 0.15) + ')';
      } else {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.life * 0.4;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // --- Batch draw particles by type for performance ---
    // Draw all circular particles in one pass with simple arcs (no gradients)
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type === 'emoji') continue; // skip, handle separately
      if (p.type === 'flash') continue; // skip, handle separately

      var drawSize = p.size * p.life;
      if (drawSize < 0.3) continue;

      // Outer glow (single arc with reduced radius, no gradient)
      ctx.globalAlpha = p.life * 0.25;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, drawSize * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, drawSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Draw flashes (simple, no gradient) ---
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type !== 'flash') continue;
      var fSize = p.size * p.life;
      if (fSize < 0.5) continue;
      // Simple white circle with alpha
      ctx.globalAlpha = p.life * 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, fSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Draw rockets ---
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type !== 'rocket') continue;
      // Rocket trail fire (simple circle)
      ctx.globalAlpha = p.life * 0.5;
      ctx.fillStyle = 'rgba(255,180,60,0.7)';
      ctx.beginPath();
      ctx.arc(p.x, p.y + 8, 10, 0, Math.PI * 2);
      ctx.fill();
      // Rocket head
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Draw emojis (avoid shadow blur for perf) ---
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type !== 'emoji') continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.font = p.size + 'px sans-serif';
      ctx.globalAlpha = p.life;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // --- Draw rainbow bars (the rainbow bridge) ---
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type !== 'rainbow-bar') continue;
      if (p.barProgress <= 0) continue;
      // Calculate the arch curve: y = peakY + ((x-cx)/W*2)^2 * archHeight
      // The bar extends from left to right as barProgress goes 0->1
      var endX = W * p.barProgress;
      var cx = p.bridgeCx;
      var peakY = p.bridgePeakY + p.layerOffset * 2.5;
      var archHeight = p.bridgeHeight - p.layerOffset * 4;
      var alpha = Math.min(1, p.life);
      // Outer glow for depth (wider, semi-transparent)
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.barThickness * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      var steps = 80;
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var x = t * endX;
        if (x > W) break;
        // Parabolic arch: y = peakY + ((x-cx)/W*2)^2 * archHeight
        var norm = (x - cx) / (W / 2);
        var y = peakY + norm * norm * archHeight;
        // Add gentle wobble
        y += Math.sin(p.wobblePhase + t * 4) * p.wobbleAmp;
        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      // Main bar
      ctx.globalAlpha = alpha;
      ctx.lineWidth = p.barThickness;
      ctx.beginPath();
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var x = t * endX;
        if (x > W) break;
        var norm = (x - cx) / (W / 2);
        var y = peakY + norm * norm * archHeight;
        y += Math.sin(p.wobblePhase + t * 4) * p.wobbleAmp;
        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      // Bright inner highlight (thinner, lighter)
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = p.barThickness * 0.3;
      ctx.beginPath();
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var x = t * endX;
        if (x > W) break;
        var norm = (x - cx) / (W / 2);
        var y = peakY + norm * norm * archHeight - 2; // slightly above main bar
        y += Math.sin(p.wobblePhase + t * 4) * p.wobbleAmp;
        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // --- Draw bubbles (luminous, translucent) ---
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.type !== 'bubble') continue;
      var alpha = p.life;
      // Outer soft glow halo
      var glowGrad = ctx.createRadialGradient(p.x, p.y, p.size * 0.5, p.x, p.y, p.size * 1.6);
      glowGrad.addColorStop(0, p.color);
      glowGrad.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
      ctx.fill();
      // Translucent body (soft fill, very low alpha for glassy look)
      ctx.globalAlpha = alpha * 0.12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Iridescent thin outline
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      // Bright glossy highlight (upper-left, the classic bubble shine)
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, p.size * 0.32, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // Small secondary highlight (lower-right)
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x + p.size * 0.25, p.y + p.size * 0.3, p.size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Tiny sparkle on the rim (upper-right) for extra luminosity
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x + p.size * 0.5, p.y - p.size * 0.6, p.size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Draw text explosion ---
    drawTextExplosion();
  }

  function drawTextExplosion() {
    if (textPhase === 'done' || !msg) return;
    var cx = W / 2;
    var cy = H / 2;

    if (textPhase === 'gathering') {
      // Draw converging particles (simple dots)
      ctx.globalAlpha = 0.8;
      for (var i = 0; i < textParticles.length; i++) {
        var p = textParticles[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (textPhase === 'expanding') {
      var fontSize = Math.min(W * 0.12, H * 0.15, 80);
      if (fontSize < 28) fontSize = 28;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(textScale, textScale);

      ctx.font = 'bold ' + fontSize + 'px "PingFang SC","Avenir Next",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Measure text for border
      var metrics = ctx.measureText(msg);
      var tw = metrics.width;
      var th = fontSize * 1.1;
      var padX = fontSize * 0.45;
      var padY = fontSize * 0.3;
      var bgW = tw + padX * 2;
      var bgH = th + padY * 2;
      var r = Math.min(bgH / 2, 18);

      // Animated rainbow border: rotating linear gradient stroke
      var borderWidth = 4;
      var animT = (elapsed * 0.8) % 1; // 0..1 cycling
      var gradAngle = animT * Math.PI * 2;
      // Gradient direction rotates
      // Colorful text shadow: cycle through rainbow colors with multi-layer shadow
      var shadowColors = [
        '#ff0040', '#ff7f00', '#ffee00', '#00ff66',
        '#00ccff', '#8b00ff', '#ff00cc'
      ];
      var shadowBlur = Math.max(16, fontSize * 0.4);
      var t = (elapsed * 1.2) % 1; // cycle speed

      // Draw multiple shadow layers with different rainbow colors for a glowing effect
      ctx.save();
      // Outer glow: large blur with cycling color
      var colorIdx1 = Math.floor(t * shadowColors.length);
      ctx.shadowColor = shadowColors[colorIdx1];
      ctx.shadowBlur = shadowBlur * 1.5;
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, 0, 0);

      // Middle glow: offset and different color
      var colorIdx2 = (colorIdx1 + 3) % shadowColors.length;
      ctx.shadowColor = shadowColors[colorIdx2];
      ctx.shadowBlur = shadowBlur;
      ctx.fillText(msg, 0, 0);

      // Inner highlight: white core
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = shadowBlur * 0.4;
      ctx.fillText(msg, 0, 0);
      ctx.restore();

      // Main text fill (no shadow) for crisp center
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, 0, 0);

      ctx.restore();
    } else if (textPhase === 'exploding') {
      for (var i = 0; i < textParticles.length; i++) {
        var p = textParticles[i];
        var sz = Math.max(0.5, p.size * p.life);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function tick(now) {
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    frameId = requestAnimationFrame(tick);
  }

  // --- Close ---
  function closeWindow() {
    if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
    try {
      if (window.__TAURI__ && window.__TAURI__.window) {
        window.__TAURI__.window.getCurrentWindow().close();
      } else {
        try { window.close(); } catch(e) {}
      }
    } catch(e) { try { window.close(); } catch(_) {} }
  }

  // The window uses setIgnoreCursorEvents(true) for native click-through,
  // so there is no clickable close button. Close via auto-close timer
  // or the Escape key.
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeWindow();
  });

  // --- Initial bursts ---
  if (effectType === 'fireworks') {
    for (var i = 0; i < 4; i++) {
      setTimeout(launchFirework, i * 300 + Math.random() * 200);
    }
    var fwInterval = setInterval(function(){
      if (elapsed > duration) clearInterval(fwInterval);
      else launchFirework();
    }, 600 + Math.random() * 300);
  } else if (effectType === 'firecrackers') {
    for (var i = 0; i < 6; i++) {
      setTimeout(launchFirecracker, i * 200 + Math.random() * 100);
    }
    var fcInterval = setInterval(function(){
      if (elapsed > duration) clearInterval(fcInterval);
      else launchFirecracker();
    }, 300 + Math.random() * 200);
  } else if (effectType === 'emojis') {
    launchEmojiBurst();
    setTimeout(launchEmojiBurst, 300);
    setTimeout(launchEmojiBurst, 600);
    var emInterval = setInterval(function(){
      if (elapsed > duration) clearInterval(emInterval);
      else launchEmojiBurst();
    }, 700 + Math.random() * 300);
  } else if (effectType === 'rainbow') {
    // Initial rainbow bridge
    createRainbowBridge();
    // Continuously create new rainbow bridges (slower pace for more dramatic effect)
    var rbInterval = setInterval(function(){
      if (elapsed > duration) clearInterval(rbInterval);
      else createRainbowBridge();
    }, 5000);
  } else if (effectType === 'bubbles') {
    // Initial burst of bubbles (staggered, so they pop at different times)
    for (var i = 0; i < 12; i++) {
      setTimeout(launchBubble, i * 180);
    }
    // Continuous bubble spawning
    var bubInterval = setInterval(function(){
      if (elapsed > duration) clearInterval(bubInterval);
      else launchBubble();
    }, 200 + Math.random() * 150);
  }

  if (msg) {
    setTimeout(initTextExplosion, 300);
  }

  frameId = requestAnimationFrame(tick);

  setTimeout(closeWindow, (duration - 1) * 1000);
})();