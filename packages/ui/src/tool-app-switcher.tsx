import { ChevronDown } from "lucide-react";
import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { cn } from "./lib/utils";
import { ToolPanelBrandMark } from "./tool-shell";

interface ToolAppBrandProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  icon: React.ReactNode;
  iconClassName?: string;
  subtitle?: React.ReactNode;
  title: React.ReactNode;
}

interface ToolAppSwitcherItem {
  href: string;
  icon: React.ReactNode;
  iconClassName?: string;
  subtitle: React.ReactNode;
  title: React.ReactNode;
}

interface ToolAppSwitcherProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
  currentIcon: React.ReactNode;
  currentIconClassName?: string;
  currentSubtitle?: React.ReactNode;
  currentTitle: React.ReactNode;
  items: ToolAppSwitcherItem[];
}

function ToolAppBrand({
  className,
  icon,
  iconClassName,
  subtitle,
  title,
  ...props
}: ToolAppBrandProps) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2.5", className)}
      {...props}
    >
      <ToolPanelBrandMark className={cn("h-8 w-8 rounded-xl", iconClassName)}>
        {icon}
      </ToolPanelBrandMark>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-white/45">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ToolAppSwitcher({
  className,
  currentIcon,
  currentIconClassName,
  currentSubtitle,
  currentTitle,
  items,
  ariaLabel,
  ...props
}: ToolAppSwitcherProps) {
  const resolvedAriaLabel =
    ariaLabel ??
    (typeof currentTitle === "string"
      ? `Switch apps from ${currentTitle}`
      : "Switch apps");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group -mx-1 inline-flex max-w-full items-center gap-0.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:hover:bg-white/5 dark:focus-visible:ring-indigo-300/40",
            className,
          )}
          aria-label={resolvedAriaLabel}
          {...props}
        >
          <ToolAppBrand
            className="min-w-0"
            icon={currentIcon}
            iconClassName={currentIconClassName}
            subtitle={currentSubtitle}
            title={currentTitle}
          />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors group-hover:text-gray-600 dark:text-white/35 dark:group-hover:text-white/60">
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-gray-200/70 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95"
      >
        <div className="space-y-1">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">
            Switch app
          </p>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-gray-200/80 hover:bg-gray-50 dark:hover:border-white/10 dark:hover:bg-white/5"
            >
              <ToolAppBrand
                icon={item.icon}
                iconClassName={item.iconClassName}
                subtitle={item.subtitle}
                title={item.title}
              />
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ToolAppBrand, ToolAppSwitcher };
