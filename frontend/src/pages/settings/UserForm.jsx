import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem } from '@/utils/localStorage'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge } from '@/components/common'
import {
    User,
    Mail,
    Phone,
    Building2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Eye,
    EyeOff,
    Key,
    Save,
    ArrowLeft,
    Check,
    X,
} from 'lucide-react'

// Storage key for users
const USERS_STORAGE_KEY = 'users'

// Role options
const roleOptions = [
    { value: 'admin', label: 'Administrator', description: 'Full system access' },
    { value: 'manager', label: 'Manager', description: 'Manage operations, approve actions' },
    { value: 'cashier', label: 'Cashier', description: 'Process transactions' },
    { value: 'auditor', label: 'Auditor', description: 'View-only access for auditing' },
]

// Branch options
const branchOptions = [
    { value: 'HQ - Kuala Lumpur', label: 'HQ - Kuala Lumpur' },
    { value: 'Branch - Petaling Jaya', label: 'Branch - Petaling Jaya' },
    { value: 'Branch - Shah Alam', label: 'Branch - Shah Alam' },
    { value: 'Branch - Johor Bahru', label: 'Branch - Johor Bahru' },
]

// Permissions by role
const rolePermissions = {
    admin: [
        'View Dashboard',
        'Manage Pledges',
        'Process Renewals',
        'Process Redemptions',
        'Manage Customers',
        'Manage Inventory',
        'View Reports',
        'Manage Auctions',
        'System Settings',
        'User Management',
        'Audit Logs',
    ],
    manager: [
        'View Dashboard',
        'Manage Pledges',
        'Process Renewals',
        'Process Redemptions',
        'Manage Customers',
        'Manage Inventory',
        'View Reports',
        'Manage Auctions',
        'Approve Overrides',
    ],
    cashier: [
        'View Dashboard',
        'Create Pledges',
        'Process Renewals',
        'Process Redemptions',
        'View Customers',
        'View Inventory',
    ],
    auditor: [
        'View Dashboard',
        'View Pledges',
        'View Customers',
        'View Inventory',
        'View Reports',
        'Audit Logs',
    ],
}

