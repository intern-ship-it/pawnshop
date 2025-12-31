// Validate Malaysian IC Number
export const validateIC = (ic) => {
  const cleaned = ic.replace(/\D/g, '')

  if (cleaned.length !== 12) {
    return { valid: false, error: 'IC number must be 12 digits' }
  }

  // Extract date components
  // const year = parseInt(cleaned.substring(0, 2)) // Unused
  const month = parseInt(cleaned.substring(2, 4))
  const day = parseInt(cleaned.substring(4, 6))

  // Validate month
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Invalid month in IC number' }
  }

  // Validate day
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Invalid day in IC number' }
  }

  return { valid: true, error: null }
}

// Validate phone number (Malaysian format)
export const validatePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length < 10 || cleaned.length > 11) {
    return { valid: false, error: 'Phone number must be 10-11 digits' }
  }

  // Malaysian mobile prefixes
  const validPrefixes = ['010', '011', '012', '013', '014', '016', '017', '018', '019']
  const prefix = cleaned.substring(0, 3)

  if (!validPrefixes.includes(prefix)) {
    return { valid: false, error: 'Invalid Malaysian phone prefix' }
  }

  return { valid: true, error: null }
}

// Validate email
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true, error: null }
}

// Validate required field
export const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { valid: false, error: `${fieldName} is required` }
  }

  return { valid: true, error: null }
}

// Validate weight (positive number)
export const validateWeight = (weight) => {
  const numWeight = parseFloat(weight)

  if (isNaN(numWeight) || numWeight <= 0) {
    return { valid: false, error: 'Weight must be a positive number' }
  }

  if (numWeight > 10000) {
    return { valid: false, error: 'Weight seems too high, please verify' }
  }

  return { valid: true, error: null }
}

// Validate amount
export const validateAmount = (amount, min = 0, max = 10000000) => {
  const numAmount = parseFloat(amount)

  if (isNaN(numAmount)) {
    return { valid: false, error: 'Amount must be a number' }
  }

  if (numAmount < min) {
    return { valid: false, error: `Amount must be at least ${min}` }
  }

  if (numAmount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` }
  }

  return { valid: true, error: null }
}

// Validate form fields
export const validateForm = (fields, rules) => {
  const errors = {}
  let isValid = true

  for (const [fieldName, value] of Object.entries(fields)) {
    const fieldRules = rules[fieldName]

    if (!fieldRules) continue

    for (const rule of fieldRules) {
      const result = rule(value, fieldName)

      if (!result.valid) {
        errors[fieldName] = result.error
        isValid = false
        break
      }
    }
  }

  return { isValid, errors }
}
