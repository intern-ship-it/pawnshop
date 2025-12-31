import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setCustomers, setSelectedCustomer, deleteCustomer } from '@/features/customers/customersSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatDate, formatCurrency, formatIC, formatPhone } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Badge, Modal } from '@/components/common'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  CreditCard,
  FileText,
  RefreshCw,
  Wallet,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  MessageSquare,
  History,
  Package,
  User,
  Shield,
  Image,
} from 'lucide-react'

const tabs = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'pledges', label: 'Pledges', icon: Package },
  { id: 'renewals', label: 'Renewals', icon: RefreshCw },
  { id: 'redemptions', label: 'Redemptions', icon: Wallet },
  { id: 'documents', label: 'Documents', icon: FileText },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { customers } = useAppSelector((state) => state.customers)

  const [customer, setCustomer] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Mock pledge data for this customer
  const [pledges, setPledges] = useState([])
  const [renewals, setRenewals] = useState([])
  const [redemptions, setRedemptions] = useState([])

  // Load customer data
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    dispatch(setCustomers(storedCustomers))

    const found = storedCustomers.find(c => c.id === id)
    if (found) {
      setCustomer(found)
      dispatch(setSelectedCustomer(found))

      // Generate mock history data
      generateMockHistory(found)
    }
  }, [id, dispatch])

  // Generate mock history
  const generateMockHistory = (cust) => {
    // Mock pledges
    const mockPledges = [
      {
        id: 'PLG001',
        date: '2024-12-20',
        items: '916 Gold Chain (25.5g)',
        principal: 5250,
        status: 'active',
        dueDate: '2025-06-20',
      },
      {
        id: 'PLG002',
        date: '2024-11-15',
        items: '916 Gold Bangle (18.2g)',
        principal: 3800,
        status: 'active',
        dueDate: '2025-05-15',
      },
      {
        id: 'PLG003',
        date: '2024-08-10',
        items: '999 Gold Ring (8.5g)',
        principal: 2400,
        status: 'redeemed',
        dueDate: '2025-02-10',
      },
    ]

    // Mock renewals
    const mockRenewals = [
      {
        id: 'REN001',
        pledgeId: 'PLG001',
        date: '2024-12-01',
        interest: 157.50,
        method: 'Cash',
      },
      {
        id: 'REN002',
        pledgeId: 'PLG002',
        date: '2024-11-30',
        interest: 114.00,
        method: 'Transfer',
      },
    ]

    // Mock redemptions
    const mockRedemptions = [
      {
        id: 'RED001',
        pledgeId: 'PLG003',
        date: '2024-10-15',
        principal: 2400,
        interest: 72.00,
        total: 2472.00,
        method: 'Cash',
      },
    ]

    if (cust.activePledges > 0) {
      setPledges(mockPledges.slice(0, cust.activePledges + 1))
    } else {
      setPledges(mockPledges.filter(p => p.status === 'redeemed'))
    }
    setRenewals(mockRenewals)
    setRedemptions(mockRedemptions)
  }

  // Handle delete
  const handleDelete = () => {
    setIsDeleting(true)

    setTimeout(() => {
      const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
      const updated = storedCustomers.filter(c => c.id !== id)
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updated)
      dispatch(setCustomers(updated))

      dispatch(addToast({
        type: 'success',
        title: 'Customer Deleted',
        message: `${customer.name} has been removed`,
      }))

      setIsDeleting(false)
      setShowDeleteModal(false)
      navigate('/customers')
    }, 500)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  if (!customer) {
    return (
      <PageWrapper title="Customer Not Found">
        <Card className="p-12 text-center">
          <User className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-800 mb-2">Customer Not Found</h3>
          <p className="text-zinc-500 mb-4">The customer you're looking for doesn't exist.</p>
          <Button variant="accent" onClick={() => navigate('/customers')}>
            Back to Customers
          </Button>
        </Card>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title={customer.name}
      subtitle={`Customer ID: ${customer.id}`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={ArrowLeft} onClick={() => navigate('/customers')}>
            Back
          </Button>
          <Button variant="outline" leftIcon={Edit} onClick={() => navigate(`/customers/${id}/edit`)}>
            Edit
          </Button>
          <Button variant="danger" leftIcon={Trash2} onClick={() => setShowDeleteModal(true)}>
            Delete
          </Button>
          <Button
            variant="accent"
            leftIcon={Plus}
            onClick={() => {
              dispatch(setSelectedCustomer(customer))
              navigate('/pledges/new')
            }}
          >
            New Pledge
          </Button>
        </div>
      }
    >
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Profile Header */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {customer.profilePhoto ? (
                    <img
                      src={customer.profilePhoto}
                      alt={customer.name}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                      {customer.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800">{customer.name}</h2>
                      <p className="text-zinc-500 font-mono">{formatIC(customer.icNumber)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" size="lg">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                      {customer.riskLevel === 'high' && (
                        <Badge variant="danger" size="lg">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          High Risk
                        </Badge>
                      )}
                      {customer.riskLevel === 'medium' && (
                        <Badge variant="warning" size="lg">Medium Risk</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-600">{formatPhone(customer.phone)}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-600">{customer.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-600">DOB: {formatDate(customer.dateOfBirth)}</span>
                    </div>
                    {customer.occupation && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-600">{customer.occupation}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2 mt-3 text-sm">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                    <span className="text-zinc-600">{customer.address}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          variants={itemVariants}
        >
          {[
            {
              label: 'Active Pledges',
              value: customer.activePledges,
              icon: Package,
              color: 'amber',
              subtitle: 'Currently held'
            },
            {
              label: 'Total Pledges',
              value: customer.totalPledges,
              icon: History,
              color: 'blue',
              subtitle: 'All time'
            },
            {
              label: 'Total Value',
              value: formatCurrency(customer.totalAmount),
              icon: TrendingUp,
              color: 'emerald',
              subtitle: 'Portfolio'
            },
            {
              label: 'Last Visit',
              value: formatDate(customer.lastVisit),
              icon: Clock,
              color: 'zinc',
              subtitle: 'Recent activity'
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    stat.color === 'amber' && 'bg-amber-100',
                    stat.color === 'blue' && 'bg-blue-100',
                    stat.color === 'emerald' && 'bg-emerald-100',
                    stat.color === 'zinc' && 'bg-zinc-100',
                  )}>
                    <stat.icon className={cn(
                      'w-5 h-5',
                      stat.color === 'amber' && 'text-amber-600',
                      stat.color === 'blue' && 'text-blue-600',
                      stat.color === 'emerald' && 'text-emerald-600',
                      stat.color === 'zinc' && 'text-zinc-600',
                    )} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-zinc-800">{stat.value}</p>
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Card>
            {/* Tab Headers */}
            <div className="border-b border-zinc-100">
              <div className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                        : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {tab.id === 'pledges' && customer.activePledges > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                        {customer.activePledges}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-5">
              <AnimatePresence mode="wait">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Quick Actions */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-800 mb-3">Quick Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={Plus}
                          onClick={() => {
                            dispatch(setSelectedCustomer(customer))
                            navigate('/pledges/new')
                          }}
                        >
                          New Pledge
                        </Button>
                        <Button variant="outline" size="sm" leftIcon={RefreshCw}>
                          Process Renewal
                        </Button>
                        <Button variant="outline" size="sm" leftIcon={Wallet}>
                          Process Redemption
                        </Button>
                        <Button variant="outline" size="sm" leftIcon={MessageSquare}>
                          Send WhatsApp
                        </Button>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-800 mb-3">Recent Activity</h4>
                      <div className="space-y-3">
                        {[
                          { action: 'Pledge Created', detail: 'PLG001 - 916 Gold Chain', date: '2024-12-20', icon: Plus, color: 'emerald' },
                          { action: 'Renewal Paid', detail: 'PLG001 - RM 157.50 interest', date: '2024-12-01', icon: RefreshCw, color: 'blue' },
                          { action: 'Pledge Created', detail: 'PLG002 - 916 Gold Bangle', date: '2024-11-15', icon: Plus, color: 'emerald' },
                        ].map((activity, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              activity.color === 'emerald' && 'bg-emerald-100',
                              activity.color === 'blue' && 'bg-blue-100',
                            )}>
                              <activity.icon className={cn(
                                'w-4 h-4',
                                activity.color === 'emerald' && 'text-emerald-600',
                                activity.color === 'blue' && 'text-blue-600',
                              )} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-zinc-800">{activity.action}</p>
                              <p className="text-xs text-zinc-500">{activity.detail}</p>
                            </div>
                            <span className="text-xs text-zinc-400">{formatDate(activity.date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer Notes */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-800 mb-3">Customer Notes</h4>
                      <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                        <p className="text-sm text-zinc-600">No notes added yet.</p>
                        <Button variant="link" size="sm" className="mt-2">
                          + Add Note
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Pledges Tab */}
                {activeTab === 'pledges' && (
                  <motion.div
                    key="pledges"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {pledges.length === 0 ? (
                      <div className="py-12 text-center">
                        <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500">No pledges found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pledges.map((pledge) => (
                          <motion.div
                            key={pledge.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-4 border border-zinc-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer"
                            onClick={() => navigate(`/pledges/${pledge.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center',
                                  pledge.status === 'active' ? 'bg-amber-100' : 'bg-zinc-100'
                                )}>
                                  <Package className={cn(
                                    'w-5 h-5',
                                    pledge.status === 'active' ? 'text-amber-600' : 'text-zinc-400'
                                  )} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-semibold text-zinc-800">{pledge.id}</span>
                                    <Badge variant={pledge.status === 'active' ? 'success' : 'default'}>
                                      {pledge.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-zinc-500">{pledge.items}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-zinc-800">{formatCurrency(pledge.principal)}</p>
                                <p className="text-xs text-zinc-500">Due: {formatDate(pledge.dueDate)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Renewals Tab */}
                {activeTab === 'renewals' && (
                  <motion.div
                    key="renewals"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {renewals.length === 0 ? (
                      <div className="py-12 text-center">
                        <RefreshCw className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500">No renewals found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renewals.map((renewal) => (
                          <div
                            key={renewal.id}
                            className="p-4 border border-zinc-200 rounded-xl"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <RefreshCw className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <span className="font-mono text-sm font-semibold text-zinc-800">{renewal.id}</span>
                                  <p className="text-sm text-zinc-500">Pledge: {renewal.pledgeId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-zinc-800">{formatCurrency(renewal.interest)}</p>
                                <p className="text-xs text-zinc-500">{renewal.method} • {formatDate(renewal.date)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Redemptions Tab */}
                {activeTab === 'redemptions' && (
                  <motion.div
                    key="redemptions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {redemptions.length === 0 ? (
                      <div className="py-12 text-center">
                        <Wallet className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500">No redemptions found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {redemptions.map((redemption) => (
                          <div
                            key={redemption.id}
                            className="p-4 border border-zinc-200 rounded-xl"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                  <Wallet className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                  <span className="font-mono text-sm font-semibold text-zinc-800">{redemption.id}</span>
                                  <p className="text-sm text-zinc-500">Pledge: {redemption.pledgeId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-emerald-600">{formatCurrency(redemption.total)}</p>
                                <p className="text-xs text-zinc-500">{redemption.method} • {formatDate(redemption.date)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <motion.div
                    key="documents"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* IC Front */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-800 mb-3">IC Front</h4>
                        {customer.icFrontImage ? (
                          <div
                            className="relative cursor-pointer group"
                            onClick={() => setShowImageModal('front')}
                          >
                            <img
                              src={customer.icFrontImage}
                              alt="IC Front"
                              className="w-full h-48 object-cover rounded-xl border border-zinc-200"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <Eye className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-48 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center">
                            <div className="text-center text-zinc-400">
                              <Image className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">Not uploaded</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* IC Back */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-800 mb-3">IC Back</h4>
                        {customer.icBackImage ? (
                          <div
                            className="relative cursor-pointer group"
                            onClick={() => setShowImageModal('back')}
                          >
                            <img
                              src={customer.icBackImage}
                              alt="IC Back"
                              className="w-full h-48 object-cover rounded-xl border border-zinc-200"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <Eye className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-48 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center">
                            <div className="text-center text-zinc-400">
                              <Image className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">Not uploaded</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload Button */}
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        leftIcon={FileText}
                        onClick={() => navigate(`/customers/${id}/edit`)}
                      >
                        Update Documents
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Customer"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-800">Are you sure?</h3>
              <p className="text-sm text-zinc-500">This action cannot be undone.</p>
            </div>
          </div>

          <p className="text-sm text-zinc-600 mb-4">
            You are about to delete <strong>{customer?.name}</strong>. All associated data including
            pledge history will be permanently removed.
          </p>

          {customer?.activePledges > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This customer has {customer.activePledges} active pledge(s)!
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              leftIcon={Trash2}
              loading={isDeleting}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={!!showImageModal}
        onClose={() => setShowImageModal(null)}
        title={showImageModal === 'front' ? 'IC Front' : 'IC Back'}
        size="lg"
      >
        <div className="p-4">
          <img
            src={showImageModal === 'front' ? customer?.icFrontImage : customer?.icBackImage}
            alt={showImageModal === 'front' ? 'IC Front' : 'IC Back'}
            className="w-full rounded-lg"
          />
          <div className="flex justify-end mt-4">
            <Button variant="outline" leftIcon={Download}>
              Download
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}