import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setCustomers, setSelectedCustomer } from '@/features/customers/customersSlice'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatIC, formatPhone } from '@/utils/formatters'
import { validateIC } from '@/utils/validators'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Package,
  Calculator,
  Wallet,
  FileSignature,
  Search,
  Plus,
  Trash2,
  Camera,
  Scale,
  Gem,
  X,
  CreditCard,
  Building2,
  RefreshCw,
  Printer,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  Edit,
  Calendar,
  Clock,
  TrendingUp,
} from 'lucide-react'

// Step configuration
const steps = [
  { id: 1, title: 'Customer', icon: User, description: 'Select customer' },
  { id: 2, title: 'Items', icon: Package, description: 'Add items' },
  { id: 3, title: 'Valuation', icon: Calculator, description: 'Calculate value' },
  { id: 4, title: 'Payout', icon: Wallet, description: 'Payment method' },
  { id: 5, title: 'Confirm', icon: FileSignature, description: 'Review & sign' },
]

// Item categories
const itemCategories = [
  { value: 'chain', label: 'Chain (Rantai)' },
  { value: 'bangle', label: 'Bangle (Gelang)' },
  { value: 'ring', label: 'Ring (Cincin)' },
  { value: 'earring', label: 'Earring (Anting)' },
  { value: 'pendant', label: 'Pendant (Loket)' },
  { value: 'bracelet', label: 'Bracelet (Gelang Tangan)' },
  { value: 'necklace', label: 'Necklace (Kalung)' },
  { value: 'bar', label: 'Gold Bar (Jongkong)' },
  { value: 'coin', label: 'Gold Coin (Syiling)' },
  { value: 'other', label: 'Other (Lain-lain)' },
]

// Purity options with prices (per gram)
const purityOptions = [
  { value: '999', label: '999 (24K)', priceKey: 'price999' },
  { value: '916', label: '916 (22K)', priceKey: 'price916' },
  { value: '875', label: '875 (21K)', priceKey: 'price875' },
  { value: '750', label: '750 (18K)', priceKey: 'price750' },
]

// Percentage presets
const percentagePresets = [80, 70, 60]

// Empty item template
const emptyItem = {
  id: '',
  category: '',
  description: '',
  weight: '',
  purity: '916',
  pricePerGram: '', // Custom price per gram (if empty, uses market price)
  stoneDeduction: '',
  stoneDeductionType: 'amount',
  photo: null,
}

