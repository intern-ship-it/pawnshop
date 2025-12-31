import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, AlertCircle } from 'lucide-react'

const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Select an option',
  size = 'md',
  className,
  selectClassName,
  required = false,
  disabled = false,
  fullWidth = true,
  ...props
}, ref) => {
  const sizes = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-sm',
    lg: 'h-12 text-base',
  }

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select Container */}
      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full appearance-none rounded-lg border bg-white px-4 pr-10 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500',
            'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
            sizes[size],
            error
              ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
              : 'border-zinc-300 hover:border-zinc-400',
            selectClassName
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

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

Select.displayName = 'Select'

export default Select
