import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-brand-ink mb-1.5 block text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "border-border-subtle bg-surface text-brand-ink placeholder:text-text-secondary",
            "w-full rounded-2xl border px-4 py-2.5 text-sm",
            "transition-all duration-200 ease-out",
            "outline-none",
            "focus:border-brand-red/60 focus:ring-brand-red/15 focus:ring-3",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-status-error focus:border-status-error focus:ring-status-error/15",
            className,
          )}
          {...props}
        />
        {(error || hint) && (
          <p
            id={error ? errorId : hintId}
            className={cn("mt-1.5 text-xs", error ? "text-status-error" : "text-text-secondary")}
            role={error ? "alert" : undefined}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
