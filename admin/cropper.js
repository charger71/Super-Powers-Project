// Archive84 admin — image cropper.
//
// Deliberately self-contained: it takes an image URL and hands back a cropped
// blob. It knows nothing about Supabase, the DB, or the drawer, so the geometry
// can be exercised on its own (the admin is behind a login, which makes an
// in-place cropper otherwise awkward to test).
//
// Crop rectangles are held in NORMALISED coordinates — x/y/w/h as 0..1
// fractions of the image — not pixels. The box is then positioned in percent,
// so the whole thing survives the dialog being resized or the image being laid
// out at any scale, with no re-measuring on resize.

// Raster formats only, and only ones canvas.toBlob can re-encode:
//   · SVG is vector — cropping through a canvas would rasterise it and throw
//     the vector away permanently. The media library has SVG logos in it.
//   · GIF may be animated, and a canvas keeps only the first frame.
//   · PDFs aren't images.
const RASTER = /\.(jpe?g|png|webp)$/i;

export const isCroppable = (path) => !!path && RASTER.test(path);

// Re-encode as the source's own format so a JPEG stays a JPEG and a PNG keeps
// its alpha. Anything unrecognised would have been rejected by isCroppable.
function outputFormat(path) {
  const ext = (path.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
  if (ext === 'png') return { type: 'image/png', ext: 'png', quality: undefined };
  if (ext === 'webp') return { type: 'image/webp', ext: 'webp', quality: 0.92 };
  return { type: 'image/jpeg', ext: 'jpg', quality: 0.92 };
}

// Aspect presets. `null` = free. Ratios are width/height in real pixels.
const ASPECTS = [
  { label: 'Free',     value: null },
  { label: 'Square',   value: 1 },
  { label: '4 : 3',    value: 4 / 3 },
  { label: '3 : 2',    value: 3 / 2 },
  { label: '16 : 9',   value: 16 / 9 },
  { label: '3 : 4',    value: 3 / 4 },
  { label: '2 : 3',    value: 2 / 3 },
];

// Corners resize both axes; edges resize one. Under an aspect lock only the
// corners stay live — an edge handle would have to invent which way to grow
// the other axis, and every answer to that feels arbitrary to use.
const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
const isCorner = (h) => h.length === 2;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Storage serves the media bucket CORS-open; without this the canvas is
    // tainted and toBlob throws SecurityError at the very last step.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image for cropping.'));
    img.src = url;
  });
}

