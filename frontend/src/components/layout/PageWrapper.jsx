import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE, DURATION } from "@/lib/motion";

/**
 * Every screen renders through here, so this is where page motion belongs: one
 * definition instead of each page inventing its own entrance.
 *
 * The header and the content arrive a beat apart. That ordering is the point -- the
 * eye lands on the title, then the body settles beneath it -- and it is small enough
 * that an operator who moves fast never waits on it.
 */
export default function PageWrapper({
  title,
  subtitle,
  actions,
  children,
  className,
  fullWidth = false,
}) {
  const reduced = useReducedMotion();

  // An operator who has asked their system to stop animating still gets the fade,
  // which carries the "this is new" signal without the movement.
  const rise = reduced ? 0 : 8;

  return (
    <div className={cn("space-y-6", !fullWidth && "max-w-[1600px] mx-auto", className)}>
      {/* Page Header */}
      {(title || actions) && (
        <motion.div
          initial={{ opacity: 0, y: rise }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
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
        </motion.div>
      )}

      {/* Page Content */}
      <motion.div
        initial={{ opacity: 0, y: rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE, delay: reduced ? 0 : 0.05 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
