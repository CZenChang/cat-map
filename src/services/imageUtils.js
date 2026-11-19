/**
 * Compress a captured photo Blob/File and generate a small square thumbnail DataURL.
 * @param {Blob} file
 * @returns {Promise<{ imageBlob: Blob, thumbDataUrl: string }>}
 */
export async function processCapturedImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const imageBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('圖片壓縮失敗'))),
        'image/jpeg',
        0.84
      );
    });

    const thumbSize = 96;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbSize;
    thumbCanvas.height = thumbSize;
    const tCtx = thumbCanvas.getContext('2d');

    const minSide = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - minSide) / 2;
    const sy = (bitmap.height - minSide) / 2;
    tCtx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, thumbSize, thumbSize);

    const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.76);
    return { imageBlob, thumbDataUrl };
  } finally {
    bitmap.close();
  }
}