/** Natural pixel dimensions of an image URL — used to restore width/height on revert. */
export async function imageSize(url) {
  const img = await loadImage(url);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/**
 * Open the crop editor over `url`.
 * Resolves with { blob, width, height, ext } once applied, or null if dismissed.
 */
export async function cropImage(url, { fileName = 'image' } = {}) {
  const img = await loadImage(url);
  const NW = img.naturalWidth;
  const NH = img.naturalHeight;

  // never let a crop collapse to nothing
  const minW = Math.min(1, 16 / NW);
  const minH = Math.min(1, 16 / NH);

  let crop = { x: 0, y: 0, w: 1, h: 1 };
  let aspect = null;

  // ---- DOM ---------------------------------------------------------------
  const dialog = document.createElement('dialog');
  dialog.className = 'cropper';

  const stage = document.createElement('div');
  stage.className = 'cropper__stage';
  const view = document.createElement('img');
  view.className = 'cropper__img';
  view.src = url;
  view.alt = '';
  view.draggable = false;
  const box = document.createElement('div');
  box.className = 'cropper__box';
  for (const h of HANDLES) {
    const el = document.createElement('span');
    el.className = `cropper__handle cropper__handle--${h}`;
    el.dataset.handle = h;
    box.append(el);
  }
  stage.append(view, box);

  const bar = document.createElement('div');
  bar.className = 'cropper__bar';

  const aspectSel = document.createElement('select');
  aspectSel.className = 'cropper__aspect';
  aspectSel.append(...ASPECTS.map((a, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = a.label;
    return o;
  }));

  const dims = document.createElement('span');
  dims.className = 'cropper__dims';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'primary';
  apply.textContent = 'Crop';

  const aspectLabel = document.createElement('label');
  aspectLabel.className = 'cropper__field';
  aspectLabel.append('Aspect', aspectSel);

  bar.append(aspectLabel, dims, reset, cancel, apply);
  dialog.append(stage, bar);
  document.body.append(dialog);

  // ---- geometry ----------------------------------------------------------
  // pixel dims of the current crop, in the image's own resolution
  const pxW = () => Math.max(1, Math.round(crop.w * NW));
  const pxH = () => Math.max(1, Math.round(crop.h * NH));

  function render() {
    box.style.left = `${crop.x * 100}%`;
    box.style.top = `${crop.y * 100}%`;
    box.style.width = `${crop.w * 100}%`;
    box.style.height = `${crop.h * 100}%`;
    dims.textContent = `${pxW()} × ${pxH()} px`;
    box.classList.toggle('cropper__box--locked', aspect !== null);
  }

  // Height that pairs with `w` at the locked ratio. Ratio is in real pixels,
  // so it has to cross back through the image's own aspect to stay normalised.
  const hFor = (w) => (w * NW) / (aspect * NH);
  const wFor = (h) => (h * NH * aspect) / NW;

  // Apply the aspect lock to an edge-box, holding `anchorX`/`anchorY` still
  // ('w' means the left edge is the one that moves, etc).
  function lockAspect(e, movingX, movingY) {
    let w = e.x1 - e.x0;
    let h = hFor(w);
    // if that overflows vertically, drive from height instead
    const roomY = movingY === 'n' ? e.y1 : 1 - e.y0;
    if (h > roomY) { h = roomY; w = wFor(h); }
    const roomX = movingX === 'w' ? e.x1 : 1 - e.x0;
    if (w > roomX) { w = roomX; h = hFor(w); }
    if (movingX === 'w') e.x0 = e.x1 - w; else e.x1 = e.x0 + w;
    if (movingY === 'n') e.y0 = e.y1 - h; else e.y1 = e.y0 + h;
    return e;
  }

  // Convert a pointer event to normalised image coordinates.
  function ptr(ev) {
    const r = view.getBoundingClientRect();
    return {
      x: clamp01((ev.clientX - r.left) / r.width),
      y: clamp01((ev.clientY - r.top) / r.height),
    };
  }

  let drag = null;

  function onDown(ev) {
    const handle = ev.target.dataset?.handle;
    const p = ptr(ev);
    if (handle) {
      drag = { mode: 'resize', handle, start: { ...crop } };
    } else if (ev.target === box) {
      drag = { mode: 'move', grab: { x: p.x - crop.x, y: p.y - crop.y }, start: { ...crop } };
    } else {
      // drag on open canvas draws a fresh rectangle from that corner
      crop = { x: p.x, y: p.y, w: minW, h: minH };
      drag = { mode: 'resize', handle: 'se', start: { ...crop }, origin: p };
    }
    ev.preventDefault();
    // capture keeps the drag alive when the pointer leaves the stage; it throws
    // for a pointerId that isn't actually down, which is harmless either way
    try { stage.setPointerCapture(ev.pointerId); } catch { /* not a live pointer */ }
  }

  function onMove(ev) {
    if (!drag) return;
    const p = ptr(ev);

    if (drag.mode === 'move') {
      crop.x = clamp01(Math.min(p.x - drag.grab.x, 1 - crop.w));
      crop.y = clamp01(Math.min(p.y - drag.grab.y, 1 - crop.h));
      render();
      return;
    }

    const s = drag.start;
    const e = { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
    if (drag.origin) { e.x0 = drag.origin.x; e.y0 = drag.origin.y; e.x1 = drag.origin.x; e.y1 = drag.origin.y; }

    const h = drag.handle;
    if (h.includes('w')) e.x0 = p.x;
    if (h.includes('e')) e.x1 = p.x;
    if (h.includes('n')) e.y0 = p.y;
    if (h.includes('s')) e.y1 = p.y;

    // let a handle cross the far edge without inverting the rectangle
    let movingX = h.includes('w') ? 'w' : 'e';
    let movingY = h.includes('n') ? 'n' : 's';
    if (e.x1 < e.x0) { [e.x0, e.x1] = [e.x1, e.x0]; movingX = movingX === 'w' ? 'e' : 'w'; }
    if (e.y1 < e.y0) { [e.y0, e.y1] = [e.y1, e.y0]; movingY = movingY === 'n' ? 's' : 'n'; }

    // enforce the floor on whichever axis this handle actually drives
    if (e.x1 - e.x0 < minW) { if (movingX === 'w') e.x0 = e.x1 - minW; else e.x1 = e.x0 + minW; }
    if (e.y1 - e.y0 < minH) { if (movingY === 'n') e.y0 = e.y1 - minH; else e.y1 = e.y0 + minH; }

    if (aspect !== null && isCorner(h)) lockAspect(e, movingX, movingY);

    crop = {
      x: clamp01(e.x0),
      y: clamp01(e.y0),
      w: Math.min(clamp01(e.x1 - e.x0), 1 - clamp01(e.x0)),
      h: Math.min(clamp01(e.y1 - e.y0), 1 - clamp01(e.y0)),
    };
    render();
  }

  function onUp(ev) {
    if (!drag) return;
    drag = null;
    if (stage.hasPointerCapture?.(ev.pointerId)) stage.releasePointerCapture(ev.pointerId);
  }

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  // Switching to a locked ratio re-fits the current box to it, anchored at the
  // top-left, so the selection stays roughly where the user put it.
  aspectSel.addEventListener('change', () => {
    aspect = ASPECTS[Number(aspectSel.value)].value;
    if (aspect !== null) {
      const e = { x0: crop.x, y0: crop.y, x1: crop.x + crop.w, y1: crop.y + crop.h };
      lockAspect(e, 'e', 's');
      crop = { x: e.x0, y: e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 };
    }
    render();
  });

  reset.addEventListener('click', () => {
    crop = { x: 0, y: 0, w: 1, h: 1 };
    aspect = null;
    aspectSel.value = '0';
    render();
  });

  render();
  dialog.showModal();

  // ---- resolve -----------------------------------------------------------
  const fmt = outputFormat(url);

  return new Promise((resolve) => {
    const done = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    cancel.addEventListener('click', () => done(null));
    // Escape (native dialog dismissal) counts as a cancel
    dialog.addEventListener('cancel', () => done(null));

    apply.addEventListener('click', async () => {
      apply.disabled = true;
      // Source rect in real pixels. Rounded once, then the destination canvas
      // takes its size from the rounded values so the copy is 1:1 and never
      // resamples — a crop should not soften the pixels it keeps.
      const sx = Math.round(crop.x * NW);
      const sy = Math.round(crop.y * NH);
      const sw = Math.min(pxW(), NW - sx);
      const sh = Math.min(pxH(), NH - sy);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      // JPEG has no alpha; without a matte, transparent source pixels come out
      // black instead of white.
      if (fmt.type === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, sw, sh);
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise((r) => canvas.toBlob(r, fmt.type, fmt.quality));
      if (!blob) { apply.disabled = false; return; }
      const base = fileName.replace(/\.[^.]+$/, '');
      done({ blob, width: sw, height: sh, ext: fmt.ext, name: `${base}-crop.${fmt.ext}` });
    });
  });
}
