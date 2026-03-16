/**
 * Get full URL for storage files
 * @param {string} path - Storage path from API (e.g., "customers/ic/abc.jpg")
 * @returns {string} Full URL
 */
export const getStorageUrl = (path) => {
  if (!path) return null
  
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  
  // Build storage URL
  const hostname = window.location.hostname
  const baseUrl = hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : window.location.origin
  
  return `${baseUrl}/storage/${path}`
}

/**
 * Compress an image file to JPEG (helps avoid backend PHP upload limits)
 * @param {File} file - The image file to compress
 * @param {Object} options - Max width/height and quality
 * @returns {Promise<File>} Compressed JPEG File object
 */
export const compressImage = (file, { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = {}) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid file type'));
    }

    const isSmall = file.size < 500 * 1024; 

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        } else if (isSmall && file.type === 'image/jpeg') {
          return resolve(file);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to compress image'));
          // Keep original name but change extension to .jpg
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const compressedFile = new File([blob], newFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};