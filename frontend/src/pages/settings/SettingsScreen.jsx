import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
  Settings,
  Building2,
  DollarSign,
  Percent,
  TrendingUp,
  Package,
  Grid3X3,
  Gem,
  Scale,
  Save,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  Info,
  Clock,
  Calculator,
  Users,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import WhatsAppSettings from './WhatsAppSettings'

// Default settings structure
const defaultSettings = {
  company: {
    name: 'Dsara Asset Ventures Sdn Bhd',
    license: 'KPKT-PG-12345',
    address: 'No. 123, Jalan Utama, 50000 Kuala Lumpur',
    phone: '03-1234 5678',
    email: 'info@dsara.com',
    receiptHeader: 'PAJAK GADAI BERLESEN',
    receiptFooter: 'Terima kasih atas sokongan anda',
  },
  goldPrice: {
    source: 'manual', // 'api' or 'manual'
    apiUrl: '',
    manualPrice: 320.00,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System',
  },
  marginPresets: [
    { id: 1, value: 80, label: '80%', isDefault: true },
    { id: 2, value: 70, label: '70%', isDefault: false },
    { id: 3, value: 60, label: '60%', isDefault: false },
  ],
  interestRules: {
    tier1: { months: 6, rate: 0.5, label: 'First 6 months' },
    tier2: { months: 12, rate: 1.5, label: 'After 6 months (maintained)' },
    tier3: { months: 999, rate: 2.0, label: 'Overdue (not maintained)' },
    gracePeriodDays: 7,
  },
  categories: [
    { id: 1, name: 'Ring', nameMs: 'Cincin', active: true },
    { id: 2, name: 'Chain', nameMs: 'Rantai', active: true },
    { id: 3, name: 'Bangle', nameMs: 'Gelang', active: true },
    { id: 4, name: 'Bracelet', nameMs: 'Rantai Tangan', active: true },
    { id: 5, name: 'Necklace', nameMs: 'Kalung', active: true },
    { id: 6, name: 'Earring', nameMs: 'Anting-anting', active: true },
    { id: 7, name: 'Pendant', nameMs: 'Loket', active: true },
    { id: 8, name: 'Brooch', nameMs: 'Kerongsang', active: true },
    { id: 9, name: 'Gold Bar', nameMs: 'Jongkong Emas', active: true },
    { id: 10, name: 'Other', nameMs: 'Lain-lain', active: true },
  ],
  purities: [
    { id: 1, value: '999', label: '999 (24K)', factor: 0.999, active: true },
    { id: 2, value: '916', label: '916 (22K)', factor: 0.916, active: true },
    { id: 3, value: '835', label: '835 (20K)', factor: 0.835, active: true },
    { id: 4, value: '750', label: '750 (18K)', factor: 0.750, active: true },
    { id: 5, value: '375', label: '375 (9K)', factor: 0.375, active: true },
  ],
  stoneDeduction: {
    defaultType: 'percentage', // 'percentage' or 'fixed'
    defaultValue: 5,
    categoryRules: [],
  },
  racks: [
    { id: 'A', name: 'Rack A', slots: 20, description: 'Main storage' },
    { id: 'B', name: 'Rack B', slots: 20, description: 'Secondary storage' },
    { id: 'C', name: 'Rack C', slots: 15, description: 'Forfeited items' },
  ],
}

// Tabs configuration
const tabs = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'goldPrice', label: 'Gold Price', icon: DollarSign },
  { id: 'margin', label: 'Margin %', icon: Percent },
  { id: 'interest', label: 'Interest Rules', icon: TrendingUp },
  { id: 'categories', label: 'Categories', icon: Package },
  { id: 'purities', label: 'Purities', icon: Gem },
  { id: 'stoneDeduction', label: 'Stone Deduction', icon: Scale },
  { id: 'racks', label: 'Racks', icon: Grid3X3 },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

