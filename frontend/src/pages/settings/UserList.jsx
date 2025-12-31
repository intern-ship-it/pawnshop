import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem } from '@/utils/localStorage'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select, Badge, Modal } from '@/components/common'
import {
    Users,
    Search,
    Plus,
    Edit,
    Trash2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    UserCheck,
    UserX,
    Mail,
    Phone,
    Building2,
    Calendar,
    MoreVertical,
    Key,
    Eye,
    EyeOff,
} from 'lucide-react'

// Storage key for users
const USERS_STORAGE_KEY = 'users'

// Default users
const defaultUsers = [
    {
        id: 'USR001',
        username: 'admin',
        password: 'admin123',
        name: 'Admin User',
        email: 'admin@pawnsys.com',
        phone: '012-345 6789',
        role: 'admin',
        branch: 'HQ - Kuala Lumpur',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-12-20T09:30:00Z',
    },
    {
        id: 'USR002',
        username: 'manager',
        password: 'manager123',
        name: 'Manager User',
        email: 'manager@pawnsys.com',
        phone: '012-456 7890',
        role: 'manager',
        branch: 'HQ - Kuala Lumpur',
        status: 'active',
        createdAt: '2024-01-15T00:00:00Z',
        lastLogin: '2024-12-19T14:20:00Z',
    },
    {
        id: 'USR003',
        username: 'cashier',
        password: 'cashier123',
        name: 'Cashier User',
        email: 'cashier@pawnsys.com',
        phone: '012-567 8901',
        role: 'cashier',
        branch: 'HQ - Kuala Lumpur',
        status: 'active',
        createdAt: '2024-02-01T00:00:00Z',
        lastLogin: '2024-12-20T08:00:00Z',
    },
    {
        id: 'USR004',
        username: 'auditor',
        password: 'auditor123',
        name: 'Auditor User',
        email: 'auditor@pawnsys.com',
        phone: '012-678 9012',
        role: 'auditor',
        branch: 'HQ - Kuala Lumpur',
        status: 'active',
        createdAt: '2024-03-01T00:00:00Z',
        lastLogin: '2024-12-18T16:45:00Z',
    },
    {
        id: 'USR005',
        username: 'staff1',
        password: 'staff123',
        name: 'Ahmad bin Hassan',
        email: 'ahmad@pawnsys.com',
        phone: '012-789 0123',
        role: 'cashier',
        branch: 'Branch - Petaling Jaya',
        status: 'inactive',
        createdAt: '2024-04-01T00:00:00Z',
        lastLogin: '2024-11-15T10:00:00Z',
    },
]

// Role configurations
const roleConfig = {
    admin: { label: 'Administrator', color: 'error', icon: ShieldAlert },
    manager: { label: 'Manager', color: 'warning', icon: ShieldCheck },
    cashier: { label: 'Cashier', color: 'info', icon: Shield },
    auditor: { label: 'Auditor', color: 'secondary', icon: Eye },
}

// Status configurations
const statusConfig = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'secondary' },
    suspended: { label: 'Suspended', variant: 'error' },
}

