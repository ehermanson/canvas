import { Sofa } from "lucide-react";
import {
  InspectorListRow,
  InspectorOptionCard,
  InspectorSectionHeader,
  InspectorSegmentedControl,
  InspectorSegmentedControlItem,
} from "@canvas-tools/ui";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { cn } from "@/lib/utils";
import type {
  Distribution,
  FrameFurnitureAlignment,
  FurnitureAnchor,
  FurnitureVerticalAnchor,
} from "@/types";

// Visual preview of frame alignment relative to furniture
function AlignmentPreview({
  mode,
  isSelected,
}: {
  mode: FrameFurnitureAlignment;
  isSelected: boolean;
}) {
  const frameColor = isSelected
    ? "fill-violet-500 dark:fill-violet-400"
    : "fill-gray-400 dark:fill-white/40";
  const furnitureColor = isSelected
    ? "fill-violet-200 dark:fill-violet-500/30"
    : "fill-gray-200 dark:fill-white/20";
  const wallColor = isSelected
    ? "stroke-violet-300 dark:stroke-violet-400"
    : "stroke-gray-300 dark:stroke-white/30";

  const w = 36;
  const h = 32;
  const furnitureWidth = 24;
  const furnitureHeight = 8;
  const furnitureX = (w - furnitureWidth) / 2;
  const furnitureY = h - furnitureHeight - 2;

  // Frame dimensions
  const fw = 6;
  const fh = 10;
  const frameY = furnitureY - fh - 4;

  const getFramePositions = (): number[] => {
    const numFrames = 3;
    const totalFrameWidth = numFrames * fw;

    switch (mode) {
      case "left":
        return [furnitureX, furnitureX + fw + 1, furnitureX + 2 * (fw + 1)];
      case "center": {
        const centerStart =
          furnitureX + (furnitureWidth - totalFrameWidth - 2) / 2;
        return [centerStart, centerStart + fw + 1, centerStart + 2 * (fw + 1)];
      }
      case "right": {
        const rightStart = furnitureX + furnitureWidth - totalFrameWidth - 2;
        return [rightStart, rightStart + fw + 1, rightStart + 2 * (fw + 1)];
      }
      case "span": {
        const gap = (furnitureWidth - totalFrameWidth) / 4;
        return [
          furnitureX + gap,
          furnitureX + gap + fw + gap,
          furnitureX + 2 * (gap + fw) + gap,
        ];
      }
    }
  };

  const positions = getFramePositions();

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        fill="none"
        className={wallColor}
        strokeWidth={1}
        rx={2}
      />
      {/* Furniture */}
      <rect
        x={furnitureX}
        y={furnitureY}
        width={furnitureWidth}
        height={furnitureHeight}
        className={furnitureColor}
        rx={1}
      />
      {/* Frames */}
      {positions.map((pos, i) => (
        <rect
          key={i}
          x={pos}
          y={frameY}
          width={fw}
          height={fh}
          className={frameColor}
          rx={1}
        />
      ))}
    </svg>
  );
}

// Horizontal distribution preview (reused from horizontal-position)
function DistributionPreview({
  mode,
  isSelected,
}: {
  mode: Distribution;
  isSelected: boolean;
}) {
  const frameColor = isSelected
    ? "fill-violet-500 dark:fill-violet-400"
    : "fill-gray-400 dark:fill-white/40";
  const wallColor = isSelected
    ? "stroke-violet-300 dark:stroke-violet-400"
    : "stroke-gray-300 dark:stroke-white/30";

  const w = 48;
  const h = 24;
  const fw = 10;
  const fh = 14;

  const getPositions = (): number[] => {
    const totalFrames = 3 * fw;
    const available = w - totalFrames;

    switch (mode) {
      case "fixed": {
        const gap = 3;
        const totalWidth = 3 * fw + 2 * gap;
        const start = (w - totalWidth) / 2;
        return [start, start + fw + gap, start + 2 * (fw + gap)];
      }
      case "space-between": {
        const gap = available / 2;
        return [0, fw + gap, 2 * (fw + gap)];
      }
      case "space-evenly": {
        const gap = available / 4;
        return [gap, gap + fw + gap, gap + 2 * (fw + gap)];
      }
      case "space-around": {
        const gap = available / 3;
        return [gap / 2, gap / 2 + fw + gap, gap / 2 + 2 * (fw + gap)];
      }
    }
  };

  const positions = getPositions();

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        fill="none"
        className={wallColor}
        strokeWidth={1}
        rx={2}
      />
      {positions.map((pos, i) => (
        <rect
          key={i}
          x={pos}
          y={(h - fh) / 2}
          width={fw}
          height={fh}
          className={frameColor}
          rx={1}
        />
      ))}
    </svg>
  );
}

