'use client';
import { useRef, useState } from 'react';
import { compressImage } from '@/lib/compressImage';
import { useToast, Button } from '@/components/ui';
import { Plus, Trash } from '@/components/icons';

const MAX_IMAGES = 3;

export default function ShopImagesUpload({ images = [], onChange }) {
  const toast = useToast();
  const [compressing, setCompressing] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const fileInputRef = useRef(null);

  // Trigger file dialog for a specific slot index (0, 1, or 2)
  function triggerSelect(index) {
    if (compressing) return;
    setActiveSlot(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file');
      return;
    }

    setCompressing(true);
    try {
      const res = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.74 });
      const nextImages = [...(images || [])];

      if (activeSlot != null && activeSlot < nextImages.length) {
        // Replacing existing slot
        nextImages[activeSlot] = res.dataUrl;
      } else {
        // Appending to slots
        if (nextImages.length >= MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} photos allowed`);
          return;
        }
        nextImages.push(res.dataUrl);
      }

      onChange(nextImages.slice(0, MAX_IMAGES));
      toast.show(`Photo compressed: ${res.origSizeKb} KB → ${res.newSizeKb} KB`);
    } catch (err) {
      toast.error(err.message || 'Failed to process image');
    } finally {
      setCompressing(false);
      setActiveSlot(null);
    }
  }

  function removeImage(index, e) {
    e.stopPropagation();
    const nextImages = images.filter((_, i) => i !== index);
    onChange(nextImages);
  }

  // Display exactly 3 slots
  const slots = [0, 1, 2];

  return (
    <div className="stack-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Shop photos</label>
        <span className="small muted">
          {images.length} of {MAX_IMAGES} photos
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {slots.map((idx) => {
          const imgUrl = images[idx];
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 'var(--r)',
                overflow: 'hidden',
                background: 'var(--bg-2)',
                border: imgUrl ? '1px solid var(--line)' : '1px dashed var(--rule)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s var(--ease)',
              }}
            >
              {imgUrl ? (
                <>
                  <img
                    src={imgUrl}
                    alt={`Shop photo ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Overlay action bar */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      padding: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        borderRadius: 6,
                        backdropFilter: 'blur(4px)',
                      }}
                      onClick={() => triggerSelect(idx)}
                      disabled={compressing}
                      title="Replace this photo"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      style={{
                        width: 28,
                        height: 28,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(217, 45, 32, 0.85)',
                        color: '#fff',
                        borderRadius: 6,
                        border: 0,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onClick={(e) => removeImage(idx, e)}
                      disabled={compressing}
                      title="Delete photo"
                    >
                      <Trash width="14" height="14" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'transparent',
                    border: 0,
                    cursor: compressing ? 'wait' : 'pointer',
                    color: 'var(--fg-2)',
                    padding: 8,
                  }}
                  onClick={() => triggerSelect(idx)}
                  disabled={compressing}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--bg-3)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Plus width="16" height="16" />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500 }}>
                    {compressing && activeSlot === idx ? 'Optimising...' : 'Add photo'}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <span className="hint">
        Photos are auto-compressed to WebP to save storage and ensure fast loading on customer phones.
      </span>
    </div>
  );
}