export default function SettingsScreen() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState('company')
  const [settings, setSettings] = useState(() => {
    const stored = getStorageItem(STORAGE_KEYS.SETTINGS, null)
    return stored ? { ...defaultSettings, ...stored } : defaultSettings
  })
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Save settings
  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setStorageItem(STORAGE_KEYS.SETTINGS, settings)
      setIsSaving(false)
      setHasChanges(false)
      
      // Dispatch custom event to update sidebar company name
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }))
      
      dispatch(addToast({
        type: 'success',
        title: 'Saved',
        message: 'Settings have been saved successfully',
      }))
    }, 500)
  }

  // Update settings helper
  const updateSettings = (section, data) => {
    setSettings(prev => ({
      ...prev,
      [section]: typeof data === 'function' ? data(prev[section]) : data,
    }))
    setHasChanges(true)
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'company':
        return <CompanyTab settings={settings} updateSettings={updateSettings} />
      case 'goldPrice':
        return <GoldPriceTab settings={settings} updateSettings={updateSettings} dispatch={dispatch} />
      case 'margin':
        return <MarginTab settings={settings} updateSettings={updateSettings} />
      case 'interest':
        return <InterestTab settings={settings} updateSettings={updateSettings} />
      case 'categories':
        return <CategoriesTab settings={settings} updateSettings={updateSettings} />
      case 'purities':
        return <PuritiesTab settings={settings} updateSettings={updateSettings} />
      case 'stoneDeduction':
        return <StoneDeductionTab settings={settings} updateSettings={updateSettings} />
      case 'racks':
        return <RacksTab settings={settings} updateSettings={updateSettings} />
      case 'whatsapp':
        return <WhatsAppSettings />
      default:
        return null
    }
  }

  return (
    <PageWrapper
      title="Settings"
      subtitle="Configure system settings and master data"
      actions={
        <Button
          variant="accent"
          leftIcon={Save}
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <Card className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all',
                      activeTab === tab.id
                        ? 'bg-amber-500/10 text-amber-600 font-medium'
                        : 'text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      activeTab === tab.id ? 'text-amber-500' : 'text-zinc-400'
                    )} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </Card>

          {/* Unsaved Changes Warning */}
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Card className="p-4 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Unsaved Changes</p>
                    <p className="text-xs text-amber-600 mt-1">Don't forget to save your changes.</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* User Management Link */}
          <Card className="mt-4 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/settings/users')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-800">User Management</p>
                  <p className="text-xs text-zinc-500">Manage users & permissions</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </div>
          </Card>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageWrapper>
  )
}

// ============================================
// TAB COMPONENTS
// ============================================

