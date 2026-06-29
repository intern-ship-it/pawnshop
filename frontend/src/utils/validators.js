// Validate Malaysian IC Number
export const validateIC = (ic) => {
  // Strip only formatting characters (dashes/spaces). Letters or any other
  // non-digit must be rejected, not silently discarded — a MyKad is digits only.
  const cleaned = (ic || '').replace(/[-\s]/g, '')

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'IC number must contain digits only' }
  }

  if (cleaned.length !== 12) {
    return { valid: false, error: 'IC number must be 12 digits' }
  }

  // Extract date components from the first 6 digits (YYMMDD)
  const month = parseInt(cleaned.substring(2, 4), 10)
  const day = parseInt(cleaned.substring(4, 6), 10)

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Invalid month in IC number' }
  }

  if (day < 1 || day > 31) {
    return { valid: false, error: 'Invalid day in IC number' }
  }

  // Reject impossible calendar dates (e.g. Feb 30, Apr 31). Century doesn't
  // affect day-of-month validity except for the Feb 29 leap-year case; treat
  // YY <= current-year-prefix as 2000s, otherwise 1900s, matching the form's
  // DOB-extraction logic.
  const yy = parseInt(cleaned.substring(0, 2), 10)
  const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy
  const date = new Date(fullYear, month - 1, day)
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { valid: false, error: 'Invalid date of birth in IC number' }
  }

  return { valid: true, error: null }
}

// Validate a passport number (international): 5-15 alphanumeric characters
export const validatePassport = (passport) => {
  const cleaned = (passport || '').trim()

  if (!/^[A-Za-z0-9]{5,15}$/.test(cleaned)) {
    return { valid: false, error: 'Passport must be 5-15 alphanumeric characters' }
  }

  return { valid: true, error: null }
}

// Unified identification validator — dispatches to the IC or passport rule
// based on type. Single source of truth shared by the customer create/edit forms.
// type: 'mykad' (default) validates a Malaysian IC; 'passport' validates a passport;
// any other type only checks that a value is present.
export const validateICOrPassport = (value, type = 'mykad') => {
  if (type === 'passport') {
    return validatePassport(value)
  }
  if (type === 'mykad') {
    return validateIC(value)
  }
  // 'other' — no format we can enforce; just require a non-empty value
  if (!value || !value.trim()) {
    return { valid: false, error: 'Identification number is required' }
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
