import { MoveHorizontal } from 'lucide-react';
import { InspectorSectionHeader } from '@canvas-tools/ui';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { cn } from '@/lib/utils';
import type { HorizontalAnchorType } from '@/types';

interface Props {
  calculator: UseCalculatorReturn;
}

const options: {
  value: HorizontalAnchorType;
  label: string;
  desc: string;
  defaultValue: number;
}[] = [
  {
    value: 'center',
    label: 'Center on Wall',
    desc: 'Horizontally centered',
    defaultValue: 0,
  },
  {
    value: 'left',
    label: 'From Left Edge',
    desc: 'Distance from left wall',
    defaultValue: 12,
  },
  {
    value: 'right',
    label: 'From Right Edge',
    desc: 'Distance from right wall',
    defaultValue: 12,
  },
];

export function HorizontalPosition({ calculator }: Props) {
  const { state, u, fromU, setHAnchorType, setHAnchorValue, setHSpacing } =
    calculator;

  return (
    <Collapsible defaultOpen>
      <InspectorSectionHeader
        icon={MoveHorizontal}
        label="Horizontal Position"
        iconBadgeClassName="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-3">
          {state.hDistribution !== 'fixed' ? (
            <p className="text-xs text-gray-500 dark:text-white/50 italic">
              Position is automatic for {state.hDistribution.replace('space-', '')} distribution.
              Set distribution to "Fixed" to control position and spacing.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {options.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      state.hAnchorType === opt.value
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/20'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10',
                    )}
                    onClick={() => {
                      setHAnchorType(opt.value);
                      if (opt.value !== 'center')
                        setHAnchorValue(opt.defaultValue);
                    }}
                  >
                    <input
                      type="radio"
                      checked={state.hAnchorType === opt.value}
                      onChange={() => {}}
                      className="mt-1 accent-amber-600 dark:accent-amber-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-white/50">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {state.hAnchorType !== 'center' && (
                <Field>
                  <FieldLabel htmlFor="hAnchorValue">
                    Distance from {state.hAnchorType} edge ({state.unit})
                  </FieldLabel>
                  <Input
                    id="hAnchorValue"
                    type="number"
                    step="0.125"
                    value={parseFloat(u(state.hAnchorValue).toFixed(3))}
                    onChange={(e) =>
                      setHAnchorValue(fromU(parseFloat(e.target.value) || 0))
                    }
                  />
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="hSpacing">
                  Gap between frames ({state.unit})
                </FieldLabel>
                <Input
                  id="hSpacing"
                  type="number"
                  step="0.125"
                  min={0}
                  value={parseFloat(u(state.hSpacing).toFixed(3))}
                  onChange={(e) =>
                    setHSpacing(fromU(parseFloat(e.target.value) || 0))
                  }
                />
              </Field>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
