import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Styled native <select>. Native is preferred here for accessibility and to
// avoid a heavyweight popover dependency for a simple language picker.
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm text-foreground shadow-sm transition-colors",
          "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Themed option list (native popup inherits these on Chromium/Firefox).
          "[&>option]:bg-popover [&>option]:text-popover-foreground",
          // Custom caret so we can drop the browser default and keep it on-theme.
          "bg-size-[1rem] bg-position-[right_0.5rem_center] bg-no-repeat",
          "bg-(image:--select-caret)",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";

export { Select };
