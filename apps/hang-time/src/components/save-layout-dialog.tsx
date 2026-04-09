import { SuiteDialogContent } from "@canvas-tools/ui";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SavedLayout } from "@/types";

interface SaveLayoutDialogProps {
  onSave: (title: string) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (id: string) => Promise<{ success: boolean; error?: string }>;
  isNameTaken: (name: string, excludeId?: string) => boolean;
  existingLayoutForCurrentConfig: SavedLayout | null;
  loadedLayout: SavedLayout | null;
  hasUnsavedChanges: boolean;
  isRemoteLoading?: boolean;
  isSignedIn?: boolean;
  remoteError?: string | null;
  buttonClassName?: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  tooltipLabel?: string;
}

export function SaveLayoutDialog({
  onSave,
  onUpdate,
  isNameTaken,
  existingLayoutForCurrentConfig,
  loadedLayout,
  hasUnsavedChanges,
  isRemoteLoading = false,
  isSignedIn = false,
  remoteError = null,
  buttonClassName,
  buttonLabel,
  iconOnly = false,
  tooltipLabel,
}: SaveLayoutDialogProps) {
  const [title, setTitle] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"update" | "new">("update");

  // Check for duplicate name as user types
  const nameTaken = title.trim() && isNameTaken(title);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setError(null);
      setMode("update");
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const result = await onSave(title);
      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Failed to save");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!loadedLayout) return;
    setIsSubmitting(true);
    try {
      const result = await onUpdate(loadedLayout.id);
      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Failed to update");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && title.trim() && !nameTaken && !isSubmitting) {
      void handleSave();
    }
  };

  const canSave = title.trim() && !nameTaken && !isSubmitting;
  const triggerClassName = cn(
    iconOnly ? "h-9 w-9 rounded-xl p-0" : buttonLabel ? "justify-start" : "flex-1",
    buttonClassName,
  );
  const triggerIconClassName = iconOnly ? "h-4 w-4" : buttonLabel ? "mr-2 h-4 w-4" : "size-4";
  const resolvedTooltipLabel = tooltipLabel ?? buttonLabel ?? "Save layout";
  const statusMessage = remoteError
    ? remoteError
    : isSignedIn
      ? isRemoteLoading
        ? "Loading account layouts..."
        : "Layouts save to your account."
      : "Layouts stay on this device.";
  const statusClassName = remoteError
    ? "text-red-500 dark:text-red-400"
    : "text-gray-500 dark:text-white/50";

  // If already saved (exact match), just show disabled button
  if (existingLayoutForCurrentConfig) {
    const button = (
      <Button
        variant="outline"
        size="sm"
        className={triggerClassName}
        disabled
        aria-label="Already saved"
      >
        <Save className={triggerIconClassName} />
        {!iconOnly && buttonLabel ? <span>{buttonLabel}</span> : null}
      </Button>
    );

    return iconOnly ? (
      <Tooltip>
        <TooltipTrigger render={<span>{button}</span>} />
        <TooltipContent>Already saved</TooltipContent>
      </Tooltip>
    ) : (
      button
    );
  }

  // If viewing a loaded layout with unsaved changes, show dialog with update/save-as options
  if (loadedLayout && hasUnsavedChanges) {
    const triggerButton = (
      <Button
        variant="outline"
        size="sm"
        className={triggerClassName}
        aria-label={resolvedTooltipLabel}
      >
        <Save className={triggerIconClassName} />
        {!iconOnly && buttonLabel ? <span>{buttonLabel}</span> : null}
      </Button>
    );

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {iconOnly ? (
          <Tooltip>
            <TooltipTrigger render={<DialogTrigger render={triggerButton} />} />
            <TooltipContent>{resolvedTooltipLabel}</TooltipContent>
          </Tooltip>
        ) : (
          <DialogTrigger render={triggerButton} />
        )}
        <SuiteDialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Changes</DialogTitle>
            <DialogDescription>You've made changes to "{loadedLayout.title}"</DialogDescription>
          </DialogHeader>
          <p className={cn("text-xs", statusClassName)}>{statusMessage}</p>

          {mode === "update" ? (
            <>
              <div className="py-2 text-sm text-gray-600 dark:text-white/60">
                Update the existing layout with your changes, or save as a new layout.
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
              <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button
                  onClick={() => void handleUpdate()}
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Update "{loadedLayout.title}"
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode("new")}
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Save as New Layout
                </Button>
                <DialogClose
                  render={
                    <Button variant="ghost" className="w-full" disabled={isSubmitting}>
                      Cancel
                    </Button>
                  }
                />
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="layout-title">New Layout Name</Label>
                <Input
                  id="layout-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Living Room Gallery v2"
                  autoFocus
                  className={nameTaken ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {nameTaken && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    A layout with this name already exists
                  </p>
                )}
                {error && !nameTaken && (
                  <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("update")} disabled={isSubmitting}>
                  Back
                </Button>
                <Button onClick={() => void handleSave()} disabled={!canSave}>
                  Save as New
                </Button>
              </DialogFooter>
            </>
          )}
        </SuiteDialogContent>
      </Dialog>
    );
  }

  // Default: simple save dialog for new layout
  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className={triggerClassName}
      aria-label={resolvedTooltipLabel}
    >
      <Save className={triggerIconClassName} />
      {!iconOnly && buttonLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger render={<DialogTrigger render={triggerButton} />} />
          <TooltipContent>{resolvedTooltipLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger render={triggerButton} />
      )}
      <SuiteDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Layout</DialogTitle>
          <DialogDescription>Give this layout a name to save it for later.</DialogDescription>
        </DialogHeader>
        <p className={cn("text-xs", statusClassName)}>{statusMessage}</p>

        <div className="space-y-2">
          <Label htmlFor="layout-title">Title</Label>
          <Input
            id="layout-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Living Room Gallery"
            autoFocus
            className={nameTaken ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {nameTaken && (
            <p className="text-sm text-red-500 dark:text-red-400">
              A layout with this name already exists
            </p>
          )}
          {error && !nameTaken && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            }
          />
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            Save Layout
          </Button>
        </DialogFooter>
      </SuiteDialogContent>
    </Dialog>
  );
}
