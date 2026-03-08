import { ListChecks } from 'lucide-react';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { formatMeasurement, toDisplayUnit } from '@/utils/calculations';

interface HowToHangProps {
  calculator: UseCalculatorReturn;
}

export function HowToHang({ calculator }: HowToHangProps) {
  const { state, layoutPositions } = calculator;

  const fmt = (val: number) =>
    formatMeasurement(toDisplayUnit(val, state.unit), state.unit);

  if (layoutPositions.length === 0) return null;

  const firstFrame = layoutPositions[0];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white/90 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        How to Hang
      </h3>
      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs">
            1
          </span>
          <span className="text-gray-700 dark:text-white/80">
            <strong className="text-gray-900 dark:text-white">
              Measure from the left edge
            </strong>{' '}
            of your wall{' '}
            <strong className="text-indigo-600 dark:text-indigo-400">
              {fmt(firstFrame.fromLeft)}
            </strong>{' '}
            and make a small mark.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs">
            2
          </span>
          <span className="text-gray-700 dark:text-white/80">
            <strong className="text-gray-900 dark:text-white">
              Measure up from the floor
            </strong>{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {fmt(firstFrame.fromFloor)}
            </strong>{' '}
            at that mark.
            {state.anchorType === 'ceiling' && (
              <>
                {' '}
                Or measure down from the ceiling{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {fmt(firstFrame.fromCeiling)}
                </strong>
                .
              </>
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs">
            3
          </span>
          <span className="text-gray-700 dark:text-white/80">
            <strong className="text-gray-900 dark:text-white">
              Install your hook or nail
            </strong>{' '}
            at this intersection point.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs">
            4
          </span>
          <span className="text-gray-700 dark:text-white/80">
            <strong className="text-gray-900 dark:text-white">
              Hang your frame
            </strong>{' '}
            by the wire/bracket and adjust until level.
          </span>
        </li>
        {layoutPositions.length > 1 && (
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-semibold text-xs">
              5
            </span>
            <span className="text-gray-700 dark:text-white/80">
              <strong className="text-gray-900 dark:text-white">Repeat</strong>{' '}
              for the remaining {layoutPositions.length - 1} frame
              {layoutPositions.length > 2 ? 's' : ''} using the measurements
              above.
            </span>
          </li>
        )}
      </ol>
      <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300">
        <strong>Tip:</strong> Use a level to ensure your marks are straight. For
        multiple frames, a laser level can help maintain alignment across the
        wall.
      </div>
    </div>
  );
}
