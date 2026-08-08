import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = "rectangular", width, height }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  const variantClasses = {
    text: "rounded-md h-3 w-full",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  return (
    <div
      className={cn("skeleton", variantClasses[variant], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="border-border-subtle rounded-2xl border bg-white p-4 shadow-sm">
      <Skeleton variant="rectangular" className="mb-3 h-32 w-full" />
      <Skeleton variant="text" className="mb-2 w-3/4" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="border-border-subtle flex items-center gap-4 border-b py-3">
      <Skeleton variant="text" className="w-1/4" />
      <Skeleton variant="text" className="w-1/4" />
      <Skeleton variant="text" className="w-1/4" />
      <Skeleton variant="text" className="w-1/6" />
    </div>
  );
}

export function SkeletonKPICard() {
  return (
    <div className="border-border-subtle rounded-2xl border bg-white p-5 shadow-sm">
      <Skeleton variant="text" className="mb-2 w-2/3" />
      <Skeleton variant="text" className="h-8 w-1/3" />
    </div>
  );
}
