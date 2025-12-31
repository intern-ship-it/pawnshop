import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  Package,
  Search,
  Filter,
  MapPin,
  Scale,
  Gem,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  Printer,
  Grid3X3,
  List,
  X,
  Save,
  Box,
  Barcode,
  CheckSquare,
  Square,
  RotateCcw,
} from 'lucide-react'

// Purity labels
const purityLabels = {
  '999': '999 (24K)',
  '916': '916 (22K)',
  '875': '875 (21K)',
  '750': '750 (18K)',
  '585': '585 (14K)',
  '375': '375 (9K)',
}

// Status config
const statusConfig = {
  active: { label: 'In Storage', variant: 'success', icon: CheckCircle, color: 'emerald' },
  overdue: { label: 'Overdue', variant: 'error', icon: AlertTriangle, color: 'red' },
  redeemed: { label: 'Released', variant: 'secondary', icon: Package, color: 'zinc' },
  forfeited: { label: 'Forfeited', variant: 'warning', icon: Clock, color: 'amber' },
}

// Label sizes
const labelSizes = [
  { id: 'small', name: 'Small (25x15mm)', width: 25, height: 15 },
  { id: 'medium', name: 'Medium (50x25mm)', width: 50, height: 25 },
  { id: 'large', name: 'Large (70x35mm)', width: 70, height: 35 },
  { id: 'sticker', name: 'Item Sticker (40x20mm)', width: 40, height: 20 },
]

