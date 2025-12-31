import { useState, useEffect, useMemo } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Badge, Modal } from '@/components/common'
import {
    Calendar,
    Clock,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Package,
    RefreshCw,
    Wallet,
    Gavel,
    Users,
    FileText,
    Printer,
    Download,
    CheckCircle,
    AlertTriangle,
    Lock,
    Unlock,
    Calculator,
    Banknote,
    CreditCard,
    Receipt,
    ArrowUpRight,
    ArrowDownRight,
    PiggyBank,
    X,
    Check,
    Info,
} from 'lucide-react'

export default function DayEndSummary() {
    const dispatch = useAppDispatch()

    // State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [isClosing, setIsClosing] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [dayStatus, setDayStatus] = useState('open') // 'open', 'closed'

    // Cash drawer
    const [cashDrawer, setCashDrawer] = useState({
        openingBalance: 5000,
        closingBalance: '',
        notes: '',
    })

    // Load data
    const [pledges, setPledges] = useState([])
    const [dayEndRecords, setDayEndRecords] = useState([])

    useEffect(() => {
        const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
        setPledges(storedPledges)

        const storedRecords = getStorageItem('dayEndRecords', [])
        setDayEndRecords(storedRecords)

        // Check if today is already closed
        const todayRecord = storedRecords.find(r => r.date === selectedDate)
        if (todayRecord) {
            setDayStatus('closed')
            setCashDrawer({
                openingBalance: todayRecord.openingBalance,
                closingBalance: todayRecord.closingBalance,
                notes: todayRecord.notes,
            })
        } else {
            setDayStatus('open')
        }
    }, [selectedDate])

    // Calculate daily transactions
    const dailyStats = useMemo(() => {
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)

        // Filter pledges created today
        const newPledges = pledges.filter(p => {
            const created = new Date(p.createdAt)
            return created >= startOfDay && created <= endOfDay
        })

        // Simulated transactions (in real app, these would come from transaction logs)
        const renewals = pledges.filter(p => {
            if (!p.renewalHistory) return false
            return p.renewalHistory.some(r => {
                const renewalDate = new Date(r.date)
                return renewalDate >= startOfDay && renewalDate <= endOfDay
            })
        })

        const redemptions = pledges.filter(p => {
            if (p.status !== 'redeemed' || !p.redeemedAt) return false
            const redeemed = new Date(p.redeemedAt)
            return redeemed >= startOfDay && redeemed <= endOfDay
        })

        // Calculate totals
        const newPledgesAmount = newPledges.reduce((sum, p) => sum + (p.loanAmount || 0), 0)
        const renewalInterest = renewals.reduce((sum, p) => {
            const todayRenewals = p.renewalHistory?.filter(r => {
                const d = new Date(r.date)
                return d >= startOfDay && d <= endOfDay
            }) || []
            return sum + todayRenewals.reduce((s, r) => s + (r.interestPaid || 0), 0)
        }, 0)
        const redemptionAmount = redemptions.reduce((sum, p) => sum + (p.redemptionTotal || p.loanAmount || 0), 0)

        // Cash flow
        const cashOut = newPledgesAmount // Money paid to customers
        const cashIn = renewalInterest + redemptionAmount // Money received from customers

        return {
            // Counts
            newPledgesCount: newPledges.length,
            renewalsCount: renewals.length,
            redemptionsCount: redemptions.length,

            // Amounts
            newPledgesAmount,
            renewalInterest,
            redemptionAmount,

            // Cash flow
            cashIn,
            cashOut,
            netCashFlow: cashIn - cashOut,

            // Items
            newPledges,
            renewals,
            redemptions,

            // Additional stats
            totalItemsAdded: newPledges.reduce((sum, p) => sum + (p.items?.length || 0), 0),
            totalWeight: newPledges.reduce((sum, p) =>
                sum + (p.items?.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0) || 0), 0
            ),
        }
    }, [pledges, selectedDate])

    // Expected closing balance
    const expectedClosing = useMemo(() => {
        return cashDrawer.openingBalance + dailyStats.cashIn - dailyStats.cashOut
    }, [cashDrawer.openingBalance, dailyStats])

    // Variance
    const variance = useMemo(() => {
        if (!cashDrawer.closingBalance) return 0
        return parseFloat(cashDrawer.closingBalance) - expectedClosing
    }, [cashDrawer.closingBalance, expectedClosing])

    // Handle day close
    const handleCloseDay = () => {
        if (!cashDrawer.closingBalance) {
            dispatch(addToast({ type: 'error', title: 'Error', message: 'Please enter closing balance' }))
            return
        }

        setIsClosing(true)

        setTimeout(() => {
            const record = {
                date: selectedDate,
                closedAt: new Date().toISOString(),
                closedBy: 'Admin User',
                openingBalance: cashDrawer.openingBalance,
                closingBalance: parseFloat(cashDrawer.closingBalance),
                expectedClosing,
                variance,
                ...dailyStats,
                notes: cashDrawer.notes,
            }

            const updatedRecords = [...dayEndRecords.filter(r => r.date !== selectedDate), record]
            setStorageItem('dayEndRecords', updatedRecords)
            setDayEndRecords(updatedRecords)

            setIsClosing(false)
            setShowCloseModal(false)
            setDayStatus('closed')

            dispatch(addToast({
                type: 'success',
                title: 'Day Closed',
                message: `Day end summary for ${selectedDate} has been saved`,
            }))
        }, 1000)
    }

    // Reopen day
    const handleReopenDay = () => {
        const updatedRecords = dayEndRecords.filter(r => r.date !== selectedDate)
        setStorageItem('dayEndRecords', updatedRecords)
        setDayEndRecords(updatedRecords)
        setDayStatus('open')
        setCashDrawer({ openingBalance: 5000, closingBalance: '', notes: '' })
        dispatch(addToast({ type: 'info', title: 'Day Reopened', message: 'You can now edit transactions' }))
    }

    // Print summary
    const handlePrint = () => {
        const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Day End Summary - ${selectedDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
          .section h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .positive { color: #059669; }
          .negative { color: #dc2626; }
          .total { font-size: 1.2em; background: #f5f5f5; padding: 10px; border-radius: 4px; }
          .signature { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Day End Summary</h1>
        <div class="header">
          <div><strong>Date:</strong> ${new Date(selectedDate).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div><strong>Status:</strong> ${dayStatus === 'closed' ? '🔒 CLOSED' : '🔓 OPEN'}</div>
        </div>

        <div class="section">
          <h3>📊 Transaction Summary</h3>
          <div class="row"><span class="label">New Pledges</span><span class="value">${dailyStats.newPledgesCount} (${formatCurrency(dailyStats.newPledgesAmount)})</span></div>
          <div class="row"><span class="label">Renewals</span><span class="value">${dailyStats.renewalsCount} (Interest: ${formatCurrency(dailyStats.renewalInterest)})</span></div>
          <div class="row"><span class="label">Redemptions</span><span class="value">${dailyStats.redemptionsCount} (${formatCurrency(dailyStats.redemptionAmount)})</span></div>
        </div>

        <div class="section">
          <h3>💰 Cash Flow</h3>
          <div class="row"><span class="label">Cash In (Received)</span><span class="value positive">+ ${formatCurrency(dailyStats.cashIn)}</span></div>
          <div class="row"><span class="label">Cash Out (Disbursed)</span><span class="value negative">- ${formatCurrency(dailyStats.cashOut)}</span></div>
          <div class="row total"><span class="label">Net Cash Flow</span><span class="value ${dailyStats.netCashFlow >= 0 ? 'positive' : 'negative'}">${dailyStats.netCashFlow >= 0 ? '+' : ''}${formatCurrency(dailyStats.netCashFlow)}</span></div>
        </div>

        <div class="section">
          <h3>🏦 Cash Drawer</h3>
          <div class="row"><span class="label">Opening Balance</span><span class="value">${formatCurrency(cashDrawer.openingBalance)}</span></div>
          <div class="row"><span class="label">Expected Closing</span><span class="value">${formatCurrency(expectedClosing)}</span></div>
          ${cashDrawer.closingBalance ? `<div class="row"><span class="label">Actual Closing</span><span class="value">${formatCurrency(parseFloat(cashDrawer.closingBalance))}</span></div>` : ''}
          ${cashDrawer.closingBalance ? `<div class="row"><span class="label">Variance</span><span class="value ${variance >= 0 ? 'positive' : 'negative'}">${variance >= 0 ? '+' : ''}${formatCurrency(variance)}</span></div>` : ''}
        </div>

        ${cashDrawer.notes ? `<div class="section"><h3>📝 Notes</h3><p>${cashDrawer.notes}</p></div>` : ''}

        <div class="signature">
          <div class="signature-line">Prepared By</div>
          <div class="signature-line">Verified By</div>
          <div class="signature-line">Manager Approval</div>
        </div>

        <p style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
          Generated on ${new Date().toLocaleString('en-MY')} | PawnSys
        </p>
      </body>
      </html>
    `

        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
    }

    return (
        <PageWrapper
            title="Day End Summary"
            subtitle="Daily closing report and cash reconciliation"
            actions={
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-44"
                    />
                    <Button variant="outline" leftIcon={Printer} onClick={handlePrint}>
                        Print
                    </Button>
                    <Button variant="outline" leftIcon={Download}>
                        Export
                    </Button>
                </div>
            }
        >
            {/* Status Banner */}
            <Card className={cn(
                'p-4 mb-6 border-2',
                dayStatus === 'closed'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {dayStatus === 'closed' ? (
                            <Lock className="w-6 h-6 text-emerald-600" />
                        ) : (
                            <Unlock className="w-6 h-6 text-amber-600" />
                        )}
                        <div>
                            <p className="font-semibold text-zinc-800">
                                {new Date(selectedDate).toLocaleDateString('en-MY', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className={cn(
                                'text-sm',
                                dayStatus === 'closed' ? 'text-emerald-600' : 'text-amber-600'
                            )}>
                                {dayStatus === 'closed' ? 'Day Closed' : 'Day Open - Transactions Active'}
                            </p>
                        </div>
                    </div>
                    {dayStatus === 'open' ? (
                        <Button variant="accent" leftIcon={Lock} onClick={() => setShowCloseModal(true)}>
                            Close Day
                        </Button>
                    ) : (
                        <Button variant="outline" leftIcon={Unlock} onClick={handleReopenDay}>
                            Reopen Day
                        </Button>
                    )}
                </div>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">New Pledges</p>
                            <p className="text-2xl font-bold text-zinc-800">{dailyStats.newPledgesCount}</p>
                            <p className="text-xs text-blue-600 font-medium">{formatCurrency(dailyStats.newPledgesAmount)}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Renewals</p>
                            <p className="text-2xl font-bold text-zinc-800">{dailyStats.renewalsCount}</p>
                            <p className="text-xs text-amber-600 font-medium">{formatCurrency(dailyStats.renewalInterest)} interest</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Redemptions</p>
                            <p className="text-2xl font-bold text-zinc-800">{dailyStats.redemptionsCount}</p>
                            <p className="text-xs text-emerald-600 font-medium">{formatCurrency(dailyStats.redemptionAmount)}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Items Added</p>
                            <p className="text-2xl font-bold text-zinc-800">{dailyStats.totalItemsAdded}</p>
                            <p className="text-xs text-purple-600 font-medium">{dailyStats.totalWeight.toFixed(2)}g total</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cash Flow Section */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Cash Flow */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-500" />
                            Cash Flow Summary
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Cash In */}
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-emerald-700">Cash In</span>
                                    <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                                </div>
                                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(dailyStats.cashIn)}</p>
                                <div className="mt-3 space-y-1 text-xs text-emerald-600">
                                    <div className="flex justify-between">
                                        <span>Interest</span>
                                        <span>{formatCurrency(dailyStats.renewalInterest)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Redemptions</span>
                                        <span>{formatCurrency(dailyStats.redemptionAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Cash Out */}
                            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-red-700">Cash Out</span>
                                    <ArrowUpRight className="w-5 h-5 text-red-500" />
                                </div>
                                <p className="text-2xl font-bold text-red-600">{formatCurrency(dailyStats.cashOut)}</p>
                                <div className="mt-3 space-y-1 text-xs text-red-600">
                                    <div className="flex justify-between">
                                        <span>New Loans</span>
                                        <span>{formatCurrency(dailyStats.newPledgesAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Net Flow */}
                            <div className={cn(
                                'p-4 rounded-xl border',
                                dailyStats.netCashFlow >= 0
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-orange-50 border-orange-200'
                            )}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={cn(
                                        'text-sm',
                                        dailyStats.netCashFlow >= 0 ? 'text-blue-700' : 'text-orange-700'
                                    )}>Net Flow</span>
                                    {dailyStats.netCashFlow >= 0 ? (
                                        <TrendingUp className="w-5 h-5 text-blue-500" />
                                    ) : (
                                        <TrendingDown className="w-5 h-5 text-orange-500" />
                                    )}
                                </div>
                                <p className={cn(
                                    'text-2xl font-bold',
                                    dailyStats.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'
                                )}>
                                    {dailyStats.netCashFlow >= 0 ? '+' : ''}{formatCurrency(dailyStats.netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Transaction Breakdown */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-amber-500" />
                            Transaction Breakdown
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-50">
                                    <tr>
                                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">Type</th>
                                        <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">Count</th>
                                        <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">Amount</th>
                                        <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">Direction</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    <tr className="hover:bg-zinc-50">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-500" />
                                                <span>New Pledges</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-medium">{dailyStats.newPledgesCount}</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(dailyStats.newPledgesAmount)}</td>
                                        <td className="p-3 text-center">
                                            <Badge variant="error">Cash Out</Badge>
                                        </td>
                                    </tr>
                                    <tr className="hover:bg-zinc-50">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="w-4 h-4 text-amber-500" />
                                                <span>Renewals (Interest)</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-medium">{dailyStats.renewalsCount}</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(dailyStats.renewalInterest)}</td>
                                        <td className="p-3 text-center">
                                            <Badge variant="success">Cash In</Badge>
                                        </td>
                                    </tr>
                                    <tr className="hover:bg-zinc-50">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <Wallet className="w-4 h-4 text-emerald-500" />
                                                <span>Redemptions</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-medium">{dailyStats.redemptionsCount}</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(dailyStats.redemptionAmount)}</td>
                                        <td className="p-3 text-center">
                                            <Badge variant="success">Cash In</Badge>
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-zinc-100 font-semibold">
                                    <tr>
                                        <td className="p-3">Total</td>
                                        <td className="p-3 text-center">{dailyStats.newPledgesCount + dailyStats.renewalsCount + dailyStats.redemptionsCount}</td>
                                        <td className="p-3 text-right">{formatCurrency(dailyStats.cashIn + dailyStats.cashOut)}</td>
                                        <td className="p-3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Cash Drawer Section */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                            <PiggyBank className="w-5 h-5 text-amber-500" />
                            Cash Drawer
                        </h3>

                        <div className="space-y-4">
                            {/* Opening Balance */}
                            <div className="p-4 bg-zinc-50 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-zinc-500">Opening Balance</span>
                                    <span className="text-lg font-bold">{formatCurrency(cashDrawer.openingBalance)}</span>
                                </div>
                            </div>

                            {/* Transactions */}
                            <div className="p-4 bg-zinc-50 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-emerald-600">+ Cash In</span>
                                    <span className="font-medium text-emerald-600">{formatCurrency(dailyStats.cashIn)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-red-600">- Cash Out</span>
                                    <span className="font-medium text-red-600">{formatCurrency(dailyStats.cashOut)}</span>
                                </div>
                            </div>

                            {/* Expected Closing */}
                            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-amber-700">Expected Closing</span>
                                    <span className="text-xl font-bold text-amber-700">{formatCurrency(expectedClosing)}</span>
                                </div>
                            </div>

                            {/* Actual Closing Input */}
                            {dayStatus === 'open' && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                                        Actual Closing Balance
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="Enter actual cash count"
                                        value={cashDrawer.closingBalance}
                                        onChange={(e) => setCashDrawer({ ...cashDrawer, closingBalance: e.target.value })}
                                        leftIcon={Banknote}
                                    />
                                </div>
                            )}

                            {/* Variance */}
                            {cashDrawer.closingBalance && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        'p-4 rounded-xl',
                                        variance === 0
                                            ? 'bg-emerald-50 border border-emerald-200'
                                            : 'bg-red-50 border border-red-200'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {variance === 0 ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                            )}
                                            <span className={cn(
                                                'text-sm font-medium',
                                                variance === 0 ? 'text-emerald-700' : 'text-red-700'
                                            )}>
                                                {variance === 0 ? 'Balanced' : 'Variance'}
                                            </span>
                                        </div>
                                        <span className={cn(
                                            'text-lg font-bold',
                                            variance === 0 ? 'text-emerald-600' : 'text-red-600'
                                        )}>
                                            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Notes */}
                            {dayStatus === 'open' && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                                        rows={3}
                                        placeholder="Any remarks for today..."
                                        value={cashDrawer.notes}
                                        onChange={(e) => setCashDrawer({ ...cashDrawer, notes: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Quick Info */}
                    <Card className="p-4 bg-blue-50 border-blue-200">
                        <div className="flex gap-3">
                            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-700">
                                <p className="font-medium">Day End Process</p>
                                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                                    <li>Review all transactions</li>
                                    <li>Count physical cash</li>
                                    <li>Enter closing balance</li>
                                    <li>Investigate variance if any</li>
                                    <li>Click "Close Day"</li>
                                </ol>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Close Day Modal */}
            <Modal
                isOpen={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                title="Close Day"
                size="md"
            >
                <div className="p-5">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-4 bg-zinc-50 rounded-xl">
                            <p className="text-2xl font-bold text-zinc-800">{dailyStats.newPledgesCount + dailyStats.renewalsCount + dailyStats.redemptionsCount}</p>
                            <p className="text-xs text-zinc-500">Total Transactions</p>
                        </div>
                        <div className={cn(
                            'text-center p-4 rounded-xl',
                            variance === 0 ? 'bg-emerald-50' : 'bg-red-50'
                        )}>
                            <p className={cn(
                                'text-2xl font-bold',
                                variance === 0 ? 'text-emerald-600' : 'text-red-600'
                            )}>
                                {variance === 0 ? 'Balanced' : formatCurrency(variance)}
                            </p>
                            <p className="text-xs text-zinc-500">Cash Variance</p>
                        </div>
                    </div>

                    {/* Warning if variance */}
                    {variance !== 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-red-800">Cash Variance Detected</p>
                                    <p className="text-sm text-red-600 mt-1">
                                        There is a {formatCurrency(Math.abs(variance))} {variance > 0 ? 'surplus' : 'shortage'}.
                                        Please verify your cash count before closing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmation */}
                    <p className="text-sm text-zinc-600 mb-6">
                        Are you sure you want to close the day? This will lock all transactions for {selectedDate}.
                    </p>

                    <div className="flex gap-3">
                        <Button variant="outline" fullWidth onClick={() => setShowCloseModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="accent"
                            fullWidth
                            leftIcon={Lock}
                            onClick={handleCloseDay}
                            loading={isClosing}
                        >
                            Close Day
                        </Button>
                    </div>
                </div>
            </Modal>
        </PageWrapper>
    )
}