import { useState, useEffect } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem } from '@/utils/localStorage'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, Button, Input, Badge, Modal } from '@/components/common'
import {
    MessageCircle,
    Settings,
    Send,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Phone,
    Key,
    Globe,
    FileText,
    Clock,
    Users,
    Bell,
    Edit,
    Save,
    RotateCcw,
    TestTube,
    History,
    Smartphone,
    Link,
    Check,
    X,
    Eye,
    RefreshCw,
    Zap,
} from 'lucide-react'

// Default message templates
const defaultTemplates = [
    {
        id: 'pledge_created',
        name: 'Pledge Created',
        event: 'New Pledge',
        enabled: true,
        template: `Salam {customer_name},

Terima kasih kerana memilih {company_name}.

📋 *Butiran Pajak Gadai*
No. Pajak: {pledge_no}
Tarikh: {date}
Jumlah Pinjaman: RM{loan_amount}
Tarikh Tamat: {due_date}

Sila simpan mesej ini untuk rujukan.

Terima kasih.
{company_name}
{company_phone}`,
    },
    {
        id: 'renewal_done',
        name: 'Renewal Confirmation',
        event: 'After Renewal',
        enabled: true,
        template: `Salam {customer_name},

Pembaharuan pajak gadai anda telah berjaya.

📋 *Butiran Pembaharuan*
No. Pajak: {pledge_no}
Faedah Dibayar: RM{interest_paid}
Tarikh Tamat Baru: {new_due_date}

Terima kasih.
{company_name}`,
    },
    {
        id: 'redemption_done',
        name: 'Redemption Confirmation',
        event: 'After Redemption',
        enabled: true,
        template: `Salam {customer_name},

Pajak gadai anda telah ditebus dengan jayanya.

📋 *Butiran Tebusan*
No. Pajak: {pledge_no}
Jumlah Dibayar: RM{total_paid}

Terima kasih kerana berurusan dengan kami. Kami mengalu-alukan anda kembali.

{company_name}`,
    },
    {
        id: 'due_reminder_7',
        name: '7 Days Reminder',
        event: '7 Days Before Due',
        enabled: true,
        template: `Salam {customer_name},

⏰ *Peringatan: 7 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 7 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Jumlah Tebus: RM{redemption_amount}

Sila hubungi kami untuk tebusan atau pembaharuan.

{company_name}
{company_phone}`,
    },
    {
        id: 'due_reminder_3',
        name: '3 Days Reminder',
        event: '3 Days Before Due',
        enabled: true,
        template: `Salam {customer_name},

⚠️ *Peringatan Segera: 3 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 3 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila ambil tindakan segera untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`,
    },
    {
        id: 'due_reminder_1',
        name: '1 Day Reminder',
        event: '1 Day Before Due',
        enabled: true,
        template: `Salam {customer_name},

🚨 *Peringatan Akhir: ESOK*

Pajak gadai anda akan tamat tempoh ESOK.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila hubungi kami dengan segera.

{company_name}
{company_phone}`,
    },
    {
        id: 'overdue_notice',
        name: 'Overdue Notice',
        event: 'After Due Date',
        enabled: true,
        template: `Salam {customer_name},

❌ *Notis: Pajak Gadai Tamat Tempoh*

Pajak gadai anda telah tamat tempoh.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Hari Tertunggak: {days_overdue} hari

Sila hubungi kami dalam masa 14 hari untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`,
    },
    {
        id: 'auction_notice',
        name: 'Auction Notice',
        event: 'Before Auction',
        enabled: false,
        template: `Salam {customer_name},

📢 *Notis Lelongan*

Pajak gadai anda telah dijadualkan untuk lelongan.

No. Pajak: {pledge_no}
Tarikh Lelongan: {auction_date}

Sila hubungi kami segera jika anda ingin menebus barang anda.

{company_name}
{company_phone}`,
    },
]

// Default WhatsApp config
const defaultConfig = {
    enabled: false,
    provider: 'ultramsg', // ultramsg, twilio, wati
    instanceId: '',
    token: '',
    phoneNumberId: '',
    defaultCountryCode: '+60',
    companyName: 'PawnSys Sdn Bhd',
    companyPhone: '03-1234 5678',
}

