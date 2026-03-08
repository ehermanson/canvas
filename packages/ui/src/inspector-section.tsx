import { ChevronDown } from "lucide-react";
import * as React from "react";
import { CollapsibleTrigger } from "./components/ui/collapsible";
import { cn } from "./lib/utils";

type InspectorSectionHeaderVariant = "badge" | "inline";

interface InspectorSectionHeaderProps extends React.ComponentProps<
  typeof CollapsibleTrigger
> {
  description?: React.ReactNode;
  descriptionClassName?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBadgeClassName?: string;
  iconClassName?: string;
  label: React.ReactNode;
  labelClassName?: string;
  labelTrailing?: React.ReactNode;
  variant?: InspectorSectionHeaderVariant;
}

function InspectorSectionHeader({
  className,
  description,
  descriptionClassName,
  icon: Icon,
  iconBadgeClassName,
  iconClassName,
  label,
  labelClassName,
  labelTrailing,
  variant = "badge",
  ...props
}: InspectorSectionHeaderProps) {
  if (variant === "inline") {
    return (
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-start gap-3 py-2.5 text-left text-gray-700 transition-colors hover:text-gray-900 dark:text-white/80 dark:hover:text-white",
          className,
        )}
        {...props}
      >
        <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", iconClassName)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight",
                labelClassName,
              )}
            >
              {label}
            </span>
            {labelTrailing}
          </div>
          {description ? (
            <p
              className={cn(
                "mt-1 truncate text-xs text-gray-500 dark:text-white/40",
                descriptionClassName,
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
    );
  }

  return (
    <CollapsibleTrigger className={cn("group w-full", className)} {...props}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/90">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg",
            iconBadgeClassName,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
        </span>
        <span className={labelClassName}>{label}</span>
        {labelTrailing}
        <ChevronDown className="ml-auto h-4 w-4 text-gray-400 transition-transform group-data-[state=closed]:-rotate-90" />
      </h3>
    </CollapsibleTrigger>
  );
}

export { InspectorSectionHeader };
