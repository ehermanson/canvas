import { CircleDot } from 'lucide-react';
import { InspectorSectionHeader } from '@canvas-tools/ui';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { cn } from '@/lib/utils';
import type { HangingType } from '@/types';

// Custom icons for hook types
function SingleHookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className}>
      {/* Frame outline */}
      <rect x="2" y="4" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Single hook at center */}
      <circle cx="12" cy="7" r="2" fill="currentColor" />
      {/* Hook line to top */}
      <line x1="12" y1="4" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DualHookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className}>
      {/* Frame outline */}
      <rect x="2" y="4" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Left hook */}
      <circle cx="7" cy="7" r="2" fill="currentColor" />
      <line x1="7" y1="4" x2="7" y2="5" stroke="currentColor" strokeWidth="1.5" />
      {/* Right hook */}
      <circle cx="17" cy="7" r="2" fill="currentColor" />
      <line x1="17" y1="4" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const HANGING_TYPE_OPTIONS: { value: HangingType; label: string; icon: typeof SingleHookIcon }[] = [
  { value: 'center', label: 'Single', icon: SingleHookIcon },
  { value: 'dual', label: 'Dual', icon: DualHookIcon },
];

interface Props {
  calculator: UseCalculatorReturn;
}

export function HangingHardware({ calculator }: Props) {
  const {
    state,
    u,
    fromU,
    setHangingOffset,
    setHangingType,
    setHookInset,
  } = calculator;

  return (
    <Collapsible
      defaultOpen
      className="pb-4 border-b border-gray-200 dark:border-white/10"
    >
      <InspectorSectionHeader
        icon={CircleDot}
        label="Hanging Hardware"
        iconBadgeClassName="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400"
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-3">
          {/* Hook Type */}
          <Field>
            <FieldLabel>Hook Type</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {HANGING_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = state.hangingType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setHangingType(option.value)}
                    className={cn(
                      'flex flex-col items-center p-2 rounded-lg border transition-all',
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-8',
                        isSelected
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-gray-400 dark:text-white/40',
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-medium mt-1',
                        isSelected
                          ? 'text-cyan-600 dark:text-cyan-300'
                          : 'text-gray-600 dark:text-white/60',
                      )}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Hook Offset from Top */}
          <Field>
            <FieldLabel htmlFor="hanging-offset">
              Hook Offset from Top ({state.unit})
            </FieldLabel>
            <Input
              id="hanging-offset"
              type="number"
              step="0.125"
              min={0}
              value={parseFloat(u(state.hangingOffset).toFixed(3))}
              onChange={(e) =>
                setHangingOffset(fromU(parseFloat(e.target.value) || 0))
              }
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1">
              Distance from frame top to hanging point
            </p>
          </Field>

          {/* Hook Inset (only for dual) */}
          {state.hangingType === 'dual' && (
            <Field>
              <FieldLabel htmlFor="hook-inset">
                Hook Inset ({state.unit})
              </FieldLabel>
              <Input
                id="hook-inset"
                type="number"
                step="0.125"
                min={0}
                value={parseFloat(u(state.hookInset).toFixed(3))}
                onChange={(e) =>
                  setHookInset(fromU(parseFloat(e.target.value) || 0))
                }
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1">
                Distance from frame edge to each hook
              </p>
            </Field>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
