import { useEffect } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { removeToast } from '@/features/ui/uiSlice'
import { cn } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react'

const variants = {
  success: {
    icon: CheckCircle,
    className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconClass: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    className: 'bg-red-50 border-red-200 text-red-800',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-amber-50 border-amber-200 text-amber-800',
    iconClass: 'text-amber-500',
  },
  info: {
    icon: Info,
    className: 'bg-blue-50 border-blue-200 text-blue-800',
    iconClass: 'text-blue-500',
  },
}

export default function Toast({
  id,
  type = 'info',
  title,
  message,
  duration = 5000,
  dismissible = true,
}) {
  const dispatch = useAppDispatch()
  const variant = variants[type] || variants.info
  const Icon = variant.icon

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        dispatch(removeToast(id))
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [id, duration, dispatch])

  const handleDismiss = () => {
    dispatch(removeToast(id))
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 p-4 rounded-xl border shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        variant.className
      )}
      role="alert"
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', variant.iconClass)} />
      
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-sm">{title}</p>
        )}
        {message && (
          <p className={cn('text-sm', title && 'mt-1 opacity-90')}>
            {message}
          </p>
        )}
      </div>
      
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Helper hook for showing toasts
export function useToast() {
  const dispatch = useAppDispatch()
  
  const showToast = ({ type, title, message, duration }) => {
    dispatch(addToast({ type, title, message, duration }))
  }
  
  return {
    success: (title, message) => showToast({ type: 'success', title, message }),
    error: (title, message) => showToast({ type: 'error', title, message }),
    warning: (title, message) => showToast({ type: 'warning', title, message }),
    info: (title, message) => showToast({ type: 'info', title, message }),
  }
}
