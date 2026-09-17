/**
 * Crops an image to a circle, in the browser, and returns it as a PNG data URL.
 *
 * Lifted out of the old `fetchAndCropImage` in src/services/pdfGenerator.ts.
 * That function cropped the dentist photo at render time using a <canvas>, which
 * is exactly the thing that stopped the renderer running on a server.
 *
 * So the crop moved to the browser and now happens once, before the photo is
 * sent, instead of on every single download. The server just embeds the PNG.
 *
 * Phase 3 moves this to the moment Ericka uploads a staff photo, storing the
 * circular derivative in Supabase alongside the original — at which point the
 * render path stops cropping entirely.
 */

/** Square canvas edge, in pixels. Comfortably above the ~109pt it is drawn at. */
const OUTPUT_SIZE = 512;

export async function cropToCircleDataUrl(source: string): Promise<string> {
  const image = await loadImage(source);

  // Take the largest centred square the source allows, so the circle is never
  // an ellipse and nothing important is cropped off one side.
  const edge = Math.min(image.width, image.height);

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get a 2D canvas context to crop the photo.');
  }

  ctx.beginPath();
  ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    image,
    (image.width - edge) / 2,
    (image.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  // PNG, because the corners outside the circle must stay transparent.
  return canvas.toDataURL('image/png');
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    // Same-origin photos need no CORS dance, but a remote one would taint the
    // canvas and make toDataURL throw. Asking for anonymous CORS up front means
    // a correctly configured remote host works too.
    if (!source.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the photo for cropping.'));
    image.src = source;
  });
}
