import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  trendLabel,
  variant = 'default',
  className,
  onClick,
}) {
  const variants = {
    default: {
      bg: 'bg-white',
      iconBg: 'bg-zinc-100',
      iconColor: 'text-zinc-600',
    },
    primary: {
      bg: 'bg-gradient-to-br from-zinc-800 to-zinc-900',
      iconBg: 'bg-white/10',
      iconColor: 'text-white',
      textColor: 'text-white',
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      textColor: 'text-white',
    },
    success: {
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      textColor: 'text-white',
    },
    danger: {
      bg: 'bg-gradient-to-br from-red-500 to-red-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      textColor: 'text-white',
    },
  }

  const variantStyles = variants[variant]
  const isColored = variant !== 'default'

  // Determine trend icon and color
  const getTrendDisplay = () => {
    if (trend === 'up') {
      return {
        Icon: TrendingUp,
        color: isColored ? 'text-white/90' : 'text-emerald-600',
        bg: isColored ? 'bg-white/10' : 'bg-emerald-50',
      }
    }
    if (trend === 'down') {
      return {
        Icon: TrendingDown,
        color: isColored ? 'text-white/90' : 'text-red-600',
        bg: isColored ? 'bg-white/10' : 'bg-red-50',
      }
    }
    return {
      Icon: Minus,
      color: isColored ? 'text-white/70' : 'text-zinc-500',
      bg: isColored ? 'bg-white/10' : 'bg-zinc-100',
    }
  }

  const trendDisplay = trend ? getTrendDisplay() : null

  return (
    <div
      className={cn(
        'relative rounded-xl border p-5 transition-all duration-200',
        variantStyles.bg,
        isColored ? 'border-transparent shadow-lg' : 'border-zinc-200 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="space-y-2">
          {/* Title */}
          <p className={cn(
            'text-sm font-medium',
            isColored ? 'text-white/80' : 'text-zinc-500'
          )}>
            {title}
          </p>

          {/* Value */}
          <p className={cn(
            'text-2xl font-bold tracking-tight',
            isColored ? 'text-white' : 'text-zinc-800'
          )}>
            {value}
          </p>

          {/* Subtitle or Trend */}
          {(subtitle || trendValue) && (
            <div className="flex items-center gap-2">
              {trendDisplay && trendValue && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                  trendDisplay.bg,
                  trendDisplay.color
                )}>
                  <trendDisplay.Icon className="w-3 h-3" />
                  {trendValue}
                </span>
              )}
              {(subtitle || trendLabel) && (
                <span className={cn(
                  'text-xs',
                  isColored ? 'text-white/70' : 'text-zinc-500'
                )}>
                  {subtitle || trendLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className={cn(
            'flex items-center justify-center w-12 h-12 rounded-xl',
            variantStyles.iconBg
          )}>
            <Icon className={cn('w-6 h-6', variantStyles.iconColor)} />
          </div>
        )}
      </div>
    </div>
  )
}
