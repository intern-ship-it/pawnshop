export const mockGoldPrices = {
  current: {
    price916: 295.00,
    price999: 320.00,
    price750: 243.00,
    lastUpdated: new Date().toISOString(),
    source: 'LBMA',
  },
  history: [
    { date: '2024-12-23', price916: 295.00, price999: 320.00 },
    { date: '2024-12-22', price916: 293.50, price999: 318.00 },
    { date: '2024-12-21', price916: 294.00, price999: 319.00 },
    { date: '2024-12-20', price916: 292.00, price999: 317.00 },
    { date: '2024-12-19', price916: 290.50, price999: 315.00 },
    { date: '2024-12-18', price916: 291.00, price999: 316.00 },
    { date: '2024-12-17', price916: 289.00, price999: 314.00 },
  ],
}

export const goldPurityRates = {
  '999': { name: '24K (999)', multiplier: 1.00, margin: 0.70 },
  '916': { name: '22K (916)', multiplier: 0.916, margin: 0.72 },
  '835': { name: '20K (835)', multiplier: 0.835, margin: 0.70 },
  '750': { name: '18K (750)', multiplier: 0.750, margin: 0.68 },
  '585': { name: '14K (585)', multiplier: 0.585, margin: 0.65 },
  '375': { name: '9K (375)', multiplier: 0.375, margin: 0.60 },
}

export default mockGoldPrices
