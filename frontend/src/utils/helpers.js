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