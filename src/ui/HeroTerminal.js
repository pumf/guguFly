let canvas = null;
let ctx = null;
let W = 0;
let H = 0;
let dpr = 1;
let stars = [];
let particles = [];
let t0 = 0;
const CYCLE = 7000;
let animFrame = null;

let heroTargetTs = 0;
let countdownInterval = null;

export function initHeroTerminal(_deps) {
  canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  dpr = window.devicePixelRatio || 1;

  resize();
  window.addEventListener('resize', resize);

  stars = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    r: Math.random() * 1.3 + 0.3,
    tw: Math.random() * Math.PI * 2,
  }));

  t0 = performance.now();
  requestAnimationFrame(frame);
}

function resize() {
  if (!canvas || !ctx) return;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawPlane(x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✈️', 0, 0);
  ctx.restore();
}

function frame(now) {
  if (!canvas || !ctx) return;

  const elapsed = (now - t0) % CYCLE;
  const progress = elapsed / CYCLE;
  const isDark = document.documentElement.dataset.theme === 'dark' ||
                 document.documentElement.dataset.activeTheme === 'dark';

  ctx.clearRect(0, 0, W, H);

  if (isDark) {
    for (const s of stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(now / 900 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cdd8ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const runwayY = H - 34;
  ctx.fillStyle = isDark ? 'rgba(26,36,71,.9)' : 'rgba(219,228,244,.9)';
  ctx.fillRect(0, runwayY, W, H - runwayY);

  const dashW = 26;
  const gap = 20;
  const offset = (now / 24) % (dashW + gap);
  ctx.fillStyle = themeColor('--amber') || '#ffb454';
  for (let x = -offset; x < W; x += dashW + gap) {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, runwayY + 12, dashW, 3);
  }
  ctx.globalAlpha = 1;

  const takeoffStart = 0.18;
  const flyEnd = 0.72;
  let px, py, ang, scale = 1, alpha = 1;

  if (progress < takeoffStart) {
    const p = progress / takeoffStart;
    px = 40 + p * W * 0.28;
    py = runwayY - 10;
    ang = 0;
    scale = 0.9;
  } else if (progress < flyEnd) {
    const p = (progress - takeoffStart) / (flyEnd - takeoffStart);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const x0 = 40 + W * 0.28;
    const y0 = runwayY - 10;
    const x1 = W + 60;
    const y1 = -40;
    const cx = W * 0.62;
    const cy = runwayY - H * 0.55;
    px = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
    py = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
    const dx = 2 * (1 - e) * (cx - x0) + 2 * e * (x1 - cx);
    const dy = 2 * (1 - e) * (cy - y0) + 2 * e * (y1 - cy);
    ang = Math.atan2(dy, dx) * 0.55;
    scale = 0.9 + e * 0.35;
    if (progress > flyEnd - 0.1) alpha = (flyEnd - progress) / 0.1;
  } else {
    px = -100;
    py = -100;
    ang = 0;
    alpha = 0;
  }

  if (alpha > 0 && progress >= takeoffStart) {
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: px - 14 + (Math.random() - 0.5) * 6,
        y: py + 6 + (Math.random() - 0.5) * 6,
        vx: -0.6 - Math.random() * 0.8,
        vy: 0.3 + Math.random() * 0.4,
        life: 1,
        r: 1.5 + Math.random() * 2.2,
      });
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.life * 0.5 * (isDark ? 1 : 0.7);
    ctx.fillStyle = themeColor('--cyan') || '#4cc9f0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (alpha > 0) {
    ctx.globalAlpha = alpha;
    drawPlane(px, py, ang, scale);
    ctx.globalAlpha = 1;
  }

  const blink = Math.sin(now / 300) > 0;
  if (blink) {
    ctx.fillStyle = themeColor('--amber') || '#ffb454';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(W - 24, runwayY - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  animFrame = requestAnimationFrame(frame);
}

/**
 * Update hero data.
 * @param {{ seconds: number, flightNo: string, label: string, msg: string, departInfo: string }|null} info
 */
export function updateHeroTask(info) {
  if (!info) {
    heroTargetTs = 0;
    setHeroInfo(null);
    setFlipNumbers(0, 0, 0);
    return;
  }
  heroTargetTs = Date.now() + info.seconds * 1000;
  setHeroInfo(info);
  updateFlipClock();
}

function setHeroInfo(info) {
  const labelEl = document.getElementById('heroFlightLabel');
  const msgEl = document.getElementById('heroFlightMsg');
  const departEl = document.getElementById('heroDepartInfo');
  if (!info) {
    if (labelEl) labelEl.textContent = '—';
    if (msgEl) msgEl.textContent = '';
    if (departEl) departEl.innerHTML = '';
    return;
  }
  if (labelEl) labelEl.innerHTML = `<span class="fno">${info.flightNo}</span>${info.label}`;
  if (msgEl) msgEl.textContent = info.msg || '';
  if (departEl) departEl.innerHTML = info.departInfo || '';
}

function updateFlipClock() {
  if (!heroTargetTs) {
    setFlipNumbers(0, 0, 0);
    return;
  }
  const remaining = Math.max(0, Math.floor((heroTargetTs - Date.now()) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  setFlipNumbers(h, m, s);
}

function setFlipNumbers(h, m, s) {
  setFlipDigit('fh', String(h).padStart(2, '0'));
  setFlipDigit('fm', String(m).padStart(2, '0'));
  setFlipDigit('fs', String(s).padStart(2, '0'));
}

function setFlipDigit(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== val) {
    el.textContent = val;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
}

export function startFlipClock() {
  if (countdownInterval) return;
  countdownInterval = setInterval(updateFlipClock, 1000);
}

export function stopFlipClock() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

export function destroyHeroTerminal() {
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  stopFlipClock();
  particles = [];
}