export default function UserForm() {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const { id } = useParams()
    const isEdit = Boolean(id)

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        phone: '',
        role: 'cashier',
        branch: 'HQ - Kuala Lumpur',
        status: 'active',
    })

    const [errors, setErrors] = useState({})
    const [showPassword, setShowPassword] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Load user data if editing
    useEffect(() => {
        if (isEdit) {
            const users = getStorageItem(USERS_STORAGE_KEY, [])
            const user = users.find(u => u.id === id)
            if (user) {
                setFormData({
                    username: user.username || '',
                    password: '',
                    confirmPassword: '',
                    name: user.name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    role: user.role || 'cashier',
                    branch: user.branch || 'HQ - Kuala Lumpur',
                    status: user.status || 'active',
                })
            } else {
                dispatch(addToast({
                    type: 'error',
                    title: 'Not Found',
                    message: 'User not found',
                }))
                navigate('/settings/users')
            }
        }
    }, [id, isEdit, navigate, dispatch])

    // Handle input change
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    // Validate form
    const validateForm = () => {
        const newErrors = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Full name is required'
        }

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required'
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters'
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username = 'Username can only contain letters, numbers and underscore'
        } else {
            // Check if username is taken (for new users or changed username)
            const users = getStorageItem(USERS_STORAGE_KEY, [])
            const existing = users.find(u => u.username === formData.username && u.id !== id)
            if (existing) {
                newErrors.username = 'Username is already taken'
            }
        }

        if (!isEdit && !formData.password) {
            newErrors.password = 'Password is required'
        } else if (formData.password && formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters'
        }

        if (formData.password && formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match'
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format'
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // Handle submit
    const handleSubmit = (e) => {
        e.preventDefault()

        if (!validateForm()) return

        setIsSaving(true)

        setTimeout(() => {
            const users = getStorageItem(USERS_STORAGE_KEY, [])

            if (isEdit) {
                // Update existing user
                const updatedUsers = users.map(u => {
                    if (u.id === id) {
                        return {
                            ...u,
                            username: formData.username,
                            ...(formData.password && { password: formData.password }),
                            name: formData.name,
                            email: formData.email,
                            phone: formData.phone,
                            role: formData.role,
                            branch: formData.branch,
                            status: formData.status,
                        }
                    }
                    return u
                })
                setStorageItem(USERS_STORAGE_KEY, updatedUsers)
                dispatch(addToast({
                    type: 'success',
                    title: 'User Updated',
                    message: `${formData.name} has been updated`,
                }))
            } else {
                // Create new user
                const newUser = {
                    id: `USR${String(Date.now()).slice(-6)}`,
                    username: formData.username,
                    password: formData.password,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    role: formData.role,
                    branch: formData.branch,
                    status: formData.status,
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                }
                setStorageItem(USERS_STORAGE_KEY, [...users, newUser])
                dispatch(addToast({
                    type: 'success',
                    title: 'User Created',
                    message: `${formData.name} has been added`,
                }))
            }

            setIsSaving(false)
            navigate('/settings/users')
        }, 500)
    }

    // Get permissions for selected role
    const permissions = rolePermissions[formData.role] || []

    return (
        <PageWrapper
            title={isEdit ? 'Edit User' : 'Create User'}
            subtitle={isEdit ? 'Update user information' : 'Add a new system user'}
            actions={
                <Button
                    variant="outline"
                    leftIcon={ArrowLeft}
                    onClick={() => navigate('/settings/users')}
                >
                    Back to Users
                </Button>
            }
        >
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Information */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                                <User className="w-5 h-5 text-amber-500" />
                                Basic Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Full Name *"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder="Enter full name"
                                    error={errors.name}
                                    leftIcon={User}
                                />

                                <Input
                                    label="Username *"
                                    value={formData.username}
                                    onChange={(e) => handleChange('username', e.target.value.toLowerCase())}
                                    placeholder="Enter username"
                                    error={errors.username}
                                    disabled={isEdit}
                                    helperText={isEdit ? 'Username cannot be changed' : 'Letters, numbers, underscore only'}
                                />

                                <Input
                                    label="Email *"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder="Enter email address"
                                    error={errors.email}
                                    leftIcon={Mail}
                                />

                                <Input
                                    label="Phone *"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="012-345 6789"
                                    error={errors.phone}
                                    leftIcon={Phone}
                                />
                            </div>
                        </Card>

                        {/* Password Section */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-500" />
                                {isEdit ? 'Change Password' : 'Set Password'}
                            </h3>

                            {isEdit && (
                                <p className="text-sm text-zinc-500 mb-4">
                                    Leave blank to keep current password
                                </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="relative">
                                    <Input
                                        label={isEdit ? 'New Password' : 'Password *'}
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => handleChange('password', e.target.value)}
                                        placeholder="Enter password"
                                        error={errors.password}
                                        leftIcon={Key}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                <Input
                                    label="Confirm Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                    placeholder="Confirm password"
                                    error={errors.confirmPassword}
                                    leftIcon={Key}
                                />
                            </div>
                        </Card>

                        {/* Role & Assignment */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-amber-500" />
                                Role & Assignment
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">Role *</label>
                                    <div className="space-y-2">
                                        {roleOptions.map((role) => (
                                            <label
                                                key={role.value}
                                                className={cn(
                                                    'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                                                    formData.role === role.value
                                                        ? 'border-amber-500 bg-amber-50'
                                                        : 'border-zinc-200 hover:border-zinc-300'
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={role.value}
                                                    checked={formData.role === role.value}
                                                    onChange={(e) => handleChange('role', e.target.value)}
                                                    className="sr-only"
                                                />
                                                <div className={cn(
                                                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                                    formData.role === role.value ? 'border-amber-500' : 'border-zinc-300'
                                                )}>
                                                    {formData.role === role.value && (
                                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-zinc-800">{role.label}</p>
                                                    <p className="text-xs text-zinc-500">{role.description}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <Select
                                        label="Branch *"
                                        value={formData.branch}
                                        onChange={(e) => handleChange('branch', e.target.value)}
                                        options={branchOptions}
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-2">Status</label>
                                        <div className="flex gap-4">
                                            <label className={cn(
                                                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                                                formData.status === 'active'
                                                    ? 'border-emerald-500 bg-emerald-50'
                                                    : 'border-zinc-200 hover:border-zinc-300'
                                            )}>
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value="active"
                                                    checked={formData.status === 'active'}
                                                    onChange={(e) => handleChange('status', e.target.value)}
                                                    className="sr-only"
                                                />
                                                <Check className={cn(
                                                    'w-4 h-4',
                                                    formData.status === 'active' ? 'text-emerald-500' : 'text-zinc-400'
                                                )} />
                                                <span className={formData.status === 'active' ? 'text-emerald-700 font-medium' : 'text-zinc-600'}>
                                                    Active
                                                </span>
                                            </label>

                                            <label className={cn(
                                                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                                                formData.status === 'inactive'
                                                    ? 'border-zinc-500 bg-zinc-50'
                                                    : 'border-zinc-200 hover:border-zinc-300'
                                            )}>
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value="inactive"
                                                    checked={formData.status === 'inactive'}
                                                    onChange={(e) => handleChange('status', e.target.value)}
                                                    className="sr-only"
                                                />
                                                <X className={cn(
                                                    'w-4 h-4',
                                                    formData.status === 'inactive' ? 'text-zinc-500' : 'text-zinc-400'
                                                )} />
                                                <span className={formData.status === 'inactive' ? 'text-zinc-700 font-medium' : 'text-zinc-600'}>
                                                    Inactive
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar - Permissions Preview */}
                    <div className="space-y-6">
                        <Card className="p-6 sticky top-24">
                            <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-amber-500" />
                                Role Permissions
                            </h3>

                            <p className="text-sm text-zinc-500 mb-4">
                                Permissions for <strong>{roleOptions.find(r => r.value === formData.role)?.label}</strong>:
                            </p>

                            <div className="space-y-2">
                                {permissions.map((permission, index) => (
                                    <motion.div
                                        key={permission}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <span className="text-zinc-600">{permission}</span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Save Button */}
                            <div className="mt-6 pt-6 border-t border-zinc-200">
                                <Button
                                    type="submit"
                                    variant="accent"
                                    fullWidth
                                    size="lg"
                                    leftIcon={Save}
                                    loading={isSaving}
                                >
                                    {isEdit ? 'Update User' : 'Create User'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    fullWidth
                                    className="mt-2"
                                    onClick={() => navigate('/settings/users')}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </PageWrapper>
    )
}