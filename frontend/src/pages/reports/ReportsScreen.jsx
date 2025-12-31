import { useState, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { setCustomers } from '@/features/customers/customersSlice'
import { getStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Select, Badge } from '@/components/common'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  PieChart,
  Activity,
  Scale,
  Gem,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react'

// Report tabs
const reportTabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'pledges', label: 'Pledges', icon: Package },
  { id: 'transactions', label: 'Transactions', icon: Activity },
  { id: 'customers', label: 'Customers', icon: Users },
]

export default function ReportsScreen() {
  const dispatch = useAppDispatch()
  const { pledges } = useAppSelector((state) => state.pledges)
  const { customers } = useAppSelector((state) => state.customers)

  // State
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState('month') // 'today', 'week', 'month', 'year', 'all'

  // Load data on mount
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    dispatch(setPledges(storedPledges))
    dispatch(setCustomers(storedCustomers))
  }, [dispatch])

  // Filter by date range
  const filterByDate = (items, dateField = 'createdAt') => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return items.filter(item => {
      const itemDate = new Date(item[dateField])

      switch (dateRange) {
        case 'today':
          return itemDate >= startOfDay
        case 'week':
          const weekAgo = new Date(startOfDay)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return itemDate >= weekAgo
        case 'month':
          const monthAgo = new Date(startOfDay)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          return itemDate >= monthAgo
        case 'year':
          const yearAgo = new Date(startOfDay)
          yearAgo.setFullYear(yearAgo.getFullYear() - 1)
          return itemDate >= yearAgo
        default:
          return true
      }
    })
  }

  // Calculate stats
  const stats = useMemo(() => {
    const filteredPledges = filterByDate(pledges)
    const activePledges = pledges.filter(p => p.status === 'active' || p.status === 'overdue')
    const redeemedPledges = filterByDate(pledges.filter(p => p.status === 'redeemed'), 'redeemedAt')

    // Total disbursed
    const totalDisbursed = filteredPledges.reduce((sum, p) => sum + (p.loanAmount || 0), 0)

    // Total collected from redemptions
    const totalCollected = redeemedPledges.reduce((sum, p) => sum + (p.redemptionAmount || 0), 0)

    // Total renewals
    const allRenewals = pledges.flatMap(p => (p.renewals || []).map(r => ({ ...r, pledgeId: p.id })))
    const filteredRenewals = filterByDate(allRenewals, 'date')
    const totalRenewalAmount = filteredRenewals.reduce((sum, r) => sum + (r.amount || 0), 0)

    // Outstanding
    const totalOutstanding = activePledges.reduce((sum, p) => sum + (p.loanAmount || 0), 0)

    // Items in storage
    const itemsInStorage = activePledges.flatMap(p => p.items || [])
    const totalWeight = itemsInStorage.reduce((sum, i) => sum + (parseFloat(i.weight) || 0), 0)
    const totalItemValue = itemsInStorage.reduce((sum, i) => sum + (i.netValue || 0), 0)

    // Overdue
    const overduePledges = pledges.filter(p => p.status === 'overdue')
    const overdueAmount = overduePledges.reduce((sum, p) => sum + (p.loanAmount || 0), 0)

    // New customers
    const newCustomers = filterByDate(customers)

    // Purity breakdown
    const purityBreakdown = itemsInStorage.reduce((acc, item) => {
      const purity = item.purity || 'unknown'
      if (!acc[purity]) acc[purity] = { count: 0, weight: 0, value: 0 }
      acc[purity].count++
      acc[purity].weight += parseFloat(item.weight) || 0
      acc[purity].value += item.netValue || 0
      return acc
    }, {})

    // Category breakdown
    const categoryBreakdown = itemsInStorage.reduce((acc, item) => {
      const category = item.category || 'other'
      if (!acc[category]) acc[category] = { count: 0, weight: 0 }
      acc[category].count++
      acc[category].weight += parseFloat(item.weight) || 0
      return acc
    }, {})

    return {
      newPledges: filteredPledges.length,
      totalDisbursed,
      totalCollected,
      renewalCount: filteredRenewals.length,
      totalRenewalAmount,
      totalOutstanding,
      activePledgeCount: activePledges.length,
      redeemedCount: redeemedPledges.length,
      overdueCount: overduePledges.length,
      overdueAmount,
      itemCount: itemsInStorage.length,
      totalWeight,
      totalItemValue,
      newCustomers: newCustomers.length,
      totalCustomers: customers.length,
      purityBreakdown,
      categoryBreakdown,
    }
  }, [pledges, customers, dateRange])

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
      title="Reports"
      subtitle="View business analytics and reports"
      actions={
        <div className="flex items-center gap-3">
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'year', label: 'This Year' },
              { value: 'all', label: 'All Time' },
            ]}
            className="w-36"
          />
          <Button variant="outline" leftIcon={Download}>
            Export
          </Button>
          <Button variant="outline" leftIcon={Printer}>
            Print
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {reportTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <Badge variant="success" className="text-xs">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    Disbursed
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-zinc-800">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-sm text-zinc-500">{stats.newPledges} new pledges</p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <Badge variant="info" className="text-xs">
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    Collected
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-zinc-800">{formatCurrency(stats.totalCollected)}</p>
                <p className="text-sm text-zinc-500">{stats.redeemedCount} redemptions</p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-amber-600" />
                  </div>
                  <Badge variant="warning" className="text-xs">Renewals</Badge>
                </div>
                <p className="text-2xl font-bold text-zinc-800">{formatCurrency(stats.totalRenewalAmount)}</p>
                <p className="text-sm text-zinc-500">{stats.renewalCount} renewals</p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <Badge variant="default" className="text-xs">Customers</Badge>
                </div>
                <p className="text-2xl font-bold text-zinc-800">{stats.totalCustomers}</p>
                <p className="text-sm text-zinc-500">+{stats.newCustomers} new</p>
              </Card>
            </motion.div>
          </div>

          {/* Outstanding & Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  Outstanding Portfolio
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-zinc-600">Active Pledges</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{stats.activePledgeCount}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="text-zinc-600">Overdue</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{stats.overdueCount}</p>
                      <p className="text-xs text-red-500">{formatCurrency(stats.overdueAmount)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="font-medium text-amber-800">Total Outstanding</span>
                    <span className="text-xl font-bold text-amber-600">{formatCurrency(stats.totalOutstanding)}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5">
                <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <Gem className="w-5 h-5 text-amber-500" />
                  Inventory Summary
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-zinc-50 rounded-lg">
                      <Package className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-zinc-800">{stats.itemCount}</p>
                      <p className="text-xs text-zinc-500">Items</p>
                    </div>
                    <div className="text-center p-3 bg-zinc-50 rounded-lg">
                      <Scale className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-zinc-800">{stats.totalWeight.toFixed(1)}g</p>
                      <p className="text-xs text-zinc-500">Weight</p>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded-lg">
                      <Gem className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalItemValue)}</p>
                      <p className="text-xs text-zinc-500">Value</p>
                    </div>
                  </div>

                  {/* Purity Breakdown */}
                  <div className="pt-4 border-t border-zinc-200">
                    <p className="text-sm font-medium text-zinc-500 mb-2">By Purity</p>
                    <div className="space-y-2">
                      {Object.entries(stats.purityBreakdown).map(([purity, data]) => (
                        <div key={purity} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600">{purity} Gold</span>
                          <div className="flex items-center gap-4">
                            <span className="text-zinc-400">{data.count} items</span>
                            <span className="font-medium">{data.weight.toFixed(1)}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Category Breakdown */}
          <motion.div variants={itemVariants}>
            <Card className="p-5">
              <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-amber-500" />
                Items by Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(stats.categoryBreakdown).map(([category, data]) => (
                  <div key={category} className="p-4 bg-zinc-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-zinc-800">{data.count}</p>
                    <p className="text-sm text-zinc-500 capitalize">{category}</p>
                    <p className="text-xs text-zinc-400">{data.weight.toFixed(1)}g</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Pledges Tab */}
      {activeTab === 'pledges' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Pledge Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <Package className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-zinc-800">{stats.newPledges}</p>
                <p className="text-sm text-zinc-500">New Pledges</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-600">{stats.activePledgeCount}</p>
                <p className="text-sm text-zinc-500">Active</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                <p className="text-sm text-zinc-500">Overdue</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <DollarSign className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{stats.redeemedCount}</p>
                <p className="text-sm text-zinc-500">Redeemed</p>
              </Card>
            </motion.div>
          </div>

          {/* Recent Pledges */}
          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-4">Recent Pledges</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">Pledge ID</th>
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">Customer</th>
                    <th className="text-right p-3 text-sm font-semibold text-zinc-600">Amount</th>
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">Date</th>
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pledges.slice(0, 10).map((pledge) => (
                    <tr key={pledge.id} className="border-b border-zinc-100">
                      <td className="p-3 font-mono text-sm">{pledge.id}</td>
                      <td className="p-3 text-sm">{pledge.customerName}</td>
                      <td className="p-3 text-sm text-right font-medium">{formatCurrency(pledge.loanAmount)}</td>
                      <td className="p-3 text-sm text-zinc-500">{formatDate(pledge.createdAt)}</td>
                      <td className="p-3">
                        <Badge variant={
                          pledge.status === 'active' ? 'success' :
                            pledge.status === 'overdue' ? 'error' :
                              pledge.status === 'redeemed' ? 'info' : 'default'
                        }>
                          {pledge.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Transaction Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div variants={itemVariants}>
              <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <TrendingUp className="w-8 h-8 mb-3 opacity-80" />
                <p className="text-emerald-100 text-sm">Money Out (Disbursed)</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-emerald-200 text-sm mt-1">{stats.newPledges} transactions</p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <TrendingDown className="w-8 h-8 mb-3 opacity-80" />
                <p className="text-blue-100 text-sm">Money In (Collected)</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalCollected + stats.totalRenewalAmount)}</p>
                <p className="text-blue-200 text-sm mt-1">{stats.redeemedCount + stats.renewalCount} transactions</p>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <Activity className="w-8 h-8 mb-3 opacity-80" />
                <p className="text-amber-100 text-sm">Net Cash Flow</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((stats.totalCollected + stats.totalRenewalAmount) - stats.totalDisbursed)}
                </p>
                <p className="text-amber-200 text-sm mt-1">
                  {(stats.totalCollected + stats.totalRenewalAmount) >= stats.totalDisbursed ? 'Positive' : 'Negative'}
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Transaction Breakdown */}
          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-4">Transaction Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                  <span className="text-zinc-700">New Pledges (Cash Out)</span>
                </div>
                <span className="font-semibold text-red-600">-{formatCurrency(stats.totalDisbursed)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                  <span className="text-zinc-700">Redemptions (Cash In)</span>
                </div>
                <span className="font-semibold text-emerald-600">+{formatCurrency(stats.totalCollected)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                  <span className="text-zinc-700">Renewals (Interest In)</span>
                </div>
                <span className="font-semibold text-blue-600">+{formatCurrency(stats.totalRenewalAmount)}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Customer Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <Users className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-zinc-800">{stats.totalCustomers}</p>
                <p className="text-sm text-zinc-500">Total Customers</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-600">{stats.newCustomers}</p>
                <p className="text-sm text-zinc-500">New This Period</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">
                  {customers.filter(c => c.activePledges > 0).length}
                </p>
                <p className="text-sm text-zinc-500">Active Customers</p>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="p-4 text-center">
                <Clock className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-zinc-600">
                  {customers.filter(c => !c.activePledges || c.activePledges === 0).length}
                </p>
                <p className="text-sm text-zinc-500">Inactive</p>
              </Card>
            </motion.div>
          </div>

          {/* Top Customers */}
          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-4">Top Customers by Total Amount</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">#</th>
                    <th className="text-left p-3 text-sm font-semibold text-zinc-600">Customer</th>
                    <th className="text-center p-3 text-sm font-semibold text-zinc-600">Active</th>
                    <th className="text-center p-3 text-sm font-semibold text-zinc-600">Total Pledges</th>
                    <th className="text-right p-3 text-sm font-semibold text-zinc-600">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
                    .slice(0, 10)
                    .map((customer, index) => (
                      <tr key={customer.id} className="border-b border-zinc-100">
                        <td className="p-3 text-sm text-zinc-400">{index + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
                              {customer.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-800">{customer.name}</p>
                              <p className="text-xs text-zinc-400">{customer.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={customer.activePledges > 0 ? 'success' : 'default'}>
                            {customer.activePledges || 0}
                          </Badge>
                        </td>
                        <td className="p-3 text-center text-sm">{customer.totalPledges || 0}</td>
                        <td className="p-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(customer.totalAmount || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </PageWrapper>
  )
}