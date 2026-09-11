import './style.css';
import { getFace, toImage } from './store.js';
import { mountSetup } from './setup.js';
import { loadDetector, startDetectionLoop, SCREEN_CLASSES } from './detect.js';
import { drawCharacter, pickPhrase } from './characters.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('overlay');
const ctx = canvas.getContext('2d');

const ENTER_MS = 500; // screen must be visible this long before waving
const EXIT_MS = 1000; // and gone this long before calming down
const FORCE_MS = 2000; // tap-to-test duration
const LERP = 0.18;

const app = {
  faces: { a: null, b: null },
  dets: [],
  screen: null, // best screen box in CSS pixels
  threshold: 0.4,
  debug: false,
  state: 'IDLE',
  seenSince: 0,
  lostSince: 0,
  forceUntil: 0,
  bubble: null,
  bubbleAt: 0,
  bubbleOn: 0
};

const chars = [
  { outfit: 'casual', faceKey: 'a', phase: 0, x: 0, y: 0, h: 0, ready: false },
  { outfit: 'suit', faceKey: 'b', phase: 1.7, x: 0, y: 0, h: 0, ready: false }
];

// ---------------------------------------------------------------- viewport

let W = 0;
let H = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

/** Maps video pixels to CSS pixels, accounting for object-fit: cover. */
function videoMap() {
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  return { scale, dx: (W - vw * scale) / 2, dy: (H - vh * scale) / 2 };
}

function mapBox([x, y, w, h]) {
  const m = videoMap();
  return { x: x * m.scale + m.dx, y: y * m.scale + m.dy, w: w * m.scale, h: h * m.scale };
}

// ---------------------------------------------------------------- state

function setState(next, now) {
  if (app.state === next) return;
  app.state = next;
  if (next === 'WAVING') {
    app.bubble = pickPhrase();
    app.bubbleOn = (Math.random() * 2) | 0;
    app.bubbleAt = now;
  } else {
    app.bubble = null;
  }
}

function updateState(now) {
  const screens = app.dets.filter((d) => SCREEN_CLASSES.has(d.cls) && d.score >= app.threshold);
  const best = screens.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
  app.screen = best ? mapBox(best.box) : null;

  const forced = now < app.forceUntil;
  const seen = !!best || forced;

  if (seen) {
    if (!app.seenSince) app.seenSince = now;
    app.lostSince = 0;
  } else {
    if (!app.lostSince) app.lostSince = now;
    app.seenSince = 0;
  }

  if (app.state === 'IDLE' && seen && (forced || now - app.seenSince >= ENTER_MS)) {
    setState('WAVING', now);
  } else if (app.state === 'WAVING' && !seen && now - app.lostSince >= EXIT_MS) {
    setState('IDLE', now);
  }

  if (app.state === 'WAVING' && now - app.bubbleAt > 1800) {
    app.bubble = pickPhrase();
    app.bubbleOn = (Math.random() * 2) | 0;
    app.bubbleAt = now;
  }
}

// ---------------------------------------------------------------- targets

function targetsFor() {
  if (app.screen) {
    const b = app.screen;
    const h = Math.min(Math.max(b.h * 0.75, 80), H * 0.6);
    const feet = Math.min(b.y + b.h, H - 8);
    const edge = h * 0.34; // keep the whole body on screen
    return [
      { x: Math.max(edge, b.x), y: feet, h },
      { x: Math.min(W - edge, b.x + b.w), y: feet, h }
    ];
  }
  const h = Math.min(H * 0.32, 280);
  const feet = H - 52;
  return [
    { x: W * 0.27, y: feet, h },
    { x: W * 0.73, y: feet, h }
  ];
}

// ---------------------------------------------------------------- render

