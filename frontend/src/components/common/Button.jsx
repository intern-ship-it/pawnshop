import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-zinc-800 text-white hover:bg-zinc-700 shadow-sm',
  secondary: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
  accent: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm shadow-amber-500/25',
  outline: 'border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  link: 'text-amber-600 hover:text-amber-700 underline-offset-4 hover:underline p-0 h-auto',
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
  xl: 'h-14 px-8 text-lg rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
  'icon-lg': 'h-12 w-12 rounded-xl',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
  loading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth = false,
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4" />
      ) : null}
      
      {children}
      
      {RightIcon && !loading && (
        <RightIcon className="w-4 h-4" />
      )}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
