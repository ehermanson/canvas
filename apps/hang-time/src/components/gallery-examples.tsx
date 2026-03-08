import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GALLERY_PRESETS, type GalleryPreset } from "@/data/gallery-presets";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { createId } from "@/lib/id";
import { cn } from "@/lib/utils";
import type { GalleryFrame } from "@/types";

interface GalleryExamplesProps {
  calculator: UseCalculatorReturn;
  buttonClassName?: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  tooltipLabel?: string;
}

export function GalleryExamples({
  buttonClassName,
  buttonLabel,
  calculator,
  iconOnly = false,
  tooltipLabel,
}: GalleryExamplesProps) {
  const {
    setFrames,
    setUniformSize,
    setFrameWidth,
    setFrameHeight,
    setHSpacing,
    setHDistribution,
    setVAlign,
    setRowSpacing,
    setRowConfigs,
    setAnchorType,
    setAnchorValue,
    setHAnchorType,
    setFurnitureWidth,
    setFurnitureHeight,
    setFurnitureAnchor,
    setFurnitureOffset,
    setFrameFurnitureAlign,
    setFurnitureVAnchor,
  } = calculator;

  const applyPreset = (preset: GalleryPreset) => {
    // Create fresh frame IDs to avoid conflicts
    const framesWithFreshIds: GalleryFrame[] = preset.frames.map((f) => ({
      ...f,
      id: createId(),
    }));

    // Apply all settings
    setFrames(framesWithFreshIds);
    setUniformSize(preset.settings.uniformSize);
    if (preset.settings.frameWidth) setFrameWidth(preset.settings.frameWidth);
    if (preset.settings.frameHeight)
      setFrameHeight(preset.settings.frameHeight);
    setHSpacing(preset.settings.hSpacing);
    setHDistribution(preset.settings.hDistribution);
    setVAlign(preset.settings.vAlign);
    setRowSpacing(preset.settings.rowSpacing);
    setRowConfigs(preset.settings.rowConfigs);
    setAnchorType(preset.settings.anchorType);
    setAnchorValue(preset.settings.anchorValue);
    setHAnchorType(preset.settings.hAnchorType);

    // Apply furniture settings if present
    if (preset.settings.furnitureWidth !== undefined)
      setFurnitureWidth(preset.settings.furnitureWidth);
    if (preset.settings.furnitureHeight !== undefined)
      setFurnitureHeight(preset.settings.furnitureHeight);
    if (preset.settings.furnitureAnchor)
      setFurnitureAnchor(preset.settings.furnitureAnchor);
    if (preset.settings.furnitureOffset !== undefined)
      setFurnitureOffset(preset.settings.furnitureOffset);
    if (preset.settings.frameFurnitureAlign)
      setFrameFurnitureAlign(preset.settings.frameFurnitureAlign);
    if (preset.settings.furnitureVAnchor)
      setFurnitureVAnchor(preset.settings.furnitureVAnchor);
  };

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        iconOnly
          ? "h-9 w-9 rounded-xl p-0"
          : buttonLabel
            ? "justify-start"
            : "flex-1",
        "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
        buttonClassName,
      )}
      aria-label={tooltipLabel ?? buttonLabel ?? "Try examples"}
    >
      <Sparkles
        className={
          iconOnly ? "h-4 w-4" : buttonLabel ? "mr-2 h-4 w-4" : "size-4"
        }
      />
      {!iconOnly && buttonLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  );

  return (
    <Popover>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {tooltipLabel ?? buttonLabel ?? "Try examples"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      )}
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 dark:text-white/50 px-2 py-1">
            Try an example layout
          </p>
          {GALLERY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors",
                "hover:bg-gray-100 dark:hover:bg-white/10",
              )}
            >
              <PresetThumbnail preset={preset} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {preset.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                  {preset.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Tiny visual preview of the preset layout
function PresetThumbnail({ preset }: { preset: GalleryPreset }) {
  const frames = preset.frames;
  const maxRow = Math.max(...frames.map((f) => f.row ?? 0));

  // Group by row
  const rows: GalleryFrame[][] = [];
  for (let i = 0; i <= maxRow; i++) {
    rows.push(frames.filter((f) => (f.row ?? 0) === i));
  }

  // Calculate scale to fit in thumbnail
  const totalWidth = Math.max(
    ...rows.map(
      (row) => row.reduce((sum, f) => sum + f.width, 0) + (row.length - 1) * 2,
    ),
  );
  const totalHeight =
    rows.reduce((sum, row) => sum + Math.max(...row.map((f) => f.height)), 0) +
    (rows.length - 1) * 2;

  const scale = Math.min(28 / totalWidth, 28 / totalHeight);

  return (
    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-white/10 rounded">
      <svg
        width={totalWidth * scale}
        height={totalHeight * scale}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        {rows.map((row, rowIndex) => {
          const rowHeight = Math.max(...row.map((f) => f.height));
          const rowWidth =
            row.reduce((sum, f) => sum + f.width, 0) + (row.length - 1) * 2;
          const rowY = rows
            .slice(0, rowIndex)
            .reduce(
              (sum, r) => sum + Math.max(...r.map((f) => f.height)) + 2,
              0,
            );
          const rowX = (totalWidth - rowWidth) / 2;

          // Check for row-specific vAlign from rowConfigs
          const rowConfig = preset.settings.rowConfigs.find(
            (c) => c.id === `row-${rowIndex}`,
          );
          const vAlign = rowConfig?.vAlign ?? preset.settings.vAlign;

          let x = rowX;
          return row.map((frame, frameIndex) => {
            let y: number;
            if (vAlign === "top") {
              y = rowY;
            } else if (vAlign === "bottom") {
              y = rowY + (rowHeight - frame.height);
            } else {
              y = rowY + (rowHeight - frame.height) / 2;
            }
            const rect = (
              <rect
                key={`${rowIndex}-${frameIndex}`}
                x={x}
                y={y}
                width={frame.width}
                height={frame.height}
                rx={0.5}
                className="fill-pink-500 dark:fill-pink-400"
              />
            );
            x += frame.width + 2;
            return rect;
          });
        })}
      </svg>
    </div>
  );
}
