"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

/**
 * Accessible bottom-sheet / modal dialog (WCAG 2.2 AA).
 *
 * Built on @base-ui/react Dialog primitives, which provide for free:
 *   - role="dialog" + aria-modal="true"
 *   - Focus trap (modal mode, default)
 *   - Focus restoration on close (to the trigger or previously focused element)
 *   - Escape key to close
 *   - Body scroll lock while open
 *   - Click outside (backdrop) to close
 *   - aria-labelledby auto-linked from SheetTitle to the popup
 *
 * This replaces the hand-rolled `fixed inset-0 … bg-black/30` overlays
 * that had none of these behaviors (WEB-A11Y-001).
 *
 * Visual: bottom-sheet on mobile (`items-end`), centered on desktop
 * (`sm:items-center`), matching the existing brand design language
 * (rounded-t-2xl → sm:rounded-2xl, per spec §11.4 radius.lg = 24px).
 */
interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /**
   * When true, clicking the backdrop will NOT close the sheet.
   * Use for destructive/important confirmations where accidental
   * dismissal could cause confusion.  Escape key still works.
   * @default false
   */
  disableBackdropClose?: boolean;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  className,
  disableBackdropClose = false,
}: SheetProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      modal
      disablePointerDismissal={disableBackdropClose}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "ease-spring-gentle",
            className,
          )}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Title for a Sheet.  Renders an `<h2>` with `aria-labelledby` auto-linked
 * to the popup by Base UI.  Required for screen-reader accessibility
 * (WCAG 4.1.2 Name, Role, Value).
 */
export function SheetTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Title className={cn("font-heading text-brand-ink text-lg font-semibold", className)}>
      {children}
    </Dialog.Title>
  );
}

/**
 * Optional description text below the title.  Auto-linked via
 * `aria-describedby` to the popup by Base UI.
 */
export function SheetDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Description className={cn("text-text-secondary mt-1 text-sm", className)}>
      {children}
    </Dialog.Description>
  );
}

/**
 * Close button that dismisses the sheet.  Use when the sheet's content
 * doesn't have its own close action (e.g. a "Cancel" button).
 */
export function SheetClose({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <Dialog.Close
      className={cn(
        "border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Close>
  );
}
