import { cn } from "@/lib/utils";

export default function PageWrapper({
  title,
  subtitle,
  actions,
  children,
  className,
  fullWidth = false,
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Header */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {title && (
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-zinc-800 to-zinc-600 bg-clip-text text-transparent">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-zinc-500 font-medium">
                {subtitle}
              </p>
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
      <div className={cn(!fullWidth && "max-w-7xl")}>{children}</div>
    </div>
  );
}
