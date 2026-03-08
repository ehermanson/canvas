import { Ruler } from 'lucide-react';
import { InspectorSectionHeader } from '@canvas-tools/ui';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';

interface Props {
  calculator: UseCalculatorReturn;
}

export function WallDimensions({ calculator }: Props) {
  const { state, u, fromU, setWallWidth, setWallHeight } = calculator;

  return (
    <Collapsible
      defaultOpen={false}
      className="pb-4 border-b border-gray-200 dark:border-white/10"
    >
      <InspectorSectionHeader
        icon={Ruler}
        label="Wall Dimensions"
        iconBadgeClassName="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
      />
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-3 pt-3">
          <Field>
            <FieldLabel htmlFor="wallWidth">Width ({state.unit})</FieldLabel>
            <Input
              id="wallWidth"
              type="number"
              step="0.125"
              value={parseFloat(u(state.wallWidth).toFixed(3))}
              onChange={(e) =>
                setWallWidth(fromU(parseFloat(e.target.value) || 0))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="wallHeight">Height ({state.unit})</FieldLabel>
            <Input
              id="wallHeight"
              type="number"
              step="0.125"
              value={parseFloat(u(state.wallHeight).toFixed(3))}
              onChange={(e) =>
                setWallHeight(fromU(parseFloat(e.target.value) || 0))
              }
            />
          </Field>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
