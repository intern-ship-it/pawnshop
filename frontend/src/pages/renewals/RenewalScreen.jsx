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
  RefreshCw,
  Search,
  Package,
  User,
  Calendar,
  Clock,
  DollarSign,
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
} from 'lucide-react'

export default function RenewalScreen() {
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

  // Extension state
  const [extensionMonths, setExtensionMonths] = useState(1)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [renewalResult, setRenewalResult] = useState(null)

  // Load pre-selected pledge
  useEffect(() => {
    if (selectedPledge) {
      setPledge(selectedPledge)
      setSearchQuery(selectedPledge.id)
      dispatch(setSelectedPledge(null))
    }
  }, [selectedPledge, dispatch])

  // Calculate interest
  const calculateInterest = (pledgeData, months = null) => {
    if (!pledgeData?.createdAt || !pledgeData?.loanAmount) return { months: 0, rate: 0, amount: 0, total: 0, monthlyBreakdown: [] }

    const createdDate = new Date(pledgeData.createdAt)
    if (isNaN(createdDate.getTime())) return { months: 0, rate: 0, amount: 0, total: pledgeData.loanAmount || 0, monthlyBreakdown: [] }

    const now = new Date()
    const currentMonths = Math.max(1, Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24 * 30)))
    const calcMonths = months || currentMonths

    let totalInterest = 0
    const monthlyBreakdown = []

    for (let i = 1; i <= calcMonths; i++) {
      const rate = i <= 6 ? 0.5 : 1.5
      const monthInterest = pledgeData.loanAmount * (rate / 100)
      totalInterest += monthInterest
      monthlyBreakdown.push({ month: i, rate, amount: monthInterest })
    }

    // Subtract already paid renewals
    const paidInterest = (pledgeData.renewals || []).reduce((sum, r) => sum + r.amount, 0)
    const outstandingInterest = Math.max(0, totalInterest - paidInterest)

    return {
      months: calcMonths,
      rate: calcMonths <= 6 ? 0.5 : 1.5,
      amount: outstandingInterest,
      total: pledgeData.loanAmount + outstandingInterest,
      monthlyBreakdown,
      paidInterest,
    }
  }

  const interest = calculateInterest(pledge)

  // Calculate extension interest
  const calculateExtensionInterest = () => {
    if (!pledge) return 0

    const createdDate = new Date(pledge.createdAt)
    const now = new Date()
    const currentMonths = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24 * 30))

    let extensionInterest = 0
    for (let i = 1; i <= extensionMonths; i++) {
      const monthNum = currentMonths + i
      const rate = monthNum <= 6 ? 0.5 : 1.5
      extensionInterest += pledge.loanAmount * (rate / 100)
    }

    return extensionInterest
  }

  const extensionInterest = calculateExtensionInterest()
  const totalPayable = interest.amount + extensionInterest

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
            message: `Pledge is ${found.status}. Cannot process renewal.`
          }))
        }
      } else {
        setSearchResult('not_found')
        setPledge(null)
      }

      setIsSearching(false)
    }, 500)
  }

  // Process renewal
  const handleProcessRenewal = () => {
    if (!pledge) return

    const received = parseFloat(amountReceived) || 0
    if (received < totalPayable) {
      dispatch(addToast({
        type: 'error',
        title: 'Insufficient',
        message: `Amount must be at least ${formatCurrency(totalPayable)}`
      }))
      return
    }

    setIsProcessing(true)

    setTimeout(() => {
      const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

      // Create renewal record
      const renewal = {
        id: `REN-${Date.now()}`,
        date: new Date().toISOString(),
        amount: totalPayable,
        amountReceived: received,
        change: received - totalPayable,
        extensionMonths,
        paymentMethod,
        referenceNo,
        outstandingInterest: interest.amount,
        extensionInterest,
      }

      // Calculate new due date
      const currentDueDate = new Date(pledge.dueDate)
      if (isNaN(currentDueDate.getTime())) {
        dispatch(addToast({
          type: 'error',
          title: 'Invalid Date',
          message: 'Pledge has invalid due date'
        }))
        setIsProcessing(false)
        return
      }
      const newDueDate = new Date(currentDueDate)
      newDueDate.setMonth(newDueDate.getMonth() + extensionMonths)

      // Update pledge
      const updatedPledge = {
        ...pledge,
        status: 'active',
        dueDate: newDueDate.toISOString(),
        renewals: [...(pledge.renewals || []), renewal],
        lastRenewalDate: new Date().toISOString(),
      }

      const updatedPledges = storedPledges.map(p =>
        p.id === pledge.id ? updatedPledge : p
      )

      setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
      dispatch(setPledges(updatedPledges))

      // Update customer last visit
      const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
      const updatedCustomers = storedCustomers.map(c => {
        if (c.id === pledge.customerId) {
          return { ...c, lastVisit: new Date().toISOString().split('T')[0] }
        }
        return c
      })
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedCustomers)
      dispatch(setCustomers(updatedCustomers))

      setRenewalResult({
        renewalId: renewal.id,
        pledgeId: pledge.id,
        customerName: pledge.customerName,
        amountPaid: totalPayable,
        change: received - totalPayable,
        newDueDate: newDueDate,
        extensionMonths,
      })

      setIsProcessing(false)
      setShowSuccessModal(true)
    }, 1000)
  }

  // Days until due
  const getDaysUntilDue = () => {
    if (!pledge?.dueDate) return 0
    const now = new Date()
    const due = new Date(pledge.dueDate)
    if (isNaN(due.getTime())) return 0
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  }

  const daysUntilDue = getDaysUntilDue()

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
      title="Renewal"
      subtitle="Process interest payment and extend pledge period"
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
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Search className="w-5 h-5 text-blue-600" />
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
                      <p className="font-medium text-red-800">Cannot process renewal</p>
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
              {/* Pledge Info Card */}
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
                          {pledge.status === 'overdue' ? (
                            <><AlertTriangle className="w-3 h-3 mr-1" />Overdue</>
                          ) : (
                            <><CheckCircle className="w-3 h-3 mr-1" />Active</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500 font-mono">{pledge.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPledge(null)
                      setSearchResult(null)
                      setSearchQuery('')
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-zinc-500">Principal</p>
                    <p className="text-lg font-semibold text-zinc-800">{formatCurrency(pledge.loanAmount)}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-zinc-500">Items</p>
                    <p className="text-lg font-semibold text-zinc-800">{pledge.items?.length} ({pledge.totalWeight?.toFixed(2)}g)</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-zinc-500">Created</p>
                    <p className="text-lg font-semibold text-zinc-800">{formatDate(pledge.createdAt)}</p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-lg',
                    daysUntilDue <= 0 ? 'bg-red-50' :
                      daysUntilDue <= 7 ? 'bg-amber-50' :
                        'bg-zinc-50'
                  )}>
                    <p className="text-xs text-zinc-500">Due Date</p>
                    <p className={cn(
                      'text-lg font-semibold',
                      daysUntilDue <= 0 ? 'text-red-600' :
                        daysUntilDue <= 7 ? 'text-amber-600' :
                          'text-zinc-800'
                    )}>
                      {formatDate(pledge.dueDate)}
                    </p>
                    <p className={cn(
                      'text-xs',
                      daysUntilDue <= 0 ? 'text-red-500' :
                        daysUntilDue <= 7 ? 'text-amber-500' :
                          'text-zinc-400'
                    )}>
                      {daysUntilDue > 0 ? `${daysUntilDue} days left` : `${Math.abs(daysUntilDue)} days overdue`}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Interest Calculation */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Interest Calculation</h3>
                    <p className="text-sm text-zinc-500">Outstanding interest and extension</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Outstanding Interest */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-red-800">Outstanding Interest</p>
                        <p className="text-sm text-red-600">{interest.months} month(s) @ varying rates</p>
                      </div>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(interest.amount)}</p>
                    </div>
                  </div>

                  {/* Extension Options */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Extend Period By
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 6].map((months) => (
                        <button
                          key={months}
                          onClick={() => setExtensionMonths(months)}
                          className={cn(
                            'px-4 py-2 rounded-lg font-medium transition-all',
                            extensionMonths === months
                              ? 'bg-amber-500 text-white'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          )}
                        >
                          {months} {months === 1 ? 'Month' : 'Months'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extension Interest */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-blue-800">Extension Interest</p>
                        <p className="text-sm text-blue-600">{extensionMonths} month(s) advance</p>
                      </div>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(extensionInterest)}</p>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-emerald-800">Total Payable</p>
                        <p className="text-sm text-emerald-600">Outstanding + Extension</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPayable)}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Payment Section */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Payment</h3>
                    <p className="text-sm text-zinc-500">Collect interest payment</p>
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
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-zinc-200 hover:border-zinc-300'
                          )}
                        >
                          <method.icon className={cn(
                            'w-5 h-5',
                            paymentMethod === method.value ? 'text-amber-600' : 'text-zinc-400'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            paymentMethod === method.value ? 'text-amber-600' : 'text-zinc-600'
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
                      placeholder={totalPayable.toFixed(2)}
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
                  {amountReceived && parseFloat(amountReceived) > totalPayable && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Change</span>
                        <span className="text-lg font-bold text-blue-600">
                          {formatCurrency(parseFloat(amountReceived) - totalPayable)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* New Due Date Preview */}
                  <div className="p-4 bg-zinc-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-sm text-zinc-500">New Due Date (after renewal)</p>
                        <p className="font-semibold text-zinc-800">
                          {(() => {
                            if (!pledge?.dueDate) return 'N/A'
                            const newDue = new Date(pledge.dueDate)
                            if (isNaN(newDue.getTime())) return 'Invalid Date'
                            newDue.setMonth(newDue.getMonth() + extensionMonths)
                            return formatDate(newDue.toISOString())
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Process Button */}
                  <Button
                    variant="success"
                    size="lg"
                    fullWidth
                    leftIcon={CheckCircle}
                    onClick={handleProcessRenewal}
                    loading={isProcessing}
                    disabled={!amountReceived || parseFloat(amountReceived) < totalPayable}
                  >
                    Process Renewal - {formatCurrency(totalPayable)}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!pledge && !searchResult && (
          <motion.div variants={itemVariants}>
            <Card className="p-12 text-center">
              <RefreshCw className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">Process Renewal</h3>
              <p className="text-zinc-500 mb-4">Search for a pledge to process interest payment and extend the period</p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => { }}
        title="Renewal Successful!"
        size="md"
      >
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </motion.div>

          <h3 className="text-xl font-bold text-zinc-800 mb-2">Renewal Processed!</h3>
          <p className="text-zinc-500 mb-4">
            ID: <span className="font-mono font-bold">{renewalResult?.renewalId}</span>
          </p>

          <div className="p-4 bg-zinc-50 rounded-xl mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Pledge</span>
                <span className="font-medium">{renewalResult?.pledgeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">{renewalResult?.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount Paid</span>
                <span className="font-medium text-emerald-600">{formatCurrency(renewalResult?.amountPaid)}</span>
              </div>
              {renewalResult?.change > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Change Given</span>
                  <span className="font-medium text-blue-600">{formatCurrency(renewalResult?.change)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-zinc-200">
                <span className="text-zinc-500">New Due Date</span>
                <span className="font-bold text-zinc-800">
                  {renewalResult?.newDueDate ? formatDate(
                    renewalResult.newDueDate instanceof Date
                      ? renewalResult.newDueDate.toISOString()
                      : renewalResult.newDueDate
                  ) : 'N/A'}
                </span>
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
              onClick={() => navigate(`/pledges/${renewalResult?.pledgeId}`)}
            >
              View Pledge
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
                setExtensionMonths(1)
              }}
            >
              New Renewal
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}