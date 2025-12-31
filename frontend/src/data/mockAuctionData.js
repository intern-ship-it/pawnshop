// Run this in browser console to add sample auction data
// Or import and call initAuctionMockData() from any component

export const initAuctionMockData = () => {
    const existingPledges = JSON.parse(localStorage.getItem('pawnsys_pledges') || '[]')

    // Sample overdue pledges (eligible for forfeit)
    const overduePledges = [
        {
            id: 'PLG-2024-0050',
            customerId: 'CUST-001',
            customerName: 'Ahmad bin Hassan',
            customerIC: '850615085432',
            customerPhone: '0123456789',
            status: 'overdue',
            loanAmount: 2500,
            netValue: 3200,
            totalWeight: 15.5,
            items: [
                { barcode: 'PLG-2024-0050-01', category: 'chain', purity: '916', weight: '10.5', netValue: 2100 },
                { barcode: 'PLG-2024-0050-02', category: 'ring', purity: '916', weight: '5.0', netValue: 1100 },
            ],
            createdAt: '2024-03-15T10:00:00Z',
            dueDate: '2024-09-15T10:00:00Z', // 3+ months overdue
            rackLocation: 'A1-S2',
        },
        {
            id: 'PLG-2024-0051',
            customerId: 'CUST-002',
            customerName: 'Siti Aminah',
            customerIC: '900820145678',
            customerPhone: '0198765432',
            status: 'overdue',
            loanAmount: 4800,
            netValue: 6500,
            totalWeight: 28.3,
            items: [
                { barcode: 'PLG-2024-0051-01', category: 'bangle', purity: '916', weight: '18.3', netValue: 4000 },
                { barcode: 'PLG-2024-0051-02', category: 'earring', purity: '750', weight: '10.0', netValue: 2500 },
            ],
            createdAt: '2024-04-01T14:30:00Z',
            dueDate: '2024-10-01T14:30:00Z', // 2+ months overdue
            rackLocation: 'B2-S1',
        },
        {
            id: 'PLG-2024-0052',
            customerId: 'CUST-003',
            customerName: 'Raj Kumar',
            customerIC: '880505087654',
            customerPhone: '0171234567',
            status: 'overdue',
            loanAmount: 1200,
            netValue: 1600,
            totalWeight: 7.2,
            items: [
                { barcode: 'PLG-2024-0052-01', category: 'pendant', purity: '916', weight: '7.2', netValue: 1600 },
            ],
            createdAt: '2024-05-20T09:15:00Z',
            dueDate: '2024-11-20T09:15:00Z', // 1+ month overdue
            rackLocation: 'A3-S4',
        },
    ]

    // Sample forfeited pledges (ready for auction)
    const forfeitedPledges = [
        {
            id: 'PLG-2024-0030',
            customerId: 'CUST-004',
            customerName: 'Lee Mei Ling',
            customerIC: '920315145632',
            customerPhone: '0162345678',
            status: 'forfeited',
            loanAmount: 3500,
            netValue: 4800,
            totalWeight: 22.0,
            items: [
                { barcode: 'PLG-2024-0030-01', category: 'necklace', purity: '916', weight: '15.0', netValue: 3300 },
                { barcode: 'PLG-2024-0030-02', category: 'bracelet', purity: '750', weight: '7.0', netValue: 1500 },
            ],
            createdAt: '2024-01-10T11:00:00Z',
            dueDate: '2024-07-10T11:00:00Z',
            forfeitedAt: '2024-09-15T10:00:00Z',
            rackLocation: 'C1-S1',
        },
        {
            id: 'PLG-2024-0031',
            customerId: 'CUST-005',
            customerName: 'Muthu Samy',
            customerIC: '780922086543',
            customerPhone: '0134567890',
            status: 'forfeited',
            loanAmount: 8500,
            netValue: 11200,
            totalWeight: 52.5,
            items: [
                { barcode: 'PLG-2024-0031-01', category: 'chain', purity: '999', weight: '30.0', netValue: 7500 },
                { barcode: 'PLG-2024-0031-02', category: 'bangle', purity: '916', weight: '22.5', netValue: 3700 },
            ],
            createdAt: '2024-02-05T15:30:00Z',
            dueDate: '2024-08-05T15:30:00Z',
            forfeitedAt: '2024-10-10T14:00:00Z',
            rackLocation: 'C2-S3',
        },
    ]

    // Sample auctioned pledges (completed sales)
    const auctionedPledges = [
        {
            id: 'PLG-2024-0010',
            customerId: 'CUST-006',
            customerName: 'Tan Ah Kow',
            customerIC: '700815087654',
            customerPhone: '0145678901',
            status: 'auctioned',
            loanAmount: 2000,
            netValue: 2800,
            totalWeight: 12.0,
            items: [
                { barcode: 'PLG-2024-0010-01', category: 'ring', purity: '916', weight: '8.0', netValue: 1800 },
                { barcode: 'PLG-2024-0010-02', category: 'earring', purity: '750', weight: '4.0', netValue: 1000 },
            ],
            createdAt: '2023-10-15T10:00:00Z',
            dueDate: '2024-04-15T10:00:00Z',
            forfeitedAt: '2024-06-20T10:00:00Z',
            auctionedAt: '2024-08-05T11:30:00Z',
            auctionPrice: 2650,
            auctionBuyer: {
                name: 'Gold Traders Sdn Bhd',
                phone: '0321234567',
            },
            auctionNotes: 'Bulk sale with other items',
            rackLocation: 'D1-S2',
        },
        {
            id: 'PLG-2024-0011',
            customerId: 'CUST-007',
            customerName: 'Fatimah binti Ali',
            customerIC: '850420145678',
            customerPhone: '0156789012',
            status: 'auctioned',
            loanAmount: 5500,
            netValue: 7200,
            totalWeight: 35.0,
            items: [
                { barcode: 'PLG-2024-0011-01', category: 'bangle', purity: '916', weight: '25.0', netValue: 5500 },
                { barcode: 'PLG-2024-0011-02', category: 'pendant', purity: '916', weight: '10.0', netValue: 1700 },
            ],
            createdAt: '2023-11-20T14:00:00Z',
            dueDate: '2024-05-20T14:00:00Z',
            forfeitedAt: '2024-07-25T09:00:00Z',
            auctionedAt: '2024-09-12T16:00:00Z',
            auctionPrice: 7000,
            auctionBuyer: {
                name: 'Kedai Emas Maju',
                phone: '0387654321',
            },
            auctionNotes: 'Good condition items',
            rackLocation: 'D2-S1',
        },
        {
            id: 'PLG-2024-0012',
            customerId: 'CUST-008',
            customerName: 'Wong Kam Fook',
            customerIC: '680730086789',
            customerPhone: '0167890123',
            status: 'auctioned',
            loanAmount: 1800,
            netValue: 2400,
            totalWeight: 10.5,
            items: [
                { barcode: 'PLG-2024-0012-01', category: 'chain', purity: '750', weight: '10.5', netValue: 2400 },
            ],
            createdAt: '2023-12-01T09:30:00Z',
            dueDate: '2024-06-01T09:30:00Z',
            forfeitedAt: '2024-08-10T11:00:00Z',
            auctionedAt: '2024-10-20T10:45:00Z',
            auctionPrice: 2200,
            auctionBuyer: {
                name: 'Syarikat Perak Emas',
                phone: '0398765432',
            },
            auctionNotes: '',
            rackLocation: 'D3-S4',
        },
    ]

    // Combine with existing pledges (avoid duplicates)
    const allMockPledges = [...overduePledges, ...forfeitedPledges, ...auctionedPledges]
    const existingIds = new Set(existingPledges.map(p => p.id))
    const newPledges = allMockPledges.filter(p => !existingIds.has(p.id))

    const updatedPledges = [...existingPledges, ...newPledges]
    localStorage.setItem('pawnsys_pledges', JSON.stringify(updatedPledges))

    console.log(`✅ Added ${newPledges.length} mock auction pledges`)
    console.log('   - Overdue: 3 pledges')
    console.log('   - Forfeited: 2 pledges')
    console.log('   - Auctioned: 3 pledges')
    console.log('🔄 Refresh the page to see changes')

    return updatedPledges
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    window.initAuctionMockData = initAuctionMockData
}

export default initAuctionMockData