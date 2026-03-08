import { Save } from 'lucide-react';
import { SuiteDialogContent } from '@canvas-tools/ui';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SavedLayout } from '@/types';

interface SaveLayoutDialogProps {
  onSave: (title: string) => { success: boolean; error?: string };
  onUpdate: (id: string) => { success: boolean; error?: string };
  isNameTaken: (name: string, excludeId?: string) => boolean;
  existingLayoutForCurrentConfig: SavedLayout | null;
  loadedLayout: SavedLayout | null;
  hasUnsavedChanges: boolean;
}

export function SaveLayoutDialog({
  onSave,
  onUpdate,
  isNameTaken,
  existingLayoutForCurrentConfig,
  loadedLayout,
  hasUnsavedChanges,
}: SaveLayoutDialogProps) {
  const [title, setTitle] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'update' | 'new'>('update');

  // Check for duplicate name as user types
  const nameTaken = title.trim() && isNameTaken(title);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setError(null);
      setMode('update');
    }
  }, [isOpen]);

  const handleSave = () => {
    const result = onSave(title);
    if (result.success) {
      setIsOpen(false);
    } else {
      setError(result.error || 'Failed to save');
    }
  };

  const handleUpdate = () => {
    if (!loadedLayout) return;
    const result = onUpdate(loadedLayout.id);
    if (result.success) {
      setIsOpen(false);
    } else {
      setError(result.error || 'Failed to update');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim() && !nameTaken) {
      handleSave();
    }
  };

  const canSave = title.trim() && !nameTaken;

  // If already saved (exact match), just show disabled button
  if (existingLayoutForCurrentConfig) {
    return (
      <Button variant="outline" size="sm" className="flex-1" disabled title="Already saved">
        <Save className="size-4" />
      </Button>
    );
  }

  // If viewing a loaded layout with unsaved changes, show dialog with update/save-as options
  if (loadedLayout && hasUnsavedChanges) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1" title="Save changes">
            <Save className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <SuiteDialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Changes</DialogTitle>
            <DialogDescription>
              You've made changes to "{loadedLayout.title}"
            </DialogDescription>
          </DialogHeader>

          {mode === 'update' ? (
            <>
              <div className="py-2 text-sm text-gray-600 dark:text-white/60">
                Update the existing layout with your changes, or save as a new
                layout.
              </div>
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">
                  {error}
                </p>
              )}
              <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button onClick={handleUpdate} className="w-full">
                  Update "{loadedLayout.title}"
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode('new')}
                  className="w-full"
                >
                  Save as New Layout
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full">
                    Cancel
                  </Button>
                </DialogClose>
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
                  className={
                    nameTaken ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }
                />
                {nameTaken && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    A layout with this name already exists
                  </p>
                )}
                {error && !nameTaken && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode('update')}>
                  Back
                </Button>
                <Button onClick={handleSave} disabled={!canSave}>
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
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1" title="Save layout">
          <Save className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <SuiteDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Layout</DialogTitle>
          <DialogDescription>
            Give this layout a name to save it for later.
          </DialogDescription>
        </DialogHeader>

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
            className={
              nameTaken ? 'border-red-500 focus-visible:ring-red-500' : ''
            }
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
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Layout
          </Button>
        </DialogFooter>
      </SuiteDialogContent>
    </Dialog>
  );
}
