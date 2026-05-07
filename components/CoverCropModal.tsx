import React, { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { exportCover16x9Jpeg } from '../lib/coverCropExport';

const ASPECT = 16 / 9;

type Props = {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onApply: (dataUrlJpeg16x9: string) => void;
};

export function CoverCropModal({ open, imageSrc, onClose, onApply }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setBusy(false);
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await exportCover16x9Jpeg(imageSrc, croppedAreaPixels);
      onApply(dataUrl);
    } catch {
      setError(
        'Не удалось сохранить обложку. Для ссылок на чужие сайты включите CORS или вставьте картинку из буфера.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col bg-matte-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-crop-title"
    >
      <div className="shrink-0 border-b border-gold/20 px-4 py-3">
        <h2 id="cover-crop-title" className="text-[15px] font-black uppercase tracking-wide text-gradient-gold">
          Кадр 16:9
        </h2>
        <p className="mt-1 text-[11px] font-medium text-white/45 leading-snug">
          Перетащите и масштабируйте — итог будет 1280×720.
        </p>
      </div>

      <div className="relative min-h-[42vh] flex-1 w-full bg-matte-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid
          objectFit="contain"
          restrictPosition={false}
        />
      </div>

      <div className="shrink-0 space-y-3 border-t border-gold/15 bg-matte-black/90 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/35 shrink-0">Масштаб</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-gold h-2"
          />
        </div>
        {error && <p className="text-[11px] font-medium text-red-400 leading-snug">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-[12px] font-black uppercase tracking-wide text-white/70 active:scale-[0.98] disabled:opacity-40"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || !croppedAreaPixels}
            className="flex-1 rounded-xl border border-gold/40 bg-gold/20 py-3 text-[12px] font-black uppercase tracking-wide text-gold-light shadow-inner active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? '…' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  );
}
