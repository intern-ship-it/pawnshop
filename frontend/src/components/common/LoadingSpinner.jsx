import { cn } from '@/lib/utils'

export default function LoadingSpinner({
  size = 'md',
  className,
  fullPage = false,
  text,
}) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
    xl: 'w-16 h-16 border-4',
  }

  const spinner = (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'rounded-full border-zinc-200 border-t-amber-500 animate-spin',
          sizes[size]
        )}
      />
      {text && <p className="text-sm text-zinc-500">{text}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    )
  }

  return spinner
}

// Page Loading Component
LoadingSpinner.Page = function PageLoading({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}

// Inline Loading Component
LoadingSpinner.Inline = function InlineLoading({ text = 'Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-zinc-500">
      <LoadingSpinner size="sm" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
