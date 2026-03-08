import { ArrowUpRight } from "lucide-react";
import * as React from "react";
import { Button } from "./components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";
import { cn } from "./lib/utils";

interface ToolLinkButtonProps extends Omit<
  React.ComponentProps<"a">,
  "children" | "href"
> {
  href: string;
  label: string;
  compact?: boolean;
  iconOnly?: boolean;
  tooltipLabel?: string;
}

export function ToolLinkButton({
  className,
  compact = false,
  href,
  iconOnly = false,
  label,
  tooltipLabel,
  ...props
}: ToolLinkButtonProps) {
  const link = (
    <Button
      asChild
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      className={cn(
        iconOnly
          ? "justify-center bg-white/80 dark:bg-slate-900/60"
          : "justify-start bg-white/80 dark:bg-slate-900/60",
        iconOnly && "h-9 w-9 rounded-xl p-0",
        compact && "h-8 px-2.5 text-[11px]",
        className,
      )}
    >
      <a href={href} aria-label={label} {...props}>
        <ArrowUpRight className="h-3.5 w-3.5" />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </a>
    </Button>
  );

  if (!tooltipLabel && !iconOnly) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent>{tooltipLabel ?? label}</TooltipContent>
    </Tooltip>
  );
}
