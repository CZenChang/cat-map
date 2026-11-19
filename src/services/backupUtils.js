import JSZip from 'jszip';

export async function buildBackupZipBlob(photos) {
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  const metadata = [];

  for (const photo of photos) {
    const imageFileName = `${photo.id}.jpg`;
    if (photo.imageBlob) {
      imagesFolder.file(imageFileName, photo.imageBlob);
    }
    metadata.push({
      id: photo.id,
      name: photo.name,
      rating: photo.rating,
      note: photo.note,
      createdAt: photo.createdAt,
      lat: photo.lat,
      lng: photo.lng,
      placeName: photo.placeName || '',
      thumbDataUrl: photo.thumbDataUrl || '',
      imageFile: imageFileName,
    });
  }

  zip.file(
    'metadata.json',
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        count: metadata.length,
        items: metadata,
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: 'blob' });
}

export async function saveZipWithPicker(zipBlob, suggestedName) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Cat-Map 備份壓縮檔 (.zip)',
            accept: { 'application/zip': ['.zip'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(zipBlob);
      await writable.close();
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
    }
  }

  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function parseBackupZip(fileOrBlob) {
  const zip = await JSZip.loadAsync(fileOrBlob);
  const metaFile = zip.file('metadata.json');
  if (!metaFile) {
    throw new Error('備份檔格式不正確（找不到 metadata.json）');
  }
  const metaText = await metaFile.async('string');
  const parsed = JSON.parse(metaText);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  const restored = [];
  for (const item of items) {
    const imgEntry = zip.file(`images/${item.imageFile}`) || zip.file(item.imageFile);
    const imageBlob = imgEntry ? await imgEntry.async('blob') : null;
    if (!imageBlob) continue;
    restored.push({
      id: item.id,
      name: item.name || '未命名照片',
      rating: Number(item.rating) || 3,
      note: item.note || '',
      createdAt: item.createdAt || new Date().toISOString(),
      lat: Number(item.lat),
      lng: Number(item.lng),
      placeName: item.placeName || '',
      thumbDataUrl: item.thumbDataUrl || '',
      imageBlob,
    });
  }
  return restored;
}
