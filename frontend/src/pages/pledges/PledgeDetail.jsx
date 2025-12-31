import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges, setSelectedPledge } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate, formatIC, formatPhone } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Badge, Modal, Input } from '@/components/common'
import {
  ArrowLeft,
  User,
  Package,
  Calendar,
  Clock,
  DollarSign,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Printer,
  MessageSquare,
  MapPin,
  Scale,
  Gem,
  CreditCard,
  Phone,
  FileText,
  Eye,
  Download,
  Trash2,
  Edit,
  QrCode,
  Image,
  X,
  Wallet,
  Building2,
  TrendingUp,
  History,
  AlertCircle,
  Info,
} from 'lucide-react'

// Status config
const statusConfig = {
  active: { label: 'Active', color: 'emerald', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'red', icon: AlertTriangle },
  redeemed: { label: 'Redeemed', color: 'blue', icon: DollarSign },
  forfeited: { label: 'Forfeited', color: 'amber', icon: XCircle },
  auctioned: { label: 'Auctioned', color: 'zinc', icon: Package },
}

// Tabs
const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'history', label: 'History', icon: History },
]

export default function PledgeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // State
  const [pledge, setPledge] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [showRackModal, setShowRackModal] = useState(false)
  const [rackLocation, setRackLocation] = useState('')

  // Load pledge on mount
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    const found = storedPledges.find(p => p.id === id)

    if (found) {
      // Check if overdue
      const now = new Date()
      if (found.status === 'active' && new Date(found.dueDate) < now) {
        found.status = 'overdue'
      }
      setPledge(found)
      setRackLocation(found.rackLocation || '')
    }
  }, [id])

  // Calculate interest
  const calculateInterest = () => {
    if (!pledge) return { months: 0, rate: 0, amount: 0, total: 0 }

    const createdDate = new Date(pledge.createdAt)
    const now = new Date()
    const months = Math.max(1, Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24 * 30)))

    // Interest calculation based on tenure
    let totalInterest = 0
    for (let i = 1; i <= months; i++) {
      const rate = i <= 6 ? 0.5 : 1.5 // 0.5% first 6 months, 1.5% after
      totalInterest += pledge.loanAmount * (rate / 100)
    }

    const currentRate = months <= 6 ? 0.5 : 1.5
    const totalDue = pledge.loanAmount + totalInterest

    return { months, rate: currentRate, amount: totalInterest, total: totalDue }
  }

  const interest = calculateInterest()

  // Days until due
  const getDaysUntilDue = () => {
    if (!pledge) return 0
    const now = new Date()
    const due = new Date(pledge.dueDate)
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  }

  const daysUntilDue = getDaysUntilDue()

  // Save rack location
  const handleSaveRack = () => {
    if (!pledge) return

    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    const updatedPledges = storedPledges.map(p =>
      p.id === id ? { ...p, rackLocation } : p
    )
    setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
    dispatch(setPledges(updatedPledges))
    setPledge({ ...pledge, rackLocation })
    setShowRackModal(false)

    dispatch(addToast({
      type: 'success',
      title: 'Saved',
      message: `Rack location updated to ${rackLocation}`,
    }))
  }

  // Action handlers
  const handleRenewal = () => {
    dispatch(setSelectedPledge(pledge))
    navigate('/renewals')
  }

  const handleRedemption = () => {
    dispatch(setSelectedPledge(pledge))
    navigate('/redemptions')
  }

  const handlePrint = () => {
    dispatch(addToast({ type: 'info', title: 'Print', message: 'Opening print dialog...' }))
  }

  const handleWhatsApp = () => {
    if (!pledge?.customerPhone) {
      dispatch(addToast({ type: 'warning', title: 'No Phone', message: 'Customer phone not available' }))
      return
    }
    const message = `Hi ${pledge?.customerName}, your pledge ${pledge?.id} is due on ${formatDate(pledge?.dueDate)}. Total amount due: ${formatCurrency(interest.total)}`
    window.open(`https://wa.me/${pledge?.customerPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank')
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

  // Not found state
  if (!pledge) {
    return (
      <PageWrapper title="Pledge Not Found">
        <Card className="p-12 text-center">
          <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-800 mb-2">Pledge Not Found</h3>
          <p className="text-zinc-500 mb-4">The pledge you're looking for doesn't exist.</p>
          <Button variant="accent" onClick={() => navigate('/pledges')}>
            Back to Pledges
          </Button>
        </Card>
      </PageWrapper>
    )
  }

  const status = statusConfig[pledge.status] || statusConfig.active
  const StatusIcon = status.icon

  return (
    <PageWrapper
      title={`Pledge: ${pledge.id}`}
      subtitle={`Created on ${formatDate(pledge.createdAt)}`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={ArrowLeft} onClick={() => navigate('/pledges')}>
            Back
          </Button>
          <Button variant="outline" leftIcon={Printer} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outline" leftIcon={MessageSquare} onClick={handleWhatsApp}>
            WhatsApp
          </Button>
        </div>
      }
    >
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Banner */}
          <motion.div variants={itemVariants}>
            <Card className={cn(
              'p-4 border-l-4',
              status.color === 'emerald' && 'border-l-emerald-500 bg-emerald-50',
              status.color === 'red' && 'border-l-red-500 bg-red-50',
              status.color === 'blue' && 'border-l-blue-500 bg-blue-50',
              status.color === 'amber' && 'border-l-amber-500 bg-amber-50',
              status.color === 'zinc' && 'border-l-zinc-500 bg-zinc-50',
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className={cn(
                    'w-6 h-6',
                    status.color === 'emerald' && 'text-emerald-600',
                    status.color === 'red' && 'text-red-600',
                    status.color === 'blue' && 'text-blue-600',
                    status.color === 'amber' && 'text-amber-600',
                    status.color === 'zinc' && 'text-zinc-600',
                  )} />
                  <div>
                    <p className="font-semibold text-zinc-800">{status.label}</p>
                    {(pledge.status === 'active' || pledge.status === 'overdue') && (
                      <p className="text-sm text-zinc-600">
                        {daysUntilDue > 0
                          ? `Due in ${daysUntilDue} days (${formatDate(pledge.dueDate)})`
                          : daysUntilDue === 0
                            ? 'Due today!'
                            : `Overdue by ${Math.abs(daysUntilDue)} days`
                        }
                      </p>
                    )}
                  </div>
                </div>
                {(pledge.status === 'active' || pledge.status === 'overdue') && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" leftIcon={RefreshCw} onClick={handleRenewal}>
                      Renew
                    </Button>
                    <Button variant="success" size="sm" leftIcon={DollarSign} onClick={handleRedemption}>
                      Redeem
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={itemVariants}>
            <Card>
              {/* Tab Headers */}
              <div className="flex border-b border-zinc-200">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                        activeTab === tab.id
                          ? 'border-amber-500 text-amber-600'
                          : 'border-transparent text-zinc-500 hover:text-zinc-700'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-5"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      {/* Customer Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Customer</h4>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                            {pledge.customerName?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-800">{pledge.customerName}</p>
                            <p className="text-sm text-zinc-500 font-mono">{formatIC(pledge.customerIC)}</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-zinc-600">
                            <Phone className="w-4 h-4 text-zinc-400" />
                            {pledge.customerPhone ? formatPhone(pledge.customerPhone) : 'N/A'}
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0"
                            onClick={() => navigate(`/customers/${pledge.customerId}`)}
                          >
                            View Customer Profile →
                          </Button>
                        </div>
                      </div>

                      {/* Loan Summary */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Loan Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Principal</span>
                            <span className="font-medium">{formatCurrency(pledge.loanAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Interest ({interest.months} mo @ {interest.rate}%)</span>
                            <span className="font-medium text-amber-600">{formatCurrency(interest.amount)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-zinc-200">
                            <span className="text-zinc-800 font-semibold">Total Due</span>
                            <span className="text-lg font-bold text-emerald-600">{formatCurrency(interest.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Payout Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Payout Method</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {pledge.payoutMethod === 'cash' && <Wallet className="w-4 h-4 text-emerald-500" />}
                            {pledge.payoutMethod === 'transfer' && <Building2 className="w-4 h-4 text-blue-500" />}
                            {pledge.payoutMethod === 'partial' && <RefreshCw className="w-4 h-4 text-amber-500" />}
                            <span className="capitalize font-medium">{pledge.payoutMethod}</span>
                          </div>
                          {(pledge.cashAmount > 0) && (
                            <p className="text-zinc-500">Cash: {formatCurrency(pledge.cashAmount)}</p>
                          )}
                          {(pledge.transferAmount > 0) && (
                            <div className="text-zinc-500">
                              <p>Transfer: {formatCurrency(pledge.transferAmount)}</p>
                              {pledge.bankName && <p>Bank: {pledge.bankName}</p>}
                              {pledge.accountNumber && <p>A/C: {pledge.accountNumber}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gold Price Used */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Gold Price (at time)</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 bg-zinc-50 rounded">
                            <p className="text-xs text-zinc-500">999 (24K)</p>
                            <p className="font-medium">{formatCurrency(pledge.goldPriceUsed?.price999)}</p>
                          </div>
                          <div className="p-2 bg-zinc-50 rounded">
                            <p className="text-xs text-zinc-500">916 (22K)</p>
                            <p className="font-medium">{formatCurrency(pledge.goldPriceUsed?.price916)}</p>
                          </div>
                          <div className="p-2 bg-zinc-50 rounded">
                            <p className="text-xs text-zinc-500">875 (21K)</p>
                            <p className="font-medium">{formatCurrency(pledge.goldPriceUsed?.price875)}</p>
                          </div>
                          <div className="p-2 bg-zinc-50 rounded">
                            <p className="text-xs text-zinc-500">750 (18K)</p>
                            <p className="font-medium">{formatCurrency(pledge.goldPriceUsed?.price750)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signature */}
                    {pledge.signature && (
                      <div className="mt-6 pt-6 border-t border-zinc-200">
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase mb-3">Customer Signature</h4>
                        <img
                          src={pledge.signature}
                          alt="Signature"
                          className="h-20 border border-zinc-200 rounded-lg bg-white"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Items Tab */}
                {activeTab === 'items' && (
                  <motion.div
                    key="items"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-5"
                  >
                    <div className="space-y-4">
                      {pledge.items?.map((item, index) => (
                        <div
                          key={item.barcode || index}
                          className="p-4 border border-zinc-200 rounded-xl hover:border-amber-300 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            {/* Item Photo */}
                            {item.photo ? (
                              <img
                                src={item.photo}
                                alt={item.description}
                                className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setSelectedImage(item.photo)
                                  setShowImageModal(true)
                                }}
                              />
                            ) : (
                              <div className="w-20 h-20 bg-zinc-100 rounded-lg flex items-center justify-center">
                                <Package className="w-8 h-8 text-zinc-300" />
                              </div>
                            )}

                            {/* Item Details */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{item.purity} Gold</Badge>
                                  <span className="text-sm text-zinc-500 capitalize">{item.category}</span>
                                </div>
                                <span className="font-mono text-xs text-zinc-400">{item.barcode}</span>
                              </div>

                              <p className="text-zinc-800 font-medium mb-2">
                                {item.description || `${item.category} - ${item.purity} Gold`}
                              </p>

                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-zinc-500">Weight</p>
                                  <p className="font-medium">{parseFloat(item.weight).toFixed(2)}g</p>
                                </div>
                                <div>
                                  <p className="text-zinc-500">Gross Value</p>
                                  <p className="font-medium">{formatCurrency(item.grossValue)}</p>
                                </div>
                                <div>
                                  <p className="text-zinc-500">Deduction</p>
                                  <p className="font-medium text-red-500">-{formatCurrency(item.deduction)}</p>
                                </div>
                                <div>
                                  <p className="text-zinc-500">Net Value</p>
                                  <p className="font-semibold text-emerald-600">{formatCurrency(item.netValue)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Items Summary */}
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-amber-700">Total Items</p>
                          <p className="text-xl font-bold text-zinc-800">{pledge.items?.length}</p>
                        </div>
                        <div>
                          <p className="text-amber-700">Total Weight</p>
                          <p className="text-xl font-bold text-zinc-800">{pledge.totalWeight?.toFixed(2)}g</p>
                        </div>
                        <div>
                          <p className="text-amber-700">Net Value</p>
                          <p className="text-xl font-bold text-zinc-800">{formatCurrency(pledge.netValue)}</p>
                        </div>
                        <div>
                          <p className="text-amber-700">Loan @ {pledge.loanPercentage}%</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(pledge.loanAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-5"
                  >
                    <div className="space-y-4">
                      {/* Created Event */}
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 pb-4 border-b border-zinc-100">
                          <p className="font-medium text-zinc-800">Pledge Created</p>
                          <p className="text-sm text-zinc-500">{formatDate(pledge.createdAt)}</p>
                          <p className="text-sm text-zinc-600 mt-1">
                            Loan amount: {formatCurrency(pledge.loanAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Renewals */}
                      {pledge.renewals?.map((renewal, index) => (
                        <div key={index} className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <RefreshCw className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 pb-4 border-b border-zinc-100">
                            <p className="font-medium text-zinc-800">Renewal Payment</p>
                            <p className="text-sm text-zinc-500">{formatDate(renewal.date)}</p>
                            <p className="text-sm text-zinc-600 mt-1">
                              Interest paid: {formatCurrency(renewal.amount)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Redemption */}
                      {pledge.status === 'redeemed' && pledge.redeemedAt && (
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-zinc-800">Pledge Redeemed</p>
                            <p className="text-sm text-zinc-500">{formatDate(pledge.redeemedAt)}</p>
                            <p className="text-sm text-zinc-600 mt-1">
                              Total paid: {formatCurrency(pledge.redemptionAmount)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* No History */}
                      {!pledge.renewals?.length && pledge.status !== 'redeemed' && (
                        <div className="text-center py-8">
                          <History className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                          <p className="text-zinc-500">No renewal history yet</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <motion.div variants={itemVariants}>
            <Card className="p-5">
              <h3 className="font-semibold text-zinc-800 mb-4">Quick Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-600">Principal</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(pledge.loanAmount)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                    <span className="text-amber-700">Interest</span>
                  </div>
                  <span className="font-semibold text-amber-600">{formatCurrency(interest.amount)}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-700">Total Due</span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatCurrency(interest.total)}</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Rack Location */}
          <motion.div variants={itemVariants}>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-800">Storage Location</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowRackModal(true)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>

              {pledge.rackLocation ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-800">{pledge.rackLocation}</p>
                    <p className="text-xs text-blue-600">Rack / Shelf Location</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRackModal(true)}
                  className="w-full p-3 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-amber-500 hover:text-amber-600 transition-colors"
                >
                  + Assign Location
                </button>
              )}
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <Card className="p-5">
              <h3 className="font-semibold text-zinc-800 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {(pledge.status === 'active' || pledge.status === 'overdue') && (
                  <>
                    <Button variant="outline" fullWidth leftIcon={RefreshCw} onClick={handleRenewal}>
                      Process Renewal
                    </Button>
                    <Button variant="success" fullWidth leftIcon={DollarSign} onClick={handleRedemption}>
                      Process Redemption
                    </Button>
                  </>
                )}
                <Button variant="outline" fullWidth leftIcon={Printer} onClick={handlePrint}>
                  Print Ticket
                </Button>
                <Button variant="outline" fullWidth leftIcon={MessageSquare} onClick={handleWhatsApp}>
                  Send WhatsApp
                </Button>
                <Button variant="outline" fullWidth leftIcon={QrCode}>
                  Print Barcode
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Important Dates */}
          <motion.div variants={itemVariants}>
            <Card className="p-5">
              <h3 className="font-semibold text-zinc-800 mb-4">Important Dates</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-xs text-zinc-500">Created</p>
                    <p className="text-sm font-medium">{formatDate(pledge.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className={cn(
                    'w-5 h-5',
                    daysUntilDue <= 7 ? 'text-red-500' :
                      daysUntilDue <= 30 ? 'text-amber-500' :
                        'text-emerald-500'
                  )} />
                  <div>
                    <p className="text-xs text-zinc-500">Due Date</p>
                    <p className="text-sm font-medium">{formatDate(pledge.dueDate)}</p>
                    {pledge.status === 'active' && (
                      <p className={cn(
                        'text-xs',
                        daysUntilDue <= 7 ? 'text-red-500' :
                          daysUntilDue <= 30 ? 'text-amber-500' :
                            'text-emerald-500'
                      )}>
                        {daysUntilDue > 0 ? `${daysUntilDue} days remaining` : 'Due today!'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Image Modal */}
      <Modal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        title="Item Photo"
        size="lg"
      >
        <div className="p-4">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Item"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>
      </Modal>

      {/* Rack Location Modal */}
      <Modal
        isOpen={showRackModal}
        onClose={() => setShowRackModal(false)}
        title="Set Storage Location"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Rack / Shelf Location"
            placeholder="e.g., A1-S3, Rack B Row 2"
            value={rackLocation}
            onChange={(e) => setRackLocation(e.target.value)}
            leftIcon={MapPin}
          />
          <div className="flex gap-3 mt-4">
            <Button variant="outline" fullWidth onClick={() => setShowRackModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleSaveRack}>
              Save Location
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}