// Company Tab
function CompanyTab({ settings, updateSettings }) {
  const company = settings.company

  const handleChange = (field, value) => {
    updateSettings('company', { ...company, [field]: value })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-amber-500" />
        Company Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Company Name"
          value={company.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Enter company name"
        />
        <Input
          label="License Number (KPKT)"
          value={company.license}
          onChange={(e) => handleChange('license', e.target.value)}
          placeholder="KPKT-PG-XXXXX"
        />
        <div className="md:col-span-2">
          <Input
            label="Address"
            value={company.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Full business address"
          />
        </div>
        <Input
          label="Phone"
          value={company.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="03-XXXX XXXX"
        />
        <Input
          label="Email"
          type="email"
          value={company.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="info@company.com"
        />
        <div className="md:col-span-2">
          <Input
            label="Receipt Header Text"
            value={company.receiptHeader}
            onChange={(e) => handleChange('receiptHeader', e.target.value)}
            placeholder="Text shown at top of receipts"
          />
        </div>
        <div className="md:col-span-2">
          <Input
            label="Receipt Footer Text"
            value={company.receiptFooter}
            onChange={(e) => handleChange('receiptFooter', e.target.value)}
            placeholder="Text shown at bottom of receipts"
          />
        </div>
      </div>
    </Card>
  )
}

// Gold Price Tab
function GoldPriceTab({ settings, updateSettings, dispatch }) {
  const goldPrice = settings.goldPrice
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleChange = (field, value) => {
    updateSettings('goldPrice', { 
      ...goldPrice, 
      [field]: value,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin',
    })
  }

  const handleRefreshAPI = () => {
    setIsRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      const mockPrice = 315 + Math.random() * 15 // Random price between 315-330
      handleChange('manualPrice', parseFloat(mockPrice.toFixed(2)))
      setIsRefreshing(false)
      dispatch(addToast({
        type: 'success',
        title: 'Gold Price Updated',
        message: `Current price: RM ${mockPrice.toFixed(2)}/g`,
      }))
    }, 1500)
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-amber-500" />
        Gold Price Settings
      </h2>

      {/* Current Price Display */}
      <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-100 text-sm">Current Gold Price (999)</p>
            <p className="text-4xl font-bold mt-1">RM {goldPrice.manualPrice?.toFixed(2)}/g</p>
            <p className="text-amber-100 text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {new Date(goldPrice.lastUpdated).toLocaleString()}
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            leftIcon={RefreshCw}
            onClick={handleRefreshAPI}
            loading={isRefreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Source Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 mb-3">Price Source</label>
        <div className="flex gap-4">
          <label className={cn(
            'flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            goldPrice.source === 'manual'
              ? 'border-amber-500 bg-amber-50'
              : 'border-zinc-200 hover:border-zinc-300'
          )}>
            <input
              type="radio"
              name="priceSource"
              value="manual"
              checked={goldPrice.source === 'manual'}
              onChange={() => handleChange('source', 'manual')}
              className="sr-only"
            />
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              goldPrice.source === 'manual' ? 'border-amber-500' : 'border-zinc-300'
            )}>
              {goldPrice.source === 'manual' && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-zinc-800">Manual Entry</p>
              <p className="text-sm text-zinc-500">Enter price manually each day</p>
            </div>
          </label>

          <label className={cn(
            'flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            goldPrice.source === 'api'
              ? 'border-amber-500 bg-amber-50'
              : 'border-zinc-200 hover:border-zinc-300'
          )}>
            <input
              type="radio"
              name="priceSource"
              value="api"
              checked={goldPrice.source === 'api'}
              onChange={() => handleChange('source', 'api')}
              className="sr-only"
            />
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              goldPrice.source === 'api' ? 'border-amber-500' : 'border-zinc-300'
            )}>
              {goldPrice.source === 'api' && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-zinc-800">API (Automatic)</p>
              <p className="text-sm text-zinc-500">Fetch from gold price API</p>
            </div>
          </label>
        </div>
      </div>

      {/* Manual Price Input */}
      {goldPrice.source === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Gold Price (RM/gram)"
            type="number"
            step="0.01"
            value={goldPrice.manualPrice}
            onChange={(e) => handleChange('manualPrice', parseFloat(e.target.value) || 0)}
            leftIcon={DollarSign}
          />
        </div>
      )}

      {/* API Settings */}
      {goldPrice.source === 'api' && (
        <div className="p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm text-zinc-600 flex items-center gap-2">
            <Info className="w-4 h-4" />
            API integration requires backend setup. Currently using simulated data.
          </p>
        </div>
      )}
    </Card>
  )
}

