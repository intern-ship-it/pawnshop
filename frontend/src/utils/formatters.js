/**
 * Formatters Utility
 * Common formatting functions for currency, dates, etc.
 */

/**
 * Format number as Malaysian Ringgit currency
 * @param {number} amount - Amount to format
 * @param {boolean} showSymbol - Whether to show RM symbol
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, showSymbol = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? 'RM 0.00' : '0.00'
  }

  const formatted = Number(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return showSymbol ? `RM ${formatted}` : formatted
}

/**
 * Format date in Malaysian format (DD/MM/YYYY)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '-'

  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'

  return d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format datetime in Malaysian format (DD/MM/YYYY HH:MM)
 * @param {string|Date} datetime - Datetime to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (datetime) => {
  if (!datetime) return '-'

  const d = new Date(datetime)
  if (isNaN(d.getTime())) return '-'

  return d.toLocaleString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format phone number with Malaysia country code
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number with +60 country code
 */
export const formatPhone = (phone) => {
  if (!phone) return '-'

  // If phone already has country code (starts with +), return as-is
  if (phone.startsWith('+')) {
    return phone
  }

  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Format Malaysian phone numbers with +60 country code
  if (cleaned.length === 10) {
    // e.g., 0123456789 -> +60 12-345 6789
    return `+60 ${cleaned.slice(1, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
  } else if (cleaned.length === 11) {
    // e.g., 01234567890 -> +60 12-3456 7890
    return `+60 ${cleaned.slice(1, 3)}-${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  } else if (cleaned.length === 9) {
    // e.g., 123456789 (no leading 0) -> +60 12-345 6789
    return `+60 ${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)} ${cleaned.slice(5)}`
  } else if (cleaned.length === 12 && cleaned.startsWith('60')) {
    // e.g., 60123456789 -> +60 12-345 6789
    const num = cleaned.slice(2)
    return `+60 ${num.slice(0, 2)}-${num.slice(2, 5)} ${num.slice(5)}`
  }

  // Unknown format - return as-is (don't assume +60)
  return phone
}

/**
 * Format weight in grams
 * @param {number} weight - Weight in grams
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted weight string
 */
export const formatWeight = (weight, decimals = 2) => {
  if (weight === null || weight === undefined || isNaN(weight)) {
    return '0.00g'
  }

  return `${Number(weight).toFixed(decimals)}g`
}

/**
 * Format percentage
 * @param {number} value - Percentage value
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%'
  }

  return `${Number(value).toFixed(decimals)}%`
}

/**
 * Format IC number
 * @param {string} ic - IC number
 * @returns {string} Formatted IC number
 */
export const formatIC = (ic) => {
  if (!ic) return '-'

  // Remove non-numeric characters
  const cleaned = ic.replace(/\D/g, '')

  // Format Malaysian IC (XXXXXX-XX-XXXX)
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`
  }

  return ic
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return ''
  if (text.length <= maxLength) return text

  return `${text.slice(0, maxLength)}...`
}

/**
 * Format relative time (e.g., "2 days ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return '-'

  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'

  const now = new Date()
  const diffMs = now - d
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

  return formatDate(date)
}
