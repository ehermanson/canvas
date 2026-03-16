import * as React from "react";
import { Button, type ButtonProps } from "./components/ui/button";
import { cn } from "./lib/utils";

const toolPanelSurfaceClassName =
  "rounded-2xl border border-gray-200/50 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90";

const ToolPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tool-panel"
      className={cn(toolPanelSurfaceClassName, className)}
      {...props}
    />
  ),
);
ToolPanel.displayName = "ToolPanel";

const ToolPanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tool-panel-header"
      className={cn("border-b border-gray-200/50 px-4 py-3 dark:border-white/10", className)}
      {...props}
    />
  ),
);
ToolPanelHeader.displayName = "ToolPanelHeader";

const ToolPanelActionBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tool-panel-action-bar"
      className={cn("border-b border-gray-200/50 px-4 py-3 dark:border-white/10", className)}
      {...props}
    />
  ),
);
ToolPanelActionBar.displayName = "ToolPanelActionBar";

interface ToolPanelTitleProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "content" | "title"
> {
  actions?: React.ReactNode;
  content?: React.ReactNode;
  leading?: React.ReactNode;
  subtitle?: React.ReactNode;
  subtitleClassName?: string;
  title: React.ReactNode;
  titleClassName?: string;
}

const ToolPanelTitle = React.forwardRef<HTMLDivElement, ToolPanelTitleProps>(
  (
    {
      actions,
      className,
      content,
      leading,
      subtitle,
      subtitleClassName,
      title,
      titleClassName,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-slot="tool-panel-title"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {content ? (
          <div className="min-w-0 flex-1">{content}</div>
        ) : (
          <>
            {leading ? <div className="shrink-0">{leading}</div> : null}
            <div className="min-w-0">
              <h1
                className={cn(
                  "truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white",
                  titleClassName,
                )}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  className={cn(
                    "mt-0.5 truncate text-[11px] text-gray-500 dark:text-white/45",
                    subtitleClassName,
                  )}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  ),
);
ToolPanelTitle.displayName = "ToolPanelTitle";

const ToolPanelBrandMark = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tool-panel-brand-mark"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
      {...props}
    />
  ),
);
ToolPanelBrandMark.displayName = "ToolPanelBrandMark";

const ToolPanelHeaderButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "icon", variant = "ghost", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={cn(
        "h-7 w-7 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-35 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
      {...props}
    />
  ),
);
ToolPanelHeaderButton.displayName = "ToolPanelHeaderButton";

const ToolPanelActionButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "icon", variant = "outline", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={cn(
        "h-9 w-9 rounded-xl border-gray-200/70 bg-white/80 text-gray-500 shadow-sm hover:border-gray-300 hover:bg-white hover:text-gray-800 disabled:pointer-events-none disabled:opacity-35 dark:border-white/10 dark:bg-slate-900/60 dark:text-white/60 dark:hover:border-white/20 dark:hover:bg-slate-900 dark:hover:text-white",
        className,
      )}
      {...props}
    />
  ),
);
ToolPanelActionButton.displayName = "ToolPanelActionButton";

const FloatingIconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "icon", variant = "outline", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      className={cn(
        "h-12 w-12 rounded-2xl border-gray-200/60 bg-white/90 shadow-2xl backdrop-blur-xl hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800",
        className,
      )}
      {...props}
    />
  ),
);
FloatingIconButton.displayName = "FloatingIconButton";

export {
  FloatingIconButton,
  ToolPanel,
  ToolPanelActionBar,
  ToolPanelActionButton,
  ToolPanelBrandMark,
  ToolPanelHeader,
  ToolPanelHeaderButton,
  ToolPanelTitle,
};