// Margin Tab
function MarginTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMargin, setNewMargin] = useState('')
  const presets = settings.marginPresets

  const handleSetDefault = (id) => {
    const updated = presets.map(p => ({ ...p, isDefault: p.id === id }))
    updateSettings('marginPresets', updated)
  }

  const handleDelete = (id) => {
    const updated = presets.filter(p => p.id !== id)
    updateSettings('marginPresets', updated)
  }

  const handleAdd = () => {
    const value = parseInt(newMargin)
    if (value > 0 && value <= 100) {
      const updated = [
        ...presets,
        { id: Date.now(), value, label: `${value}%`, isDefault: false }
      ]
      updateSettings('marginPresets', updated)
      setNewMargin('')
      setShowAddModal(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Percent className="w-5 h-5 text-amber-500" />
          Margin Percentage Presets
        </h2>
        <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setShowAddModal(true)}>
          Add Preset
        </Button>
      </div>

      <p className="text-sm text-zinc-500 mb-6">
        These presets appear as quick-select buttons when creating a new pledge. The default preset will be pre-selected.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={cn(
              'p-4 rounded-xl border-2 transition-all',
              preset.isDefault
                ? 'border-amber-500 bg-amber-50'
                : 'border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl font-bold text-zinc-800">{preset.value}%</span>
              {preset.isDefault && (
                <Badge variant="success">Default</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {!preset.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetDefault(preset.id)}
                  className="flex-1"
                >
                  Set Default
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(preset.id)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Margin Preset"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Margin Percentage"
            type="number"
            min="1"
            max="100"
            value={newMargin}
            onChange={(e) => setNewMargin(e.target.value)}
            placeholder="e.g. 75"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" fullWidth onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Preset
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// Interest Tab
function InterestTab({ settings, updateSettings }) {
  const rules = settings.interestRules

  const handleChange = (tier, field, value) => {
    updateSettings('interestRules', {
      ...rules,
      [tier]: { ...rules[tier], [field]: value }
    })
  }

  const handleGraceChange = (value) => {
    updateSettings('interestRules', {
      ...rules,
      gracePeriodDays: parseInt(value) || 0
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-amber-500" />
        Interest Rate Rules
      </h2>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Interest Calculation (KPKT Compliant)</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Interest is calculated monthly based on principal amount</li>
              <li>Tier upgrades apply to all outstanding months</li>
              <li>Renewal payments reset the "maintained" status</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tier 1 */}
        <div className="p-4 rounded-xl border border-zinc-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier1.label}</p>
              <p className="text-sm text-zinc-500">Initial rate for new pledges</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (months)"
              type="number"
              value={rules.tier1.months}
              onChange={(e) => handleChange('tier1', 'months', parseInt(e.target.value) || 0)}
            />
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier1.rate}
              onChange={(e) => handleChange('tier1', 'rate', parseFloat(e.target.value) || 0)}
              rightElement={<span className="text-zinc-400">%</span>}
            />
          </div>
        </div>

        {/* Tier 2 */}
        <div className="p-4 rounded-xl border border-zinc-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier2.label}</p>
              <p className="text-sm text-zinc-500">Rate after initial period if renewed</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (months)"
              type="number"
              value={rules.tier2.months}
              onChange={(e) => handleChange('tier2', 'months', parseInt(e.target.value) || 0)}
            />
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier2.rate}
              onChange={(e) => handleChange('tier2', 'rate', parseFloat(e.target.value) || 0)}
              rightElement={<span className="text-zinc-400">%</span>}
            />
          </div>
        </div>

        {/* Tier 3 */}
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier3.label}</p>
              <p className="text-sm text-zinc-500">Penalty rate for overdue pledges</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier3.rate}
              onChange={(e) => handleChange('tier3', 'rate', parseFloat(e.target.value) || 0)}
              rightElement={<span className="text-zinc-400">%</span>}
            />
            <Input
              label="Grace Period (days)"
              type="number"
              value={rules.gracePeriodDays}
              onChange={(e) => handleGraceChange(e.target.value)}
              helperText="Days before penalty applies"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-700 mb-2">Rate Summary:</p>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="success">{rules.tier1.rate}%</Badge>
          <span className="text-zinc-400">→</span>
          <Badge variant="warning">{rules.tier2.rate}%</Badge>
          <span className="text-zinc-400">→</span>
          <Badge variant="error">{rules.tier3.rate}%</Badge>
        </div>
      </div>
    </Card>
  )
}

// Categories Tab
function CategoriesTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', nameMs: '' })
  const categories = settings.categories

  const handleAdd = () => {
    if (formData.name) {
      const updated = [
        ...categories,
        { id: Date.now(), name: formData.name, nameMs: formData.nameMs || formData.name, active: true }
      ]
      updateSettings('categories', updated)
      setFormData({ name: '', nameMs: '' })
      setShowAddModal(false)
    }
  }

  const handleToggle = (id) => {
    const updated = categories.map(c => 
      c.id === id ? { ...c, active: !c.active } : c
    )
    updateSettings('categories', updated)
  }

  const handleDelete = (id) => {
    const updated = categories.filter(c => c.id !== id)
    updateSettings('categories', updated)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-500" />
          Item Categories
        </h2>
        <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setShowAddModal(true)}>
          Add Category
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border transition-all',
              category.active
                ? 'border-zinc-200 bg-white'
                : 'border-zinc-100 bg-zinc-50 opacity-60'
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-zinc-800">{category.name}</p>
                <p className="text-sm text-zinc-500">{category.nameMs}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggle(category.id)}
                className={category.active ? 'text-emerald-600' : 'text-zinc-400'}
              >
                {category.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(category.id)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Category"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Category Name (English)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Ring"
          />
          <Input
            label="Category Name (Malay)"
            value={formData.nameMs}
            onChange={(e) => setFormData({ ...formData, nameMs: e.target.value })}
            placeholder="e.g. Cincin"
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" fullWidth onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Category
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// Purities Tab
function PuritiesTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ value: '', label: '', factor: '' })
  const purities = settings.purities

  const handleAdd = () => {
    if (formData.value && formData.factor) {
      const updated = [
        ...purities,
        { 
          id: Date.now(), 
          value: formData.value, 
          label: formData.label || formData.value, 
          factor: parseFloat(formData.factor) || 0,
          active: true 
        }
      ]
      updateSettings('purities', updated)
      setFormData({ value: '', label: '', factor: '' })
      setShowAddModal(false)
    }
  }

  const handleToggle = (id) => {
    const updated = purities.map(p => 
      p.id === id ? { ...p, active: !p.active } : p
    )
    updateSettings('purities', updated)
  }

  const handleDelete = (id) => {
    const updated = purities.filter(p => p.id !== id)
    updateSettings('purities', updated)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Gem className="w-5 h-5 text-amber-500" />
          Gold Purities
        </h2>
        <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setShowAddModal(true)}>
          Add Purity
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {purities.map((purity) => (
          <div
            key={purity.id}
            className={cn(
              'p-4 rounded-xl border-2 transition-all',
              purity.active
                ? 'border-amber-200 bg-amber-50'
                : 'border-zinc-100 bg-zinc-50 opacity-60'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-zinc-800">{purity.value}</p>
                <p className="text-sm text-zinc-500">{purity.label}</p>
              </div>
              <Badge variant="secondary">{(purity.factor * 100).toFixed(1)}%</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggle(purity.id)}
                className={cn('flex-1', purity.active ? 'text-emerald-600' : 'text-zinc-400')}
              >
                {purity.active ? 'Active' : 'Inactive'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(purity.id)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Purity"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Purity Value"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="e.g. 916"
          />
          <Input
            label="Display Label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="e.g. 916 (22K)"
          />
          <Input
            label="Factor (decimal)"
            type="number"
            step="0.001"
            value={formData.factor}
            onChange={(e) => setFormData({ ...formData, factor: e.target.value })}
            placeholder="e.g. 0.916"
            helperText="Used for value calculation"
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" fullWidth onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Purity
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// Stone Deduction Tab
function StoneDeductionTab({ settings, updateSettings }) {
  const deduction = settings.stoneDeduction

  const handleChange = (field, value) => {
    updateSettings('stoneDeduction', { ...deduction, [field]: value })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <Scale className="w-5 h-5 text-amber-500" />
        Stone Deduction Rules
      </h2>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Stone deduction is applied to gross weight to calculate net gold weight for valuation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">Default Deduction Type</label>
          <div className="flex gap-4">
            <label className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
              deduction.defaultType === 'percentage'
                ? 'border-amber-500 bg-amber-50'
                : 'border-zinc-200 hover:border-zinc-300'
            )}>
              <input
                type="radio"
                name="deductionType"
                value="percentage"
                checked={deduction.defaultType === 'percentage'}
                onChange={() => handleChange('defaultType', 'percentage')}
                className="sr-only"
              />
              <Percent className="w-4 h-4" />
              <span className="font-medium">Percentage</span>
            </label>
            <label className={cn(
              'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
              deduction.defaultType === 'fixed'
                ? 'border-amber-500 bg-amber-50'
                : 'border-zinc-200 hover:border-zinc-300'
            )}>
              <input
                type="radio"
                name="deductionType"
                value="fixed"
                checked={deduction.defaultType === 'fixed'}
                onChange={() => handleChange('defaultType', 'fixed')}
                className="sr-only"
              />
              <Calculator className="w-4 h-4" />
              <span className="font-medium">Fixed (gram)</span>
            </label>
          </div>
        </div>

        <Input
          label={`Default Value (${deduction.defaultType === 'percentage' ? '%' : 'gram'})`}
          type="number"
          step="0.1"
          value={deduction.defaultValue}
          onChange={(e) => handleChange('defaultValue', parseFloat(e.target.value) || 0)}
          rightElement={<span className="text-zinc-400">{deduction.defaultType === 'percentage' ? '%' : 'g'}</span>}
        />
      </div>

      {/* Example Calculation */}
      <div className="p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-700 mb-2">Example Calculation:</p>
        <div className="text-sm text-zinc-600">
          <p>Gross Weight: 10.00g</p>
          <p>Stone Deduction: {deduction.defaultValue}{deduction.defaultType === 'percentage' ? '%' : 'g'}</p>
          <p className="font-medium text-zinc-800 mt-1">
            Net Weight: {deduction.defaultType === 'percentage' 
              ? (10 * (1 - deduction.defaultValue / 100)).toFixed(2) 
              : (10 - deduction.defaultValue).toFixed(2)}g
          </p>
        </div>
      </div>
    </Card>
  )
}

// Racks Tab
function RacksTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ id: '', name: '', slots: 20, description: '' })
  const racks = settings.racks

  const handleAdd = () => {
    if (formData.id && formData.name) {
      const updated = [
        ...racks,
        { 
          id: formData.id.toUpperCase(), 
          name: formData.name, 
          slots: parseInt(formData.slots) || 20,
          description: formData.description 
        }
      ]
      updateSettings('racks', updated)
      setFormData({ id: '', name: '', slots: 20, description: '' })
      setShowAddModal(false)
    }
  }

  const handleDelete = (id) => {
    const updated = racks.filter(r => r.id !== id)
    updateSettings('racks', updated)
  }

  // Calculate total slots
  const totalSlots = racks.reduce((sum, r) => sum + r.slots, 0)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-amber-500" />
          Rack / Locker Setup
        </h2>
        <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setShowAddModal(true)}>
          Add Rack
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm text-zinc-500">Total Racks</p>
          <p className="text-2xl font-bold text-zinc-800">{racks.length}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl">
          <p className="text-sm text-amber-600">Total Slots</p>
          <p className="text-2xl font-bold text-amber-600">{totalSlots}</p>
        </div>
      </div>

      {/* Rack List */}
      <div className="space-y-3">
        {racks.map((rack) => (
          <div
            key={rack.id}
            className="flex items-center justify-between p-4 rounded-xl border border-zinc-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">{rack.id}</span>
              </div>
              <div>
                <p className="font-medium text-zinc-800">{rack.name}</p>
                <p className="text-sm text-zinc-500">{rack.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-semibold text-zinc-800">{rack.slots}</p>
                <p className="text-xs text-zinc-500">slots</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(rack.id)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Rack Visual */}
      <div className="mt-6 p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-700 mb-3">Rack Layout Preview</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {racks.map((rack) => (
            <div key={rack.id} className="flex-shrink-0">
              <p className="text-xs text-zinc-500 text-center mb-1">{rack.id}</p>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: Math.min(rack.slots, 20) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm bg-zinc-200"
                    title={`${rack.id}-${String(i + 1).padStart(2, '0')}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Rack"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Rack ID"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            placeholder="e.g. D"
            maxLength={3}
            helperText="Short code (1-3 characters)"
          />
          <Input
            label="Rack Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Rack D"
          />
          <Input
            label="Number of Slots"
            type="number"
            value={formData.slots}
            onChange={(e) => setFormData({ ...formData, slots: e.target.value })}
            placeholder="20"
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. High value items"
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" fullWidth onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Rack
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}