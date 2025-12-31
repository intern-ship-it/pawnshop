import { cn } from '@/lib/utils'

export default function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
  ...props
}) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-zinc-200 shadow-sm',
        hover && 'hover:shadow-md hover:border-zinc-300 transition-all duration-200 cursor-pointer',
        paddings[padding],
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

// Card Header
Card.Header = function CardHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  className,
  children,
}) {
  if (children) {
    return (
      <div className={cn('mb-4', className)}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          {title && (
            <h3 className="font-semibold text-zinc-800">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}

// Card Content
Card.Content = function CardContent({ children, className }) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  )
}

// Card Footer
Card.Footer = function CardFooter({ children, className, border = true }) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 flex items-center justify-end gap-3',
        border && 'border-t border-zinc-100',
        className
      )}
    >
      {children}
    </div>
  )
}
