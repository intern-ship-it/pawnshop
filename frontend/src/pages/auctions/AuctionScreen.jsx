import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate, formatIC } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  Gavel,
  Search,
  Package,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  Scale,
  TrendingUp,
  ArrowRight,
  Users,
  FileText,
  Printer,
  Download,
  Filter,
  MapPin,
  Tag,
  Banknote,
  ShieldAlert,
  Archive,
  ChevronRight,
} from 'lucide-react'

// Status config
const statusConfig = {
  overdue: { label: 'Overdue', variant: 'error', icon: AlertTriangle },
  forfeited: { label: 'Forfeited', variant: 'warning', icon: XCircle },
  auctioned: { label: 'Auctioned', variant: 'success', icon: Gavel },
}

// Tabs
const tabs = [
  { id: 'eligible', label: 'Eligible for Forfeit', icon: AlertTriangle, count: 0 },
  { id: 'forfeited', label: 'Forfeited', icon: XCircle, count: 0 },
  { id: 'auctioned', label: 'Auctioned', icon: Gavel, count: 0 },
]

export default function AuctionScreen() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { pledges } = useAppSelector((state) => state.pledges)

  // State
  const [activeTab, setActiveTab] = useState('eligible')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('overdue-days')

  // Modal state
  const [showForfeitModal, setShowForfeitModal] = useState(false)
  const [showAuctionModal, setShowAuctionModal] = useState(false)
  const [selectedPledge, setSelectedPledge] = useState(null)
  const [auctionPrice, setAuctionPrice] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [auctionNotes, setAuctionNotes] = useState('')

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)

  // Load pledges on mount
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

    // Initialize mock auction data if none exists
    const hasAuctionData = storedPledges.some(p =>
      p.status === 'overdue' || p.status === 'forfeited' || p.status === 'auctioned'
    )

    if (!hasAuctionData) {
      // Add sample auction data for demo
      const mockPledges = [
        // Overdue pledges
        {
          id: 'PLG-2024-0050',
          customerId: 'CUST-001',
          customerName: 'Ahmad bin Hassan',
          customerIC: '850615085432',
          status: 'overdue',
          loanAmount: 2500,
          netValue: 3200,
          totalWeight: 15.5,
          items: [
            { barcode: 'PLG-2024-0050-01', category: 'chain', purity: '916', weight: '10.5', netValue: 2100 },
            { barcode: 'PLG-2024-0050-02', category: 'ring', purity: '916', weight: '5.0', netValue: 1100 },
          ],
          createdAt: '2024-03-15T10:00:00Z',
          dueDate: '2024-09-15T10:00:00Z',
          rackLocation: 'A1-S2',
        },
        {
          id: 'PLG-2024-0051',
          customerId: 'CUST-002',
          customerName: 'Siti Aminah',
          customerIC: '900820145678',
          status: 'overdue',
          loanAmount: 4800,
          netValue: 6500,
          totalWeight: 28.3,
          items: [
            { barcode: 'PLG-2024-0051-01', category: 'bangle', purity: '916', weight: '18.3', netValue: 4000 },
            { barcode: 'PLG-2024-0051-02', category: 'earring', purity: '750', weight: '10.0', netValue: 2500 },
          ],
          createdAt: '2024-04-01T14:30:00Z',
          dueDate: '2024-10-01T14:30:00Z',
          rackLocation: 'B2-S1',
        },
        {
          id: 'PLG-2024-0052',
          customerId: 'CUST-003',
          customerName: 'Raj Kumar',
          customerIC: '880505087654',
          status: 'overdue',
          loanAmount: 1200,
          netValue: 1600,
          totalWeight: 7.2,
          items: [
            { barcode: 'PLG-2024-0052-01', category: 'pendant', purity: '916', weight: '7.2', netValue: 1600 },
          ],
          createdAt: '2024-05-20T09:15:00Z',
          dueDate: '2024-11-20T09:15:00Z',
          rackLocation: 'A3-S4',
        },
        // Forfeited pledges
        {
          id: 'PLG-2024-0030',
          customerId: 'CUST-004',
          customerName: 'Lee Mei Ling',
          customerIC: '920315145632',
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
        // Auctioned pledges
        {
          id: 'PLG-2024-0010',
          customerId: 'CUST-006',
          customerName: 'Tan Ah Kow',
          customerIC: '700815087654',
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
          auctionBuyer: { name: 'Gold Traders Sdn Bhd', phone: '0321234567' },
          rackLocation: 'D1-S2',
        },
        {
          id: 'PLG-2024-0011',
          customerId: 'CUST-007',
          customerName: 'Fatimah binti Ali',
          customerIC: '850420145678',
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
          auctionBuyer: { name: 'Kedai Emas Maju', phone: '0387654321' },
          rackLocation: 'D2-S1',
        },
        {
          id: 'PLG-2024-0012',
          customerId: 'CUST-008',
          customerName: 'Wong Kam Fook',
          customerIC: '680730086789',
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
          auctionBuyer: { name: 'Syarikat Perak Emas', phone: '0398765432' },
          rackLocation: 'D3-S4',
        },
      ]

      const existingIds = new Set(storedPledges.map(p => p.id))
      const newPledges = mockPledges.filter(p => !existingIds.has(p.id))
      const allPledges = [...storedPledges, ...newPledges]
      setStorageItem(STORAGE_KEYS.PLEDGES, allPledges)
      dispatch(setPledges(allPledges))
      return
    }

    // Update overdue status
    const now = new Date()
    const updatedPledges = storedPledges.map(pledge => {
      if (pledge.status === 'active' && new Date(pledge.dueDate) < now) {
        return { ...pledge, status: 'overdue' }
      }
      return pledge
    })

    dispatch(setPledges(updatedPledges))
  }, [dispatch])

  // Calculate days overdue
  const getDaysOverdue = (dueDate) => {
    const now = new Date()
    const due = new Date(dueDate)
    const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  // Filter pledges by tab
  const filteredPledges = useMemo(() => {
    let result = []

    switch (activeTab) {
      case 'eligible':
        result = pledges.filter(p => p.status === 'overdue')
        break
      case 'forfeited':
        result = pledges.filter(p => p.status === 'forfeited')
        break
      case 'auctioned':
        result = pledges.filter(p => p.status === 'auctioned')
        break
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.id?.toLowerCase().includes(query) ||
        p.customerName?.toLowerCase().includes(query) ||
        p.customerIC?.replace(/[-\s]/g, '').includes(query.replace(/[-\s]/g, ''))
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'overdue-days':
          return getDaysOverdue(b.dueDate) - getDaysOverdue(a.dueDate)
        case 'amount-high':
          return (b.loanAmount || 0) - (a.loanAmount || 0)
        case 'amount-low':
          return (a.loanAmount || 0) - (b.loanAmount || 0)
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt)
        default:
          return 0
      }
    })

    return result
  }, [pledges, activeTab, searchQuery, sortBy])

  // Tab counts
  const tabCounts = useMemo(() => ({
    eligible: pledges.filter(p => p.status === 'overdue').length,
    forfeited: pledges.filter(p => p.status === 'forfeited').length,
    auctioned: pledges.filter(p => p.status === 'auctioned').length,
  }), [pledges])

  // Stats
  const stats = useMemo(() => {
    const overduePledges = pledges.filter(p => p.status === 'overdue')
    const forfeitedPledges = pledges.filter(p => p.status === 'forfeited')
    const auctionedPledges = pledges.filter(p => p.status === 'auctioned')

    return {
      overdueCount: overduePledges.length,
      overdueAmount: overduePledges.reduce((sum, p) => sum + (p.loanAmount || 0), 0),
      forfeitedCount: forfeitedPledges.length,
      forfeitedValue: forfeitedPledges.reduce((sum, p) => sum + (p.netValue || 0), 0),
      auctionedCount: auctionedPledges.length,
      auctionedRevenue: auctionedPledges.reduce((sum, p) => sum + (p.auctionPrice || 0), 0),
    }
  }, [pledges])

  // Process forfeit
  const handleForfeit = () => {
    if (!selectedPledge) return

    setIsProcessing(true)

    setTimeout(() => {
      const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

      const updatedPledge = {
        ...selectedPledge,
        status: 'forfeited',
        forfeitedAt: new Date().toISOString(),
      }

      const updatedPledges = storedPledges.map(p =>
        p.id === selectedPledge.id ? updatedPledge : p
      )

      setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
      dispatch(setPledges(updatedPledges))

      setIsProcessing(false)
      setShowForfeitModal(false)
      setSelectedPledge(null)

      dispatch(addToast({
        type: 'success',
        title: 'Forfeited',
        message: `Pledge ${selectedPledge.id} has been marked as forfeited`,
      }))
    }, 800)
  }

  // Process auction
  const handleAuction = () => {
    if (!selectedPledge) return

    const price = parseFloat(auctionPrice)
    if (!price || price <= 0) {
      dispatch(addToast({ type: 'error', title: 'Invalid', message: 'Please enter a valid auction price' }))
      return
    }

    if (!buyerName.trim()) {
      dispatch(addToast({ type: 'error', title: 'Required', message: 'Please enter buyer name' }))
      return
    }

    setIsProcessing(true)

    setTimeout(() => {
      const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

      const updatedPledge = {
        ...selectedPledge,
        status: 'auctioned',
        auctionedAt: new Date().toISOString(),
        auctionPrice: price,
        auctionBuyer: {
          name: buyerName,
          phone: buyerPhone,
        },
        auctionNotes,
      }

      const updatedPledges = storedPledges.map(p =>
        p.id === selectedPledge.id ? updatedPledge : p
      )

      setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
      dispatch(setPledges(updatedPledges))

      setIsProcessing(false)
      setShowAuctionModal(false)
      setSelectedPledge(null)
      setAuctionPrice('')
      setBuyerName('')
      setBuyerPhone('')
      setAuctionNotes('')

      dispatch(addToast({
        type: 'success',
        title: 'Auctioned',
        message: `Pledge ${selectedPledge.id} sold for ${formatCurrency(price)}`,
      }))
    }, 800)
  }

  // Open forfeit modal
  const openForfeitModal = (pledge) => {
    setSelectedPledge(pledge)
    setShowForfeitModal(true)
  }

  // Open auction modal
  const openAuctionModal = (pledge) => {
    setSelectedPledge(pledge)
    setAuctionPrice(pledge.netValue?.toString() || '')
    setShowAuctionModal(true)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <PageWrapper
      title="Auctions"
      subtitle="Manage forfeited pledges and auction sales"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download}>
            Export
          </Button>
          <Button variant="outline" leftIcon={Printer}>
            Print List
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-5 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Overdue Pledges</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                <p className="text-sm text-zinc-500">{formatCurrency(stats.overdueAmount)} at risk</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-5 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Forfeited Items</p>
                <p className="text-2xl font-bold text-amber-600">{stats.forfeitedCount}</p>
                <p className="text-sm text-zinc-500">{formatCurrency(stats.forfeitedValue)} inventory</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Archive className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-5 border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Auctioned</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.auctionedCount}</p>
                <p className="text-sm text-zinc-500">{formatCurrency(stats.auctionedRevenue)} revenue</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Gavel className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const count = tabCounts[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-bold',
                  activeTab === tab.id ? 'bg-white/20' : 'bg-zinc-100'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by Pledge ID, Customer Name or IC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'overdue-days', label: 'Most Overdue' },
              { value: 'amount-high', label: 'Amount: High to Low' },
              { value: 'amount-low', label: 'Amount: Low to High' },
              { value: 'newest', label: 'Newest First' },
            ]}
            className="w-48"
          />
        </div>
      </Card>

      {/* Pledges List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {filteredPledges.length === 0 ? (
            <Card className="p-12 text-center">
              <Gavel className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">No Pledges Found</h3>
              <p className="text-zinc-500">
                {activeTab === 'eligible' && 'No overdue pledges eligible for forfeit'}
                {activeTab === 'forfeited' && 'No forfeited pledges yet'}
                {activeTab === 'auctioned' && 'No auctioned items yet'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPledges.map((pledge, index) => {
                const daysOverdue = getDaysOverdue(pledge.dueDate)
                const status = statusConfig[pledge.status] || statusConfig.overdue
                const StatusIcon = status.icon

                return (
                  <motion.div
                    key={pledge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-5 hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Pledge Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-semibold text-zinc-800">{pledge.id}</span>
                            <Badge variant={status.variant}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            {activeTab === 'eligible' && daysOverdue > 0 && (
                              <span className="text-sm text-red-500 font-medium">
                                {daysOverdue} days overdue
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-600">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-zinc-400" />
                              {pledge.customerName}
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4 text-zinc-400" />
                              {pledge.items?.length} item(s)
                            </div>
                            <div className="flex items-center gap-1">
                              <Scale className="w-4 h-4 text-zinc-400" />
                              {pledge.totalWeight?.toFixed(2)}g
                            </div>
                            {pledge.rackLocation && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="text-blue-600">{pledge.rackLocation}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Values */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-zinc-500">Loan Amount</p>
                            <p className="font-semibold text-zinc-800">{formatCurrency(pledge.loanAmount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-zinc-500">Item Value</p>
                            <p className="font-semibold text-emerald-600">{formatCurrency(pledge.netValue)}</p>
                          </div>

                          {/* Auction Info */}
                          {pledge.status === 'auctioned' && (
                            <div className="text-right">
                              <p className="text-xs text-zinc-500">Sold For</p>
                              <p className="font-bold text-amber-600">{formatCurrency(pledge.auctionPrice)}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={Eye}
                            onClick={() => navigate(`/pledges/${pledge.id}`)}
                          >
                            View
                          </Button>

                          {activeTab === 'eligible' && (
                            <Button
                              variant="error"
                              size="sm"
                              leftIcon={XCircle}
                              onClick={() => openForfeitModal(pledge)}
                            >
                              Forfeit
                            </Button>
                          )}

                          {activeTab === 'forfeited' && (
                            <Button
                              variant="accent"
                              size="sm"
                              leftIcon={Gavel}
                              onClick={() => openAuctionModal(pledge)}
                            >
                              Auction
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Auction Details */}
                      {pledge.status === 'auctioned' && pledge.auctionBuyer && (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <div className="flex items-center gap-6 text-sm">
                            <div>
                              <span className="text-zinc-500">Buyer:</span>
                              <span className="ml-2 font-medium">{pledge.auctionBuyer.name}</span>
                            </div>
                            {pledge.auctionBuyer.phone && (
                              <div>
                                <span className="text-zinc-500">Phone:</span>
                                <span className="ml-2">{pledge.auctionBuyer.phone}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-zinc-500">Date:</span>
                              <span className="ml-2">{formatDate(pledge.auctionedAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Forfeit Confirmation Modal */}
      <Modal
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        title="Confirm Forfeit"
        size="md"
      >
        <div className="p-5">
          <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
            <ShieldAlert className="w-10 h-10 text-red-500" />
            <div>
              <p className="font-semibold text-red-800">Warning: This action is irreversible</p>
              <p className="text-sm text-red-600">
                The pledge will be marked as forfeited and items will be available for auction.
              </p>
            </div>
          </div>

          {selectedPledge && (
            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Pledge ID</span>
                <span className="font-mono font-semibold">{selectedPledge.id}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">{selectedPledge.customerName}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Loan Amount</span>
                <span className="font-semibold">{formatCurrency(selectedPledge.loanAmount)}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Items</span>
                <span>{selectedPledge.items?.length} item(s) - {selectedPledge.totalWeight?.toFixed(2)}g</span>
              </div>
              <div className="flex justify-between p-3 bg-amber-50 rounded-lg">
                <span className="text-amber-700">Days Overdue</span>
                <span className="font-bold text-amber-600">{getDaysOverdue(selectedPledge.dueDate)} days</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowForfeitModal(false)}>
              Cancel
            </Button>
            <Button
              variant="error"
              fullWidth
              leftIcon={XCircle}
              onClick={handleForfeit}
              loading={isProcessing}
            >
              Confirm Forfeit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Auction Modal */}
      <Modal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        title="Record Auction Sale"
        size="md"
      >
        <div className="p-5">
          {selectedPledge && (
            <>
              {/* Pledge Summary */}
              <div className="p-4 bg-zinc-50 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold">{selectedPledge.id}</span>
                  <Badge variant="warning">Forfeited</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Items:</span>
                    <span className="ml-2">{selectedPledge.items?.length} ({selectedPledge.totalWeight?.toFixed(2)}g)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Value:</span>
                    <span className="ml-2 font-semibold text-emerald-600">{formatCurrency(selectedPledge.netValue)}</span>
                  </div>
                </div>
              </div>

              {/* Auction Form */}
              <div className="space-y-4">
                <Input
                  label="Auction Price (RM) *"
                  type="number"
                  step="0.01"
                  placeholder="Enter selling price"
                  value={auctionPrice}
                  onChange={(e) => setAuctionPrice(e.target.value)}
                  leftIcon={DollarSign}
                />

                <Input
                  label="Buyer Name *"
                  placeholder="Enter buyer's name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  leftIcon={Users}
                />

                <Input
                  label="Buyer Phone (Optional)"
                  placeholder="Enter phone number"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                />

                <Input
                  label="Notes (Optional)"
                  placeholder="Any additional notes"
                  value={auctionNotes}
                  onChange={(e) => setAuctionNotes(e.target.value)}
                  multiline
                  rows={2}
                />

                {/* Profit/Loss Indicator */}
                {auctionPrice && selectedPledge.loanAmount && (
                  <div className={cn(
                    'p-3 rounded-lg border',
                    parseFloat(auctionPrice) >= selectedPledge.loanAmount
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  )}>
                    <div className="flex justify-between items-center">
                      <span className={parseFloat(auctionPrice) >= selectedPledge.loanAmount ? 'text-emerald-700' : 'text-red-700'}>
                        {parseFloat(auctionPrice) >= selectedPledge.loanAmount ? 'Profit' : 'Loss'}
                      </span>
                      <span className={cn(
                        'font-bold',
                        parseFloat(auctionPrice) >= selectedPledge.loanAmount ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatCurrency(Math.abs(parseFloat(auctionPrice) - selectedPledge.loanAmount))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" fullWidth onClick={() => setShowAuctionModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  fullWidth
                  leftIcon={Gavel}
                  onClick={handleAuction}
                  loading={isProcessing}
                >
                  Complete Sale
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </PageWrapper>
  )
}