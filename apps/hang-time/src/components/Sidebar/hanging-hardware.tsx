import { InspectorOptionCard, InspectorSectionHeader } from "@canvas-tools/ui";
import { CircleDot } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { cn } from "@/lib/utils";
import type { HangingType } from "@/types";

// Custom icons for hook types
function SingleHookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className}>
      {/* Frame outline */}
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
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
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Left hook */}
      <circle cx="7" cy="7" r="2" fill="currentColor" />
      <line x1="7" y1="4" x2="7" y2="5" stroke="currentColor" strokeWidth="1.5" />
      {/* Right hook */}
      <circle cx="17" cy="7" r="2" fill="currentColor" />
      <line x1="17" y1="4" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const HANGING_TYPE_OPTIONS: {
  value: HangingType;
  label: string;
  icon: typeof SingleHookIcon;
}[] = [
  { value: "center", label: "Single", icon: SingleHookIcon },
  { value: "dual", label: "Dual", icon: DualHookIcon },
];

interface Props {
  calculator: UseCalculatorReturn;
}

export function HangingHardware({ calculator }: Props) {
  const { state, layoutResult, u, fromU, setHangingOffset, setHangingType, setHookInset } =
    calculator;
  const offsetError = layoutResult.issues.find((issue) => issue.field === "hangingOffset");
  const insetError = layoutResult.issues.find((issue) => issue.field === "hookInset");

  return (
    <Collapsible defaultOpen className="border-b border-gray-200 dark:border-white/10">
      <InspectorSectionHeader
        icon={CircleDot}
        iconClassName="text-cyan-500"
        label="Hanging Hardware"
        variant="inline"
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-2.5 pb-3">
          {/* Hook Type */}
          <Field>
            <FieldLabel>Hook Type</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {HANGING_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = state.hangingType === option.value;
                return (
                  <InspectorOptionCard
                    key={option.value}
                    asChild
                    layout="column"
                    selected={isSelected}
                    tone="cyan"
                    className="p-2"
                  >
                    <button onClick={() => setHangingType(option.value)} type="button">
                      <Icon
                        className={cn(
                          "h-6 w-8",
                          isSelected
                            ? "text-cyan-600 dark:text-cyan-400"
                            : "text-gray-400 dark:text-white/40",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium mt-1",
                          isSelected
                            ? "text-cyan-600 dark:text-cyan-300"
                            : "text-gray-600 dark:text-white/60",
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  </InspectorOptionCard>
                );
              })}
            </div>
          </Field>

          {/* Hook Offset from Top */}
          <Field>
            <FieldLabel htmlFor="hanging-offset">Hook Offset from Top ({state.unit})</FieldLabel>
            <Input
              id="hanging-offset"
              type="number"
              step="0.125"
              min={0}
              aria-invalid={Boolean(offsetError)}
              aria-describedby={offsetError ? "hanging-offset-error" : undefined}
              value={parseFloat(u(state.hangingOffset).toFixed(3))}
              onChange={(e) => setHangingOffset(fromU(parseFloat(e.target.value) || 0))}
              className="h-8 text-sm"
            />
            {offsetError ? (
              <p id="hanging-offset-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {offsetError.message}
              </p>
            ) : null}
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-1">
              Distance from frame top to hanging point
            </p>
          </Field>

          {/* Hook Inset (only for dual) */}
          {state.hangingType === "dual" && (
            <Field>
              <FieldLabel htmlFor="hook-inset">Hook Inset ({state.unit})</FieldLabel>
              <Input
                id="hook-inset"
                type="number"
                step="0.125"
                min={0}
                aria-invalid={Boolean(insetError)}
                aria-describedby={insetError ? "hook-inset-error" : undefined}
                value={parseFloat(u(state.hookInset).toFixed(3))}
                onChange={(e) => setHookInset(fromU(parseFloat(e.target.value) || 0))}
                className="h-8 text-sm"
              />
              {insetError ? (
                <p id="hook-inset-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {insetError.message}
                </p>
              ) : null}
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
