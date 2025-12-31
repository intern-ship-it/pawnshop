import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { setCustomers } from '@/features/customers/customersSlice'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { getStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import {
  Plus,
  RefreshCw,
  Wallet,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Scale,
  Lock,
} from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user, role } = useAppSelector((state) => state.auth)
  const { goldPrice } = useAppSelector((state) => state.ui)
  const { pledges } = useAppSelector((state) => state.pledges)

  // Load data on mount
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    dispatch(setCustomers(storedCustomers))
    dispatch(setPledges(storedPledges))
  }, [dispatch])

  // Mock stats data
  const stats = {
    todayPledges: { count: 14, amount: 45200, trend: '+12%' },
    renewals: { amount: 12850, transactions: 24 },
    redemptions: { count: 8, amount: 18400 },
    paymentSplit: { cash: 65, online: 35 },
    overdue: { count: 3 },
  }

  // Mock pending approvals
  const pendingApprovals = [
    { id: 'T-99281', type: 'New Pledge', amount: 12000, badge: 'High', badgeColor: 'amber' },
    { id: 'T-99285', type: 'Redemption', amount: 4500, badge: 'Discount', badgeColor: 'gray' },
  ]

  // Mock stock alerts
  const stockAlerts = [
    {
      id: 1,
      type: 'Weight Discrepancy',
      icon: Scale,
      description: 'Item #G-1002 weight recorded as 5.2g vs expected 5.5g.',
      severity: 'critical',
    },
    {
      id: 2,
      type: 'Pending Safe Audit',
      icon: Lock,
      description: 'Daily safe audit not completed.',
      severity: 'warning',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title + Quick Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Dashboard Overview</h1>
          <p className="text-zinc-500 mt-1">Welcome back! Here's your business summary for today.</p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pledges/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Pledge
          </button>
          <button
            onClick={() => navigate('/renewals')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Renew
          </button>
          <button
            onClick={() => navigate('/redemptions')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            <Wallet className="w-4 h-4 text-zinc-500" />
            Redeem
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Pledges */}
        <div
          onClick={() => navigate('/pledges')}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-zinc-900 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
              <Plus className="w-5 h-5 text-zinc-600" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {stats.todayPledges.trend}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Today's Pledges</p>
          <p className="text-2xl xl:text-3xl font-bold text-zinc-800">{stats.todayPledges.count}</p>
          <p className="text-sm font-semibold text-zinc-900 mt-1 truncate" title={formatCurrency(stats.todayPledges.amount)}>
            {formatCurrency(stats.todayPledges.amount)}
          </p>
        </div>

        {/* Renewals */}
        <div
          onClick={() => navigate('/renewals')}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-amber-400 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <RefreshCw className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Renewals</p>
          <p className="text-xl xl:text-2xl font-bold text-zinc-800 truncate" title={formatCurrency(stats.renewals.amount)}>
            {formatCurrency(stats.renewals.amount)}
          </p>
          <p className="text-sm text-zinc-500 mt-1">{stats.renewals.transactions} transactions</p>
        </div>

        {/* Redemptions */}
        <div
          onClick={() => navigate('/redemptions')}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Redemptions</p>
          <p className="text-2xl xl:text-3xl font-bold text-zinc-800">{stats.redemptions.count}</p>
          <p className="text-sm font-semibold text-emerald-600 mt-1 truncate" title={formatCurrency(stats.redemptions.amount)}>
            {formatCurrency(stats.redemptions.amount)}
          </p>
        </div>

        {/* Payment Split */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-3">Payment Split</p>
          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden mb-3 flex">
            <div
              className="h-full bg-zinc-800"
              style={{ width: `${stats.paymentSplit.cash}%` }}
            />
            <div
              className="h-full bg-amber-400"
              style={{ width: `${stats.paymentSplit.online}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-800"></span>
              <span className="text-zinc-600">Cash {stats.paymentSplit.cash}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-zinc-600">Online {stats.paymentSplit.online}%</span>
            </span>
          </div>
        </div>

        {/* Overdue - Red/Pink Card */}
        <div
          onClick={() => navigate('/pledges?status=overdue')}
          className="bg-red-50 rounded-xl border border-red-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center group-hover:bg-white/80 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-red-600/80 mb-1">Overdue</p>
          <p className="text-3xl font-bold text-red-600">{stats.overdue.count}</p>
          <button className="text-sm text-red-600 font-bold mt-1 flex items-center gap-1 group-hover:gap-2 transition-all">
            View items <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-zinc-800">Pending Approvals</h3>
            </div>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              {pendingApprovals.length + 2} Pending
            </span>
          </div>

          {/* List */}
          <div className="divide-y divide-zinc-100">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-zinc-500">#{item.id}</span>
                  <span className="text-sm font-medium text-zinc-800">{item.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-800">{formatCurrency(item.amount)}</span>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded',
                    item.badgeColor === 'amber' && 'bg-amber-100 text-amber-700',
                    item.badgeColor === 'blue' && 'bg-blue-100 text-blue-700'
                  )}>
                    {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-100">
            <button className="text-sm text-zinc-600 font-medium flex items-center gap-1 hover:text-zinc-800">
              View all approvals <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-zinc-600" />
              </div>
              <h3 className="font-semibold text-zinc-800">Stock Alerts</h3>
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              2 Critical
            </span>
          </div>

          {/* Alerts List */}
          <div className="p-5 space-y-4">
            {stockAlerts.map((alert) => {
              const Icon = alert.icon
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'p-4 rounded-lg',
                    alert.severity === 'critical' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      alert.severity === 'critical' ? 'bg-red-100' : 'bg-amber-100'
                    )}>
                      <Icon className={cn(
                        'w-4 h-4',
                        alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                      )} />
                    </div>
                    <div className="flex-1">
                      <h4 className={cn(
                        'font-semibold',
                        alert.severity === 'critical' ? 'text-red-800' : 'text-amber-800'
                      )}>
                        {alert.type}
                      </h4>
                      <p className={cn(
                        'text-sm mt-0.5',
                        alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                      )}>
                        {alert.description}
                      </p>
                      {alert.severity === 'critical' && (
                        <div className="flex items-center gap-2 mt-3">
                          <button className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                            Investigate
                          </button>
                          <button className="px-3 py-1.5 text-red-700 text-sm font-medium hover:bg-red-100 rounded-lg transition-colors">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}