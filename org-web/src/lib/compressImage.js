/**
 * Compresses an image client-side to efficient WebP (or JPEG fallback)
 * Resizes large dimensions to max 1000x1000 preserving aspect ratio.
 * Reduces 5-10MB camera photos down to ~30-50KB for fast loading and minimal DB storage.
 */
export async function compressImage(file, { maxWidth = 1000, maxHeight = 1000, quality = 0.74 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file (JPG, PNG, WEBP).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable.'));

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const origSizeKb = Math.round(file.size / 1024);
        const newSizeKb = Math.round((dataUrl.length * 0.75) / 1024);

        resolve({
          dataUrl,
          origSizeKb,
          newSizeKb,
          width,
          height,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

