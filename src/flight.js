import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';

function safeGetCurrentWebviewWindow() {
  try {
    return getCurrentWebviewWindow();
  } catch (e) {
    return null;
  }
}

const appWindow = safeGetCurrentWebviewWindow();
if (appWindow) {
  appWindow.setIgnoreCursorEvents(true);
}

const canvas = document.getElementById('flightCanvas');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const W = parseInt(params.get('w')) || 1920;
const H = parseInt(params.get('h')) || 1080;

const speedMap = { vslow: 0.1, slow: 0.2, normal: 0.35, fast: 0.6 };
const heightMap = { top: 0.25, center: 0.5, bottom: 0.75 };

const speedFactor = speedMap[params.get('speed')] || 0.35;
const heightPos = heightMap[params.get('height')] || 0.5;
const customMsg = params.get('msg') || '';
const planeStyle = params.get('plane') || 'classic';
const particleStyle = params.get('particle') || 'classic';
const bubbleStyle = params.get('bubble') || 'classic';
const imageData = localStorage.getItem('_flightImage') || '';
const useImage = localStorage.getItem('_flightUseImage') === '1';
const direction = params.get('dir') || 'ltr';
const sequenceId = params.get('seq') || '';

const isRtl = direction === 'rtl';
let flightDirection = isRtl ? -1 : 1;

canvas.width = W;
canvas.height = H;

const SCALE = 2.5;
const t0 = performance.now();

const totalDist = W + 240 * SCALE;

const plane = {
  x: isRtl ? W + 120 * SCALE : -120 * SCALE,
  y: H * heightPos + (Math.random() - 0.5) * 80,
  duration: 2500 / speedFactor,
  startTime: performance.now(),
};

const particles = [];

// --- Custom image (DOM img for GIF support) ---
let customImg = null;
const gifImg = document.getElementById('gifPlane');
if (useImage && imageData) {
  gifImg.src = imageData;
  customImg = gifImg;
}

// =================== Plane styles ===================

const planeDrawers = {
  classic(x, y, t) {
    ctx.fillStyle = '#4A9EFF';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#74B9FF';
    ctx.beginPath();
    ctx.ellipse(10, -2, 8, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF8C42';
    ctx.beginPath();
    ctx.moveTo(-4, -4); ctx.lineTo(6, -22); ctx.lineTo(14, -18); ctx.lineTo(8, -4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4); ctx.lineTo(6, 22); ctx.lineTo(14, 18); ctx.lineTo(8, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(-20, -2); ctx.lineTo(-28, -14); ctx.lineTo(-22, -14); ctx.lineTo(-16, -2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-20, 2); ctx.lineTo(-28, 14); ctx.lineTo(-22, 14); ctx.lineTo(-16, 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#636e72';
    const propAngle = (t / 50) % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(24 + Math.cos(propAngle) * 4, Math.sin(propAngle) * 4, 2, 0, Math.PI * 2);
    ctx.fill();
  },
  rocket(x, y, t) {
    const bob = Math.sin(t / 80) * 2;
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(28, 0 + bob);
    ctx.lineTo(-16, -18 + bob);
    ctx.lineTo(-14, 0 + bob);
    ctx.lineTo(-16, 18 + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#C0392B';
    ctx.beginPath();
    ctx.ellipse(-8, 0 + bob, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(6, -2 + bob, 4, 3, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#95A5A6';
    ctx.beginPath();
    ctx.ellipse(-18 + Math.sin(t / 100) * 2, 0 + bob, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  butterfly(x, y, t) {
    const flap = Math.sin(t / 60) * 0.3 + 1;
    const r1 = 18 * flap;
    const r2 = 18 / flap;
    ctx.fillStyle = '#9B59B6';
    ctx.beginPath();
    ctx.ellipse(-8, -2, r1, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, 2, r1, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E67E22';
    ctx.beginPath();
    ctx.ellipse(8, -2, r2, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, 2, r2, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F1C40F';
    ctx.beginPath();
    ctx.ellipse(-10, -3, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-10, 3, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2C3E50';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  jet(x, y, t) {
    ctx.fillStyle = '#636e72';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-20, -8);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-20, 8);
    ctx.lineTo(-8, 2);
    ctx.lineTo(-10, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b2bec3';
    ctx.beginPath();
    ctx.ellipse(12, 0, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.arc(-18, 0, 3 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  },
};

// =================== Particle styles ===================

function classicParticle(x, y) {
  const colors = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'];
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: flightDirection * -(3 + Math.random() * 4),
      vy: (Math.random() - 0.5) * 3,
      life: 1,
      size: 4 + Math.random() * 6,
      color: colors[i % colors.length],
      decay: 0.006 + Math.random() * 0.006,
    });
  }
}

function rocketParticle(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x - 20 + Math.random() * 10,
      y: y + (Math.random() - 0.5) * 20,
      vx: flightDirection * -(1 + Math.random() * 3),
      vy: (Math.random() - 0.5) * 2,
      life: 1,
      size: 3 + Math.random() * 8,
      color: ['#FF6B35', '#FFD700', '#FF4500', '#FF8C42'][i % 4],
      decay: 0.008 + Math.random() * 0.006,
    });
  }
}

function butterflyParticle(x, y) {
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      size: 2 + Math.random() * 3,
      color: ['#FFD700', '#FF69B4', '#9B59B6', '#F1C40F'][i % 4],
      decay: 0.004 + Math.random() * 0.004,
    });
  }
}

function jetParticle(x, y) {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: x - 30 + Math.random() * 15,
      y: y + (Math.random() - 0.5) * 8,
      vx: flightDirection * -(2 + Math.random() * 5),
      vy: (Math.random() - 0.5) * 0.5,
      life: 1,
      size: 3 + Math.random() * 5,
      color: ['#dfe6e9', '#74b9ff', '#a29bfe', '#dfe6e9'][i % 4],
      decay: 0.01 + Math.random() * 0.008,
    });
  }
}

