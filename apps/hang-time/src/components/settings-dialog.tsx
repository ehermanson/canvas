import { Moon, Ruler, Settings, Sun } from 'lucide-react';
import { SuiteDialogContent } from '@canvas-tools/ui';
import { useEffect } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import type { Theme, Unit } from '@/types';
import { Button } from './ui/button';

const UNIT_STORAGE_KEY = 'picture-hanging-unit';

interface SettingsDialogProps {
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
}

const unitOptions: { value: Unit; label: string; desc: string }[] = [
  { value: 'in', label: 'Inches', desc: 'Imperial measurements (e.g., 57")' },
  {
    value: 'cm',
    label: 'Centimeters',
    desc: 'Metric measurements (e.g., 145 cm)',
  },
];

const themeOptions: {
  value: Theme;
  label: string;
  desc: string;
  icon: typeof Sun;
}[] = [
  {
    value: 'light',
    label: 'Light',
    desc: 'Bright and clean interface',
    icon: Sun,
  },
  { value: 'dark', label: 'Dark', desc: 'Easy on the eyes', icon: Moon },
];

export function SettingsDialog({ unit, onUnitChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();

  // Save unit preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(UNIT_STORAGE_KEY, unit);
  }, [unit]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1" title="Settings">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <SuiteDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your preferences.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-gray-500 dark:text-white/50" />
              <Label className="text-sm font-medium dark:text-white/80">
                Appearance
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer transition-colors',
                      theme === opt.value
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/20'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10',
                    )}
                    onClick={() => setTheme(opt.value)}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-6',
                        theme === opt.value
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-400 dark:text-white/40',
                      )}
                    />
                    <div className="text-center">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          theme === opt.value
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-gray-900 dark:text-white',
                        )}
                      >
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-white/50">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Measurement Units */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-gray-500 dark:text-white/50" />
              <Label className="text-sm font-medium dark:text-white/80">
                Measurement Units
              </Label>
            </div>
            <div className="space-y-2">
              {unitOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    unit === opt.value
                      ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10',
                  )}
                  onClick={() => onUnitChange(opt.value)}
                >
                  <input
                    type="radio"
                    name="unit"
                    checked={unit === opt.value}
                    onChange={() => {}}
                    className="accent-indigo-600 dark:accent-indigo-500"
                  />
                  <div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        unit === opt.value
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-900 dark:text-white',
                      )}
                    >
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/50">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SuiteDialogContent>
    </Dialog>
  );
}

// Helper to load saved unit preference
export function loadSavedUnit(): Unit | null {
  const saved = localStorage.getItem(UNIT_STORAGE_KEY);
  if (saved === 'in' || saved === 'cm') {
    return saved;
  }
  return null;
}
