import { MoveVertical } from 'lucide-react';
import { InspectorSectionHeader } from '@canvas-tools/ui';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { cn } from '@/lib/utils';
import type { AnchorType } from '@/types';

interface Props {
  calculator: UseCalculatorReturn;
}

const options: {
  value: AnchorType;
  label: string;
  desc: string;
  defaultValue: number;
}[] = [
    {
      value: 'floor',
      label: 'From Floor',
      desc: 'Eye-level standard: 57"',
      defaultValue: 57,
    },
    {
      value: 'ceiling',
      label: 'From Ceiling',
      desc: 'Gap from ceiling (e.g., 6")',
      defaultValue: 6,
    },
    {
      value: 'center',
      label: 'Center on Wall',
      desc: 'Vertically centered',
      defaultValue: 0,
    },
    {
      value: 'furniture',
      label: 'Above Furniture',
      desc: 'Position above a piece of furniture',
      defaultValue: 8,
    },
  ];

export function VerticalPosition({ calculator }: Props) {
  const {
    state,
    u,
    fromU,
    setAnchorType,
    setAnchorValue,
  } = calculator;

  return (
    <Collapsible
      defaultOpen
      className="pb-4 border-b border-gray-200 dark:border-white/10"
    >
      <InspectorSectionHeader
        icon={MoveVertical}
        label="Vertical Position"
        iconBadgeClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-3">
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  state.anchorType === opt.value
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10',
                )}
                onClick={() => {
                  setAnchorType(opt.value);
                  if (opt.value !== 'center')
                    setAnchorValue(opt.defaultValue);
                }}
              >
                <input
                  type="radio"
                  checked={state.anchorType === opt.value}
                  onChange={() => { }}
                  className="mt-1 accent-emerald-600 dark:accent-emerald-500"
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

          {state.anchorType !== 'center' &&
            state.anchorType !== 'furniture' && (
              <Field className="mt-3">
                <FieldLabel htmlFor="anchorValue">
                  {state.anchorType === 'floor'
                    ? 'Distance from floor'
                    : 'Distance from ceiling'}{' '}
                  ({state.unit})
                </FieldLabel>
                <Input
                  id="anchorValue"
                  type="number"
                  step="0.125"
                  value={parseFloat(u(state.anchorValue).toFixed(3))}
                  onChange={(e) =>
                    setAnchorValue(fromU(parseFloat(e.target.value) || 0))
                  }
                />
              </Field>
            )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
