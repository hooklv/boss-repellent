// Two cartoon colleagues, drawn procedurally. No image assets except the face
// photo, which is masked into the head circle.

export const PHRASES = ['Go away!', 'Not today!', 'Log off!', 'Touch grass!', 'Close the laptop!'];

export const pickPhrase = () => PHRASES[(Math.random() * PHRASES.length) | 0];

const OUTFITS = {
  casual: {
    top: '#37b89a',
    topDark: '#2a9480',
    legs: '#4a6fa5',
    skin: '#f0c8a0',
    shoes: '#2b2b33'
  },
  suit: {
    top: '#343b4a',
    topDark: '#272d39',
    legs: '#2b313d',
    skin: '#e8bb92',
    shoes: '#17171c'
  }
};

const D = Math.PI / 180;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

function drawArm(ctx, px, py, angleDeg, len, w, color, skin) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angleDeg * D);
  ctx.fillStyle = color;
  roundRect(ctx, -w * 0.5, -w * 0.5, len, w, w * 0.5);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(len, 0, w * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws an image so it covers a circle of radius r centred at (cx, cy). */
function drawFaceInCircle(ctx, img, cx, cy, r) {
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const scale = Math.max((r * 2) / iw, (r * 2) / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function drawFallbackFace(ctx, cx, cy, r, skin, blinking) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2b2b33';
  const ex = r * 0.36;
  const ey = cy - r * 0.1;
  if (blinking) {
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = '#2b2b33';
    ctx.beginPath();
    ctx.moveTo(cx - ex - r * 0.13, ey);
    ctx.lineTo(cx - ex + r * 0.13, ey);
    ctx.moveTo(cx + ex - r * 0.13, ey);
    ctx.lineTo(cx + ex + r * 0.13, ey);
    ctx.stroke();
  } else {
    for (const sx of [-ex, ex]) {
      ctx.beginPath();
      ctx.arc(cx + sx, ey, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = '#2b2b33';
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.12, r * 0.34, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

function drawBubble(ctx, text, x, y, scale, vw) {
  const fs = Math.max(11, 13 * scale);
  ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const padX = fs * 0.7;
  const padY = fs * 0.5;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fs + padY * 2;
  const left = Math.min(Math.max(6, x - w / 2), Math.max(6, vw - w - 6));
  const top = y - h;

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, left, top, w, h, h * 0.4);
  ctx.beginPath();
  ctx.moveTo(x - fs * 0.35, top + h - 1);
  ctx.lineTo(x + fs * 0.1, top + h + fs * 0.6);
  ctx.lineTo(x + fs * 0.35, top + h - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#17171c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, top + h / 2);
}

/**
 * @param c {x, y (feet), h (height), face, outfit, t (seconds), phase, waving, bubble, vw}
 */
export function drawCharacter(ctx, c) {
  const { x, h, t, phase, waving, outfit } = c;
  const p = OUTFITS[outfit] || OUTFITS.casual;

  const jump = waving ? -Math.abs(Math.sin(t * 7 + phase)) * h * 0.05 : 0;
  const sway = waving ? Math.sin(t * 7 + phase) * 3 : Math.sin(t * 1.4 + phase) * 2.5;

  // ground shadow stays put while the body jumps
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, c.y, h * 0.16, h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, c.y + jump);
  ctx.rotate(sway * D);

  const headR = h * 0.155;
  const headY = -h + headR;
  const shoulderY = headY + headR * 1.35;
  const hipY = -h * 0.42;
  const torsoW = h * 0.3;
  const legW = h * 0.095;
  const armLen = h * 0.29;
  const armW = h * 0.075;

  // legs
  const stride = waving ? Math.sin(t * 7 + phase) * h * 0.02 : 0;
  ctx.fillStyle = p.legs;
  roundRect(ctx, -torsoW * 0.42 - stride, hipY, legW, -hipY - h * 0.02, legW * 0.4);
  roundRect(ctx, torsoW * 0.42 - legW + stride, hipY, legW, -hipY - h * 0.02, legW * 0.4);
  ctx.fillStyle = p.shoes;
  roundRect(ctx, -torsoW * 0.46 - stride, -h * 0.035, legW * 1.35, h * 0.035, h * 0.015);
  roundRect(ctx, torsoW * 0.46 - legW * 1.35 + stride, -h * 0.035, legW * 1.35, h * 0.035, h * 0.015);

  const osc = waving ? Math.sin(t * 11 + phase) * 22 : Math.sin(t * 2 + phase) * 5;
  const rightAngle = waving ? -38 + osc : 76 + osc * 0.6;
  const leftAngle = waving ? 218 - osc : 104 - osc * 0.6;
  const paintArms = () => {
    drawArm(ctx, torsoW * 0.42, shoulderY, rightAngle, armLen, armW, p.topDark, p.skin);
    drawArm(ctx, -torsoW * 0.42, shoulderY, leftAngle, armLen, armW, p.topDark, p.skin);
  };

  // idle: arms hang behind the torso. waving: hands stay in front of the head.
  if (!waving) paintArms();

  // torso
  ctx.fillStyle = p.top;
  roundRect(ctx, -torsoW / 2, shoulderY, torsoW, hipY - shoulderY + h * 0.02, torsoW * 0.22);

  if (outfit === 'suit') {
    ctx.fillStyle = '#f4f4f7';
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.16, shoulderY);
    ctx.lineTo(torsoW * 0.16, shoulderY);
    ctx.lineTo(0, shoulderY + h * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.05, shoulderY + h * 0.01);
    ctx.lineTo(torsoW * 0.05, shoulderY + h * 0.01);
    ctx.lineTo(torsoW * 0.08, shoulderY + h * 0.16);
    ctx.lineTo(0, shoulderY + h * 0.19);
    ctx.lineTo(-torsoW * 0.08, shoulderY + h * 0.16);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = p.topDark;
    roundRect(ctx, -torsoW * 0.12, shoulderY, torsoW * 0.24, h * 0.03, h * 0.015);
  }

  // neck
  ctx.fillStyle = p.skin;
  roundRect(ctx, -h * 0.035, headY + headR * 0.6, h * 0.07, h * 0.07, h * 0.02);

  // head
  const tilt = waving ? Math.sin(t * 11 + phase) * 7 : Math.sin(t * 1.1 + phase * 1.7) * 3;
  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(tilt * D);

  ctx.fillStyle = p.skin;
  for (const sx of [-headR, headR]) {
    ctx.beginPath();
    ctx.arc(sx, headR * 0.1, headR * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  if (c.face) {
    drawFaceInCircle(ctx, c.face, 0, 0, headR);
  } else {
    const blinking = ((t + phase * 3) % 4.2) < 0.14 && !waving;
    drawFallbackFace(ctx, 0, 0, headR, p.skin, blinking);
  }

  ctx.lineWidth = Math.max(1.5, headR * 0.1);
  ctx.strokeStyle = outfit === 'suit' ? '#343b4a' : '#2a9480';
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (waving) paintArms();

  ctx.restore();

  if (c.bubble) {
    drawBubble(ctx, c.bubble, x, c.y + jump - h * 1.02, h / 190, c.vw ?? ctx.canvas.width);
  }
}
