import * as React from "react";

import { cn } from "../../lib/utils";

const ButtonGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="button-group"
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-xl border border-gray-200/60 bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/75 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-l-gray-200/70 dark:[&>*:not(:first-child)]:border-l-white/10",
        className,
      )}
      {...props}
    />
  ),
);
ButtonGroup.displayName = "ButtonGroup";

const ButtonGroupText = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="button-group-text"
      className={cn(
        "inline-flex min-w-[3.5rem] items-center justify-center px-3 text-[11px] font-medium tracking-wide text-gray-400 dark:text-white/35",
        className,
      )}
      {...props}
    />
  ),
);
ButtonGroupText.displayName = "ButtonGroupText";

export { ButtonGroup, ButtonGroupText };
