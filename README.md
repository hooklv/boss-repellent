# Boss Repellent

Point your phone's rear camera at a monitor or laptop and two cartoon colleagues
start frantically waving you away from work. Look away from the screen and they
go back to idling.

Everything runs in the browser: camera, object detection, rendering. No backend,
no uploads.

## How it works

| Piece | What it does |
| --- | --- |
| `src/main.js` | camera, viewport mapping, state machine, render loop |
| `src/detect.js` | TensorFlow.js + COCO-SSD (`lite_mobilenet_v2`), throttled detection loop |
| `src/characters.js` | the two characters, drawn procedurally on a canvas |
| `src/setup.js` | face picker with drag-to-position / zoom crop |
| `src/store.js` | IndexedDB persistence for the cropped faces |

- Detection runs at ~6 fps, rendering at 60 fps.
- A screen counts as detected when COCO-SSD reports `tv` or `laptop` above the
  confidence threshold (default 0.4).
- State machine with hysteresis: `IDLE → WAVING` after 500 ms of continuous
  detection, `WAVING → IDLE` after 1000 ms without one. No flicker at the edge.
- When a screen is detected the characters stand on the left and right edges of
  its bounding box, scaled to the box height, positions smoothed with a lerp.
  Otherwise they stand at the bottom of the viewport.
- Idle is a gentle sway plus small arm movement; the fallback cartoon face also
  blinks. With a real photo the head has a slow tilt instead, since a blink can't
  be painted onto someone's face.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/boss-repellent/
npm run build
npm run preview
```

`getUserMedia` needs a secure context. `localhost` counts, but a phone on your
LAN does not, so to test on a real device either use HTTPS or open the deployed
Pages URL.

## Deploy to GitHub Pages

1. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds `dist`
   and publishes it.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The app lands on `https://<user>.github.io/boss-repellent/`.

The Vite `base` in `vite.config.js` is `/boss-repellent/`. Rename the repo and
you have to change it to match, or the assets 404.

## Faces

On first launch you pick two photos, one per character, and crop each one:
drag to position, slider to zoom, circular preview. Slot A wears casual clothes,
slot B a suit and tie. **Change faces** in the top bar re-opens the picker.

The cropped 256×256 squares live in IndexedDB on that device only. They are
never uploaded and never committed; `faces/` and `*.face.*` are in `.gitignore`
as a second guard.

## Debug mode

**Debug** in the top bar shows detection boxes with class and score, the current
state, and a confidence threshold slider. Lower the threshold when a screen
fills most of the frame, since COCO-SSD gets noticeably less confident there.

Tap anywhere on the camera view to force WAVING for two seconds, which is how
you test the animation without pointing at a screen.

## Notes

- The COCO-SSD weights (~5 MB) download from Google's CDN on first run and are
  then cached by the browser. A "Loading model…" pill shows while that happens;
  the characters are already live underneath.
- iOS Safari only grants camera access inside a user gesture, hence the
  **Start camera** button.
