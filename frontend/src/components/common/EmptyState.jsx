import { cn } from '@/lib/utils'
import { Inbox, Search, FileX, AlertCircle } from 'lucide-react'
import Button from './Button'

const icons = {
  empty: Inbox,
  search: Search,
  error: AlertCircle,
  noFile: FileX,
}

export default function EmptyState({
  icon = 'empty',
  title = 'No data found',
  description,
  action,
  actionLabel,
  onAction,
  className,
}) {
  const Icon = typeof icon === 'string' ? icons[icon] : icon

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 mb-4">
        <Icon className="w-8 h-8 text-zinc-400" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-zinc-800 mb-1">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-zinc-500 max-w-sm mb-4">{description}</p>
      )}

      {/* Action */}
      {(action || (actionLabel && onAction)) && (
        <div className="mt-2">
          {action || (
            <Button variant="accent" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
