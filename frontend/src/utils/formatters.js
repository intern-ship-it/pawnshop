// Currency formatter for Malaysian Ringgit
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'RM 0.00'
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Short currency format (e.g., RM 1.5K)
export const formatCurrencyShort = (amount) => {
  if (amount >= 1000000) {
    return `RM ${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `RM ${(amount / 1000).toFixed(1)}K`
  }
  return formatCurrency(amount)
}

// Date formatter
export const formatDate = (dateString, format = 'short') => {
  if (!dateString) return ''
  const date = new Date(dateString)

  if (isNaN(date.getTime())) return ''

  if (format === 'short') {
    return date.toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (format === 'long') {
    return date.toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (format === 'datetime') {
    return date.toLocaleString('ms-MY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('ms-MY')
}

// IC Number formatter (XXXXXX-XX-XXXX)
export const formatIC = (ic) => {
  if (!ic) return ''
  const cleaned = ic.replace(/\D/g, '')
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`
  }
  return ic
}

// Phone number formatter
export const formatPhone = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
  }
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }
  return phone
}

// Weight formatter (grams)
export const formatWeight = (weight) => {
  return `${parseFloat(weight).toFixed(2)}g`
}

// Percentage formatter
export const formatPercentage = (value) => {
  return `${parseFloat(value).toFixed(2)}%`
}