export default function WhatsAppSettings() {
    const dispatch = useAppDispatch()

    // State
    const [config, setConfig] = useState(defaultConfig)
    const [templates, setTemplates] = useState(defaultTemplates)
    const [activeTab, setActiveTab] = useState('config') // config, templates, history, test
    const [isSaving, setIsSaving] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState('disconnected') // connected, disconnected, checking

    // Edit template modal
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)

    // Test modal
    const [showTestModal, setShowTestModal] = useState(false)
    const [testPhone, setTestPhone] = useState('')
    const [testTemplate, setTestTemplate] = useState('pledge_created')
    const [isSending, setIsSending] = useState(false)

    // Message history
    const [messageHistory, setMessageHistory] = useState([])

    // Load settings
    useEffect(() => {
        const settings = getStorageItem('whatsapp_settings', null)
        if (settings) {
            setConfig(settings.config || defaultConfig)
            setTemplates(settings.templates || defaultTemplates)
        }

        const history = getStorageItem('whatsapp_history', [])
        setMessageHistory(history)
    }, [])

    // Save settings
    const handleSave = () => {
        setIsSaving(true)
        setTimeout(() => {
            setStorageItem('whatsapp_settings', { config, templates })
            setIsSaving(false)
            dispatch(addToast({ type: 'success', title: 'Saved', message: 'WhatsApp settings saved successfully' }))
        }, 500)
    }

    // Test connection
    const handleTestConnection = () => {
        setConnectionStatus('checking')
        setTimeout(() => {
            if (config.instanceId && config.token) {
                setConnectionStatus('connected')
                dispatch(addToast({ type: 'success', title: 'Connected', message: 'WhatsApp API connection successful' }))
            } else {
                setConnectionStatus('disconnected')
                dispatch(addToast({ type: 'error', title: 'Failed', message: 'Please enter Instance ID and Token' }))
            }
        }, 1500)
    }

    // Toggle template
    const toggleTemplate = (templateId) => {
        setTemplates(prev => prev.map(t =>
            t.id === templateId ? { ...t, enabled: !t.enabled } : t
        ))
    }

    // Edit template
    const openEditTemplate = (template) => {
        setEditingTemplate({ ...template })
        setShowEditModal(true)
    }

    // Save template
    const saveTemplate = () => {
        setTemplates(prev => prev.map(t =>
            t.id === editingTemplate.id ? editingTemplate : t
        ))
        setShowEditModal(false)
        dispatch(addToast({ type: 'success', title: 'Template Updated', message: editingTemplate.name }))
    }

    // Send test message
    const handleSendTest = () => {
        if (!testPhone) {
            dispatch(addToast({ type: 'error', title: 'Error', message: 'Please enter phone number' }))
            return
        }

        setIsSending(true)
        const template = templates.find(t => t.id === testTemplate)

        setTimeout(() => {
            // Simulate sending - add to history
            const newMessage = {
                id: `MSG-${Date.now()}`,
                timestamp: new Date().toISOString(),
                phone: testPhone,
                template: template.name,
                status: 'sent',
                message: template.template
                    .replace('{customer_name}', 'Test Customer')
                    .replace('{company_name}', config.companyName)
                    .replace('{company_phone}', config.companyPhone)
                    .replace('{pledge_no}', 'PLG-2024-001234')
                    .replace('{date}', new Date().toLocaleDateString('en-MY'))
                    .replace('{loan_amount}', '2,500.00')
                    .replace('{due_date}', '24/01/2025')
                    .replace('{interest_paid}', '50.00')
                    .replace('{new_due_date}', '24/02/2025')
                    .replace('{total_paid}', '2,550.00')
                    .replace('{redemption_amount}', '2,550.00')
                    .replace('{days_overdue}', '5')
                    .replace('{auction_date}', '15/02/2025'),
            }

            const updatedHistory = [newMessage, ...messageHistory].slice(0, 50)
            setMessageHistory(updatedHistory)
            setStorageItem('whatsapp_history', updatedHistory)

            setIsSending(false)
            setShowTestModal(false)
            dispatch(addToast({ type: 'success', title: 'Message Sent', message: `Test message sent to ${testPhone}` }))
        }, 1500)
    }

    // Available variables
    const variables = [
        '{customer_name}', '{customer_phone}', '{customer_ic}',
        '{pledge_no}', '{date}', '{loan_amount}', '{due_date}',
        '{interest_paid}', '{new_due_date}', '{total_paid}',
        '{redemption_amount}', '{days_overdue}', '{auction_date}',
        '{company_name}', '{company_phone}',
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-800">WhatsApp Integration</h2>
                        <p className="text-sm text-zinc-500">Send automated notifications via WhatsApp</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={config.enabled ? 'success' : 'secondary'}>
                        {config.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button variant="accent" leftIcon={Save} onClick={handleSave} loading={isSaving}>
                        Save Settings
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-zinc-200">
                {[
                    { id: 'config', label: 'Configuration', icon: Settings },
                    { id: 'templates', label: 'Message Templates', icon: FileText },
                    { id: 'history', label: 'History', icon: History },
                    { id: 'test', label: 'Test', icon: TestTube },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                            activeTab === tab.id
                                ? 'border-amber-500 text-amber-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'config' && (
                    <motion.div
                        key="config"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    >
                        {/* API Configuration */}
                        <Card className="p-6">
                            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-500" />
                                API Configuration
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                                    <span className="text-sm font-medium">Enable WhatsApp</span>
                                    <button
                                        onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                                        className={cn(
                                            'w-12 h-6 rounded-full transition-colors relative',
                                            config.enabled ? 'bg-green-500' : 'bg-zinc-300'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                                            config.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                        )} />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Provider</label>
                                    <select
                                        value={config.provider}
                                        onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="ultramsg">UltraMsg</option>
                                        <option value="twilio">Twilio</option>
                                        <option value="wati">WATI</option>
                                    </select>
                                </div>

                                <Input
                                    label="Instance ID"
                                    placeholder="Enter instance ID"
                                    value={config.instanceId}
                                    onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                                    leftIcon={Globe}
                                />

                                <Input
                                    label="API Token"
                                    type="password"
                                    placeholder="Enter API token"
                                    value={config.token}
                                    onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                    leftIcon={Key}
                                />

                                <Input
                                    label="Default Country Code"
                                    placeholder="+60"
                                    value={config.defaultCountryCode}
                                    onChange={(e) => setConfig({ ...config, defaultCountryCode: e.target.value })}
                                    leftIcon={Phone}
                                />

                                {/* Connection Status */}
                                <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            'w-3 h-3 rounded-full',
                                            connectionStatus === 'connected' ? 'bg-green-500' :
                                                connectionStatus === 'checking' ? 'bg-amber-500 animate-pulse' :
                                                    'bg-red-500'
                                        )} />
                                        <span className="text-sm text-zinc-600">
                                            {connectionStatus === 'connected' ? 'Connected' :
                                                connectionStatus === 'checking' ? 'Checking...' :
                                                    'Disconnected'}
                                        </span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        leftIcon={RefreshCw}
                                        onClick={handleTestConnection}
                                        loading={connectionStatus === 'checking'}
                                    >
                                        Test Connection
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Company Info */}
                        <Card className="p-6">
                            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-amber-500" />
                                Company Info (for messages)
                            </h3>

                            <div className="space-y-4">
                                <Input
                                    label="Company Name"
                                    placeholder="Your Company Sdn Bhd"
                                    value={config.companyName}
                                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                                />

                                <Input
                                    label="Company Phone"
                                    placeholder="03-1234 5678"
                                    value={config.companyPhone}
                                    onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })}
                                    leftIcon={Phone}
                                />
                            </div>

                            {/* Info Box */}
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex gap-3">
                                    <MessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-700">
                                        <p className="font-medium">How it works:</p>
                                        <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                                            <li>Sign up at ultramsg.com or similar provider</li>
                                            <li>Get your Instance ID and Token</li>
                                            <li>Enter credentials above</li>
                                            <li>Test connection</li>
                                            <li>Customize message templates</li>
                                            <li>Messages will be sent automatically!</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'templates' && (
                    <motion.div
                        key="templates"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="overflow-hidden">
                            <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                                <p className="text-sm text-zinc-600">
                                    Configure automatic WhatsApp messages for different events. Use variables like{' '}
                                    <code className="bg-zinc-200 px-1 rounded">{'{customer_name}'}</code> to personalize messages.
                                </p>
                            </div>

                            <div className="divide-y divide-zinc-100">
                                {templates.map(template => (
                                    <div key={template.id} className="p-4 hover:bg-zinc-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => toggleTemplate(template.id)}
                                                    className={cn(
                                                        'w-10 h-6 rounded-full transition-colors relative',
                                                        template.enabled ? 'bg-green-500' : 'bg-zinc-300'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                                                        template.enabled ? 'translate-x-5' : 'translate-x-1'
                                                    )} />
                                                </button>
                                                <div>
                                                    <p className="font-medium text-zinc-800">{template.name}</p>
                                                    <p className="text-xs text-zinc-500">{template.event}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={Edit}
                                                onClick={() => openEditTemplate(template)}
                                            >
                                                Edit
                                            </Button>
                                        </div>

                                        {/* Preview */}
                                        <div className="mt-3 ml-14">
                                            <pre className="text-xs text-zinc-500 bg-zinc-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-24">
                                                {template.template.slice(0, 150)}...
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="overflow-hidden">
                            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                                <h3 className="font-semibold text-zinc-800">Message History</h3>
                                <Badge variant="info">{messageHistory.length} messages</Badge>
                            </div>

                            {messageHistory.length === 0 ? (
                                <div className="p-12 text-center">
                                    <History className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                                    <p className="text-zinc-500">No messages sent yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
                                    {messageHistory.map(msg => (
                                        <div key={msg.id} className="p-4 hover:bg-zinc-50">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-zinc-400" />
                                                    <span className="font-medium">{msg.phone}</span>
                                                    <Badge variant="secondary">{msg.template}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {msg.status === 'sent' ? (
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                    <span className="text-xs text-zinc-400">
                                                        {new Date(msg.timestamp).toLocaleString('en-MY')}
                                                    </span>
                                                </div>
                                            </div>
                                            <pre className="text-xs text-zinc-500 bg-zinc-100 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-20">
                                                {msg.message.slice(0, 200)}...
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'test' && (
                    <motion.div
                        key="test"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="max-w-xl"
                    >
                        <Card className="p-6">
                            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                <TestTube className="w-5 h-5 text-amber-500" />
                                Send Test Message
                            </h3>

                            <div className="space-y-4">
                                <Input
                                    label="Phone Number"
                                    placeholder="60123456789"
                                    value={testPhone}
                                    onChange={(e) => setTestPhone(e.target.value)}
                                    leftIcon={Phone}
                                    helperText="Enter full number with country code (no + or spaces)"
                                />

                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Template</label>
                                    <select
                                        value={testTemplate}
                                        onChange={(e) => setTestTemplate(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                    >
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Message Preview</label>
                                    <pre className="text-xs text-zinc-600 bg-zinc-100 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {templates.find(t => t.id === testTemplate)?.template
                                            .replace('{customer_name}', 'Test Customer')
                                            .replace('{company_name}', config.companyName)
                                            .replace('{company_phone}', config.companyPhone)
                                            .replace('{pledge_no}', 'PLG-2024-001234')
                                            .replace('{date}', new Date().toLocaleDateString('en-MY'))
                                            .replace('{loan_amount}', '2,500.00')
                                            .replace('{due_date}', '24/01/2025')}
                                    </pre>
                                </div>

                                <Button
                                    variant="accent"
                                    fullWidth
                                    leftIcon={Send}
                                    onClick={handleSendTest}
                                    loading={isSending}
                                    disabled={!testPhone}
                                >
                                    Send Test Message
                                </Button>
                            </div>

                            {/* Note */}
                            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                                <p className="text-xs text-amber-700">
                                    <strong>Note:</strong> In this prototype, messages are simulated. In production,
                                    messages will be sent via the configured WhatsApp API provider.
                                </p>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Template Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Edit Message Template"
                size="lg"
            >
                <div className="p-5">
                    {editingTemplate && (
                        <div className="space-y-4">
                            <Input
                                label="Template Name"
                                value={editingTemplate.name}
                                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                            />

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    Message Template
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                                    rows={12}
                                    value={editingTemplate.template}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, template: e.target.value })}
                                />
                            </div>

                            {/* Variables */}
                            <div>
                                <p className="text-xs text-zinc-500 mb-2">Available Variables (click to insert):</p>
                                <div className="flex flex-wrap gap-1">
                                    {variables.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setEditingTemplate({
                                                ...editingTemplate,
                                                template: editingTemplate.template + v
                                            })}
                                            className="px-2 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button variant="outline" fullWidth onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </Button>
                                <Button variant="accent" fullWidth leftIcon={Save} onClick={saveTemplate}>
                                    Save Template
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}