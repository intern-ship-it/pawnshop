import { useState, useEffect, useMemo } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { getStorageItem, setStorageItem } from '@/utils/localStorage'
import { formatCurrency } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
    FileText,
    Search,
    Filter,
    Download,
    Printer,
    Calendar,
    User,
    Clock,
    Activity,
    Eye,
    Edit,
    Trash2,
    Plus,
    LogIn,
    LogOut,
    DollarSign,
    Package,
    RefreshCw,
    Wallet,
    Gavel,
    Settings,
    Shield,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    ChevronDown,
    ChevronUp,
    X,
} from 'lucide-react'

// Storage key
const AUDIT_LOG_KEY = 'audit_logs'

// Action types with icons and colors
const actionConfig = {
    // Auth
    login: { label: 'Login', icon: LogIn, color: 'blue', category: 'auth' },
    logout: { label: 'Logout', icon: LogOut, color: 'zinc', category: 'auth' },

    // CRUD
    create: { label: 'Create', icon: Plus, color: 'emerald', category: 'data' },
    update: { label: 'Update', icon: Edit, color: 'amber', category: 'data' },
    delete: { label: 'Delete', icon: Trash2, color: 'red', category: 'data' },
    view: { label: 'View', icon: Eye, color: 'zinc', category: 'data' },

    // Transactions
    pledge_create: { label: 'New Pledge', icon: Plus, color: 'emerald', category: 'transaction' },
    pledge_update: { label: 'Update Pledge', icon: Edit, color: 'amber', category: 'transaction' },
    renewal: { label: 'Renewal', icon: RefreshCw, color: 'blue', category: 'transaction' },
    redemption: { label: 'Redemption', icon: Wallet, color: 'emerald', category: 'transaction' },
    forfeit: { label: 'Forfeit', icon: XCircle, color: 'red', category: 'transaction' },
    auction: { label: 'Auction Sale', icon: Gavel, color: 'amber', category: 'transaction' },

    // System
    settings_change: { label: 'Settings Change', icon: Settings, color: 'zinc', category: 'system' },
    override: { label: 'Manual Override', icon: AlertTriangle, color: 'amber', category: 'system' },
    approval: { label: 'Approval', icon: CheckCircle, color: 'emerald', category: 'system' },
    rejection: { label: 'Rejection', icon: XCircle, color: 'red', category: 'system' },
}

// Module types
const moduleConfig = {
    auth: { label: 'Authentication', color: 'blue' },
    customer: { label: 'Customer', color: 'emerald' },
    pledge: { label: 'Pledge', color: 'amber' },
    renewal: { label: 'Renewal', color: 'blue' },
    redemption: { label: 'Redemption', color: 'emerald' },
    inventory: { label: 'Inventory', color: 'zinc' },
    auction: { label: 'Auction', color: 'amber' },
    settings: { label: 'Settings', color: 'zinc' },
    user: { label: 'User', color: 'blue' },
}

