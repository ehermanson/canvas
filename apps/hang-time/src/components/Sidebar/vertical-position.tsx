import { InspectorOptionCard, InspectorSectionHeader } from "@canvas-tools/ui";
import { MoveVertical } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import type { AnchorType } from "@/types";

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
    value: "floor",
    label: "From Floor",
    desc: 'Eye-level standard: 57"',
    defaultValue: 57,
  },
  {
    value: "ceiling",
    label: "From Ceiling",
    desc: 'Gap from ceiling (e.g., 6")',
    defaultValue: 6,
  },
  {
    value: "center",
    label: "Center on Wall",
    desc: "Vertically centered",
    defaultValue: 0,
  },
  {
    value: "furniture",
    label: "Above Furniture",
    desc: "Position above a piece of furniture",
    defaultValue: 8,
  },
];

export function VerticalPosition({ calculator }: Props) {
  const { state, u, fromU, setAnchorType, setAnchorValue } = calculator;

  return (
    <Collapsible defaultOpen className="border-b border-gray-200 dark:border-white/10">
      <InspectorSectionHeader
        icon={MoveVertical}
        iconClassName="text-emerald-500"
        label="Vertical Position"
        variant="inline"
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-2.5 pb-3">
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <InspectorOptionCard
                key={opt.value}
                asChild
                selected={state.anchorType === opt.value}
                tone="emerald"
                className="cursor-pointer p-3"
                onClick={() => {
                  setAnchorType(opt.value);
                  if (opt.value !== "center") setAnchorValue(opt.defaultValue);
                }}
              >
                <label>
                  <input
                    type="radio"
                    checked={state.anchorType === opt.value}
                    onChange={() => {}}
                    className="mt-1 accent-emerald-600 dark:accent-emerald-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/50">{opt.desc}</div>
                  </div>
                </label>
              </InspectorOptionCard>
            ))}
          </div>

          {state.anchorType !== "center" && state.anchorType !== "furniture" && (
            <Field className="mt-3">
              <FieldLabel htmlFor="anchorValue">
                {state.anchorType === "floor" ? "Distance from floor" : "Distance from ceiling"} (
                {state.unit})
              </FieldLabel>
              <Input
                id="anchorValue"
                type="number"
                step="0.125"
                value={parseFloat(u(state.anchorValue).toFixed(3))}
                onChange={(e) => setAnchorValue(fromU(parseFloat(e.target.value) || 0))}
              />
            </Field>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