export default function InventoryList() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { pledges } = useAppSelector((state) => state.pledges)

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [purityFilter, setPurityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [rackFilter, setRackFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table')
  const [showFilters, setShowFilters] = useState(false)

  // Selection state
  const [selectedItems, setSelectedItems] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // Modal state
  const [showRackModal, setShowRackModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [rackLocation, setRackLocation] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [labelSize, setLabelSize] = useState('medium')
  const [printQuantity, setPrintQuantity] = useState(1)

  // Load pledges on mount
  useEffect(() => {
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    dispatch(setPledges(storedPledges))
  }, [dispatch])

  // Flatten all items from pledges
  const allItems = useMemo(() => {
    return pledges.flatMap(pledge =>
      (pledge.items || []).map((item, idx) => ({
        ...item,
        itemIndex: idx,
        pledgeId: pledge.id,
        pledgeNo: pledge.pledgeNo || pledge.id,
        pledgeStatus: pledge.status,
        customerName: pledge.customerName,
        customerIC: pledge.customerIC,
        createdAt: pledge.createdAt,
        dueDate: pledge.dueDate,
        rackLocation: pledge.rackLocation || item.rackLocation,
        loanAmount: pledge.loanAmount,
      }))
    )
  }, [pledges])

  // Get unique categories and racks
  const categories = useMemo(() => [...new Set(allItems.map(item => item.category).filter(Boolean))], [allItems])
  const racks = useMemo(() => [...new Set(allItems.map(item => item.rackLocation).filter(Boolean))].sort(), [allItems])

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchBarcode = item.barcode?.toLowerCase().includes(query)
        const matchPledge = item.pledgeId?.toLowerCase().includes(query) || item.pledgeNo?.toLowerCase().includes(query)
        const matchCustomer = item.customerName?.toLowerCase().includes(query)
        const matchCategory = item.category?.toLowerCase().includes(query)
        const matchRack = item.rackLocation?.toLowerCase().includes(query)
        if (!matchBarcode && !matchPledge && !matchCustomer && !matchCategory && !matchRack) return false
      }
      if (purityFilter !== 'all' && item.purity !== purityFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (rackFilter !== 'all') {
        if (rackFilter === 'unassigned' && item.rackLocation) return false
        if (rackFilter !== 'unassigned' && item.rackLocation !== rackFilter) return false
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && item.pledgeStatus !== 'active') return false
        if (statusFilter === 'overdue' && item.pledgeStatus !== 'overdue') return false
        if (statusFilter === 'redeemed' && item.pledgeStatus !== 'redeemed') return false
      }
      return true
    })
  }, [allItems, searchQuery, purityFilter, categoryFilter, rackFilter, statusFilter])

  // Calculate stats
  const stats = useMemo(() => {
    const inStorage = allItems.filter(i => i.pledgeStatus === 'active' || i.pledgeStatus === 'overdue')
    return {
      totalItems: inStorage.length,
      totalWeight: inStorage.reduce((sum, i) => sum + (parseFloat(i.weight) || 0), 0),
      totalValue: inStorage.reduce((sum, i) => sum + (i.netValue || 0), 0),
      noLocation: inStorage.filter(i => !i.rackLocation).length,
      overdue: allItems.filter(i => i.pledgeStatus === 'overdue').length,
    }
  }, [allItems])

  // Handle selection
  const toggleItemSelection = (barcode) => {
    setSelectedItems(prev =>
      prev.includes(barcode)
        ? prev.filter(b => b !== barcode)
        : [...prev, barcode]
    )
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map(i => i.barcode))
    }
    setSelectAll(!selectAll)
  }

  const clearSelection = () => {
    setSelectedItems([])
    setSelectAll(false)
  }

  // Save rack location
  const handleSaveRack = () => {
    if (!selectedItem) return
    const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
    const updatedPledges = storedPledges.map(pledge => {
      if (pledge.id === selectedItem.pledgeId) {
        return { ...pledge, rackLocation }
      }
      return pledge
    })
    setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
    dispatch(setPledges(updatedPledges))
    setShowRackModal(false)
    setSelectedItem(null)
    setRackLocation('')
    dispatch(addToast({ type: 'success', title: 'Location Updated', message: `Rack location set to ${rackLocation}` }))
  }

  // Open rack modal
  const openRackModal = (item) => {
    setSelectedItem(item)
    setRackLocation(item.rackLocation || '')
    setShowRackModal(true)
  }

  // Open print modal
  const openPrintModal = () => {
    setShowPrintModal(true)
  }

  // Handle print - opens new window with printable labels
  const handlePrint = () => {
    const itemsToPrint = selectedItems.length > 0
      ? filteredItems.filter(i => selectedItems.includes(i.barcode))
      : filteredItems.slice(0, 10)

    const labelConfig = labelSizes.find(l => l.id === labelSize)

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Labels - PawnSys</title>
        <style>
          @page { size: auto; margin: 5mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10px; }
          .header { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .header h2 { margin-bottom: 10px; }
          .header p { color: #666; margin-bottom: 15px; }
          .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-right: 10px; }
          .btn-print { background: #f59e0b; color: white; }
          .btn-close { background: #e5e5e5; color: #333; }
          .labels-container { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-start; }
          .label { border: 1px solid #ccc; padding: 8px; background: white; page-break-inside: avoid; border-radius: 4px; }
          .label-small { width: 100px; }
          .label-medium { width: 190px; }
          .label-large { width: 260px; }
          .label-sticker { width: 150px; }
          .company { font-size: 9px; font-weight: bold; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; }
          .barcode-area { text-align: center; margin: 8px 0; padding: 5px; background: #fafafa; }
          .barcode-lines { font-family: 'Libre Barcode 128', monospace; font-size: 40px; line-height: 1; }
          .barcode-text { font-family: monospace; font-size: 11px; letter-spacing: 1px; margin-top: 4px; }
          .details { font-size: 9px; }
          .details-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .details-row .label-text { color: #666; }
          .details-row .value { font-weight: bold; }
          .location { background: #e0f2fe; padding: 4px 8px; text-align: center; font-size: 10px; font-weight: bold; margin-top: 6px; border-radius: 3px; }
          .location-icon { margin-right: 3px; }
          @media print { .header { display: none; } body { padding: 0; } }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="header">
          <h2>🏷️ Label Print Preview</h2>
          <p><strong>${itemsToPrint.length}</strong> label(s) × <strong>${printQuantity}</strong> copy(s) = <strong>${itemsToPrint.length * printQuantity}</strong> total labels</p>
          <p>Size: <strong>${labelConfig.name}</strong></p>
          <button class="btn btn-print" onclick="window.print()">🖨️ Print Now</button>
          <button class="btn btn-close" onclick="window.close()">✕ Close</button>
        </div>
        
        <div class="labels-container">
          ${itemsToPrint.map(item =>
      Array(printQuantity).fill(0).map(() => `
              <div class="label label-${labelSize}">
                <div class="company">PAWNSYS SDN BHD</div>
                <div class="barcode-area">
                  <div class="barcode-lines">*${item.barcode || 'N/A'}*</div>
                  <div class="barcode-text">${item.barcode || 'N/A'}</div>
                </div>
                <div class="details">
                  <div class="details-row">
                    <span class="label-text">Pledge:</span>
                    <span class="value">${item.pledgeNo || item.pledgeId}</span>
                  </div>
                  <div class="details-row">
                    <span class="label-text">Item:</span>
                    <span class="value">${item.category || 'Gold'} (${item.purity || 'N/A'})</span>
                  </div>
                  <div class="details-row">
                    <span class="label-text">Weight:</span>
                    <span class="value">${parseFloat(item.weight || 0).toFixed(2)}g</span>
                  </div>
                </div>
                ${item.rackLocation ? `<div class="location"><span class="location-icon">📍</span>${item.rackLocation}</div>` : ''}
              </div>
            `).join('')
    ).join('')}
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(printContent)
    printWindow.document.close()

    setShowPrintModal(false)
    dispatch(addToast({ type: 'success', title: 'Print Preview Opened', message: `${itemsToPrint.length * printQuantity} labels ready` }))
  }

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setPurityFilter('all')
    setCategoryFilter('all')
    setStatusFilter('active')
    setRackFilter('all')
  }

  const hasActiveFilters = searchQuery || purityFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active' || rackFilter !== 'all'

  return (
    <PageWrapper
      title="Inventory Management"
      subtitle="Track, locate, and manage all pledged items"
      actions={
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <Badge variant="info" className="mr-2">{selectedItems.length} selected</Badge>
          )}
          <Button variant="outline" leftIcon={Printer} onClick={openPrintModal}>
            Print Labels
          </Button>
          <Button variant="outline" leftIcon={Download}>
            Export
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Items</p>
              <p className="text-xl font-bold text-zinc-800">{stats.totalItems}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Weight</p>
              <p className="text-xl font-bold text-blue-600">{stats.totalWeight.toFixed(2)}g</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Gem className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Value</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overdue</p>
              <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">No Location</p>
              <p className="text-xl font-bold text-zinc-600">{stats.noLocation}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters Bar */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search barcode, pledge no, customer, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'In Storage' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'redeemed', label: 'Released' },
              ]}
              className="w-32"
            />

            <Button
              variant="outline"
              leftIcon={Filter}
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-zinc-100')}
            >
              Filters
              {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />}
            </Button>

            <div className="flex border border-zinc-200 rounded-lg overflow-hidden">
              <button
                className={cn('p-2 transition-colors', viewMode === 'table' ? 'bg-zinc-100' : 'hover:bg-zinc-50')}
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-zinc-100' : 'hover:bg-zinc-50')}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-200">
                <Select
                  label="Category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...categories.map(c => ({ value: c, label: c }))
                  ]}
                />
                <Select
                  label="Purity"
                  value={purityFilter}
                  onChange={(e) => setPurityFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Purities' },
                    ...Object.entries(purityLabels).map(([k, v]) => ({ value: k, label: v }))
                  ]}
                />
                <Select
                  label="Rack Location"
                  value={rackFilter}
                  onChange={(e) => setRackFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    { value: 'unassigned', label: '⚠️ Unassigned' },
                    ...racks.map(r => ({ value: r, label: r }))
                  ]}
                />
                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} leftIcon={RotateCcw}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Selection Actions Bar */}
      {selectedItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="p-3 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">{selectedItems.length} item(s) selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="accent" leftIcon={Printer} onClick={openPrintModal}>
                  Print Selected
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          Showing <strong>{filteredItems.length}</strong> items
        </p>
        <button className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1" onClick={toggleSelectAll}>
          {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {selectAll ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Items Display */}
      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="p-4 text-left w-10">
                        <button onClick={toggleSelectAll}>
                          {selectAll ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5 text-zinc-400" />}
                        </button>
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Item</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Barcode</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Pledge</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Customer</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Weight</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Purity</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Location</th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                      <th className="p-4 text-center text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-12 text-center">
                          <Box className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                          <p className="text-zinc-500">No items found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, index) => {
                        const status = statusConfig[item.pledgeStatus] || statusConfig.active
                        const StatusIcon = status.icon
                        const isSelected = selectedItems.includes(item.barcode)

                        return (
                          <motion.tr
                            key={`${item.barcode}-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(index * 0.02, 0.3) }}
                            className={cn('hover:bg-zinc-50 transition-colors', isSelected && 'bg-amber-50')}
                          >
                            <td className="p-4">
                              <button onClick={() => toggleItemSelection(item.barcode)}>
                                {isSelected ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5 text-zinc-300 hover:text-zinc-400" />}
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center overflow-hidden">
                                  {item.photo ? (
                                    <img src={item.photo} alt="" className="w-full h-full object-cover cursor-pointer"
                                      onClick={() => { setSelectedImage(item.photo); setShowImageModal(true) }} />
                                  ) : (
                                    <Package className="w-5 h-5 text-zinc-400" />
                                  )}
                                </div>
                                <span className="font-medium text-zinc-800 capitalize">{item.category}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Barcode className="w-4 h-4 text-zinc-400" />
                                <code className="text-sm font-mono bg-zinc-100 px-2 py-1 rounded">{item.barcode || 'N/A'}</code>
                              </div>
                            </td>
                            <td className="p-4">
                              <button onClick={() => navigate(`/pledges/${item.pledgeId}`)} className="text-amber-600 hover:text-amber-700 font-medium text-sm">
                                {item.pledgeNo || item.pledgeId}
                              </button>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-zinc-800">{item.customerName}</p>
                            </td>
                            <td className="p-4">
                              <span className="font-semibold">{parseFloat(item.weight || 0).toFixed(2)}g</span>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{item.purity || 'N/A'}</Badge>
                            </td>
                            <td className="p-4">
                              {item.rackLocation ? (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium text-blue-600">{item.rackLocation}</span>
                                </div>
                              ) : (
                                <span className="text-red-500 text-sm flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge variant={status.variant}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon-sm" title="View Pledge" onClick={() => navigate(`/pledges/${item.pledgeId}`)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" title="Print Label"
                                  onClick={() => { setSelectedItems([item.barcode]); openPrintModal() }}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {(item.pledgeStatus === 'active' || item.pledgeStatus === 'overdue') && (
                                  <Button variant="ghost" size="icon-sm" title="Set Location" onClick={() => openRackModal(item)}>
                                    <MapPin className="w-4 h-4" />
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
            </Card>
          </motion.div>
        ) : (
          /* Grid View */
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.length === 0 ? (
              <Card className="col-span-full p-12 text-center">
                <Box className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-500">No items found</p>
              </Card>
            ) : (
              filteredItems.map((item, index) => {
                const status = statusConfig[item.pledgeStatus] || statusConfig.active
                const isSelected = selectedItems.includes(item.barcode)

                return (
                  <motion.div key={`${item.barcode}-${index}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}>
                    <Card className={cn('overflow-hidden hover:shadow-lg transition-all relative', isSelected && 'ring-2 ring-amber-500')}>
                      <div className="absolute top-2 left-2 z-10">
                        <button onClick={(e) => { e.stopPropagation(); toggleItemSelection(item.barcode) }}
                          className="w-6 h-6 rounded bg-white/80 flex items-center justify-center">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-amber-500" /> : <Square className="w-5 h-5 text-zinc-400" />}
                        </button>
                      </div>
                      <div className="aspect-square bg-zinc-100 relative">
                        {item.photo ? (
                          <img src={item.photo} alt={item.category} className="w-full h-full object-cover"
                            onClick={() => { setSelectedImage(item.photo); setShowImageModal(true) }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-zinc-300" />
                          </div>
                        )}
                        <Badge variant={status.variant} className="absolute top-2 right-2">{status.label}</Badge>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-zinc-800 capitalize text-sm">{item.category}</span>
                          <Badge variant="outline" className="text-xs">{item.purity}</Badge>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono mb-2 truncate">{item.barcode}</p>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-zinc-600">{parseFloat(item.weight || 0).toFixed(2)}g</span>
                          <span className="font-semibold text-emerald-600">{formatCurrency(item.netValue || 0)}</span>
                        </div>
                        {item.rackLocation ? (
                          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            <MapPin className="w-3 h-3" />{item.rackLocation}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                            <AlertTriangle className="w-3 h-3" />No location
                          </div>
                        )}
                        <div className="flex gap-1 mt-3">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/pledges/${item.pledgeId}`)}>
                            <Eye className="w-3 h-3 mr-1" />View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedItems([item.barcode]); openPrintModal() }}>
                            <Printer className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rack Location Modal */}
      <Modal isOpen={showRackModal} onClose={() => setShowRackModal(false)} title="Set Storage Location" size="sm">
        <div className="p-5">
          {selectedItem && (
            <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium capitalize">{selectedItem.category} - {selectedItem.purity}</p>
                  <p className="text-xs text-zinc-500 font-mono">{selectedItem.barcode}</p>
                  <p className="text-xs text-zinc-400">{selectedItem.pledgeNo || selectedItem.pledgeId}</p>
                </div>
              </div>
            </div>
          )}
          <Input label="Rack / Locker Location" placeholder="e.g., A-01, B-05, SAFE-1"
            value={rackLocation} onChange={(e) => setRackLocation(e.target.value.toUpperCase())}
            leftIcon={MapPin} helperText="Enter rack code (e.g., A-01 means Rack A, Slot 01)" />
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Quick Select:</p>
            <div className="flex flex-wrap gap-2">
              {['A-01', 'A-02', 'B-01', 'B-02', 'C-01', 'SAFE-1'].map(loc => (
                <button key={loc} onClick={() => setRackLocation(loc)}
                  className={cn('px-3 py-1 text-sm rounded-lg border transition-colors',
                    rackLocation === loc ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-zinc-200 hover:bg-zinc-50')}>
                  {loc}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" fullWidth onClick={() => setShowRackModal(false)}>Cancel</Button>
            <Button variant="accent" fullWidth leftIcon={Save} onClick={handleSaveRack}>Save Location</Button>
          </div>
        </div>
      </Modal>

      {/* Print Labels Modal */}
      <Modal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} title="Print Barcode Labels" size="md">
        <div className="p-5">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-zinc-700">Items to Print</p>
              <Badge variant="info">{selectedItems.length > 0 ? selectedItems.length : Math.min(filteredItems.length, 10)} labels</Badge>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg max-h-32 overflow-y-auto">
              {selectedItems.length > 0 ? (
                <div className="space-y-1">
                  {filteredItems.filter(i => selectedItems.includes(i.barcode)).slice(0, 5).map(item => (
                    <div key={item.barcode} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{item.barcode}</span>
                      <span className="text-zinc-500 capitalize">{item.category}</span>
                    </div>
                  ))}
                  {selectedItems.length > 5 && <p className="text-xs text-zinc-400">...and {selectedItems.length - 5} more</p>}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No items selected. Will print first 10 items from filtered list.</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Label Size</label>
            <div className="grid grid-cols-2 gap-2">
              {labelSizes.map(size => (
                <button key={size.id} onClick={() => setLabelSize(size.id)}
                  className={cn('p-3 rounded-lg border-2 text-left transition-all',
                    labelSize === size.id ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300')}>
                  <p className="font-medium text-sm">{size.name}</p>
                  <p className="text-xs text-zinc-500">{size.width}mm × {size.height}mm</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Copies per Item</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(qty => (
                <button key={qty} onClick={() => setPrintQuantity(qty)}
                  className={cn('w-12 h-12 rounded-lg border-2 font-bold transition-all',
                    printQuantity === qty ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-zinc-200 hover:border-zinc-300')}>
                  {qty}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-zinc-700 mb-2">Label Preview</p>
            <div className="border border-zinc-200 rounded-lg p-4 bg-white">
              <div className="border border-dashed border-zinc-300 p-3 max-w-[200px] mx-auto">
                <p className="text-[8px] font-bold text-center border-b border-zinc-200 pb-1 mb-2">PAWNSYS SDN BHD</p>
                <div className="text-center mb-2 bg-zinc-50 p-2">
                  <p className="font-mono text-2xl tracking-wider">||||||||||||</p>
                  <p className="font-mono text-[10px]">PLG-2024-001-01</p>
                </div>
                <div className="text-[8px] space-y-1">
                  <div className="flex justify-between"><span>Pledge:</span><span className="font-bold">PLG-2024-001</span></div>
                  <div className="flex justify-between"><span>Item:</span><span className="font-bold">Ring (916)</span></div>
                  <div className="flex justify-between"><span>Weight:</span><span className="font-bold">5.25g</span></div>
                </div>
                <div className="mt-2 bg-blue-100 text-center text-[8px] font-bold py-1 rounded">📍 A-01</div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg mb-6">
            <div className="flex gap-2">
              <Printer className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">How Barcode Printing Works:</p>
                <ol className="list-decimal list-inside text-xs mt-1 space-y-1">
                  <li>Click "Generate Labels" to open print preview</li>
                  <li>A new window shows all labels ready to print</li>
                  <li>Click "Print Now" in the preview window</li>
                  <li>Select your label printer (Zebra, Brother, etc.)</li>
                  <li>Configure paper size to match label sheets</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowPrintModal(false)}>Cancel</Button>
            <Button variant="accent" fullWidth leftIcon={Printer} onClick={handlePrint}>Generate Labels</Button>
          </div>
        </div>
      </Modal>

      {/* Image Modal */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} title="Item Photo" size="lg">
        <div className="p-4">
          {selectedImage && <img src={selectedImage} alt="Item" className="w-full max-h-[70vh] object-contain rounded-lg" />}
        </div>
      </Modal>
    </PageWrapper>
  )
}