const FURNITURE_ANCHOR_OPTIONS: { value: FurnitureAnchor; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const FRAME_ALIGNMENT_OPTIONS: {
  value: FrameFurnitureAlignment;
  label: string;
}[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "span", label: "Span" },
];

// Only dynamic distributions for span mode (fixed is redundant with center alignment)
const SPAN_DISTRIBUTION_OPTIONS: { value: Distribution; label: string }[] = [
  { value: "space-between", label: "Edge" },
  { value: "space-evenly", label: "Even" },
  { value: "space-around", label: "Balanced" },
];

const VERTICAL_ANCHOR_OPTIONS: {
  value: FurnitureVerticalAnchor;
  label: string;
  desc: string;
}[] = [
  {
    value: "above-furniture",
    label: "Above Furniture",
    desc: "Offset from furniture top",
  },
  { value: "ceiling", label: "From Ceiling", desc: "Offset from ceiling" },
  { value: "center", label: "Centered", desc: "Between ceiling and furniture" },
];

interface Props {
  calculator: UseCalculatorReturn;
}

export function Furniture({ calculator }: Props) {
  const {
    state,
    u,
    fromU,
    setFurnitureWidth,
    setFurnitureHeight,
    setFurnitureAnchor,
    setFurnitureOffset,
    setFrameFurnitureAlign,
    setFurnitureVAnchor,
    setAnchorValue,
    setHDistribution,
    setHSpacing,
  } = calculator;

  return (
    <Collapsible
      defaultOpen
      className="pb-4 border-b border-gray-200 dark:border-white/10"
    >
      <InspectorSectionHeader
        icon={Sofa}
        label="Furniture"
        iconBadgeClassName="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400"
      />
      <CollapsibleContent>
        <div className="space-y-4 pt-3">
          {/* Furniture Dimensions */}
          <FieldSet>
            <FieldLegend variant="label">Dimensions</FieldLegend>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="furnitureWidth">
                    Width ({state.unit})
                  </FieldLabel>
                  <Input
                    id="furnitureWidth"
                    type="number"
                    step="0.125"
                    value={parseFloat(u(state.furnitureWidth).toFixed(3))}
                    onChange={(e) =>
                      setFurnitureWidth(fromU(parseFloat(e.target.value) || 0))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="furnitureHeight">
                    Height ({state.unit})
                  </FieldLabel>
                  <Input
                    id="furnitureHeight"
                    type="number"
                    step="0.125"
                    value={parseFloat(u(state.furnitureHeight).toFixed(3))}
                    onChange={(e) =>
                      setFurnitureHeight(fromU(parseFloat(e.target.value) || 0))
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          {/* Furniture Position */}
          <Field>
            <FieldLabel>Furniture Position on Wall</FieldLabel>
            <InspectorSegmentedControl className="grid-cols-3">
              {FURNITURE_ANCHOR_OPTIONS.map((option) => (
                <InspectorSegmentedControlItem
                  key={option.value}
                  asChild
                  selected={state.furnitureAnchor === option.value}
                  tone="violet"
                  className="text-sm"
                >
                  <button
                    type="button"
                    onClick={() => setFurnitureAnchor(option.value)}
                  >
                    {option.label}
                  </button>
                </InspectorSegmentedControlItem>
              ))}
            </InspectorSegmentedControl>
          </Field>

          {/* Offset from edge - hidden when centered */}
          {state.furnitureAnchor !== "center" && (
            <Field>
              <FieldLabel htmlFor="furnitureOffset">
                Offset from {state.furnitureAnchor} edge ({state.unit})
              </FieldLabel>
              <Input
                id="furnitureOffset"
                type="number"
                step="0.125"
                min={0}
                value={parseFloat(u(state.furnitureOffset).toFixed(3))}
                onChange={(e) =>
                  setFurnitureOffset(fromU(parseFloat(e.target.value) || 0))
                }
              />
            </Field>
          )}

          {/* Vertical Position */}
          <Field>
            <FieldLabel>Vertical Frame Position</FieldLabel>
            <div className="flex flex-col gap-2">
              {VERTICAL_ANCHOR_OPTIONS.map((opt) => (
                <InspectorListRow
                  key={opt.value}
                  asChild
                  selected={state.furnitureVAnchor === opt.value}
                  tone="violet"
                  className="flex cursor-pointer items-start gap-3 px-3 py-3"
                >
                  <label onClick={() => setFurnitureVAnchor(opt.value)}>
                    <input
                      type="radio"
                      checked={state.furnitureVAnchor === opt.value}
                      onChange={() => {}}
                      className="mt-1 accent-violet-600 dark:accent-violet-500"
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
                </InspectorListRow>
              ))}
            </div>
          </Field>

          {/* Offset input - shown for non-center vertical anchors */}
          {state.furnitureVAnchor !== "center" && (
            <Field>
              <FieldLabel htmlFor="furnitureGap">
                {state.furnitureVAnchor === "above-furniture"
                  ? `Gap above furniture (${state.unit})`
                  : `Distance from ceiling (${state.unit})`}
              </FieldLabel>
              <Input
                id="furnitureGap"
                type="number"
                step="0.125"
                value={parseFloat(u(state.anchorValue).toFixed(3))}
                onChange={(e) =>
                  setAnchorValue(fromU(parseFloat(e.target.value) || 0))
                }
              />
            </Field>
          )}

          {/* Frame Alignment */}
          <Field>
            <FieldLabel>Horizontal Frame Alignment</FieldLabel>
            <div className="grid grid-cols-4 gap-1.5">
              {FRAME_ALIGNMENT_OPTIONS.map((option) => (
                <InspectorOptionCard
                  key={option.value}
                  asChild
                  layout="column"
                  selected={state.frameFurnitureAlign === option.value}
                  tone="violet"
                  className="p-1.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFrameFurnitureAlign(option.value);
                      if (
                        option.value === "span" &&
                        state.hDistribution === "fixed"
                      ) {
                        setHDistribution("space-evenly");
                      }
                    }}
                  >
                    <AlignmentPreview
                      mode={option.value}
                      isSelected={state.frameFurnitureAlign === option.value}
                    />
                    <span
                      className={cn(
                        "mt-1 text-[10px] font-medium",
                        state.frameFurnitureAlign === option.value
                          ? "text-violet-600 dark:text-violet-300"
                          : "text-gray-600 dark:text-white/60",
                      )}
                    >
                      {option.label}
                    </span>
                  </button>
                </InspectorOptionCard>
              ))}
            </div>
          </Field>

          {/* Gap between frames - shown for left/center/right alignment */}
          {state.frameFurnitureAlign !== "span" && (
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
          )}

          {/* Span mode: show horizontal distribution options */}
          {state.frameFurnitureAlign === "span" && (
            <Field>
              <FieldLabel>Distribution</FieldLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {SPAN_DISTRIBUTION_OPTIONS.map((option) => (
                  <InspectorOptionCard
                    key={option.value}
                    asChild
                    layout="column"
                    selected={state.hDistribution === option.value}
                    tone="violet"
                    className="p-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => setHDistribution(option.value)}
                    >
                      <DistributionPreview
                        mode={option.value}
                        isSelected={state.hDistribution === option.value}
                      />
                      <span
                        className={cn(
                          "mt-1 text-[10px] font-medium",
                          state.hDistribution === option.value
                            ? "text-violet-600 dark:text-violet-300"
                            : "text-gray-600 dark:text-white/60",
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  </InspectorOptionCard>
                ))}
              </div>
            </Field>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
