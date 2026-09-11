// Face photos live only on this device, in IndexedDB. Nothing is uploaded.

const DB_NAME = 'boss-repellent';
const STORE = 'faces';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, run) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const getFace = (key) => tx('readonly', (s) => s.get(key));
export const putFace = (key, blob) => tx('readwrite', (s) => s.put(blob, key));
export const clearFaces = () => tx('readwrite', (s) => s.clear());

/** Blob -> drawable image (ImageBitmap where available, <img> on older Safari). */
export async function toImage(blob) {
  if (!blob) return null;
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
