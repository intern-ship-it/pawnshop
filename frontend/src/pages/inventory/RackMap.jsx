import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setPledges } from '@/features/pledges/pledgesSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { formatCurrency } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
    Grid3X3,
    Package,
    MapPin,
    Search,
    Plus,
    Eye,
    Edit,
    Trash2,
    Save,
    X,
    AlertTriangle,
    CheckCircle,
    Box,
    Layers,
    ArrowRight,
    RefreshCw,
    Printer,
    Download,
    Info,
    Clock,
    User,
} from 'lucide-react'

// Default racks configuration
const defaultRacks = [
    { id: 'A', name: 'Rack A', slots: 20, description: 'Main gold storage', rows: 4, cols: 5 },
    { id: 'B', name: 'Rack B', slots: 20, description: 'Secondary storage', rows: 4, cols: 5 },
    { id: 'C', name: 'Rack C', slots: 15, description: 'High value items', rows: 3, cols: 5 },
    { id: 'SAFE', name: 'Safe', slots: 10, description: 'Premium/large items', rows: 2, cols: 5 },
]

export default function RackMap() {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const { pledges } = useAppSelector((state) => state.pledges)

    // State
    const [racks, setRacks] = useState([])
    const [selectedRack, setSelectedRack] = useState(null)
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Modals
    const [showSlotModal, setShowSlotModal] = useState(false)
    const [showAddRackModal, setShowAddRackModal] = useState(false)
    const [showMoveModal, setShowMoveModal] = useState(false)

    // New rack form
    const [newRack, setNewRack] = useState({ id: '', name: '', slots: 20, description: '', rows: 4, cols: 5 })

    // Move form
    const [moveTarget, setMoveTarget] = useState('')

    // Load data
    useEffect(() => {
        // Load racks from settings
        const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {})
        const storedRacks = settings.racks || defaultRacks
        setRacks(storedRacks)

        // Load pledges
        const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
        dispatch(setPledges(storedPledges))

        // Select first rack by default
        if (storedRacks.length > 0 && !selectedRack) {
            setSelectedRack(storedRacks[0].id)
        }
    }, [dispatch])

    // Build slot occupancy map
    const slotOccupancy = useMemo(() => {
        const map = {}

        pledges.forEach(pledge => {
            if (pledge.rackLocation && (pledge.status === 'active' || pledge.status === 'overdue')) {
                const location = pledge.rackLocation.toUpperCase()
                if (!map[location]) {
                    map[location] = []
                }
                map[location].push({
                    pledgeId: pledge.id,
                    pledgeNo: pledge.pledgeNo || pledge.id,
                    customerName: pledge.customerName,
                    status: pledge.status,
                    itemCount: pledge.items?.length || 0,
                    totalWeight: pledge.items?.reduce((sum, i) => sum + (parseFloat(i.weight) || 0), 0) || 0,
                    loanAmount: pledge.loanAmount,
                    dueDate: pledge.dueDate,
                    createdAt: pledge.createdAt,
                })
            }
        })

        return map
    }, [pledges])

    // Calculate stats
    const stats = useMemo(() => {
        const totalSlots = racks.reduce((sum, r) => sum + (r.slots || 0), 0)
        const occupiedSlots = Object.keys(slotOccupancy).length
        const emptySlots = totalSlots - occupiedSlots

        return {
            totalRacks: racks.length,
            totalSlots,
            occupiedSlots,
            emptySlots,
            occupancyRate: totalSlots > 0 ? ((occupiedSlots / totalSlots) * 100).toFixed(1) : 0,
        }
    }, [racks, slotOccupancy])

    // Get current rack data
    const currentRack = useMemo(() => {
        return racks.find(r => r.id === selectedRack) || racks[0]
    }, [racks, selectedRack])

    // Generate slots for current rack
    const rackSlots = useMemo(() => {
        if (!currentRack) return []

        const slots = []
        const rows = currentRack.rows || 4
        const cols = currentRack.cols || 5

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotNum = row * cols + col + 1
                if (slotNum <= currentRack.slots) {
                    const slotId = `${currentRack.id}-${String(slotNum).padStart(2, '0')}`
                    const occupants = slotOccupancy[slotId] || []

                    slots.push({
                        id: slotId,
                        row,
                        col,
                        number: slotNum,
                        isOccupied: occupants.length > 0,
                        occupants,
                        hasOverdue: occupants.some(o => o.status === 'overdue'),
                    })
                }
            }
        }

        return slots
    }, [currentRack, slotOccupancy])

    // Filter slots by search
    const filteredSlots = useMemo(() => {
        if (!searchQuery) return rackSlots

        const query = searchQuery.toLowerCase()
        return rackSlots.filter(slot => {
            if (slot.id.toLowerCase().includes(query)) return true
            return slot.occupants.some(o =>
                o.pledgeNo?.toLowerCase().includes(query) ||
                o.customerName?.toLowerCase().includes(query)
            )
        })
    }, [rackSlots, searchQuery])

    // Handle slot click
    const handleSlotClick = (slot) => {
        setSelectedSlot(slot)
        setShowSlotModal(true)
    }

    // Add new rack
    const handleAddRack = () => {
        if (!newRack.id || !newRack.name) {
            dispatch(addToast({ type: 'error', title: 'Error', message: 'Rack ID and Name are required' }))
            return
        }

        const updatedRacks = [...racks, {
            ...newRack,
            id: newRack.id.toUpperCase(),
            slots: parseInt(newRack.slots) || 20,
            rows: parseInt(newRack.rows) || 4,
            cols: parseInt(newRack.cols) || 5,
        }]

        // Save to settings
        const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {})
        settings.racks = updatedRacks
        setStorageItem(STORAGE_KEYS.SETTINGS, settings)

        setRacks(updatedRacks)
        setShowAddRackModal(false)
        setNewRack({ id: '', name: '', slots: 20, description: '', rows: 4, cols: 5 })

        dispatch(addToast({ type: 'success', title: 'Rack Added', message: `${newRack.name} has been created` }))
    }

    // Move pledge to new location
    const handleMove = () => {
        if (!selectedSlot || !moveTarget) return

        const pledgeToMove = selectedSlot.occupants[0]
        if (!pledgeToMove) return

        const storedPledges = getStorageItem(STORAGE_KEYS.PLEDGES, [])
        const updatedPledges = storedPledges.map(p => {
            if (p.id === pledgeToMove.pledgeId) {
                return { ...p, rackLocation: moveTarget.toUpperCase() }
            }
            return p
        })

        setStorageItem(STORAGE_KEYS.PLEDGES, updatedPledges)
        dispatch(setPledges(updatedPledges))

        setShowMoveModal(false)
        setShowSlotModal(false)
        setMoveTarget('')

        dispatch(addToast({
            type: 'success',
            title: 'Pledge Moved',
            message: `${pledgeToMove.pledgeNo} moved to ${moveTarget.toUpperCase()}`,
        }))
    }

    // Delete rack
    const handleDeleteRack = (rackId) => {
        // Check if rack has items
        const hasItems = Object.keys(slotOccupancy).some(loc => loc.startsWith(rackId + '-'))
        if (hasItems) {
            dispatch(addToast({ type: 'error', title: 'Cannot Delete', message: 'Rack has items. Move them first.' }))
            return
        }

        const updatedRacks = racks.filter(r => r.id !== rackId)
        const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {})
        settings.racks = updatedRacks
        setStorageItem(STORAGE_KEYS.SETTINGS, settings)

        setRacks(updatedRacks)
        if (selectedRack === rackId && updatedRacks.length > 0) {
            setSelectedRack(updatedRacks[0].id)
        }

        dispatch(addToast({ type: 'success', title: 'Rack Deleted', message: 'Rack has been removed' }))
    }

    return (
        <PageWrapper
            title="Rack / Locker Map"
            subtitle="Visual storage location management"
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" leftIcon={Printer}>
                        Print Map
                    </Button>
                    <Button variant="accent" leftIcon={Plus} onClick={() => setShowAddRackModal(true)}>
                        Add Rack
                    </Button>
                </div>
            }
        >
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Grid3X3 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Total Racks</p>
                            <p className="text-xl font-bold text-zinc-800">{stats.totalRacks}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-zinc-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Total Slots</p>
                            <p className="text-xl font-bold text-zinc-800">{stats.totalSlots}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Occupied</p>
                            <p className="text-xl font-bold text-amber-600">{stats.occupiedSlots}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Box className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Empty</p>
                            <p className="text-xl font-bold text-emerald-600">{stats.emptySlots}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 font-bold text-sm">{stats.occupancyRate}%</span>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Occupancy</p>
                            <div className="w-20 h-2 bg-zinc-200 rounded-full overflow-hidden mt-1">
                                <div
                                    className="h-full bg-purple-500 rounded-full transition-all"
                                    style={{ width: `${stats.occupancyRate}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Rack Selector */}
                <div className="lg:col-span-1">
                    <Card className="p-4">
                        <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-amber-500" />
                            Racks
                        </h3>

                        <div className="space-y-2">
                            {racks.map(rack => {
                                const rackOccupied = Object.keys(slotOccupancy).filter(loc => loc.startsWith(rack.id + '-')).length
                                const isSelected = selectedRack === rack.id

                                return (
                                    <button
                                        key={rack.id}
                                        onClick={() => setSelectedRack(rack.id)}
                                        className={cn(
                                            'w-full p-3 rounded-lg border-2 text-left transition-all',
                                            isSelected
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-zinc-200 hover:border-zinc-300'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-zinc-800">{rack.name}</p>
                                                <p className="text-xs text-zinc-500">{rack.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-zinc-800">{rackOccupied}/{rack.slots}</p>
                                                <p className="text-xs text-zinc-400">slots</p>
                                            </div>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden mt-2">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all',
                                                    rackOccupied === rack.slots ? 'bg-red-500' : 'bg-amber-500'
                                                )}
                                                style={{ width: `${(rackOccupied / rack.slots) * 100}%` }}
                                            />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-6 pt-4 border-t border-zinc-200">
                            <p className="text-xs font-medium text-zinc-500 mb-3">LEGEND</p>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-zinc-100 border border-zinc-300" />
                                    <span className="text-zinc-600">Empty Slot</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-amber-500" />
                                    <span className="text-zinc-600">Occupied</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-red-500" />
                                    <span className="text-zinc-600">Overdue Item</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Rack Grid */}
                <div className="lg:col-span-3">
                    <Card className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-800">{currentRack?.name || 'Select a Rack'}</h3>
                                <p className="text-sm text-zinc-500">{currentRack?.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Search slot or pledge..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    leftIcon={Search}
                                    className="w-48"
                                />
                            </div>
                        </div>

                        {/* Grid */}
                        {currentRack ? (
                            <div
                                className="grid gap-3"
                                style={{
                                    gridTemplateColumns: `repeat(${currentRack.cols || 5}, minmax(0, 1fr))`,
                                }}
                            >
                                {filteredSlots.map(slot => (
                                    <motion.button
                                        key={slot.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleSlotClick(slot)}
                                        className={cn(
                                            'aspect-square rounded-xl border-2 p-2 transition-all flex flex-col items-center justify-center relative',
                                            slot.isOccupied
                                                ? slot.hasOverdue
                                                    ? 'bg-red-500 border-red-600 text-white'
                                                    : 'bg-amber-500 border-amber-600 text-white'
                                                : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-600'
                                        )}
                                    >
                                        <span className="text-xs font-bold">{slot.id}</span>
                                        {slot.isOccupied ? (
                                            <>
                                                <Package className="w-5 h-5 mt-1" />
                                                <span className="text-[10px] mt-1 truncate w-full text-center">
                                                    {slot.occupants[0]?.pledgeNo}
                                                </span>
                                                {slot.occupants.length > 1 && (
                                                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
                                                        +{slot.occupants.length - 1}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <Box className="w-5 h-5 mt-1 text-zinc-300" />
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Grid3X3 className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                                <p className="text-zinc-500">Select a rack to view slots</p>
                            </div>
                        )}

                        {/* Quick Stats */}
                        {currentRack && (
                            <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-500">
                                        <strong className="text-zinc-800">{rackSlots.filter(s => s.isOccupied).length}</strong> occupied
                                    </span>
                                    <span className="text-zinc-500">
                                        <strong className="text-zinc-800">{rackSlots.filter(s => !s.isOccupied).length}</strong> empty
                                    </span>
                                    <span className="text-zinc-500">
                                        <strong className="text-red-600">{rackSlots.filter(s => s.hasOverdue).length}</strong> overdue
                                    </span>
                                </div>
                                <Button variant="outline" size="sm" leftIcon={RefreshCw} onClick={() => setSearchQuery('')}>
                                    Reset View
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Slot Detail Modal */}
            <Modal
                isOpen={showSlotModal}
                onClose={() => setShowSlotModal(false)}
                title={`Slot ${selectedSlot?.id}`}
                size="md"
            >
                <div className="p-5">
                    {selectedSlot?.isOccupied ? (
                        <>
                            {/* Occupied Slot */}
                            <div className="space-y-3 mb-6">
                                {selectedSlot.occupants.map((occupant, idx) => (
                                    <div
                                        key={occupant.pledgeId}
                                        className={cn(
                                            'p-4 rounded-xl border',
                                            occupant.status === 'overdue'
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-amber-50 border-amber-200'
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Package className={cn(
                                                    'w-5 h-5',
                                                    occupant.status === 'overdue' ? 'text-red-500' : 'text-amber-500'
                                                )} />
                                                <span className="font-bold">{occupant.pledgeNo}</span>
                                            </div>
                                            <Badge variant={occupant.status === 'overdue' ? 'error' : 'success'}>
                                                {occupant.status === 'overdue' ? 'Overdue' : 'Active'}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-zinc-500 flex items-center gap-1">
                                                    <User className="w-3 h-3" /> Customer
                                                </p>
                                                <p className="font-medium">{occupant.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 flex items-center gap-1">
                                                    <Package className="w-3 h-3" /> Items
                                                </p>
                                                <p className="font-medium">{occupant.itemCount} items ({occupant.totalWeight.toFixed(2)}g)</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500">Loan Amount</p>
                                                <p className="font-medium text-emerald-600">{formatCurrency(occupant.loanAmount)}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Due Date
                                                </p>
                                                <p className={cn(
                                                    'font-medium',
                                                    occupant.status === 'overdue' && 'text-red-600'
                                                )}>
                                                    {occupant.dueDate ? new Date(occupant.dueDate).toLocaleDateString('en-MY') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                fullWidth
                                                leftIcon={Eye}
                                                onClick={() => {
                                                    setShowSlotModal(false)
                                                    navigate(`/pledges/${occupant.pledgeId}`)
                                                }}
                                            >
                                                View Pledge
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                fullWidth
                                                leftIcon={ArrowRight}
                                                onClick={() => setShowMoveModal(true)}
                                            >
                                                Move
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* Empty Slot */
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                                <Box className="w-8 h-8 text-zinc-400" />
                            </div>
                            <h4 className="font-semibold text-zinc-800 mb-2">Empty Slot</h4>
                            <p className="text-sm text-zinc-500 mb-4">
                                This slot is available for new items
                            </p>
                            <Badge variant="success">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Available
                            </Badge>
                        </div>
                    )}

                    <Button variant="outline" fullWidth onClick={() => setShowSlotModal(false)} className="mt-4">
                        Close
                    </Button>
                </div>
            </Modal>

            {/* Move Modal */}
            <Modal
                isOpen={showMoveModal}
                onClose={() => setShowMoveModal(false)}
                title="Move to New Location"
                size="sm"
            >
                <div className="p-5">
                    <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
                        <p className="text-sm text-zinc-500">Moving from</p>
                        <p className="font-bold text-lg">{selectedSlot?.id}</p>
                        <p className="text-sm text-zinc-600">{selectedSlot?.occupants[0]?.pledgeNo}</p>
                    </div>

                    <Input
                        label="New Location"
                        placeholder="e.g., B-05, SAFE-01"
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value.toUpperCase())}
                        leftIcon={MapPin}
                    />

                    {/* Quick select empty slots */}
                    <div className="mt-3">
                        <p className="text-xs text-zinc-500 mb-2">Available Slots:</p>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                            {rackSlots.filter(s => !s.isOccupied).slice(0, 10).map(slot => (
                                <button
                                    key={slot.id}
                                    onClick={() => setMoveTarget(slot.id)}
                                    className={cn(
                                        'px-2 py-1 text-xs rounded border transition-colors',
                                        moveTarget === slot.id
                                            ? 'bg-amber-100 border-amber-300 text-amber-700'
                                            : 'border-zinc-200 hover:bg-zinc-50'
                                    )}
                                >
                                    {slot.id}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button variant="outline" fullWidth onClick={() => setShowMoveModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="accent" fullWidth leftIcon={ArrowRight} onClick={handleMove} disabled={!moveTarget}>
                            Move Item
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Add Rack Modal */}
            <Modal
                isOpen={showAddRackModal}
                onClose={() => setShowAddRackModal(false)}
                title="Add New Rack"
                size="sm"
            >
                <div className="p-5 space-y-4">
                    <Input
                        label="Rack ID"
                        placeholder="e.g., D, E, VAULT"
                        value={newRack.id}
                        onChange={(e) => setNewRack({ ...newRack, id: e.target.value.toUpperCase() })}
                        maxLength={5}
                        helperText="Short code (1-5 characters)"
                    />

                    <Input
                        label="Rack Name"
                        placeholder="e.g., Rack D"
                        value={newRack.name}
                        onChange={(e) => setNewRack({ ...newRack, name: e.target.value })}
                    />

                    <Input
                        label="Description"
                        placeholder="e.g., Reserve storage"
                        value={newRack.description}
                        onChange={(e) => setNewRack({ ...newRack, description: e.target.value })}
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <Input
                            label="Total Slots"
                            type="number"
                            value={newRack.slots}
                            onChange={(e) => setNewRack({ ...newRack, slots: e.target.value })}
                        />
                        <Input
                            label="Rows"
                            type="number"
                            value={newRack.rows}
                            onChange={(e) => setNewRack({ ...newRack, rows: e.target.value })}
                        />
                        <Input
                            label="Columns"
                            type="number"
                            value={newRack.cols}
                            onChange={(e) => setNewRack({ ...newRack, cols: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button variant="outline" fullWidth onClick={() => setShowAddRackModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="accent" fullWidth leftIcon={Plus} onClick={handleAddRack}>
                            Add Rack
                        </Button>
                    </div>
                </div>
            </Modal>
        </PageWrapper>
    )
}