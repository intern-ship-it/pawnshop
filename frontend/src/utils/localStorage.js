const STORAGE_PREFIX = 'pawnsys_'

// Get item from localStorage
export const getStorageItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error)
    return defaultValue
  }
}

// Set item in localStorage
export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error)
    return false
  }
}

// Remove item from localStorage
export const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
    return true
  } catch (error) {
    console.error(`Error removing ${key} from localStorage:`, error)
    return false
  }
}

// Clear all PawnSys data from localStorage
export const clearAllStorage = () => {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
    return true
  } catch (error) {
    console.error('Error clearing localStorage:', error)
    return false
  }
}

// Storage keys constants
export const STORAGE_KEYS = {
  AUTH: 'auth',
  CUSTOMERS: 'customers',
  PLEDGES: 'pledges',
  INVENTORY: 'inventory',
  SETTINGS: 'settings',
  GOLD_PRICE: 'gold_price',
}

// Initialize storage with mock data
export const initializeStorage = (mockData) => {
  for (const [key, data] of Object.entries(mockData)) {
    const existingData = getStorageItem(key)
    if (!existingData) {
      setStorageItem(key, data)
    }
  }
}
