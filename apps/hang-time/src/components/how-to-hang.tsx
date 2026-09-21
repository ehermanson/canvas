import { ListChecks } from "lucide-react";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { formatMeasurement, toDisplayUnit } from "@/utils/calculations";

interface HowToHangProps {
  calculator: UseCalculatorReturn;
}

export function HowToHang({ calculator }: HowToHangProps) {
  const { state, layoutPositions, layoutResult } = calculator;
  const fmt = (value: number) => formatMeasurement(toDisplayUnit(value, state.unit), state.unit);
  if (layoutPositions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/90">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        How to Hang
      </h3>
      {!layoutResult.isValid ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <p className="font-semibold">Correct the layout before installing hardware.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {layoutResult.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-white/60">
            Measure each coordinate from the named wall edges. Mark the horizontal and vertical
            measurements at their intersection.
          </p>
          {layoutPositions.map((frame) => (
            <section
              key={frame.frameId}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5"
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {frame.name}
                {frame.row !== undefined ? ` · Row ${frame.row + 1}` : ""}
              </h4>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-700 dark:text-white/80">
                <li>
                  Mark the {state.hangingType === "dual" ? "left hook" : "hook"} at{" "}
                  {fmt(frame.fromLeft)} from the wall’s left edge and {fmt(frame.fromFloor)} up from
                  the floor.
                </li>
                {state.hangingType === "dual" && frame.hookX2 !== undefined ? (
                  <>
                    <li>
                      Mark the right hook at {fmt(frame.hookX2)} from the wall’s left edge and{" "}
                      {fmt(frame.fromFloor)} up from the floor. The marks must be{" "}
                      {fmt(frame.hookGap ?? 0)} apart.
                    </li>
                    <li>Use a level to confirm both marks are on the same horizontal line.</li>
                    <li>Install hardware at both marks, hang the frame, and check it is level.</li>
                  </>
                ) : (
                  <li>
                    Install the hook or nail at the mark, hang the frame, and check it is level.
                  </li>
                )}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