function drawDebug() {
  ctx.lineWidth = 2;
  ctx.font = '600 12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const d of app.dets) {
    const isScreen = SCREEN_CLASSES.has(d.cls);
    const passes = isScreen && d.score >= app.threshold;
    const b = mapBox(d.box);
    ctx.strokeStyle = passes ? '#ffd23f' : isScreen ? 'rgba(255,210,63,0.35)' : 'rgba(255,255,255,0.28)';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    const label = `${d.cls} ${d.score.toFixed(2)}`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(b.x, b.y - 16, ctx.measureText(label).width + 10, 16);
    ctx.fillStyle = passes ? '#ffd23f' : '#fff';
    ctx.fillText(label, b.x + 5, b.y - 4);
  }
  $('debug-state').textContent =
    `state: ${app.state} · dets: ${app.dets.length}` + (app.screen ? ' · screen ✓' : '');
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  if (!W || !H) resize();

  const now = nowMs;
  const t = nowMs / 1000;
  updateState(now);

  const targets = targetsFor();
  ctx.clearRect(0, 0, W, H);
  if (app.debug) drawDebug();

  const waving = app.state === 'WAVING';
  chars.forEach((c, i) => {
    const tg = targets[i];
    if (!c.ready) {
      Object.assign(c, tg);
      c.ready = true;
    } else {
      c.x += (tg.x - c.x) * LERP;
      c.y += (tg.y - c.y) * LERP;
      c.h += (tg.h - c.h) * LERP;
    }
    drawCharacter(ctx, {
      x: c.x,
      y: c.y,
      h: c.h,
      t,
      phase: c.phase,
      waving,
      outfit: c.outfit,
      vw: W,
      face: app.faces[c.faceKey],
      bubble: waving && app.bubbleOn === i ? app.bubble : null
    });
  });
}

// ---------------------------------------------------------------- boot

async function loadFaces() {
  app.faces.a = await toImage(await getFace('a'));
  app.faces.b = await toImage(await getFace('b'));
}

async function hasBothFaces() {
  return !!(await getFace('a')) && !!(await getFace('b'));
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

let detectionStarted = false;

async function run() {
  $('gate').hidden = true;
  $('loading').hidden = false;

  try {
    $('loading-text').textContent = 'Starting camera…';
    await startCamera();
  } catch (err) {
    $('loading').hidden = true;
    $('gate').hidden = false;
    $('gate-text').textContent =
      'Camera access is required. Allow it in the browser settings, then try again. (' +
      (err?.name || 'error') +
      ')';
    return;
  }

  resize();

  if (!detectionStarted) {
    detectionStarted = true;
    $('loading-text').textContent = 'Loading model…';
    try {
      const detect = await loadDetector();
      startDetectionLoop({
        video,
        detect,
        fps: 6,
        onResult: (r) => (app.dets = r),
        onError: (e) => console.warn('detect failed', e)
      });
    } catch (err) {
      console.error(err);
      $('loading-text').textContent = 'Model failed to load. Tap the screen to make them wave.';
      setTimeout(() => ($('loading').hidden = true), 2500);
      return;
    }
  }

  $('loading').hidden = true;
}

async function openSetup(canCancel) {
  const root = $('setup');
  root.hidden = false;
  const saved = await mountSetup(root, { canCancel });
  root.hidden = true;
  root.innerHTML = '';
  if (saved) await loadFaces();
  return saved;
}

// exposed for quick poking from the console
window.bossRepellent = app;

// UI wiring
$('gate-btn').onclick = () => run();

$('btn-debug').onclick = (e) => {
  e.stopPropagation();
  app.debug = !app.debug;
  $('btn-debug').classList.toggle('on', app.debug);
  $('debug-panel').hidden = !app.debug;
};

$('btn-faces').onclick = async (e) => {
  e.stopPropagation();
  await openSetup(true);
};

$('thr').oninput = (e) => {
  app.threshold = parseFloat(e.target.value);
  $('thr-value').textContent = app.threshold.toFixed(2);
};

// tap anywhere on the scene to force a wave
$('stage').addEventListener('pointerdown', () => {
  app.forceUntil = performance.now() + FORCE_MS;
});

(async function init() {
  resize();
  requestAnimationFrame(frame);
  // Setup opens on top of the gate, so the camera still starts from a real tap
  // (iOS only grants getUserMedia inside a user gesture).
  if (!(await hasBothFaces())) await openSetup(false);
  await loadFaces();
})();