const particleAdders = { classic: classicParticle, rocket: rocketParticle, butterfly: butterflyParticle, jet: jetParticle };

// =================== Bubble styles ===================

function drawClassicBubble(bx, by, text, textWidth, textHeight) {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(bx - textWidth / 2, by - textHeight / 2, textWidth, textHeight, 14 * SCALE);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx - 8 * SCALE, by + textHeight / 2);
  ctx.lineTo(bx, by + textHeight / 2 + 8 * SCALE);
  ctx.lineTo(bx + 8 * SCALE, by + textHeight / 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2d3436';
  ctx.fillText(text, bx, by);
}

function drawAngularBubble(bx, by, text, textWidth, textHeight) {
  ctx.fillStyle = 'rgba(44,62,80,0.9)';
  ctx.beginPath();
  ctx.roundRect(bx - textWidth / 2, by - textHeight / 2, textWidth, textHeight, 4 * SCALE);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx - 6 * SCALE, by + textHeight / 2);
  ctx.lineTo(bx, by + textHeight / 2 + 12 * SCALE);
  ctx.lineTo(bx + 6 * SCALE, by + textHeight / 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, bx, by);
}

function drawSoftBubble(bx, by, text, textWidth, textHeight) {
  ctx.fillStyle = 'rgba(255,182,193,0.9)';
  ctx.beginPath();
  const r = textHeight / 2;
  ctx.roundRect(bx - textWidth / 2, by - textHeight / 2, textWidth, textHeight, r);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by + textHeight / 2 + 6 * SCALE, 6 * SCALE, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d3436';
  ctx.fillText(text, bx, by);
}

function drawMinimalBubble(bx, by, text, textWidth, textHeight) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(bx - textWidth / 2, by - textHeight / 2, textWidth, textHeight, 20 * SCALE);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, bx, by);
}

const bubbleDrawers = {
  classic: drawClassicBubble,
  rocket: drawAngularBubble,
  butterfly: drawSoftBubble,
  jet: drawMinimalBubble,
};

const selectedPlane = planeDrawers[planeStyle] || planeDrawers.classic;
const selectedParticle = particleAdders[particleStyle] || particleAdders.classic;
const selectedBubble = bubbleDrawers[bubbleStyle] || bubbleDrawers.classic;

// --- Drawing ---

function drawPlane(x, y, t) {
  if (useImage && customImg && customImg.complete && customImg.naturalWidth > 0) {
    ctx.save();
    ctx.translate(x, y);
    if (isRtl) ctx.scale(-1, 1);
    const aspect = customImg.naturalWidth / customImg.naturalHeight;
    const iw = 60 * SCALE;
    const ih = iw / aspect;
    ctx.drawImage(customImg, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (isRtl) ctx.scale(-1, 1);
  ctx.scale(SCALE, SCALE);
  selectedPlane(x, y, t);
  ctx.restore();
}

function addParticle(x, y) {
  selectedParticle(x, y);
}

function drawQuote(x, y) {
  const text = customMsg;
  if (!text) return;
  ctx.font = `bold ${18 * SCALE}px -apple-system, "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padding = 14 * SCALE;
  const textWidth = ctx.measureText(text).width + padding * 2;
  const textHeight = 44 * SCALE;
  const bx = x;
  const by = y - 40 * SCALE - textHeight / 2;
  selectedBubble(bx, by, text, textWidth, textHeight);
}

function animate() {
  const elapsed = performance.now() - plane.startTime;
  const progress = Math.min(elapsed / plane.duration, 1);
  const t = performance.now() - t0;
  if (isRtl) {
    plane.x = W + 120 * SCALE - totalDist * progress;
  } else {
    plane.x = -120 * SCALE + totalDist * progress;
  }
  const floatY = Math.sin(t / 100) * 5;
  const currentY = plane.y + floatY;
  ctx.clearRect(0, 0, W, H);
  const particleOffX = isRtl ? 30 * SCALE : -30 * SCALE;
  if (plane.x >= -60 * SCALE && plane.x <= W + 60 * SCALE) {
    addParticle(plane.x + particleOffX, currentY);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.98; p.vy *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (plane.x > -120 * SCALE && plane.x < W + 120 * SCALE) {
    drawPlane(plane.x, currentY, t);
    drawQuote(plane.x, currentY);
  }
  if (progress < 1) {
    requestAnimationFrame(animate);
  } else if (particles.length > 0) {
    requestAnimationFrame(animate);
  } else {
    setTimeout(async () => {
      await emit('flight-ended', { sequenceId });
      if (appWindow) {
        await appWindow.close();
      }
    }, 300);
  }
}

requestAnimationFrame(animate);
