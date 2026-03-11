import { InspectorSectionHeader } from '@canvas-tools/ui';
import { Ruler } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
      className="border-b border-gray-200 dark:border-white/10"
    >
      <InspectorSectionHeader
        icon={Ruler}
        iconClassName="text-blue-500"
        label="Wall Dimensions"
        variant="inline"
      />
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-3 pt-2.5 pb-3">
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
