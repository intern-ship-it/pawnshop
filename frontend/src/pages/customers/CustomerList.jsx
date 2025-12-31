import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { setCustomers, setSelectedCustomer } from '@/features/customers/customersSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatDate, formatCurrency, formatIC, formatPhone } from '@/utils/formatters'
import { validateIC } from '@/utils/validators'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Badge, Input } from '@/components/common'
import {
  Plus,
  Download,
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  Eye,
  Edit,
  ChevronRight,
  X,
  CreditCard,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react'

export default function CustomerList() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { customers } = useAppSelector((state) => state.customers)

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [icLookup, setIcLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Load customers from localStorage on mount
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    if (storedCustomers.length === 0) {
      // Initialize with mock data if empty
      const mockCustomers = [
        {
          id: 'CUS001',
          name: 'Ahmad bin Abdullah',
          icNumber: '880515145678',
          phone: '0123456789',
          whatsapp: '0123456789',
          email: 'ahmad@email.com',
          address: '123, Jalan Merdeka, Taman Sentosa, 81200 Johor Bahru, Johor',
          dateOfBirth: '1988-05-15',
          gender: 'male',
          occupation: 'Engineer',
          icFrontImage: null,
          icBackImage: null,
          profilePhoto: null,
          activePledges: 2,
          totalPledges: 5,
          totalAmount: 15000,
          lastVisit: '2024-12-20',
          riskLevel: 'low',
          status: 'active',
          createdAt: '2024-01-15',
          updatedAt: '2024-12-20',
        },
        {
          id: 'CUS002',
          name: 'Siti Nurhaliza binti Mohd',
          icNumber: '920830108765',
          phone: '0198765432',
          whatsapp: '0198765432',
          email: 'siti@email.com',
          address: '45, Lorong Damai, Kampung Baru, 50300 Kuala Lumpur',
          dateOfBirth: '1992-08-30',
          gender: 'female',
          occupation: 'Teacher',
          icFrontImage: null,
          icBackImage: null,
          profilePhoto: null,
          activePledges: 1,
          totalPledges: 3,
          totalAmount: 8500,
          lastVisit: '2024-12-18',
          riskLevel: 'low',
          status: 'active',
          createdAt: '2024-03-20',
          updatedAt: '2024-12-18',
        },
        {
          id: 'CUS003',
          name: 'Raj Kumar a/l Subramaniam',
          icNumber: '750220145432',
          phone: '0167890123',
          whatsapp: '0167890123',
          email: 'raj@email.com',
          address: '78, Jalan Harmoni, Taman Pelangi, 80400 Johor Bahru, Johor',
          dateOfBirth: '1975-02-20',
          gender: 'male',
          occupation: 'Business Owner',
          icFrontImage: null,
          icBackImage: null,
          profilePhoto: null,
          activePledges: 0,
          totalPledges: 8,
          totalAmount: 45000,
          lastVisit: '2024-12-10',
          riskLevel: 'medium',
          status: 'active',
          createdAt: '2023-06-10',
          updatedAt: '2024-12-10',
        },
        {
          id: 'CUS004',
          name: 'Lee Mei Ling',
          icNumber: '850712089012',
          phone: '0145678901',
          whatsapp: '0145678901',
          email: 'meiling@email.com',
          address: '22, Jalan Kenanga, Taman Bunga, 14000 Bukit Mertajam, Penang',
          dateOfBirth: '1985-07-12',
          gender: 'female',
          occupation: 'Accountant',
          icFrontImage: null,
          icBackImage: null,
          profilePhoto: null,
          activePledges: 3,
          totalPledges: 6,
          totalAmount: 22000,
          lastVisit: '2024-12-22',
          riskLevel: 'low',
          status: 'active',
          createdAt: '2024-02-28',
          updatedAt: '2024-12-22',
        },
        {
          id: 'CUS005',
          name: 'Muhammad Faiz bin Ismail',
          icNumber: '950405067890',
          phone: '0112345678',
          whatsapp: '0112345678',
          email: 'faiz@email.com',
          address: '99, Jalan Setia, Taman Impian, 40150 Shah Alam, Selangor',
          dateOfBirth: '1995-04-05',
          gender: 'male',
          occupation: 'Freelancer',
          icFrontImage: null,
          icBackImage: null,
          profilePhoto: null,
          activePledges: 1,
          totalPledges: 2,
          totalAmount: 5500,
          lastVisit: '2024-12-15',
          riskLevel: 'high',
          status: 'active',
          createdAt: '2024-10-01',
          updatedAt: '2024-12-15',
        },
      ]
      setStorageItem(STORAGE_KEYS.CUSTOMERS, mockCustomers)
      dispatch(setCustomers(mockCustomers))
    } else {
      dispatch(setCustomers(storedCustomers))
    }
  }, [dispatch])

  // IC Lookup handler
  const handleICLookup = () => {
    const cleanIC = icLookup.replace(/[-\s]/g, '')

    if (!cleanIC) {
      dispatch(addToast({
        type: 'warning',
        title: 'IC Required',
        message: 'Please enter an IC number to search',
      }))
      return
    }

    if (!validateIC(cleanIC)) {
      dispatch(addToast({
        type: 'error',
        title: 'Invalid IC',
        message: 'Please enter a valid 12-digit IC number',
      }))
      return
    }

    setIsSearching(true)

    // Simulate search delay
    setTimeout(() => {
      const found = customers.find(c => c.icNumber.replace(/[-\s]/g, '') === cleanIC)
      setLookupResult(found || 'not_found')
      setIsSearching(false)

      if (found) {
        dispatch(addToast({
          type: 'success',
          title: 'Customer Found',
          message: `Found: ${found.name}`,
        }))
      }
    }, 500)
  }

  // Clear lookup
  const clearLookup = () => {
    setIcLookup('')
    setLookupResult(null)
  }

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.icNumber.includes(searchQuery) ||
      customer.phone.includes(searchQuery)

    // Status filter
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && customer.activePledges > 0) ||
      (filterStatus === 'inactive' && customer.activePledges === 0) ||
      (filterStatus === 'high-risk' && customer.riskLevel === 'high')

    return matchesSearch && matchesStatus
  })

  // Stats
  const stats = {
    total: customers.length,
    active: customers.filter(c => c.activePledges > 0).length,
    inactive: customers.filter(c => c.activePledges === 0).length,
    highRisk: customers.filter(c => c.riskLevel === 'high').length,
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  }

  return (
    <PageWrapper
      title="Customers"
      subtitle="Manage customer records and IC lookup"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download}>Export</Button>
          <Button variant="accent" leftIcon={Plus} onClick={() => navigate('/customers/new')}>
            Add Customer
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: 'Total Customers', value: stats.total, icon: Users, color: 'zinc' },
          { label: 'Active Pledges', value: stats.active, icon: UserCheck, color: 'emerald' },
          { label: 'No Active Pledge', value: stats.inactive, icon: UserX, color: 'zinc' },
          { label: 'High Risk', value: stats.highRisk, icon: AlertTriangle, color: 'red' },
        ].map((stat, index) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  stat.color === 'emerald' && 'bg-emerald-100',
                  stat.color === 'red' && 'bg-red-100',
                  stat.color === 'zinc' && 'bg-zinc-100',
                )}>
                  <stat.icon className={cn(
                    'w-5 h-5',
                    stat.color === 'emerald' && 'text-emerald-600',
                    stat.color === 'red' && 'text-red-600',
                    stat.color === 'zinc' && 'text-zinc-600',
                  )} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-800">{stat.value}</p>
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* IC Lookup Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="mb-6">
          <div className="p-5 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-800">IC Lookup</h3>
                <p className="text-sm text-zinc-500">Search customer by IC number</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Enter IC Number (e.g., 880515-14-5678)"
                  value={icLookup}
                  onChange={(e) => setIcLookup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleICLookup()}
                  className="pr-10"
                />
                {icLookup && (
                  <button
                    onClick={clearLookup}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                variant="primary"
                leftIcon={Search}
                onClick={handleICLookup}
                loading={isSearching}
              >
                Fetch
              </Button>
            </div>

            {/* Lookup Result */}
            <AnimatePresence mode="wait">
              {lookupResult && (
                <motion.div
                  key={lookupResult === 'not_found' ? 'not-found' : 'found'}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-4"
                >
                  {lookupResult === 'not_found' ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <UserX className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-800">Customer Not Found</h4>
                          <p className="text-sm text-amber-600 mt-1">
                            No customer with IC {formatIC(icLookup)} exists in the system.
                          </p>
                          <Button
                            variant="accent"
                            size="sm"
                            className="mt-3"
                            leftIcon={Plus}
                            onClick={() => navigate(`/customers/new?ic=${icLookup.replace(/[-\s]/g, '')}`)}
                          >
                            Create New Customer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                          {lookupResult.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-zinc-800 text-lg">{lookupResult.name}</h4>
                              <p className="text-sm text-zinc-500 font-mono">{formatIC(lookupResult.icNumber)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="success">Verified</Badge>
                              {lookupResult.riskLevel === 'high' && (
                                <Badge variant="danger">High Risk</Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-zinc-400" />
                              <span className="text-zinc-600">{formatPhone(lookupResult.phone)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <CreditCard className="w-4 h-4 text-zinc-400" />
                              <span className="text-zinc-600">{lookupResult.activePledges} Active Pledges</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-zinc-400" />
                              <span className="text-zinc-600">Last: {formatDate(lookupResult.lastVisit)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-zinc-400" />
                              <span className="text-zinc-600 truncate">{lookupResult.address.split(',')[0]}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-4">
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={Eye}
                              onClick={() => navigate(`/customers/${lookupResult.id}`)}
                            >
                              View Profile
                            </Button>
                            <Button
                              variant="accent"
                              size="sm"
                              leftIcon={Plus}
                              onClick={() => {
                                dispatch(setSelectedCustomer(lookupResult))
                                navigate('/pledges/new')
                              }}
                            >
                              New Pledge
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={Edit}
                              onClick={() => navigate(`/customers/${lookupResult.id}/edit`)}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* Customer List Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          {/* Header */}
          <div className="p-5 border-b border-zinc-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-800">All Customers</h3>
                  <p className="text-sm text-zinc-500">{filteredCustomers.length} customers found</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search name, IC, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>

                {/* Filter Toggle */}
                <Button
                  variant={showFilters ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={Filter}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  Filters
                </Button>
              </div>
            </div>

            {/* Filter Options */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100">
                    <span className="text-sm text-zinc-500">Status:</span>
                    {['all', 'active', 'inactive', 'high-risk'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-lg transition-all',
                          filterStatus === status
                            ? 'bg-zinc-800 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        )}
                      >
                        {status === 'all' ? 'All' :
                          status === 'active' ? 'Active Pledges' :
                            status === 'inactive' ? 'No Pledges' : 'High Risk'}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Customer List */}
          <div className="divide-y divide-zinc-100">
            <AnimatePresence>
              {filteredCustomers.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-12 text-center"
                >
                  <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-500">No customers found</p>
                  <Button
                    variant="accent"
                    size="sm"
                    className="mt-4"
                    leftIcon={Plus}
                    onClick={() => navigate('/customers/new')}
                  >
                    Add First Customer
                  </Button>
                </motion.div>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="p-4 hover:bg-zinc-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 flex items-center justify-center text-zinc-600 font-semibold text-lg flex-shrink-0 group-hover:from-amber-500 group-hover:to-amber-600 group-hover:text-white transition-all">
                        {customer.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-800 truncate">{customer.name}</h4>
                          {customer.riskLevel === 'high' && (
                            <Badge variant="danger" size="sm">High Risk</Badge>
                          )}
                          {customer.riskLevel === 'medium' && (
                            <Badge variant="warning" size="sm">Medium</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-zinc-500 font-mono">{formatIC(customer.icNumber)}</span>
                          <span className="text-sm text-zinc-400">{formatPhone(customer.phone)}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden md:flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-lg font-bold text-zinc-800">{customer.activePledges}</p>
                          <p className="text-xs text-zinc-500">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-zinc-800">{formatCurrency(customer.totalAmount)}</p>
                          <p className="text-xs text-zinc-500">Total Value</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-zinc-600">{formatDate(customer.lastVisit)}</p>
                          <p className="text-xs text-zinc-500">Last Visit</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>
    </PageWrapper>
  )
}