import * as React from "react";
import { Button, type ButtonProps } from "./components/ui/button";
import { ButtonGroup, ButtonGroupText } from "./components/ui/button-group";
import { cn } from "./lib/utils";

type ViewportToolbarButtonKind = "action" | "icon" | "step";

const ViewportToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ButtonGroup ref={ref} className={cn("shadow-lg backdrop-blur-xl", className)} {...props} />
  ),
);
ViewportToolbar.displayName = "ViewportToolbar";

const ViewportToolbarValue = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ButtonGroupText ref={ref} className={cn("min-w-[3.75rem]", className)} {...props} />
  ),
);
ViewportToolbarValue.displayName = "ViewportToolbarValue";

interface ViewportToolbarButtonProps extends Omit<ButtonProps, "size" | "variant"> {
  kind?: ViewportToolbarButtonKind;
}

const viewportToolbarButtonClassNames: Record<ViewportToolbarButtonKind, string> = {
  action: "px-3 text-[11px] font-medium",
  icon: "px-2.5",
  step: "min-w-10 px-0 text-sm font-semibold",
};

const ViewportToolbarButton = React.forwardRef<HTMLButtonElement, ViewportToolbarButtonProps>(
  ({ className, kind = "action", ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 rounded-none border-0 text-gray-700 hover:bg-white/45 hover:text-gray-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
        viewportToolbarButtonClassNames[kind],
        className,
      )}
      {...props}
    />
  ),
);
ViewportToolbarButton.displayName = "ViewportToolbarButton";

export { ViewportToolbar, ViewportToolbarButton, ViewportToolbarValue };
