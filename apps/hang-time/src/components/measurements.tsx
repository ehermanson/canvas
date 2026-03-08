import { Ruler } from 'lucide-react';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import {
  formatMeasurement,
  formatShort,
  toDisplayUnit,
} from '@/utils/calculations';

interface MeasurementsProps {
  calculator: UseCalculatorReturn;
}

export function Measurements({ calculator }: MeasurementsProps) {
  const { state, layoutPositions } = calculator;

  const fmt = (val: number) =>
    formatMeasurement(toDisplayUnit(val, state.unit), state.unit);
  const fmtShort = (val: number) =>
    formatShort(toDisplayUnit(val, state.unit), state.unit);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white/90 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          <Ruler className="h-3.5 w-3.5" />
        </span>
        Hook Placement
      </h3>
      <div className="space-y-2">
        {layoutPositions.map((frame) => (
          <div
            key={frame.id}
            className="p-3 rounded-lg border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"
          >
            <h4 className="text-xs font-medium text-gray-700 dark:text-white/80 mb-2">
              {frame.name}
              {frame.row !== undefined && ` (Row ${frame.row + 1})`}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-white dark:bg-white/5 rounded-md">
                <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {fmt(frame.fromLeft)}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-white/50">
                  {frame.hookGap ? 'Left hook from edge' : 'From left edge'}
                </div>
              </div>
              {frame.hookGap ? (
                <div className="text-center p-2 bg-white dark:bg-white/5 rounded-md">
                  <div className="text-base font-bold text-orange-500 dark:text-orange-400">
                    {fmt(frame.hookGap)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-white/50">
                    Hook gap
                  </div>
                </div>
              ) : (
                <div className="text-center p-2 bg-white dark:bg-white/5 rounded-md">
                  <div className="text-base font-bold text-amber-500 dark:text-amber-400">
                    {fmt(frame.fromCeiling)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-white/50">
                    From ceiling
                  </div>
                </div>
              )}
              <div className="text-center p-2 bg-white dark:bg-white/5 rounded-md">
                <div className="text-base font-bold text-emerald-500 dark:text-emerald-400">
                  {fmt(frame.fromFloor)}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-white/50">
                  From floor
                </div>
              </div>
              <div className="text-center p-2 bg-white dark:bg-white/5 rounded-md">
                <div className="text-base font-bold text-gray-500 dark:text-white/60">
                  {fmtShort(frame.width)} × {fmtShort(frame.height)}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-white/50">
                  Frame size
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
