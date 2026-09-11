// First-run face setup: pick a photo per slot, drag to position, slider to zoom.
// The cropped square is stored in IndexedDB and never leaves the device.

import { getFace, putFace, toImage } from './store.js';

const S = 300; // crop canvas working size
const OUT = 256; // stored face size

const SLOTS = [
  { key: 'a', title: 'Colleague A', sub: 'casual outfit' },
  { key: 'b', title: 'Colleague B', sub: 'suit and tie' }
];

function createSlot(def, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'slot';
  wrap.innerHTML = `
    <h2>${def.title}</h2>
    <div class="crop empty">
      <canvas width="${S}" height="${S}"></canvas>
      <div class="mask"></div>
      <div class="empty-label">no photo yet</div>
    </div>
    <div class="row">
      <button class="chip pick">Choose photo</button>
      <input type="range" min="1" max="3" step="0.01" value="1" />
    </div>
    <div class="sub">${def.sub} · drag to position</div>
    <input type="file" accept="image/*" />
  `;

  const crop = wrap.querySelector('.crop');
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const zoom = wrap.querySelector('input[type=range]');
  const file = wrap.querySelector('input[type=file]');

  const state = { img: null, zoom: 1, ox: 0, oy: 0 };

  const baseScale = () => Math.max(S / state.img.width, S / state.img.height);

  function clamp() {
    const eff = baseScale() * state.zoom;
    const mx = Math.max(0, (state.img.width * eff - S) / 2);
    const my = Math.max(0, (state.img.height * eff - S) / 2);
    state.ox = Math.min(mx, Math.max(-mx, state.ox));
    state.oy = Math.min(my, Math.max(-my, state.oy));
  }

  function paint(target, size) {
    const c = target.getContext('2d');
    const k = size / S;
    c.clearRect(0, 0, size, size);
    if (!state.img) return;
    const eff = baseScale() * state.zoom * k;
    const w = state.img.width * eff;
    const h = state.img.height * eff;
    c.drawImage(state.img, size / 2 + state.ox * k - w / 2, size / 2 + state.oy * k - h / 2, w, h);
  }

  const draw = () => paint(canvas, S);

  function setImage(img) {
    state.img = img;
    state.zoom = 1;
    state.ox = 0;
    state.oy = 0;
    zoom.value = '1';
    crop.classList.remove('empty');
    draw();
    onChange?.();
  }

  wrap.querySelector('.pick').onclick = () => file.click();

  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      setImage(await toImage(f));
    } catch {
      alert('Could not read that image.');
    }
    file.value = '';
  };

  zoom.oninput = () => {
    if (!state.img) return;
    state.zoom = parseFloat(zoom.value);
    clamp();
    draw();
  };

  let dragging = null;
  crop.addEventListener('pointerdown', (e) => {
    if (!state.img) return;
    const rect = crop.getBoundingClientRect();
    dragging = { x: e.clientX, y: e.clientY, k: S / rect.width };
    crop.setPointerCapture(e.pointerId);
  });
  crop.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.ox += (e.clientX - dragging.x) * dragging.k;
    state.oy += (e.clientY - dragging.y) * dragging.k;
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    clamp();
    draw();
  });
  const endDrag = () => (dragging = null);
  crop.addEventListener('pointerup', endDrag);
  crop.addEventListener('pointercancel', endDrag);

  return {
    key: def.key,
    el: wrap,
    hasImage: () => !!state.img,
    async load() {
      const blob = await getFace(def.key);
      if (blob) setImage(await toImage(blob));
    },
    async save() {
      if (!state.img) return;
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      paint(out, OUT);
      const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.9));
      await putFace(def.key, blob);
    }
  };
}

/** Renders the setup screen into `root`; resolves when the user saves. */
export async function mountSetup(root, { canCancel }) {
  root.innerHTML = `
    <h1>Who is shooing you?</h1>
    <p>Two photos, cropped to the face. They stay on this phone.</p>
    <div class="slots"></div>
    <div class="row-actions"></div>
    <p class="note">Stored locally in IndexedDB. Nothing is uploaded, nothing is committed.</p>
  `;

  const actions = root.querySelector('.row-actions');
  const save = document.createElement('button');
  save.className = 'primary';
  save.textContent = 'Save and start';
  actions.appendChild(save);

  let cancel = null;
  if (canCancel) {
    cancel = document.createElement('button');
    cancel.className = 'chip';
    cancel.textContent = 'Cancel';
    actions.appendChild(cancel);
  }

  const sync = () => (save.disabled = !slots.every((s) => s.hasImage()));
  const slots = SLOTS.map((def) => createSlot(def, sync));
  const list = root.querySelector('.slots');
  slots.forEach((s) => list.appendChild(s.el));
  await Promise.all(slots.map((s) => s.load()));

  sync();

  return new Promise((resolve) => {
    save.onclick = async () => {
      save.disabled = true;
      save.textContent = 'Saving…';
      await Promise.all(slots.map((s) => s.save()));
      resolve(true);
    };
    if (cancel) cancel.onclick = () => resolve(false);
  });
}