export default function NewPledge() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { selectedCustomer, customers } = useAppSelector((state) => state.customers)
  const { goldPrice } = useAppSelector((state) => state.ui)

  // Refs
  const signatureCanvasRef = useRef(null)
  const photoInputRefs = useRef({})

  // Step state
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Customer state
  const [icSearch, setIcSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [customerSearchResult, setCustomerSearchResult] = useState(null)

  // Step 2: Items state
  const [items, setItems] = useState([{ ...emptyItem, id: 'item-1' }])

  // Step 3: Valuation state
  const [loanPercentage, setLoanPercentage] = useState(70)
  const [customPercentage, setCustomPercentage] = useState('')
  const [useCustomPercentage, setUseCustomPercentage] = useState(false)

  // Step 4: Payout state
  const [payoutMethod, setPayoutMethod] = useState('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [referenceNo, setReferenceNo] = useState('')

  // Step 5: Signature state
  const [signature, setSignature] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // General state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdPledgeId, setCreatedPledgeId] = useState(null)

  // Load customers on mount
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    dispatch(setCustomers(storedCustomers))

    // If customer was pre-selected from CustomerDetail
    if (selectedCustomer) {
      setCustomer(selectedCustomer)
      setIcSearch(selectedCustomer.icNumber)
    }
  }, [dispatch, selectedCustomer])

  // Initialize signature canvas when step 5 is reached
  useEffect(() => {
    if (currentStep === 5) {
      setTimeout(() => {
        initSignatureCanvas()
      }, 100)
    }
  }, [currentStep])

  // Get market price for a purity
  const getMarketPrice = (purity) => {
    const purityOption = purityOptions.find(p => p.value === purity)
    return goldPrice[purityOption?.priceKey] || goldPrice.price916
  }

  // Calculate totals
  const calculateItemValue = (item) => {
    if (!item.weight || !item.purity) return { gross: 0, deduction: 0, net: 0, priceUsed: 0 }

    const weight = parseFloat(item.weight) || 0
    const marketPrice = getMarketPrice(item.purity)
    // Use custom price if set, otherwise use market price
    const pricePerGram = item.pricePerGram ? parseFloat(item.pricePerGram) : marketPrice

    const grossValue = weight * pricePerGram

    let deduction = 0
    if (item.stoneDeduction) {
      const deductionValue = parseFloat(item.stoneDeduction) || 0
      if (item.stoneDeductionType === 'percent') {
        deduction = grossValue * (deductionValue / 100)
      } else {
        deduction = deductionValue
      }
    }

    const netValue = Math.max(0, grossValue - deduction)
    return { gross: grossValue, deduction, net: netValue, priceUsed: pricePerGram }
  }

  const totals = items.reduce((acc, item) => {
    const { gross, deduction, net } = calculateItemValue(item)
    return {
      grossValue: acc.grossValue + gross,
      totalDeduction: acc.totalDeduction + deduction,
      netValue: acc.netValue + net,
      totalWeight: acc.totalWeight + (parseFloat(item.weight) || 0),
    }
  }, { grossValue: 0, totalDeduction: 0, netValue: 0, totalWeight: 0 })

  const effectivePercentage = useCustomPercentage ? (parseFloat(customPercentage) || 0) : loanPercentage
  const loanAmount = totals.netValue * (effectivePercentage / 100)

  // Customer search handler
  const handleCustomerSearch = () => {
    const cleanIC = icSearch.replace(/[-\s]/g, '')

    if (!cleanIC) {
      dispatch(addToast({ type: 'warning', title: 'Required', message: 'Please enter IC number' }))
      return
    }

    if (!validateIC(cleanIC)) {
      dispatch(addToast({ type: 'error', title: 'Invalid IC', message: 'Please enter valid 12-digit IC' }))
      return
    }

    setIsSearching(true)

    setTimeout(() => {
      const found = customers.find(c => c.icNumber.replace(/[-\s]/g, '') === cleanIC)
      setCustomerSearchResult(found || 'not_found')
      if (found) {
        setCustomer(found)
        dispatch(addToast({ type: 'success', title: 'Found', message: `Customer: ${found.name}` }))
      }
      setIsSearching(false)
    }, 500)
  }

  // Item handlers
  const addItem = () => {
    const newItem = { ...emptyItem, id: `item-${Date.now()}` }
    setItems([...items, newItem])
  }

  const removeItem = (id) => {
    if (items.length === 1) {
      dispatch(addToast({ type: 'warning', title: 'Required', message: 'At least one item is required' }))
      return
    }
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id, field, value) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleItemPhoto = (e, itemId) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      dispatch(addToast({ type: 'error', title: 'Invalid', message: 'Please upload an image' }))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      updateItem(itemId, 'photo', reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Payout auto-calculate
  useEffect(() => {
    if (payoutMethod === 'cash') {
      setCashAmount(loanAmount.toFixed(2))
      setTransferAmount('')
    } else if (payoutMethod === 'transfer') {
      setTransferAmount(loanAmount.toFixed(2))
      setCashAmount('')
    }
  }, [payoutMethod, loanAmount])

  // Signature canvas handlers
  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  const startDrawing = (e) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      const canvas = signatureCanvasRef.current
      if (canvas) {
        setSignature(canvas.toDataURL())
      }
    }
  }

  const clearSignature = () => {
    setSignature(null)
    initSignatureCanvas()
  }

  // Navigation validation
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!customer) {
          dispatch(addToast({ type: 'error', title: 'Required', message: 'Please select a customer' }))
          return false
        }
        return true
      case 2:
        const validItems = items.filter(item =>
          item.category && item.weight && parseFloat(item.weight) > 0
        )
        if (validItems.length === 0) {
          dispatch(addToast({ type: 'error', title: 'Required', message: 'Please add at least one item with category and weight' }))
          return false
        }
        return true
      case 3:
        if (effectivePercentage <= 0 || effectivePercentage > 100) {
          dispatch(addToast({ type: 'error', title: 'Invalid', message: 'Loan percentage must be between 1-100%' }))
          return false
        }
        return true
      case 4:
        if (payoutMethod === 'partial') {
          const cash = parseFloat(cashAmount) || 0
          const transfer = parseFloat(transferAmount) || 0
          if (Math.abs((cash + transfer) - loanAmount) > 0.01) {
            dispatch(addToast({ type: 'error', title: 'Mismatch', message: 'Cash + Transfer must equal loan amount' }))
            return false
          }
          if (transfer > 0 && (!bankName || !accountNumber)) {
            dispatch(addToast({ type: 'error', title: 'Required', message: 'Bank details required for transfer' }))
            return false
          }
        }
        if (payoutMethod === 'transfer' && (!bankName || !accountNumber)) {
          dispatch(addToast({ type: 'error', title: 'Required', message: 'Bank details required for transfer' }))
          return false
        }
        return true
      case 5:
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Submit pledge
  const handleSubmit = () => {
    if (!signature) {
      dispatch(addToast({ type: 'error', title: 'Required', message: 'Customer signature is required' }))
      return
    }

    if (!agreedToTerms) {
      dispatch(addToast({ type: 'error', title: 'Required', message: 'Please agree to terms and conditions' }))
      return
    }

    setIsSubmitting(true)

    setTimeout(() => {
      const existingPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
      const pledgeNumber = String(existingPledges.length + 1).padStart(4, '0')
      const pledgeId = `PLG-${new Date().getFullYear()}-${pledgeNumber}`

      const pledgeItems = items
        .filter(item => item.category && item.weight)
        .map((item, index) => {
          const { gross, deduction, net } = calculateItemValue(item)
          return {
            ...item,
            barcode: `${pledgeId}-${String(index + 1).padStart(2, '0')}`,
            grossValue: gross,
            deduction,
            netValue: net,
          }
        })

      const newPledge = {
        id: pledgeId,
        customerId: customer.id,
        customerName: customer.name,
        customerIC: customer.icNumber,
        customerPhone: customer.phone,
        items: pledgeItems,
        totalWeight: totals.totalWeight,
        grossValue: totals.grossValue,
        totalDeduction: totals.totalDeduction,
        netValue: totals.netValue,
        loanPercentage: effectivePercentage,
        loanAmount,
        payoutMethod,
        cashAmount: parseFloat(cashAmount) || 0,
        transferAmount: parseFloat(transferAmount) || 0,
        bankName,
        accountNumber,
        referenceNo,
        goldPriceUsed: { ...goldPrice },
        signature,
        status: 'active',
        rackLocation: null,
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        renewals: [],
        interestRate: 0.5,
      }

      const updatedPledges = [...existingPledges, newPledge]
      setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
      dispatch(setPledges(updatedPledges))

      const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
      const updatedCustomers = storedCustomers.map(c => {
        if (c.id === customer.id) {
          return {
            ...c,
            activePledges: (c.activePledges || 0) + 1,
            totalPledges: (c.totalPledges || 0) + 1,
            totalAmount: (c.totalAmount || 0) + loanAmount,
            lastVisit: new Date().toISOString().split('T')[0],
          }
        }
        return c
      })
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedCustomers)
      dispatch(setCustomers(updatedCustomers))
      dispatch(setSelectedCustomer(null))

      setCreatedPledgeId(pledgeId)
      setIsSubmitting(false)
      setShowSuccessModal(true)
    }, 1000)
  }

  // Animation variants
  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  }

  return (
    <PageWrapper
      title="New Pledge"
      subtitle="Create a new pledge transaction"
      actions={
        <Button variant="outline" leftIcon={ArrowLeft} onClick={() => navigate('/pledges')}>
          Cancel
        </Button>
      }
    >
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex items-center">
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <motion.div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                      isActive && 'border-amber-500 bg-amber-50 text-amber-600',
                      isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                      !isActive && !isCompleted && 'border-zinc-300 bg-white text-zinc-400'
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </motion.div>
                  <div className="mt-2 text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      isActive && 'text-amber-600',
                      isCompleted && 'text-emerald-600',
                      !isActive && !isCompleted && 'text-zinc-400'
                    )}>
                      {step.title}
                    </p>
                    <p className="text-xs text-zinc-500 hidden sm:block">{step.description}</p>
                  </div>
                </motion.div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'w-12 lg:w-20 h-0.5 mx-2',
                    isCompleted ? 'bg-emerald-500' : 'bg-zinc-200'
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Step 1: Customer Selection */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">Customer Information</h3>
                  <p className="text-sm text-zinc-500">Search by IC or select existing customer</p>
                </div>
              </div>

              {/* IC Search */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Enter IC Number (e.g., 880515-14-5678)"
                    value={icSearch}
                    onChange={(e) => setIcSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomerSearch()}
                    leftIcon={CreditCard}
                  />
                </div>
                <Button
                  variant="primary"
                  leftIcon={Search}
                  onClick={handleCustomerSearch}
                  loading={isSearching}
                >
                  Search
                </Button>
              </div>

              {/* Selected Customer Display */}
              <AnimatePresence>
                {customer && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-800">{customer.name}</h4>
                          <Badge variant="success">Selected</Badge>
                        </div>
                        <p className="text-sm text-zinc-500 font-mono">{formatIC(customer.icNumber)}</p>
                        <p className="text-sm text-zinc-500">{formatPhone(customer.phone)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-500">Active Pledges</p>
                        <p className="text-xl font-bold text-zinc-800">{customer.activePledges || 0}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setCustomer(null)
                          setCustomerSearchResult(null)
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {customerSearchResult === 'not_found' && !customer && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-800">Customer not found</p>
                        <p className="text-sm text-amber-600">IC {formatIC(icSearch)} is not registered</p>
                      </div>
                      <Button
                        variant="accent"
                        size="sm"
                        leftIcon={Plus}
                        onClick={() => navigate(`/customers/new?ic=${icSearch.replace(/[-\s]/g, '')}`)}
                      >
                        Create New
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Step 2: Items Entry */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-800">Pledge Items</h3>
                    <p className="text-sm text-zinc-500">Add gold items for this pledge</p>
                  </div>
                </div>
                <Button variant="outline" leftIcon={Plus} onClick={addItem}>
                  Add Item
                </Button>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-zinc-200 rounded-xl bg-zinc-50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-zinc-700">Item #{index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Select
                        label="Category"
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        options={[{ value: '', label: 'Select...' }, ...itemCategories]}
                        required
                      />
                      <Select
                        label="Purity"
                        value={item.purity}
                        onChange={(e) => {
                          updateItem(item.id, 'purity', e.target.value)
                          // Reset custom price when purity changes
                          updateItem(item.id, 'pricePerGram', '')
                        }}
                        options={purityOptions}
                      />
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Price/g (RM) <span className="text-amber-500">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={getMarketPrice(item.purity).toFixed(2)}
                            value={item.pricePerGram}
                            onChange={(e) => updateItem(item.id, 'pricePerGram', e.target.value)}
                            leftIcon={DollarSign}
                          />
                          {!item.pricePerGram && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Market
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Market: RM {getMarketPrice(item.purity).toFixed(2)}
                        </p>
                      </div>
                      <Input
                        label="Weight (g)"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.weight}
                        onChange={(e) => updateItem(item.id, 'weight', e.target.value)}
                        leftIcon={Scale}
                        required
                      />
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Stone Deduction
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.stoneDeduction}
                            onChange={(e) => updateItem(item.id, 'stoneDeduction', e.target.value)}
                            className="flex-1"
                          />
                          <Select
                            value={item.stoneDeductionType}
                            onChange={(e) => updateItem(item.id, 'stoneDeductionType', e.target.value)}
                            options={[
                              { value: 'amount', label: 'RM' },
                              { value: 'percent', label: '%' },
                            ]}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <Input
                        label="Description / Remarks"
                        placeholder="e.g., 916 Gold Chain with pendant"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Item Photo
                        </label>
                        <input
                          ref={(el) => photoInputRefs.current[item.id] = el}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleItemPhoto(e, item.id)}
                          className="hidden"
                        />
                        {item.photo ? (
                          <div className="relative inline-block">
                            <img
                              src={item.photo}
                              alt="Item"
                              className="w-20 h-20 object-cover rounded-lg border border-zinc-200"
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, 'photo', null)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon={Camera}
                            onClick={() => photoInputRefs.current[item.id]?.click()}
                          >
                            Upload Photo
                          </Button>
                        )}
                      </div>
                    </div>

                    {item.weight && item.category && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 bg-white rounded-lg p-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-zinc-500 block">Price Used</span>
                            <span className="font-semibold text-zinc-800">
                              RM {calculateItemValue(item).priceUsed.toFixed(2)}/g
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Gross Value</span>
                            <span className="font-semibold text-zinc-800">
                              {formatCurrency(calculateItemValue(item).gross)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Deduction</span>
                            <span className="font-semibold text-red-600">
                              - {formatCurrency(calculateItemValue(item).deduction)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Net Value</span>
                            <span className="font-bold text-emerald-600 text-lg">
                              {formatCurrency(calculateItemValue(item).net)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-amber-700">Total Items</p>
                    <p className="text-xl font-bold text-zinc-800">{items.filter(i => i.category && i.weight).length}</p>
                  </div>
                  <div>
                    <p className="text-amber-700">Total Weight</p>
                    <p className="text-xl font-bold text-zinc-800">{totals.totalWeight.toFixed(2)}g</p>
                  </div>
                  <div>
                    <p className="text-amber-700">Gross Value</p>
                    <p className="text-xl font-bold text-zinc-800">{formatCurrency(totals.grossValue)}</p>
                  </div>
                  <div>
                    <p className="text-amber-700">Net Value</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.netValue)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Valuation */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">Valuation & Loan Amount</h3>
                  <p className="text-sm text-zinc-500">Review calculation and set loan percentage</p>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden mb-6">
                <div className="bg-zinc-800 text-white px-4 py-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Items Breakdown
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">#</th>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">Item</th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">Purity</th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">Weight</th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">Price/g</th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">Gross</th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">Deduction</th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">Net Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.filter(i => i.category && i.weight).map((item, idx) => {
                        const calc = calculateItemValue(item)
                        const category = itemCategories.find(c => c.value === item.category)
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50">
                            <td className="px-4 py-3 text-zinc-500">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium">{category?.label || item.category}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                {item.purity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">{parseFloat(item.weight).toFixed(2)}g</td>
                            <td className="px-4 py-3 text-right">RM {calc.priceUsed.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(calc.gross)}</td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {calc.deduction > 0 ? `- ${formatCurrency(calc.deduction)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {formatCurrency(calc.net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                      <tr>
                        <td colSpan="3" className="px-4 py-3 font-bold text-zinc-800">TOTAL</td>
                        <td className="px-4 py-3 text-right font-bold">{totals.totalWeight.toFixed(2)}g</td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(totals.grossValue)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {totals.totalDeduction > 0 ? `- ${formatCurrency(totals.totalDeduction)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 text-lg">
                          {formatCurrency(totals.netValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Loan Percentage Selection */}
              <div className="border border-zinc-200 rounded-xl p-4 mb-6">
                <label className="block text-sm font-semibold text-zinc-700 mb-3">
                  Select Loan Percentage (Margin)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {percentagePresets.map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => {
                        setLoanPercentage(percent)
                        setUseCustomPercentage(false)
                      }}
                      className={cn(
                        'px-6 py-3 rounded-lg font-bold transition-all text-lg',
                        !useCustomPercentage && loanPercentage === percent
                          ? 'bg-amber-500 text-white shadow-lg'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      )}
                    >
                      {percent}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUseCustomPercentage(true)}
                    className={cn(
                      'px-6 py-3 rounded-lg font-bold transition-all',
                      useCustomPercentage
                        ? 'bg-amber-500 text-white shadow-lg'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    )}
                  >
                    Custom
                  </button>
                </div>

                {useCustomPercentage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Enter %"
                      value={customPercentage}
                      onChange={(e) => setCustomPercentage(e.target.value)}
                      className="w-32"
                    />
                    <span className="text-zinc-500">%</span>
                  </motion.div>
                )}
              </div>

              {/* Loan Calculation Summary */}
              <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-white rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  Loan Calculation
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-700">
                    <span className="text-zinc-400">Total Net Value (A)</span>
                    <span className="font-semibold text-lg">{formatCurrency(totals.netValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-700">
                    <span className="text-zinc-400">Loan Percentage (B)</span>
                    <span className="font-semibold text-lg">{effectivePercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-700">
                    <span className="text-zinc-400">Calculation (A × B)</span>
                    <span className="text-zinc-300">
                      {formatCurrency(totals.netValue)} × {effectivePercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-4 bg-amber-500/20 -mx-6 px-6 rounded-lg">
                    <span className="text-amber-400 font-semibold text-lg">LOAN AMOUNT</span>
                    <span className="text-3xl font-bold text-amber-400">{formatCurrency(loanAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Interest & Repayment Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Interest Rates */}
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Interest Rates
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-white rounded-lg">
                      <span className="text-zinc-600">First 6 months</span>
                      <span className="font-bold text-blue-600">0.5% / month</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded-lg">
                      <span className="text-zinc-600">After 6 months (renewed)</span>
                      <span className="font-bold text-amber-600">1.5% / month</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded-lg">
                      <span className="text-zinc-600">Overdue (not renewed)</span>
                      <span className="font-bold text-red-600">2.0% / month</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Interest Examples */}
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                  <h5 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Monthly Interest (First 6 Months)
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-white rounded-lg">
                      <span className="text-zinc-600">Loan Amount</span>
                      <span className="font-semibold">{formatCurrency(loanAmount)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded-lg">
                      <span className="text-zinc-600">Monthly Interest (0.5%)</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(loanAmount * 0.005)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-amber-100 rounded-lg border border-amber-200">
                      <span className="text-amber-800 font-medium">6 Months Total Interest</span>
                      <span className="font-bold text-amber-700">
                        {formatCurrency(loanAmount * 0.005 * 6)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Redemption Estimate */}
              <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4">
                <h5 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Redemption Estimate (If Redeemed Within 6 Months)
                </h5>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-zinc-500 mb-1">After 1 Month</p>
                    <p className="font-bold text-amber-700">
                      {formatCurrency(loanAmount + (loanAmount * 0.005 * 1))}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-zinc-500 mb-1">After 3 Months</p>
                    <p className="font-bold text-amber-700">
                      {formatCurrency(loanAmount + (loanAmount * 0.005 * 3))}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-zinc-500 mb-1">After 6 Months</p>
                    <p className="font-bold text-amber-700">
                      {formatCurrency(loanAmount + (loanAmount * 0.005 * 6))}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-3 text-center">
                  * Redemption Amount = Loan + Interest. Grace period of 7 days after due date.
                </p>
              </div>

              {/* Due Date Info */}
              <div className="mt-4 p-4 bg-zinc-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Loan Period</p>
                    <p className="text-xs text-zinc-500">Standard 6 months tenure</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-500">Due Date</p>
                  <p className="font-bold text-zinc-800">
                    {new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-MY', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Payout */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">Payout Method</h3>
                  <p className="text-sm text-zinc-500">Select how to pay the customer</p>
                </div>
              </div>

              {/* Loan Amount Display */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 font-medium">Total Payout Amount</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(loanAmount)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 mb-3">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'cash', label: 'Full Cash', icon: Wallet },
                    { value: 'transfer', label: 'Full Transfer', icon: Building2 },
                    { value: 'partial', label: 'Partial', icon: RefreshCw },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPayoutMethod(method.value)}
                      className={cn(
                        'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                        payoutMethod === method.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <method.icon className={cn(
                        'w-6 h-6',
                        payoutMethod === method.value ? 'text-amber-600' : 'text-zinc-400'
                      )} />
                      <span className={cn(
                        'font-medium',
                        payoutMethod === method.value ? 'text-amber-600' : 'text-zinc-600'
                      )}>
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                {(payoutMethod === 'cash' || payoutMethod === 'partial') && (
                  <Input
                    label="Cash Amount (RM)"
                    type="number"
                    step="0.01"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    disabled={payoutMethod === 'cash'}
                    leftIcon={Wallet}
                  />
                )}

                {(payoutMethod === 'transfer' || payoutMethod === 'partial') && (
                  <>
                    <Input
                      label="Transfer Amount (RM)"
                      type="number"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      disabled={payoutMethod === 'transfer'}
                      leftIcon={Building2}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Bank Name"
                        placeholder="e.g., Maybank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required
                      />
                      <Input
                        label="Account Number"
                        placeholder="Enter account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        required
                      />
                    </div>

                    <Input
                      label="Reference Number (Optional)"
                      placeholder="Transaction reference"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                    />
                  </>
                )}
              </div>

              {payoutMethod === 'partial' && (
                <div className="mt-4 p-3 bg-zinc-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Cash + Transfer</span>
                    <span className={cn(
                      'font-medium',
                      Math.abs((parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0) - loanAmount) < 0.01
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    )}>
                      {formatCurrency((parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0))}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 5: Confirm & Sign */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileSignature className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">Review & Confirm</h3>
                  <p className="text-sm text-zinc-500">Review details and capture signature</p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-zinc-50 rounded-xl">
                  <h4 className="font-semibold text-zinc-800 mb-3">Customer</h4>
                  <p className="font-medium text-zinc-800">{customer?.name}</p>
                  <p className="text-sm text-zinc-500">{customer && formatIC(customer.icNumber)}</p>
                  <p className="text-sm text-zinc-500">{customer && formatPhone(customer.phone)}</p>
                </div>

                <div className="p-4 bg-zinc-50 rounded-xl">
                  <h4 className="font-semibold text-zinc-800 mb-3">Items</h4>
                  <p className="text-zinc-600">{items.filter(i => i.category).length} item(s)</p>
                  <p className="text-sm text-zinc-500">Total Weight: {totals.totalWeight.toFixed(2)}g</p>
                  <p className="text-sm text-zinc-500">Net Value: {formatCurrency(totals.netValue)}</p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl">
                  <h4 className="font-semibold text-emerald-800 mb-3">Loan Details</h4>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(loanAmount)}</p>
                  <p className="text-sm text-emerald-600">@ {effectivePercentage}% of net value</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-3">Payout</h4>
                  <p className="text-zinc-600 capitalize">{payoutMethod}</p>
                  {(parseFloat(cashAmount) || 0) > 0 && (
                    <p className="text-sm text-zinc-500">Cash: {formatCurrency(parseFloat(cashAmount))}</p>
                  )}
                  {(parseFloat(transferAmount) || 0) > 0 && (
                    <p className="text-sm text-zinc-500">Transfer: {formatCurrency(parseFloat(transferAmount))}</p>
                  )}
                </div>
              </div>

              {/* Signature Pad */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-zinc-700">
                    Customer Signature <span className="text-red-500">*</span>
                  </label>
                  {signature && (
                    <Button variant="ghost" size="sm" onClick={clearSignature}>
                      Clear Signature
                    </Button>
                  )}
                </div>
                <div className="border-2 border-dashed border-zinc-300 rounded-xl p-2 bg-white">
                  <canvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={150}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">Sign above using mouse or touch</p>
              </div>

              {/* Terms Agreement */}
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-zinc-600">
                    I confirm that all information is correct and agree to the terms and conditions of this pledge transaction.
                  </span>
                </label>
              </div>

              {/* Due Date Info */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">
                      Due Date: {new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-amber-600">6 months from today. Interest at 0.5% per month.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between p-6 border-t border-zinc-200">
          <Button
            variant="outline"
            leftIcon={ArrowLeft}
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          {currentStep < 5 ? (
            <Button variant="accent" rightIcon={ArrowRight} onClick={handleNext}>
              Next Step
            </Button>
          ) : (
            <Button
              variant="success"
              leftIcon={Check}
              onClick={handleSubmit}
              loading={isSubmitting}
            >
              Create Pledge
            </Button>
          )}
        </div>
      </Card>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {}}
        title="Pledge Created Successfully!"
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

          <h3 className="text-xl font-bold text-zinc-800 mb-2">Pledge Created!</h3>
          <p className="text-zinc-500 mb-4">
            Pledge ID: <span className="font-mono font-bold text-zinc-800">{createdPledgeId}</span>
          </p>

          <div className="p-4 bg-zinc-50 rounded-xl mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Customer</p>
                <p className="font-medium text-zinc-800">{customer?.name}</p>
              </div>
              <div>
                <p className="text-zinc-500">Loan Amount</p>
                <p className="font-medium text-emerald-600">{formatCurrency(loanAmount)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              leftIcon={Printer}
              onClick={() => {
                dispatch(addToast({ type: 'info', title: 'Print', message: 'Opening print dialog...' }))
              }}
            >
              Print Receipt
            </Button>
            <Button
              variant="outline"
              fullWidth
              leftIcon={MessageSquare}
              onClick={() => {
                dispatch(addToast({ type: 'info', title: 'WhatsApp', message: 'Sending to customer...' }))
              }}
            >
              Send WhatsApp
            </Button>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(`/pledges/${createdPledgeId}`)}
            >
              View Pledge
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={() => {
                setShowSuccessModal(false)
                setCurrentStep(1)
                setCustomer(null)
                setIcSearch('')
                setCustomerSearchResult(null)
                setItems([{ ...emptyItem, id: 'item-1' }])
                setSignature(null)
                setAgreedToTerms(false)
              }}
            >
              New Pledge
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}