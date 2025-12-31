import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges, setSelectedPledge } from '@/features/pledges/pledgesSlice'
import { getStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate, formatIC } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge } from '@/components/common'
import {
  Plus,
  Search,
  Filter,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  DollarSign,
  Calendar,
  User,
  FileText,
  Download,
  TrendingUp,
  Scale,
} from 'lucide-react'

// Status badge config
const statusConfig = {
  active: { label: 'Active', variant: 'success', icon: CheckCircle },
  overdue: { label: 'Overdue', variant: 'error', icon: AlertTriangle },
  redeemed: { label: 'Redeemed', variant: 'info', icon: DollarSign },
  forfeited: { label: 'Forfeited', variant: 'warning', icon: XCircle },
  auctioned: { label: 'Auctioned', variant: 'default', icon: Package },
}

export default function PledgeList() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { pledges } = useAppSelector((state) => state.pledges)

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  // Load pledges on mount
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])

    // Check for overdue pledges
    const now = new Date()
    const updatedPledges = storedPledges.map(pledge => {
      if (pledge.status === 'active' && new Date(pledge.dueDate) < now) {
        return { ...pledge, status: 'overdue' }
      }
      return pledge
    })

    dispatch(setPledges(updatedPledges))
  }, [dispatch])

  // Calculate stats
  const stats = {
    total: pledges.length,
    active: pledges.filter(p => p.status === 'active').length,
    overdue: pledges.filter(p => p.status === 'overdue').length,
    totalValue: pledges
      .filter(p => p.status === 'active' || p.status === 'overdue')
      .reduce((sum, p) => sum + (p.loanAmount || 0), 0),
    redeemed: pledges.filter(p => p.status === 'redeemed').length,
  }

  // Filter and sort pledges
  const filteredPledges = pledges
    .filter(pledge => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchId = pledge.id?.toLowerCase().includes(query)
        const matchName = pledge.customerName?.toLowerCase().includes(query)
        const matchIC = pledge.customerIC?.replace(/[-\s]/g, '').includes(query.replace(/[-\s]/g, ''))
        if (!matchId && !matchName && !matchIC) return false
      }

      // Status filter
      if (statusFilter !== 'all' && pledge.status !== statusFilter) return false

      // Date filter
      if (dateFilter !== 'all') {
        const createdDate = new Date(pledge.createdAt)
        const now = new Date()

        switch (dateFilter) {
          case 'today':
            if (createdDate.toDateString() !== now.toDateString()) return false
            break
          case 'week':
            const weekAgo = new Date(now.setDate(now.getDate() - 7))
            if (createdDate < weekAgo) return false
            break
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1))
            if (createdDate < monthAgo) return false
            break
        }
      }

      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt)
        case 'amount-high':
          return (b.loanAmount || 0) - (a.loanAmount || 0)
        case 'amount-low':
          return (a.loanAmount || 0) - (b.loanAmount || 0)
        case 'due-soon':
          return new Date(a.dueDate) - new Date(b.dueDate)
        default:
          return 0
      }
    })

  // Days until due
  const getDaysUntilDue = (dueDate) => {
    const now = new Date()
    const due = new Date(dueDate)
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return diff
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

  return (
    <PageWrapper
      title="Pledges"
      subtitle="Manage all pledge transactions"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download}>
            Export
          </Button>
          <Button variant="accent" leftIcon={Plus} onClick={() => navigate('/pledges/new')}>
            New Pledge
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total Pledges</p>
                <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Active</p>
                <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Overdue</p>
                <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Outstanding</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(stats.totalValue)}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Redeemed</p>
                <p className="text-xl font-bold text-blue-600">{stats.redeemed}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search by Pledge ID, Customer Name or IC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'redeemed', label: 'Redeemed' },
              { value: 'forfeited', label: 'Forfeited' },
            ]}
            className="w-40"
          />

          {/* Date Filter */}
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
            ]}
            className="w-40"
          />

          {/* Sort */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'amount-high', label: 'Amount: High to Low' },
              { value: 'amount-low', label: 'Amount: Low to High' },
              { value: 'due-soon', label: 'Due Soon' },
            ]}
            className="w-44"
          />
        </div>
      </Card>

      {/* Pledges Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Pledge ID</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Customer</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Items</th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600">Loan Amount</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Created</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Due Date</th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">Status</th>
                <th className="text-center p-4 text-sm font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPledges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500">No pledges found</p>
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear Search
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPledges.map((pledge, index) => {
                  const status = statusConfig[pledge.status] || statusConfig.active
                  const StatusIcon = status.icon
                  const daysUntilDue = getDaysUntilDue(pledge.dueDate)

                  return (
                    <motion.tr
                      key={pledge.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/pledges/${pledge.id}`)}
                    >
                      {/* Pledge ID */}
                      <td className="p-4">
                        <span className="font-mono font-semibold text-zinc-800">{pledge.id}</span>
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
                            {pledge.customerName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-zinc-800">{pledge.customerName}</p>
                            <p className="text-xs text-zinc-500 font-mono">{formatIC(pledge.customerIC)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-zinc-400" />
                          <span className="text-zinc-600">
                            {pledge.items?.length || 0} item(s)
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">{pledge.totalWeight?.toFixed(2)}g</p>
                      </td>

                      {/* Loan Amount */}
                      <td className="p-4 text-right">
                        <span className="font-semibold text-zinc-800">
                          {formatCurrency(pledge.loanAmount)}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="p-4">
                        <span className="text-zinc-600 text-sm">
                          {formatDate(pledge.createdAt)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="p-4">
                        <span className="text-zinc-600 text-sm">
                          {formatDate(pledge.dueDate)}
                        </span>
                        {pledge.status === 'active' && (
                          <p className={cn(
                            'text-xs mt-0.5',
                            daysUntilDue <= 7 ? 'text-red-500' :
                              daysUntilDue <= 30 ? 'text-amber-500' :
                                'text-zinc-400'
                          )}>
                            {daysUntilDue > 0 ? `${daysUntilDue} days left` : 'Due today'}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <Badge variant={status.variant}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/pledges/${pledge.id}`)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(pledge.status === 'active' || pledge.status === 'overdue') && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                dispatch(setSelectedPledge(pledge))
                                navigate('/renewals')
                              }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        {filteredPledges.length > 0 && (
          <div className="p-4 border-t border-zinc-200 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Showing {filteredPledges.length} of {pledges.length} pledges
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </PageWrapper>
  )
}