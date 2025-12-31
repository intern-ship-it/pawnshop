import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges, setSelectedPledge } from '@/features/pledges/pledgesSlice'
import { setCustomers } from '@/features/customers/customersSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate, formatIC, formatPhone } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  DollarSign,
  Search,
  Package,
  User,
  Calendar,
  Clock,
  CreditCard,
  Wallet,
  Building2,
  CheckCircle,
  AlertTriangle,
  Printer,
  MessageSquare,
  Plus,
  ArrowRight,
  Scale,
  TrendingUp,
  Info,
  X,
  Gift,
  ShieldCheck,
  FileCheck,
} from 'lucide-react'

export default function RedemptionScreen() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { selectedPledge } = useAppSelector((state) => state.pledges)

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [pledge, setPledge] = useState(null)
  const [searchResult, setSearchResult] = useState(null)

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountReceived, setAmountReceived] = useState('')
  const [referenceNo, setReferenceNo] = useState('')

  // Verification state
  const [verifiedIC, setVerifiedIC] = useState(false)
  const [verifiedItems, setVerifiedItems] = useState(false)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [redemptionResult, setRedemptionResult] = useState(null)

  // Load pre-selected pledge
  useEffect(() => {
    if (selectedPledge) {
      setPledge(selectedPledge)
      setSearchQuery(selectedPledge.id)
      dispatch(setSelectedPledge(null))
    }
  }, [selectedPledge, dispatch])

  // Calculate interest and total
  const calculateTotal = (pledgeData) => {
    if (!pledgeData) return { principal: 0, interest: 0, total: 0, months: 0 }

    const createdDate = new Date(pledgeData.createdAt)
    const now = new Date()
    const months = Math.max(1, Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24 * 30)))

    let totalInterest = 0
    for (let i = 1; i <= months; i++) {
      const rate = i <= 6 ? 0.5 : 1.5
      totalInterest += pledgeData.loanAmount * (rate / 100)
    }

    // Subtract already paid renewals
    const paidInterest = (pledgeData.renewals || []).reduce((sum, r) => sum + r.amount, 0)
    const outstandingInterest = Math.max(0, totalInterest - paidInterest)

    return {
      principal: pledgeData.loanAmount,
      interest: outstandingInterest,
      total: pledgeData.loanAmount + outstandingInterest,
      months,
      paidInterest,
    }
  }

  const totals = calculateTotal(pledge)

  // Search pledge
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      dispatch(addToast({ type: 'warning', title: 'Required', message: 'Please enter a pledge ID' }))
      return
    }

    setIsSearching(true)

    setTimeout(() => {
      const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
      const found = storedPledges.find(p =>
        p.id.toLowerCase() === searchQuery.toLowerCase().trim()
      )

      if (found) {
        if (found.status === 'active' || found.status === 'overdue') {
          setPledge(found)
          setSearchResult('found')
          dispatch(addToast({ type: 'success', title: 'Found', message: `Pledge ${found.id} loaded` }))
        } else {
          setSearchResult('invalid')
          setPledge(null)
          dispatch(addToast({
            type: 'error',
            title: 'Invalid Status',
            message: `Pledge is already ${found.status}. Cannot process redemption.`
          }))
        }
      } else {
        setSearchResult('not_found')
        setPledge(null)
      }

      setIsSearching(false)
    }, 500)
  }

  // Process redemption
  const handleProcessRedemption = () => {
    if (!pledge) return

    if (!verifiedIC || !verifiedItems) {
      dispatch(addToast({
        type: 'error',
        title: 'Verification Required',
        message: 'Please verify IC and items before processing'
      }))
      return
    }

    const received = parseFloat(amountReceived) || 0
    if (received < totals.total) {
      dispatch(addToast({
        type: 'error',
        title: 'Insufficient',
        message: `Amount must be at least ${formatCurrency(totals.total)}`
      }))
      return
    }

    setIsProcessing(true)

    setTimeout(() => {
      const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

      // Update pledge status
      const updatedPledge = {
        ...pledge,
        status: 'redeemed',
        redeemedAt: new Date().toISOString(),
        redemptionAmount: totals.total,
        redemptionPaymentMethod: paymentMethod,
        redemptionReferenceNo: referenceNo,
        amountReceived: received,
        changeGiven: received - totals.total,
      }

      const updatedPledges = storedPledges.map(p =>
        p.id === pledge.id ? updatedPledge : p
      )

      setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
      dispatch(setPledges(updatedPledges))

      // Update customer stats
      const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
      const updatedCustomers = storedCustomers.map(c => {
        if (c.id === pledge.customerId) {
          return {
            ...c,
            activePledges: Math.max(0, (c.activePledges || 0) - 1),
            lastVisit: new Date().toISOString().split('T')[0],
          }
        }
        return c
      })
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedCustomers)
      dispatch(setCustomers(updatedCustomers))

      setRedemptionResult({
        pledgeId: pledge.id,
        customerName: pledge.customerName,
        principal: totals.principal,
        interest: totals.interest,
        totalPaid: totals.total,
        change: received - totals.total,
        items: pledge.items,
        paymentMethod,
      })

      setIsProcessing(false)
      setShowSuccessModal(true)
    }, 1000)
  }

  // Days since created
  const getDaysSinceCreated = () => {
    if (!pledge) return 0
    const now = new Date()
    const created = new Date(pledge.createdAt)
    return Math.ceil((now - created) / (1000 * 60 * 60 * 24))
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
      title="Redemption"
      subtitle="Process full payment and release items"
    >
      <motion.div
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Search Section */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Search className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-800">Find Pledge</h3>
                <p className="text-sm text-zinc-500">Search by Pledge ID</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter Pledge ID (e.g., PLG-2024-0001)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  leftIcon={Package}
                />
              </div>
              <Button
                variant="primary"
                leftIcon={Search}
                onClick={handleSearch}
                loading={isSearching}
              >
                Search
              </Button>
            </div>

            {/* Search Results */}
            <AnimatePresence>
              {searchResult === 'not_found' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Pledge not found</p>
                      <p className="text-sm text-amber-600">No pledge matches "{searchQuery}"</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {searchResult === 'invalid' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">Cannot process redemption</p>
                      <p className="text-sm text-red-600">This pledge is not active</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Pledge Details */}
        <AnimatePresence>
          {pledge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Customer & Pledge Info */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                      {pledge.customerName?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-800">{pledge.customerName}</h3>
                        <Badge variant={pledge.status === 'overdue' ? 'error' : 'success'}>
                          {pledge.status === 'overdue' ? 'Overdue' : 'Active'}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500">
                        <span className="font-mono">{pledge.id}</span> • IC: {formatIC(pledge.customerIC)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPledge(null)
                      setSearchResult(null)
                      setSearchQuery('')
                      setVerifiedIC(false)
                      setVerifiedItems(false)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Items Summary */}
                <div className="p-4 bg-zinc-50 rounded-xl mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Package className="w-5 h-5 text-zinc-400" />
                    <span className="font-medium text-zinc-700">Pledged Items ({pledge.items?.length})</span>
                  </div>
                  <div className="space-y-2">
                    {pledge.items?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-amber-500" />
                          <span className="capitalize">{item.category}</span>
                          <span className="text-zinc-400">•</span>
                          <span>{item.purity} Gold</span>
                          <span className="text-zinc-400">•</span>
                          <span>{parseFloat(item.weight).toFixed(2)}g</span>
                        </div>
                        <span className="font-mono text-xs text-zinc-400">{item.barcode}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-200 flex justify-between">
                    <span className="text-zinc-500">Total Weight</span>
                    <span className="font-semibold">{pledge.totalWeight?.toFixed(2)}g</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-zinc-50 rounded-lg text-center">
                    <Calendar className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Created</p>
                    <p className="text-sm font-medium">{formatDate(pledge.createdAt)}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg text-center">
                    <Clock className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Duration</p>
                    <p className="text-sm font-medium">{getDaysSinceCreated()} days</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg text-center">
                    <TrendingUp className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Renewals</p>
                    <p className="text-sm font-medium">{pledge.renewals?.length || 0}</p>
                  </div>
                </div>
              </Card>

              {/* Payment Breakdown */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Payment Summary</h3>
                    <p className="text-sm text-zinc-500">Total amount to collect</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg">
                    <span className="text-zinc-600">Principal Amount</span>
                    <span className="font-semibold">{formatCurrency(totals.principal)}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div>
                      <span className="text-amber-700">Outstanding Interest</span>
                      <p className="text-xs text-amber-600">{totals.months} month(s)</p>
                    </div>
                    <span className="font-semibold text-amber-600">{formatCurrency(totals.interest)}</span>
                  </div>

                  {totals.paidInterest > 0 && (
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700">Already Paid (Renewals)</span>
                      <span className="font-semibold text-blue-600">-{formatCurrency(totals.paidInterest)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                    <span className="font-semibold text-emerald-800">Total Redemption Amount</span>
                    <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Verification */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Verification Checklist</h3>
                    <p className="text-sm text-zinc-500">Confirm before releasing items</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={verifiedIC}
                      onChange={(e) => setVerifiedIC(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-zinc-800">IC Verified</p>
                      <p className="text-sm text-zinc-500">Customer IC matches: {formatIC(pledge.customerIC)}</p>
                    </div>
                    {verifiedIC && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                  </label>

                  <label className="flex items-center gap-3 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={verifiedItems}
                      onChange={(e) => setVerifiedItems(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-zinc-800">Items Verified</p>
                      <p className="text-sm text-zinc-500">All {pledge.items?.length} item(s) checked and ready for release</p>
                    </div>
                    {verifiedItems && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                  </label>
                </div>
              </Card>

              {/* Payment Collection */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Collect Payment</h3>
                    <p className="text-sm text-zinc-500">Process redemption payment</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'cash', label: 'Cash', icon: Wallet },
                        { value: 'card', label: 'Card', icon: CreditCard },
                        { value: 'transfer', label: 'Transfer', icon: Building2 },
                      ].map((method) => (
                        <button
                          key={method.value}
                          onClick={() => setPaymentMethod(method.value)}
                          className={cn(
                            'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                            paymentMethod === method.value
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-zinc-200 hover:border-zinc-300'
                          )}
                        >
                          <method.icon className={cn(
                            'w-5 h-5',
                            paymentMethod === method.value ? 'text-emerald-600' : 'text-zinc-400'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            paymentMethod === method.value ? 'text-emerald-600' : 'text-zinc-600'
                          )}>
                            {method.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Amount Received (RM)"
                      type="number"
                      step="0.01"
                      placeholder={totals.total.toFixed(2)}
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      leftIcon={DollarSign}
                    />
                    {paymentMethod !== 'cash' && (
                      <Input
                        label="Reference No."
                        placeholder="Transaction reference"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Change Display */}
                  {amountReceived && parseFloat(amountReceived) > totals.total && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Change to Return</span>
                        <span className="text-lg font-bold text-blue-600">
                          {formatCurrency(parseFloat(amountReceived) - totals.total)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Process Button */}
                  <Button
                    variant="success"
                    size="lg"
                    fullWidth
                    leftIcon={Gift}
                    onClick={handleProcessRedemption}
                    loading={isProcessing}
                    disabled={
                      !verifiedIC ||
                      !verifiedItems ||
                      !amountReceived ||
                      parseFloat(amountReceived) < totals.total
                    }
                  >
                    Complete Redemption - Release Items
                  </Button>

                  {(!verifiedIC || !verifiedItems) && (
                    <p className="text-center text-sm text-amber-600">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Please complete verification checklist first
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!pledge && !searchResult && (
          <motion.div variants={itemVariants}>
            <Card className="p-12 text-center">
              <Gift className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">Process Redemption</h3>
              <p className="text-zinc-500 mb-4">Search for a pledge to process full payment and release items</p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => { }}
        title="Redemption Complete!"
        size="md"
      >
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
          >
            <Gift className="w-10 h-10 text-emerald-600" />
          </motion.div>

          <h3 className="text-xl font-bold text-zinc-800 mb-2">Items Released!</h3>
          <p className="text-zinc-500 mb-4">
            Pledge <span className="font-mono font-bold">{redemptionResult?.pledgeId}</span> has been redeemed
          </p>

          <div className="p-4 bg-zinc-50 rounded-xl mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">{redemptionResult?.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Principal</span>
                <span className="font-medium">{formatCurrency(redemptionResult?.principal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Interest</span>
                <span className="font-medium">{formatCurrency(redemptionResult?.interest)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200">
                <span className="text-zinc-500">Total Paid</span>
                <span className="font-bold text-emerald-600">{formatCurrency(redemptionResult?.totalPaid)}</span>
              </div>
              {redemptionResult?.change > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Change Given</span>
                  <span className="font-medium text-blue-600">{formatCurrency(redemptionResult?.change)}</span>
                </div>
              )}
            </div>

            {/* Items Released */}
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <p className="text-sm font-medium text-zinc-700 mb-2">Items Released:</p>
              <div className="space-y-1">
                {redemptionResult?.items?.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-zinc-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="capitalize">{item.category}</span>
                    <span className="text-zinc-400">•</span>
                    <span>{item.purity}</span>
                    <span className="text-zinc-400">•</span>
                    <span>{parseFloat(item.weight).toFixed(2)}g</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" fullWidth leftIcon={Printer}>
              Print Receipt
            </Button>
            <Button variant="outline" fullWidth leftIcon={MessageSquare}>
              Send WhatsApp
            </Button>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate('/pledges')}
            >
              Back to Pledges
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={() => {
                setShowSuccessModal(false)
                setPledge(null)
                setSearchQuery('')
                setSearchResult(null)
                setAmountReceived('')
                setVerifiedIC(false)
                setVerifiedItems(false)
              }}
            >
              New Redemption
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}