import type { Area } from 'react-easy-crop';

const OUTPUT_W = 1280;
const OUTPUT_H = 720;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    if (/^https?:\/\//i.test(url)) {
      image.crossOrigin = 'anonymous';
    }
    image.src = url;
  });
}

/** Вырезает область `pixelCrop` из изображения и сохраняет как JPEG 16:9 (1280×720). */
export async function exportCover16x9Jpeg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_W,
    OUTPUT_H
  );
  return canvas.toDataURL('image/jpeg', 0.88);
}
