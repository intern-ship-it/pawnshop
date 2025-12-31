import { useState, useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  QrCode,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  AlertTriangle,
  Package,
  Search,
  Play,
  Pause,
  RotateCcw,
  Printer,
  Download,
  Clock,
  User,
  Calendar,
  Barcode,
  ScanLine,
  MapPin,
  FileText,
  Check,
  X,
  Info,
  Zap,
} from 'lucide-react'

export default function StockReconciliation() {
  const dispatch = useAppDispatch()
  const { pledges } = useAppSelector((state) => state.pledges)
  const inputRef = useRef(null)

  // State
  const [selectedRack, setSelectedRack] = useState('all')
  const [isReconciling, setIsReconciling] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scannedItems, setScannedItems] = useState([])
  const [reconciliationStartTime, setReconciliationStartTime] = useState(null)

  // Modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false)
  const [reconciliationNote, setReconciliationNote] = useState('')

  // Load pledges
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    dispatch(setPledges(storedPledges))
  }, [dispatch])

  // Get racks from settings
  const racks = useMemo(() => {
    const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {})
    return settings.racks || [
      { id: 'A', name: 'Rack A' },
      { id: 'B', name: 'Rack B' },
      { id: 'C', name: 'Rack C' },
    ]
  }, [])

  // Build expected items list based on selected rack
  const expectedItems = useMemo(() => {
    const items = []

    pledges.forEach(pledge => {
      if (pledge.status === 'active' || pledge.status === 'overdue') {
        const rackLocation = pledge.rackLocation?.toUpperCase() || ''

        // Filter by selected rack
        if (selectedRack !== 'all') {
          if (!rackLocation.startsWith(selectedRack + '-') && rackLocation !== selectedRack) {
            return
          }
        }

        // Add each item from the pledge
        (pledge.items || []).forEach((item, idx) => {
          items.push({
            barcode: item.barcode || `${pledge.id}-${idx + 1}`,
            pledgeId: pledge.id,
            pledgeNo: pledge.pledgeNo || pledge.id,
            category: item.category,
            weight: item.weight,
            purity: item.purity,
            rackLocation: rackLocation,
            customerName: pledge.customerName,
          })
        })
      }
    })

    return items
  }, [pledges, selectedRack])

  // Calculate reconciliation stats
  const stats = useMemo(() => {
    const scannedBarcodes = new Set(scannedItems.map(s => s.barcode))
    const expectedBarcodes = new Set(expectedItems.map(e => e.barcode))

    const matched = scannedItems.filter(s => expectedBarcodes.has(s.barcode))
    const unexpected = scannedItems.filter(s => !expectedBarcodes.has(s.barcode))
    const missing = expectedItems.filter(e => !scannedBarcodes.has(e.barcode))

    return {
      expected: expectedItems.length,
      scanned: scannedItems.length,
      matched: matched.length,
      unexpected: unexpected.length,
      missing: missing.length,
      matchedItems: matched,
      unexpectedItems: unexpected,
      missingItems: missing,
      progress: expectedItems.length > 0 ? Math.round((matched.length / expectedItems.length) * 100) : 0,
    }
  }, [scannedItems, expectedItems])

  // Start reconciliation
  const handleStart = () => {
    setIsReconciling(true)
    setReconciliationStartTime(new Date())
    setScannedItems([])
    setTimeout(() => inputRef.current?.focus(), 100)
    dispatch(addToast({
      type: 'info',
      title: 'Reconciliation Started',
      message: `Scanning ${stats.expected} items in ${selectedRack === 'all' ? 'all racks' : selectedRack}`,
    }))
  }

  // Handle scan
  const handleScan = (e) => {
    e?.preventDefault()
    const barcode = scanInput.trim().toUpperCase()

    if (!barcode) return

    // Check if already scanned
    if (scannedItems.find(s => s.barcode === barcode)) {
      dispatch(addToast({ type: 'warning', title: 'Duplicate', message: 'Item already scanned' }))
      setScanInput('')
      return
    }

    // Find in expected items
    const expectedItem = expectedItems.find(e => e.barcode === barcode)

    const newItem = {
      barcode,
      timestamp: new Date().toISOString(),
      status: expectedItem ? 'matched' : 'unexpected',
      ...(expectedItem || {}),
    }

    setScannedItems(prev => [newItem, ...prev])
    setScanInput('')

    // Play sound feedback (simulated)
    if (expectedItem) {
      dispatch(addToast({ type: 'success', title: 'Matched', message: barcode }))
    } else {
      dispatch(addToast({ type: 'error', title: 'Unexpected Item', message: `${barcode} not in expected list` }))
    }
  }

  // Simulate scanning a random expected item (for demo)
  const handleSimulateScan = () => {
    const unscanned = expectedItems.filter(e => !scannedItems.find(s => s.barcode === e.barcode))
    if (unscanned.length > 0) {
      const randomItem = unscanned[Math.floor(Math.random() * unscanned.length)]
      setScanInput(randomItem.barcode)
      setTimeout(() => handleScan(), 100)
    } else {
      dispatch(addToast({ type: 'info', title: 'Complete', message: 'All items have been scanned' }))
    }
  }

  // Reset reconciliation
  const handleReset = () => {
    setIsReconciling(false)
    setScannedItems([])
    setReconciliationStartTime(null)
    setScanInput('')
  }

  // Complete reconciliation
  const handleComplete = () => {
    // Save reconciliation record
    const reconciliations = getStorageItem('reconciliations', [])
    const newRecon = {
      id: `RECON-${Date.now()}`,
      date: new Date().toISOString(),
      rack: selectedRack,
      startTime: reconciliationStartTime?.toISOString(),
      endTime: new Date().toISOString(),
      expected: stats.expected,
      scanned: stats.scanned,
      matched: stats.matched,
      missing: stats.missing,
      unexpected: stats.unexpected,
      status: stats.missing > 0 || stats.unexpected > 0 ? 'discrepancy' : 'complete',
      note: reconciliationNote,
      performedBy: 'Admin User',
    }
    setStorageItem('reconciliations', [...reconciliations, newRecon])

    setShowCompleteModal(false)
    handleReset()

    dispatch(addToast({
      type: 'success',
      title: 'Reconciliation Complete',
      message: stats.missing === 0 && stats.unexpected === 0
        ? 'All items verified successfully'
        : `Completed with ${stats.missing + stats.unexpected} discrepancies`,
    }))
  }

  // Format elapsed time
  const getElapsedTime = () => {
    if (!reconciliationStartTime) return '00:00'
    const elapsed = Math.floor((new Date() - reconciliationStartTime) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <PageWrapper
      title="Stock Reconciliation"
      subtitle="Verify physical inventory against system records"
      actions={
        <div className="flex items-center gap-2">
          {!isReconciling ? (
            <Button variant="accent" leftIcon={Play} onClick={handleStart}>
              Start Reconciliation
            </Button>
          ) : (
            <>
              <Button variant="outline" leftIcon={RotateCcw} onClick={handleReset}>
                Reset
              </Button>
              <Button
                variant="accent"
                leftIcon={CheckCircle}
                onClick={() => setShowCompleteModal(true)}
                disabled={stats.scanned === 0}
              >
                Complete
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Expected</p>
              <p className="text-xl font-bold text-zinc-800">{stats.expected}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Scanned</p>
              <p className="text-xl font-bold text-amber-600">{stats.scanned}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Matched</p>
              <p className="text-xl font-bold text-emerald-600">{stats.matched}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Missing</p>
              <p className="text-xl font-bold text-red-600">{stats.missing}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Unexpected</p>
              <p className="text-xl font-bold text-orange-600">{stats.unexpected}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="space-y-6">
          {/* Rack Selection */}
          <Card className="p-4">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              Select Area
            </h3>
            <Select
              value={selectedRack}
              onChange={(e) => setSelectedRack(e.target.value)}
              options={[
                { value: 'all', label: 'All Racks' },
                ...racks.map(r => ({ value: r.id, label: r.name })),
              ]}
              disabled={isReconciling}
            />
            <p className="text-xs text-zinc-500 mt-2">
              {stats.expected} items to verify in {selectedRack === 'all' ? 'all racks' : selectedRack}
            </p>
          </Card>

          {/* Scanner */}
          <Card className="p-4">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-500" />
              Barcode Scanner
            </h3>

            {isReconciling ? (
              <form onSubmit={handleScan}>
                <Input
                  ref={inputRef}
                  placeholder="Scan barcode..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                  leftIcon={Barcode}
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <Button type="submit" variant="accent" fullWidth leftIcon={ScanLine}>
                    Verify
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSimulateScan} title="Demo: Scan random item">
                    <Zap className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6">
                <QrCode className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Click "Start Reconciliation" to begin</p>
              </div>
            )}

            {/* Timer */}
            {isReconciling && (
              <div className="mt-4 pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Elapsed
                  </span>
                  <span className="font-mono font-bold text-zinc-800">{getElapsedTime()}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Progress */}
          {isReconciling && (
            <Card className="p-4">
              <h3 className="font-semibold text-zinc-800 mb-4">Progress</h3>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Verified</span>
                  <span className="font-medium">{stats.progress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                {stats.matched} of {stats.expected} items verified
              </p>
            </Card>
          )}

          {/* Quick Actions */}
          {isReconciling && stats.missing > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">{stats.missing} Missing Items</p>
                  <p className="text-sm text-red-600 mt-1">Some items haven't been scanned yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowDiscrepancyModal(true)}
                  >
                    View Missing Items
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Scanned Items List */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-500" />
                Scanned Items
              </h3>
              {scannedItems.length > 0 && (
                <Badge variant="info">{scannedItems.length} items</Badge>
              )}
            </div>

            <div className="p-4 max-h-[500px] overflow-y-auto">
              {scannedItems.length === 0 ? (
                <div className="text-center py-12">
                  <ScanLine className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-500">No items scanned yet</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {isReconciling ? 'Scan barcodes to verify items' : 'Start reconciliation to begin'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {scannedItems.map((item, index) => (
                      <motion.div
                        key={item.barcode}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border',
                          item.status === 'matched'
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-orange-50 border-orange-200'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {item.status === 'matched' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                          )}
                          <div>
                            <code className="font-mono text-sm font-medium">{item.barcode}</code>
                            {item.category && (
                              <p className="text-xs text-zinc-500">
                                {item.category} • {item.pledgeNo}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={item.status === 'matched' ? 'success' : 'warning'}>
                            {item.status === 'matched' ? 'Matched' : 'Unexpected'}
                          </Badge>
                          <span className="text-xs text-zinc-400">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Complete Reconciliation Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Reconciliation"
        size="md"
      >
        <div className="p-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-600">{stats.matched}</p>
              <p className="text-xs text-emerald-700">Matched</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats.missing}</p>
              <p className="text-xs text-red-700">Missing</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{stats.unexpected}</p>
              <p className="text-xs text-orange-700">Unexpected</p>
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            'p-4 rounded-xl mb-6',
            stats.missing === 0 && stats.unexpected === 0
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          )}>
            <div className="flex items-center gap-3">
              {stats.missing === 0 && stats.unexpected === 0 ? (
                <>
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-800">All Items Verified</p>
                    <p className="text-sm text-emerald-600">No discrepancies found</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="font-medium text-red-800">Discrepancies Found</p>
                    <p className="text-sm text-red-600">
                      {stats.missing} missing, {stats.unexpected} unexpected items
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              rows={3}
              placeholder="Add any notes about this reconciliation..."
              value={reconciliationNote}
              onChange={(e) => setReconciliationNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth leftIcon={Check} onClick={handleComplete}>
              Complete & Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Missing Items Modal */}
      <Modal
        isOpen={showDiscrepancyModal}
        onClose={() => setShowDiscrepancyModal(false)}
        title="Missing Items"
        size="md"
      >
        <div className="p-5">
          <div className="p-3 bg-red-50 rounded-lg mb-4">
            <p className="text-sm text-red-700">
              <strong>{stats.missing}</strong> items have not been scanned yet
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {stats.missingItems.map((item, index) => (
              <div
                key={item.barcode}
                className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <div>
                    <code className="font-mono text-sm">{item.barcode}</code>
                    <p className="text-xs text-zinc-500">{item.category} • {item.rackLocation}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{item.pledgeNo}</p>
                  <p className="text-xs text-zinc-400">{item.customerName}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" fullWidth className="mt-4" onClick={() => setShowDiscrepancyModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}