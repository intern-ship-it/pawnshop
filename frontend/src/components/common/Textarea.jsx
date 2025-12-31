import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

const Textarea = forwardRef(({
  label,
  error,
  hint,
  className,
  textareaClassName,
  required = false,
  disabled = false,
  fullWidth = true,
  rows = 4,
  ...props
}, ref) => {
  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Textarea */}
      <textarea
        ref={ref}
        disabled={disabled}
        rows={rows}
        className={cn(
          'w-full rounded-lg border bg-white px-4 py-3 text-sm transition-all duration-200',
          'placeholder:text-zinc-400 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500',
          'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
          error
            ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
            : 'border-zinc-300 hover:border-zinc-400',
          textareaClassName
        )}
        {...props}
      />

      {/* Error or Hint */}
      {(error || hint) && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs',
          error ? 'text-red-500' : 'text-zinc-500'
        )}>
          {error && <AlertCircle className="w-3.5 h-3.5" />}
          <span>{error || hint}</span>
        </div>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Textarea
