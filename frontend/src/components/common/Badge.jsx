import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  primary: 'bg-zinc-800 text-white border-zinc-800',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  // Status-specific variants
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  defaulted: 'bg-red-100 text-red-800 border-red-300',
  renewed: 'bg-purple-50 text-purple-700 border-purple-200',
  redeemed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  auctioned: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

const sizes = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-2.5 py-1',
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  icon: Icon,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full border',
        'whitespace-nowrap',
        variants[variant] || variants.default,
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}

// Status Badge with predefined statuses
Badge.Status = function StatusBadge({ status, size = 'md' }) {
  const statusConfig = {
    active: { label: 'Active', variant: 'active' },
    pending: { label: 'Pending', variant: 'pending' },
    expired: { label: 'Expired', variant: 'expired' },
    expiring: { label: 'Expiring Soon', variant: 'warning' },
    completed: { label: 'Completed', variant: 'completed' },
    defaulted: { label: 'Defaulted', variant: 'defaulted' },
    renewed: { label: 'Renewed', variant: 'renewed' },
    redeemed: { label: 'Redeemed', variant: 'redeemed' },
    auctioned: { label: 'Auctioned', variant: 'auctioned' },
    'auction-ready': { label: 'Auction Ready', variant: 'warning' },
    pledged: { label: 'Pledged', variant: 'info' },
    available: { label: 'Available', variant: 'success' },
    sold: { label: 'Sold', variant: 'purple' },
  }

  const config = statusConfig[status] || { label: status, variant: 'default' }

  return (
    <Badge variant={config.variant} size={size} dot>
      {config.label}
    </Badge>
  )
}

// Role Badge
Badge.Role = function RoleBadge({ role, size = 'md' }) {
  const roleConfig = {
    admin: { label: 'Administrator', variant: 'danger' },
    manager: { label: 'Manager', variant: 'info' },
    cashier: { label: 'Cashier', variant: 'success' },
    auditor: { label: 'Auditor', variant: 'purple' },
  }

  const config = roleConfig[role] || { label: role, variant: 'default' }

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  )
}
