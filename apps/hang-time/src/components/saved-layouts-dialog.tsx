import { SuiteDialogContent } from "@canvas-tools/ui";
import { Check, FolderOpen, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SavedLayout } from "@/types";

interface SavedLayoutsDialogProps {
  layouts: SavedLayout[];
  onLoad: (layout: SavedLayout) => void;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newTitle: string) => Promise<{ success: boolean; error?: string }>;
  isRemoteLoading?: boolean;
  isSignedIn?: boolean;
  remoteError?: string | null;
  buttonClassName?: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  tooltipLabel?: string;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SavedLayoutsDialog({
  layouts,
  onLoad,
  onDelete,
  onRename,
  isRemoteLoading = false,
  isSignedIn = false,
  remoteError = null,
  buttonClassName,
  buttonLabel,
  iconOnly = false,
  tooltipLabel,
}: SavedLayoutsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEditing = (layout: SavedLayout, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(layout.id);
    setEditValue(layout.title);
    setEditError(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValue("");
    setEditError(null);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;

    setIsSubmitting(true);
    try {
      const result = await onRename(editingId, editValue);
      if (result.success) {
        setEditingId(null);
        setEditValue("");
        setEditError(null);
      } else {
        setEditError(result.error || "Failed to rename");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      if (!editingId) return;
      setIsSubmitting(true);
      try {
        const result = await onRename(editingId, editValue);
        if (result.success) {
          setEditingId(null);
          setEditValue("");
          setEditError(null);
        } else {
          setEditError(result.error || "Failed to rename");
        }
      } finally {
        setIsSubmitting(false);
      }
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditValue("");
      setEditError(null);
    }
  };

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        iconOnly ? "h-9 w-9 rounded-xl p-0" : buttonLabel ? "justify-start" : "flex-1",
        buttonClassName,
      )}
      aria-label={tooltipLabel ?? buttonLabel ?? "Saved layouts"}
    >
      <FolderOpen className={iconOnly ? "h-4 w-4" : buttonLabel ? "mr-2 h-4 w-4" : "size-4"} />
      {!iconOnly && buttonLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  );
  const statusMessage = remoteError
    ? remoteError
    : isSignedIn
      ? isRemoteLoading
        ? "Loading account layouts..."
        : "Layouts in this list are account-backed."
      : "Layouts in this list are stored on this device.";
  const statusClassName = remoteError
    ? "text-red-500 dark:text-red-400"
    : "text-gray-500 dark:text-white/50";

  return (
    <Dialog>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger render={<DialogTrigger render={triggerButton} />} />
          <TooltipContent>{tooltipLabel ?? buttonLabel ?? "Saved layouts"}</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger render={triggerButton} />
      )}
      <SuiteDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved Layouts</DialogTitle>
          <DialogDescription>Click a layout to load it.</DialogDescription>
        </DialogHeader>
        <p className={cn("text-xs", statusClassName)}>{statusMessage}</p>

        {layouts.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-white/50">
            <p>No saved layouts yet.</p>
            <p className="text-sm mt-1">Use the Save button to save your current layout.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {layouts.map((layout) => (
              <div
                key={layout.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/20 cursor-pointer transition-colors"
                onClick={() => editingId !== layout.id && onLoad(layout)}
              >
                <div className="flex-1 min-w-0">
                  {editingId === layout.id ? (
                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          setEditError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className={`h-8 ${editError ? "border-red-500" : ""}`}
                        disabled={isSubmitting}
                      />
                      {editError && (
                        <p className="text-xs text-red-500 dark:text-red-400">{editError}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {layout.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-white/50">
                        {formatDate(layout.createdAt)}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center ml-2">
                  {editingId === layout.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-500/20"
                        onClick={(e) => void saveEdit(e)}
                        disabled={isSubmitting}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/60 dark:hover:bg-white/10"
                        onClick={cancelEditing}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:text-white/40 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/20"
                        onClick={(e) => startEditing(layout, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:hover:bg-red-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(layout.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SuiteDialogContent>
    </Dialog>
  );
}
