import React from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

/**
 * Phone Input Component with Country Code Selector
 * Uses react-phone-number-input for international phone number support
 */
export default function PhoneInputField({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = "Enter phone number",
  defaultCountry = "MY", // Malaysia
  className,
  helperText,
  ...props
}) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <PhoneInput
          international
          defaultCountry={defaultCountry}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn("phone-input-custom", error && "phone-input-error")}
          {...props}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {helperText && !error && (
        <p className="text-xs text-zinc-500 mt-1">{helperText}</p>
      )}

      <style jsx global>{`
        .phone-input-custom {
          width: 100%;
        }

        .phone-input-custom .PhoneInputInput {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e4e4e7;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          color: #18181b;
          background-color: white;
          transition: all 0.15s ease;
          outline: none;
        }

        .phone-input-custom .PhoneInputInput:hover {
          border-color: #d4d4d8;
        }

        .phone-input-custom .PhoneInputInput:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .phone-input-custom .PhoneInputInput:disabled {
          background-color: #f4f4f5;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .phone-input-custom .PhoneInputCountry {
          margin-right: 0.5rem;
          padding: 0.625rem 0.5rem;
          border: 1px solid #e4e4e7;
          border-radius: 0.5rem;
          background-color: white;
          transition: all 0.15s ease;
        }

        .phone-input-custom .PhoneInputCountry:hover {
          border-color: #d4d4d8;
          background-color: #fafafa;
        }

        .phone-input-custom .PhoneInputCountryIcon {
          width: 1.25rem;
          height: 1.25rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .phone-input-custom .PhoneInputCountrySelect {
          cursor: pointer;
        }

        .phone-input-custom .PhoneInputCountrySelectArrow {
          width: 0.375rem;
          height: 0.375rem;
          color: #71717a;
          margin-left: 0.375rem;
          opacity: 0.8;
        }

        /* Error state */
        .phone-input-error .PhoneInputInput {
          border-color: #ef4444;
        }

        .phone-input-error .PhoneInputInput:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .phone-input-error .PhoneInputCountry {
          border-color: #ef4444;
        }

        /* Dropdown styling */
        .PhoneInputCountrySelect option {
          padding: 0.5rem;
        }
      `}</style>
    </div>
  );
}
