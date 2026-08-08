"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FormField — pairs a label, control, and optional hint/error message.
 * The single source of truth for form layout across the app.
 *
 * Usage:
 *   <FormField label="الاسم" hint="يظهر على الفاتورة" error={errors.name}>
 *     <Input value={name} onChange={...} />
 *   </FormField>
 */
export interface FormFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="label text-brand-ink flex items-center gap-1">
          {label}
          {required && (
            <span className="text-status-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="caption text-status-error">
          {error}
        </p>
      ) : hint ? (
        <p className="caption text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}
