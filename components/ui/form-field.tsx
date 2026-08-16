"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FormField — pairs a label, control, and optional hint/error message.
 * The single source of truth for form layout across the app.
 *
 * The label is programmatically associated with the control: when a single
 * element child is given, its `id` (auto-generated via useId unless the
 * child carries one) is bound to the label's htmlFor, and error/hint text
 * is wired through aria-describedby — screen readers announce
 * "label, control, description" as one unit (WCAG 1.3.1 / 4.1.2).
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
  const autoId = React.useId();
  const id = htmlFor ?? autoId;
  const descriptionId = React.useId();

  let control = children;
  const onlyChild = React.Children.count(children) === 1 ? React.Children.only(children) : null;
  if (React.isValidElement(onlyChild)) {
    const props = onlyChild.props as React.HTMLAttributes<HTMLElement> & {
      "aria-describedby"?: string;
    };
    control = React.cloneElement(onlyChild, {
      id: props.id ?? id,
      "aria-describedby":
        error || hint ? (props["aria-describedby"] ?? descriptionId) : props["aria-describedby"],
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="label text-brand-ink flex items-center gap-1">
          {label}
          {required && (
            <span className="text-status-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ? (
        <p role="alert" id={descriptionId} className="caption text-status-error">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="caption text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
