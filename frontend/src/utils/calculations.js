// Gold purity rates
export const goldPurityRates = {
  '999': { name: '24K (999)', multiplier: 1.00, margin: 0.70 },
  '916': { name: '22K (916)', multiplier: 0.916, margin: 0.72 },
  '835': { name: '20K (835)', multiplier: 0.835, margin: 0.70 },
  '750': { name: '18K (750)', multiplier: 0.750, margin: 0.68 },
  '585': { name: '14K (585)', multiplier: 0.585, margin: 0.65 },
  '375': { name: '9K (375)', multiplier: 0.375, margin: 0.60 },
}

// Calculate gold item value
export const calculateGoldValue = (weight, purity, pricePerGram) => {
  const purityRate = goldPurityRates[purity]?.multiplier || 1
  return weight * pricePerGram * purityRate
}

// Calculate loan amount (typically 60-75% of item value)
export const calculateLoanAmount = (itemValue, marginRate = 0.70) => {
  return Math.floor(itemValue * marginRate)
}

// Calculate monthly interest
export const calculateMonthlyInterest = (principal, interestRate = 1.5) => {
  return (principal * interestRate) / 100
}

// Calculate total interest for period
export const calculateTotalInterest = (principal, interestRate, months) => {
  return calculateMonthlyInterest(principal, interestRate) * months
}

// Calculate days remaining until maturity
export const calculateDaysRemaining = (maturityDate) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maturity = new Date(maturityDate)
  maturity.setHours(0, 0, 0, 0)
  const diffTime = maturity - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Calculate redemption amount
export const calculateRedemptionAmount = (principal, interestRate, daysElapsed) => {
  const monthsElapsed = Math.ceil(daysElapsed / 30)
  const interest = calculateTotalInterest(principal, interestRate, monthsElapsed)
  return principal + interest
}

// Calculate partial redemption
export const calculatePartialRedemption = (totalItems, itemsToRedeem, principal, interestRate, daysElapsed) => {
  const portionRatio = itemsToRedeem / totalItems
  const portionPrincipal = principal * portionRatio
  const monthsElapsed = Math.ceil(daysElapsed / 30)
  const interest = calculateTotalInterest(portionPrincipal, interestRate, monthsElapsed)
  return portionPrincipal + interest
}

// Generate unique ID
export const generateId = (prefix = 'ID') => {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${randomStr}`.toUpperCase()
}

// Generate Pledge ID
export const generatePledgeId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(100000 + Math.random() * 900000)
  return `PLG-${year}-${random}`
}

// Calculate auction eligibility date (6 months after maturity in Malaysia)
export const calculateAuctionDate = (maturityDate) => {
  const maturity = new Date(maturityDate)
  maturity.setMonth(maturity.getMonth() + 6)
  return maturity.toISOString().split('T')[0]
}

// Calculate months between two dates
export const calculateMonthsBetween = (startDate, endDate) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return Math.max(1, months)
}