// Generate sample audit logs
const generateSampleLogs = () => {
    const users = ['Admin User', 'Manager User', 'Cashier User', 'Ahmad bin Hassan']
    const actions = [
        { action: 'login', module: 'auth', description: 'User logged in', details: { ip: '192.168.1.100', browser: 'Chrome' } },
        { action: 'pledge_create', module: 'pledge', description: 'Created new pledge PLG-2024-001234', details: { pledgeId: 'PLG-2024-001234', customer: 'Siti Aminah', amount: 2500 } },
        { action: 'renewal', module: 'renewal', description: 'Processed renewal for PLG-2024-001230', details: { pledgeId: 'PLG-2024-001230', interest: 75, extensionMonths: 1 } },
        { action: 'redemption', module: 'redemption', description: 'Processed redemption for PLG-2024-001225', details: { pledgeId: 'PLG-2024-001225', totalPaid: 2650, items: 2 } },
        { action: 'create', module: 'customer', description: 'Created new customer CUST-001234', details: { customerId: 'CUST-001234', name: 'Lee Mei Ling', ic: '920315-14-5632' } },
        { action: 'update', module: 'customer', description: 'Updated customer CUST-001230', details: { customerId: 'CUST-001230', field: 'phone', oldValue: '012-345 6789', newValue: '012-456 7890' } },
        { action: 'override', module: 'pledge', description: 'Manual gold price override', details: { pledgeId: 'PLG-2024-001235', oldPrice: 320, newPrice: 315, reason: 'Market fluctuation' } },
        { action: 'settings_change', module: 'settings', description: 'Updated interest rate rules', details: { setting: 'interestRules.tier2.rate', oldValue: 1.5, newValue: 1.8 } },
        { action: 'forfeit', module: 'auction', description: 'Marked pledge as forfeited', details: { pledgeId: 'PLG-2024-001200', daysOverdue: 45 } },
        { action: 'auction', module: 'auction', description: 'Recorded auction sale', details: { pledgeId: 'PLG-2024-001195', salePrice: 3200, buyer: 'Gold Traders Sdn Bhd' } },
        { action: 'approval', module: 'pledge', description: 'Approved payout override', details: { pledgeId: 'PLG-2024-001236', requestedBy: 'Cashier User', amount: 5000 } },
        { action: 'delete', module: 'user', description: 'Deleted user account', details: { userId: 'USR005', username: 'staff_old' } },
        { action: 'logout', module: 'auth', description: 'User logged out', details: { sessionDuration: '4h 32m' } },
    ]

    const logs = []
    const now = new Date()

    // Generate 50 sample logs over the past 7 days
    for (let i = 0; i < 50; i++) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)]
        const randomUser = users[Math.floor(Math.random() * users.length)]
        const randomHoursAgo = Math.floor(Math.random() * 168) // Up to 7 days
        const timestamp = new Date(now.getTime() - randomHoursAgo * 60 * 60 * 1000)

        logs.push({
            id: `LOG-${String(Date.now() + i).slice(-8)}`,
            timestamp: timestamp.toISOString(),
            user: randomUser,
            userId: `USR00${Math.floor(Math.random() * 5) + 1}`,
            action: randomAction.action,
            module: randomAction.module,
            description: randomAction.description,
            details: randomAction.details,
            ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        })
    }

    // Sort by timestamp descending
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export default function AuditLogScreen() {
    const dispatch = useAppDispatch()

    // State
    const [logs, setLogs] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [moduleFilter, setModuleFilter] = useState('all')
    const [actionFilter, setActionFilter] = useState('all')
    const [userFilter, setUserFilter] = useState('all')
    const [dateRange, setDateRange] = useState('all')
    const [showFilters, setShowFilters] = useState(false)

    // Detail modal
    const [selectedLog, setSelectedLog] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(false)

    // Load logs on mount
    useEffect(() => {
        let stored = getStorageItem(AUDIT_LOG_KEY, null)
        if (!stored || stored.length === 0) {
            stored = generateSampleLogs()
            setStorageItem(AUDIT_LOG_KEY, stored)
        }
        setLogs(stored)
    }, [])

    // Get unique users for filter
    const uniqueUsers = useMemo(() => {
        const users = [...new Set(logs.map(l => l.user))]
        return users.sort()
    }, [logs])

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const matchesSearch =
                    log.description?.toLowerCase().includes(query) ||
                    log.user?.toLowerCase().includes(query) ||
                    log.id?.toLowerCase().includes(query) ||
                    JSON.stringify(log.details)?.toLowerCase().includes(query)
                if (!matchesSearch) return false
            }

            // Module filter
            if (moduleFilter !== 'all' && log.module !== moduleFilter) return false

            // Action filter
            if (actionFilter !== 'all' && log.action !== actionFilter) return false

            // User filter
            if (userFilter !== 'all' && log.user !== userFilter) return false

            // Date range filter
            if (dateRange !== 'all') {
                const logDate = new Date(log.timestamp)
                const now = new Date()
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

                switch (dateRange) {
                    case 'today':
                        if (logDate < startOfToday) return false
                        break
                    case 'week':
                        const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000)
                        if (logDate < weekAgo) return false
                        break
                    case 'month':
                        const monthAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000)
                        if (logDate < monthAgo) return false
                        break
                }
            }

            return true
        })
    }, [logs, searchQuery, moduleFilter, actionFilter, userFilter, dateRange])

    // Stats
    const stats = useMemo(() => {
        const today = new Date()
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        return {
            total: logs.length,
            today: logs.filter(l => new Date(l.timestamp) >= startOfToday).length,
            transactions: logs.filter(l => ['pledge_create', 'renewal', 'redemption', 'forfeit', 'auction'].includes(l.action)).length,
            overrides: logs.filter(l => l.action === 'override').length,
        }
    }, [logs])

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp)
        return date.toLocaleString('en-MY', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
    }

    // Format relative time
    const formatRelativeTime = (timestamp) => {
        const now = new Date()
        const date = new Date(timestamp)
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return formatTimestamp(timestamp)
    }

    // Open detail modal
    const openDetail = (log) => {
        setSelectedLog(log)
        setShowDetailModal(true)
    }

    // Export logs
    const handleExport = () => {
        const csv = [
            ['ID', 'Timestamp', 'User', 'Action', 'Module', 'Description', 'Details'].join(','),
            ...filteredLogs.map(log => [
                log.id,
                log.timestamp,
                log.user,
                log.action,
                log.module,
                `"${log.description}"`,
                `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    // Clear filters
    const clearFilters = () => {
        setSearchQuery('')
        setModuleFilter('all')
        setActionFilter('all')
        setUserFilter('all')
        setDateRange('all')
    }

    const hasActiveFilters = searchQuery || moduleFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || dateRange !== 'all'

    return (
        <PageWrapper
            title="Audit Log"
            subtitle="View system activity and transaction history"
            actions={
                <div className="flex items-center gap-3">
                    <Button variant="outline" leftIcon={Download} onClick={handleExport}>
                        Export CSV
                    </Button>
                    <Button variant="outline" leftIcon={Printer}>
                        Print
                    </Button>
                </div>
            }
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Total Logs</p>
                            <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Today</p>
                            <p className="text-xl font-bold text-emerald-600">{stats.today}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Transactions</p>
                            <p className="text-xl font-bold text-amber-600">{stats.transactions}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Overrides</p>
                            <p className="text-xl font-bold text-red-600">{stats.overrides}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search & Filters */}
            <Card className="p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={Search}
                        />
                    </div>

                    <Select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        options={[
                            { value: 'all', label: 'All Time' },
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'This Week' },
                            { value: 'month', label: 'This Month' },
                        ]}
                        className="w-36"
                    />

                    <Button
                        variant="outline"
                        leftIcon={Filter}
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(showFilters && 'bg-zinc-100')}
                    >
                        Filters
                        {hasActiveFilters && (
                            <span className="ml-2 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                                !
                            </span>
                        )}
                    </Button>

                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-zinc-200"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select
                                label="Module"
                                value={moduleFilter}
                                onChange={(e) => setModuleFilter(e.target.value)}
                                options={[
                                    { value: 'all', label: 'All Modules' },
                                    ...Object.entries(moduleConfig).map(([key, val]) => ({
                                        value: key,
                                        label: val.label,
                                    }))
                                ]}
                            />

                            <Select
                                label="Action"
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                options={[
                                    { value: 'all', label: 'All Actions' },
                                    ...Object.entries(actionConfig).map(([key, val]) => ({
                                        value: key,
                                        label: val.label,
                                    }))
                                ]}
                            />

                            <Select
                                label="User"
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                                options={[
                                    { value: 'all', label: 'All Users' },
                                    ...uniqueUsers.map(user => ({
                                        value: user,
                                        label: user,
                                    }))
                                ]}
                            />
                        </div>
                    </motion.div>
                )}
            </Card>

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-zinc-500">
                    Showing <strong>{filteredLogs.length}</strong> of {logs.length} logs
                </p>
            </div>

            {/* Log List */}
            <Card className="overflow-hidden">
                {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-zinc-800 mb-2">No Logs Found</h3>
                        <p className="text-zinc-500">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {filteredLogs.map((log, index) => {
                            const action = actionConfig[log.action] || { label: log.action, icon: Activity, color: 'zinc' }
                            const module = moduleConfig[log.module] || { label: log.module, color: 'zinc' }
                            const ActionIcon = action.icon

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                                    className="p-4 hover:bg-zinc-50 cursor-pointer transition-colors"
                                    onClick={() => openDetail(log)}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={cn(
                                            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                                            action.color === 'blue' && 'bg-blue-100',
                                            action.color === 'emerald' && 'bg-emerald-100',
                                            action.color === 'amber' && 'bg-amber-100',
                                            action.color === 'red' && 'bg-red-100',
                                            action.color === 'zinc' && 'bg-zinc-100',
                                        )}>
                                            <ActionIcon className={cn(
                                                'w-5 h-5',
                                                action.color === 'blue' && 'text-blue-600',
                                                action.color === 'emerald' && 'text-emerald-600',
                                                action.color === 'amber' && 'text-amber-600',
                                                action.color === 'red' && 'text-red-600',
                                                action.color === 'zinc' && 'text-zinc-600',
                                            )} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-zinc-800">{log.description}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5" />
                                                    {log.user}
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {module.label}
                                                </Badge>
                                                <span className="text-zinc-400">•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatRelativeTime(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Badge */}
                                        <Badge variant={
                                            action.color === 'emerald' ? 'success' :
                                                action.color === 'amber' ? 'warning' :
                                                    action.color === 'red' ? 'error' :
                                                        action.color === 'blue' ? 'info' : 'secondary'
                                        }>
                                            {action.label}
                                        </Badge>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </Card>

            {/* Detail Modal */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title="Log Details"
                size="md"
            >
                {selectedLog && (
                    <div className="p-5">
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-6">
                            {(() => {
                                const action = actionConfig[selectedLog.action] || { icon: Activity, color: 'zinc' }
                                const ActionIcon = action.icon
                                return (
                                    <div className={cn(
                                        'w-12 h-12 rounded-xl flex items-center justify-center',
                                        action.color === 'blue' && 'bg-blue-100',
                                        action.color === 'emerald' && 'bg-emerald-100',
                                        action.color === 'amber' && 'bg-amber-100',
                                        action.color === 'red' && 'bg-red-100',
                                        action.color === 'zinc' && 'bg-zinc-100',
                                    )}>
                                        <ActionIcon className={cn(
                                            'w-6 h-6',
                                            action.color === 'blue' && 'text-blue-600',
                                            action.color === 'emerald' && 'text-emerald-600',
                                            action.color === 'amber' && 'text-amber-600',
                                            action.color === 'red' && 'text-red-600',
                                            action.color === 'zinc' && 'text-zinc-600',
                                        )} />
                                    </div>
                                )
                            })()}
                            <div>
                                <p className="font-semibold text-zinc-800">{selectedLog.description}</p>
                                <p className="text-sm text-zinc-500">{selectedLog.id}</p>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                                <span className="text-zinc-500">Timestamp</span>
                                <span className="font-medium">{formatTimestamp(selectedLog.timestamp)}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                                <span className="text-zinc-500">User</span>
                                <span className="font-medium">{selectedLog.user}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                                <span className="text-zinc-500">Module</span>
                                <Badge variant="secondary">{moduleConfig[selectedLog.module]?.label || selectedLog.module}</Badge>
                            </div>
                            <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                                <span className="text-zinc-500">Action</span>
                                <Badge variant={
                                    actionConfig[selectedLog.action]?.color === 'emerald' ? 'success' :
                                        actionConfig[selectedLog.action]?.color === 'amber' ? 'warning' :
                                            actionConfig[selectedLog.action]?.color === 'red' ? 'error' : 'info'
                                }>
                                    {actionConfig[selectedLog.action]?.label || selectedLog.action}
                                </Badge>
                            </div>
                            {selectedLog.ip && (
                                <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                                    <span className="text-zinc-500">IP Address</span>
                                    <span className="font-mono text-sm">{selectedLog.ip}</span>
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-zinc-700 mb-2">Additional Details</p>
                                <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
                                    <pre className="text-sm text-emerald-400 font-mono">
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <Button variant="outline" fullWidth onClick={() => setShowDetailModal(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </PageWrapper>
    )
}