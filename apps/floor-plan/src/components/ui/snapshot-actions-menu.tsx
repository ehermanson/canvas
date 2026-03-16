import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SnapshotActionsMenuProps {
  onDuplicate: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}

export function SnapshotActionsMenu({
  onDuplicate,
  onDelete,
  deleteDisabled = false,
}: SnapshotActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setOpen((prev) => !prev);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Snapshot actions</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-[9999] mt-1 w-44 overflow-hidden rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100/90 hover:text-gray-950 dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-white"
            onClick={() => {
              onDuplicate();
              setOpen(false);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            disabled={deleteDisabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
