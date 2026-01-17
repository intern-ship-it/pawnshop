import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

const Input = forwardRef(
  (
    {
      label,
      error,
      hint,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      leftElement,
      rightElement,
      type = "text",
      size = "md",
      className,
      inputClassName,
      required = false,
      disabled = false,
      fullWidth = true,
      multiline = false,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    const sizes = {
      sm: "h-9 text-sm",
      md: "h-11 text-sm",
      lg: "h-12 text-base",
    };

    const baseInputClasses = cn(
      "w-full rounded-lg border bg-white px-4 transition-all duration-200",
      "placeholder:text-zinc-400",
      "focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500",
      "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
      !multiline && sizes[size],
      multiline && "py-3 text-sm",
      (LeftIcon || leftElement) && "pl-10",
      (RightIcon || rightElement || isPassword) && "pr-10",
      error
        ? "border-red-300 focus:ring-red-500/30 focus:border-red-500"
        : "border-zinc-300 hover:border-zinc-400",
      inputClassName
    );

    // Animation variants for eye icon
    const iconVariants = {
      initial: {
        scale: 0.6,
        opacity: 0,
        rotate: -90,
      },
      animate: {
        scale: 1,
        opacity: 1,
        rotate: 0,
        transition: {
          type: "spring",
          stiffness: 500,
          damping: 25,
          duration: 0.3,
        },
      },
      exit: {
        scale: 0.6,
        opacity: 0,
        rotate: 90,
        transition: {
          duration: 0.15,
        },
      },
      hover: {
        scale: 1.1,
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 10,
        },
      },
      tap: {
        scale: 0.9,
      },
    };

    return (
      <div
        className={cn(
          "flex flex-col gap-1.5",
          fullWidth && "w-full",
          className
        )}
      >
        {/* Label */}
        {label && (
          <label className="text-sm font-medium text-zinc-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon or Element */}
          {(LeftIcon || leftElement) && (
            <div
              className={cn(
                "absolute left-3 text-zinc-400 flex items-center justify-center",
                multiline ? "top-3" : "top-1/2 -translate-y-1/2"
              )}
            >
              {LeftIcon ? <LeftIcon className="w-5 h-5" /> : leftElement}
            </div>
          )}

          {/* Input Field or Textarea */}
          {multiline ? (
            <textarea
              ref={ref}
              disabled={disabled}
              rows={rows}
              className={baseInputClasses}
              {...props}
            />
          ) : (
            <input
              ref={ref}
              type={inputType}
              disabled={disabled}
              className={baseInputClasses}
              {...props}
            />
          )}

          {/* Right Icon, Element or Password Toggle */}
          {(RightIcon || rightElement || isPassword) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {isPassword ? (
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-400 hover:text-amber-500 transition-colors p-1 rounded-full"
                  tabIndex={-1}
                  whileHover="hover"
                  whileTap="tap"
                  variants={iconVariants}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {showPassword ? (
                      <motion.div
                        key="eyeOff"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <EyeOff className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="eye"
                        variants={iconVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <Eye className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              ) : RightIcon ? (
                <RightIcon className="w-5 h-5 text-zinc-400" />
              ) : (
                rightElement
              )}
            </div>
          )}
        </div>

        {/* Error or Hint */}
        {(error || hint) && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              error ? "text-red-500" : "text-zinc-500"
            )}
          >
            {error && <AlertCircle className="w-3.5 h-3.5" />}
            <span>{error || hint}</span>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
