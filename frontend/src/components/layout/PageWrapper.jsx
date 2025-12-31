import { cn } from '@/lib/utils'

export default function PageWrapper({
  title,
  subtitle,
  actions,
  children,
  className,
  fullWidth = false,
}) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Page Header */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-zinc-800">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
            )}
          </div>
          
          {actions && (
            <div className="flex items-center gap-3 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Page Content */}
      <div className={cn(!fullWidth && 'max-w-7xl')}>
        {children}
      </div>
    </div>
  )
}