export default function UserList() {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()

    // State
    const [users, setUsers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')

    // Modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [showResetModal, setShowResetModal] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    // Load users on mount
    useEffect(() => {
        const stored = getStorageItem(USERS_STORAGE_KEY, null)
        if (stored && stored.length > 0) {
            setUsers(stored)
        } else {
            setUsers(defaultUsers)
            setStorageItem(USERS_STORAGE_KEY, defaultUsers)
        }
    }, [])

    // Filter users
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const matchesSearch =
                    user.name?.toLowerCase().includes(query) ||
                    user.username?.toLowerCase().includes(query) ||
                    user.email?.toLowerCase().includes(query)
                if (!matchesSearch) return false
            }

            // Role filter
            if (roleFilter !== 'all' && user.role !== roleFilter) return false

            // Status filter
            if (statusFilter !== 'all' && user.status !== statusFilter) return false

            return true
        })
    }, [users, searchQuery, roleFilter, statusFilter])

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        admins: users.filter(u => u.role === 'admin').length,
    }), [users])

    // Toggle user status
    const handleToggleStatus = (user) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active'
        const updated = users.map(u =>
            u.id === user.id ? { ...u, status: newStatus } : u
        )
        setUsers(updated)
        setStorageItem(USERS_STORAGE_KEY, updated)
        dispatch(addToast({
            type: 'success',
            title: 'Status Updated',
            message: `${user.name} is now ${newStatus}`,
        }))
    }

    // Delete user
    const handleDelete = () => {
        if (!selectedUser) return
        const updated = users.filter(u => u.id !== selectedUser.id)
        setUsers(updated)
        setStorageItem(USERS_STORAGE_KEY, updated)
        setShowDeleteModal(false)
        setSelectedUser(null)
        dispatch(addToast({
            type: 'success',
            title: 'User Deleted',
            message: `${selectedUser.name} has been removed`,
        }))
    }

    // Reset password
    const handleResetPassword = () => {
        if (!selectedUser || !newPassword) return
        const updated = users.map(u =>
            u.id === selectedUser.id ? { ...u, password: newPassword } : u
        )
        setUsers(updated)
        setStorageItem(USERS_STORAGE_KEY, updated)
        setShowResetModal(false)
        setSelectedUser(null)
        setNewPassword('')
        dispatch(addToast({
            type: 'success',
            title: 'Password Reset',
            message: `Password for ${selectedUser.name} has been updated`,
        }))
    }

    // Open delete modal
    const openDeleteModal = (user) => {
        setSelectedUser(user)
        setShowDeleteModal(true)
    }

    // Open reset modal
    const openResetModal = (user) => {
        setSelectedUser(user)
        setNewPassword('')
        setShowResetModal(true)
    }

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'Never'
        return new Date(dateString).toLocaleDateString('en-MY', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
    }

    // Format datetime
    const formatDateTime = (dateString) => {
        if (!dateString) return 'Never'
        return new Date(dateString).toLocaleString('en-MY', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <PageWrapper
            title="User Management"
            subtitle="Manage system users and access control"
            actions={
                <Button
                    variant="accent"
                    leftIcon={Plus}
                    onClick={() => navigate('/settings/users/new')}
                >
                    Add User
                </Button>
            }
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Total Users</p>
                            <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Active</p>
                            <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                            <UserX className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Inactive</p>
                            <p className="text-xl font-bold text-zinc-500">{stats.inactive}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">Admins</p>
                            <p className="text-xl font-bold text-red-600">{stats.admins}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search by name, username or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={Search}
                        />
                    </div>
                    <Select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'All Roles' },
                            { value: 'admin', label: 'Administrator' },
                            { value: 'manager', label: 'Manager' },
                            { value: 'cashier', label: 'Cashier' },
                            { value: 'auditor', label: 'Auditor' },
                        ]}
                        className="w-40"
                    />
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'All Status' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                        ]}
                        className="w-40"
                    />
                </div>
            </Card>

            {/* User List */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">Branch</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">Last Login</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                                        <p className="text-zinc-500">No users found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => {
                                    const role = roleConfig[user.role] || roleConfig.cashier
                                    const status = statusConfig[user.status] || statusConfig.inactive
                                    const RoleIcon = role.icon

                                    return (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="hover:bg-zinc-50 transition-colors"
                                        >
                                            {/* User Info */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-semibold">
                                                        {user.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-zinc-800">{user.name}</p>
                                                        <p className="text-sm text-zinc-500">@{user.username}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <RoleIcon className={cn(
                                                        'w-4 h-4',
                                                        role.color === 'error' && 'text-red-500',
                                                        role.color === 'warning' && 'text-amber-500',
                                                        role.color === 'info' && 'text-blue-500',
                                                        role.color === 'secondary' && 'text-zinc-500',
                                                    )} />
                                                    <span className="text-sm font-medium text-zinc-700">{role.label}</span>
                                                </div>
                                            </td>

                                            {/* Branch */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                                    <Building2 className="w-4 h-4 text-zinc-400" />
                                                    {user.branch || 'Not assigned'}
                                                </div>
                                            </td>

                                            {/* Last Login */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                                    <Calendar className="w-4 h-4 text-zinc-400" />
                                                    {formatDateTime(user.lastLogin)}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <Badge variant={status.variant}>{status.label}</Badge>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => navigate(`/settings/users/${user.id}/edit`)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openResetModal(user)}
                                                    >
                                                        <Key className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleToggleStatus(user)}
                                                        className={user.status === 'active' ? 'text-zinc-500' : 'text-emerald-500'}
                                                    >
                                                        {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openDeleteModal(user)}
                                                        className="text-red-500 hover:bg-red-50"
                                                        disabled={user.role === 'admin' && stats.admins <= 1}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
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

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete User"
                size="sm"
            >
                <div className="p-5">
                    <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                        <Trash2 className="w-8 h-8 text-red-500" />
                        <div>
                            <p className="font-semibold text-red-800">Delete {selectedUser?.name}?</p>
                            <p className="text-sm text-red-600">This action cannot be undone.</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" fullWidth onClick={() => setShowDeleteModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="error" fullWidth onClick={handleDelete}>
                            Delete User
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                title="Reset Password"
                size="sm"
            >
                <div className="p-5">
                    <p className="text-sm text-zinc-600 mb-4">
                        Enter a new password for <strong>{selectedUser?.name}</strong>
                    </p>

                    <div className="relative mb-6">
                        <Input
                            label="New Password"
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
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

                    <div className="flex gap-3">
                        <Button variant="outline" fullWidth onClick={() => setShowResetModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="accent" fullWidth onClick={handleResetPassword} disabled={!newPassword}>
                            Reset Password
                        </Button>
                    </div>
                </div>
            </Modal>
        </PageWrapper>
    )
}