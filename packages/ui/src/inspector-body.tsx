import * as React from "react";
import { cn } from "./lib/utils";
import { Slot } from "./components/ui/slot";

type InspectorTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "indigo"
  | "neutral"
  | "pink"
  | "violet";

const insetToneClassNames: Record<InspectorTone, string> = {
  amber: "border-amber-400/30 bg-amber-500/[0.08] dark:border-amber-400/20 dark:bg-amber-500/[0.1]",
  blue: "border-blue-400/30 bg-blue-500/[0.08] dark:border-blue-400/20 dark:bg-blue-500/[0.1]",
  cyan: "border-cyan-400/30 bg-cyan-500/[0.08] dark:border-cyan-400/20 dark:bg-cyan-500/[0.1]",
  emerald:
    "border-emerald-400/30 bg-emerald-500/[0.08] dark:border-emerald-400/20 dark:bg-emerald-500/[0.1]",
  indigo:
    "border-indigo-400/30 bg-indigo-500/[0.08] dark:border-indigo-400/20 dark:bg-indigo-500/[0.1]",
  neutral: "border-gray-200/70 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.03]",
  pink: "border-pink-400/30 bg-pink-500/[0.08] dark:border-pink-400/20 dark:bg-pink-500/[0.1]",
  violet:
    "border-violet-400/30 bg-violet-500/[0.08] dark:border-violet-400/20 dark:bg-violet-500/[0.1]",
};

const optionToneClassNames: Record<InspectorTone, string> = {
  amber:
    "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400/70 dark:bg-amber-500/20 dark:text-amber-300",
  blue: "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/70 dark:bg-blue-500/20 dark:text-blue-300",
  cyan: "border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400/70 dark:bg-cyan-500/20 dark:text-cyan-300",
  emerald:
    "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/70 dark:bg-emerald-500/20 dark:text-emerald-300",
  indigo:
    "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/70 dark:bg-indigo-500/20 dark:text-indigo-300",
  neutral:
    "border-gray-300 bg-gray-100 text-gray-900 dark:border-white/20 dark:bg-white/10 dark:text-white",
  pink: "border-pink-500 bg-pink-50 text-pink-700 dark:border-pink-400/70 dark:bg-pink-500/20 dark:text-pink-300",
  violet:
    "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400/70 dark:bg-violet-500/20 dark:text-violet-300",
};

const segmentedToneClassNames: Record<InspectorTone, string> = {
  amber:
    "border-amber-400/40 bg-amber-500/[0.1] text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/[0.16] dark:text-amber-200",
  blue: "border-blue-400/40 bg-blue-500/[0.1] text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/[0.16] dark:text-blue-200",
  cyan: "border-cyan-400/40 bg-cyan-500/[0.1] text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/[0.16] dark:text-cyan-200",
  emerald:
    "border-emerald-400/40 bg-emerald-500/[0.1] text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/[0.16] dark:text-emerald-200",
  indigo:
    "border-indigo-400/40 bg-indigo-500/[0.1] text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/[0.16] dark:text-indigo-200",
  neutral: "border-transparent bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white",
  pink: "border-pink-400/40 bg-pink-500/[0.1] text-pink-700 dark:border-pink-400/40 dark:bg-pink-500/[0.16] dark:text-pink-200",
  violet:
    "border-violet-400/40 bg-violet-500/[0.1] text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/[0.16] dark:text-violet-200",
};

const listToneClassNames: Record<InspectorTone, string> = {
  amber:
    "border-amber-400/70 bg-amber-500/[0.08] shadow-[0_0_0_1px_rgba(245,158,11,0.14),0_10px_28px_-22px_rgba(245,158,11,0.7)]",
  blue: "border-blue-400/70 bg-blue-500/[0.08] shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_10px_28px_-22px_rgba(59,130,246,0.7)]",
  cyan: "border-cyan-400/70 bg-cyan-500/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_12px_30px_-22px_rgba(6,182,212,0.8)]",
  emerald:
    "border-emerald-400/70 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_10px_28px_-22px_rgba(16,185,129,0.7)]",
  indigo:
    "border-indigo-400/70 bg-indigo-500/[0.08] shadow-[0_0_0_1px_rgba(99,102,241,0.15),0_10px_28px_-22px_rgba(79,70,229,0.7)]",
  neutral:
    "border-gray-300 bg-gray-100 shadow-[0_0_0_1px_rgba(148,163,184,0.12)] dark:border-white/20 dark:bg-white/[0.08]",
  pink: "border-pink-400/70 bg-pink-500/[0.08] shadow-[0_0_0_1px_rgba(244,114,182,0.14),0_10px_28px_-22px_rgba(236,72,153,0.7)]",
  violet:
    "border-violet-400/70 bg-violet-500/[0.08] shadow-[0_0_0_1px_rgba(167,139,250,0.12),0_10px_28px_-22px_rgba(139,92,246,0.8)]",
};

interface InspectorInsetProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: InspectorTone;
}

const InspectorInset = React.forwardRef<HTMLDivElement, InspectorInsetProps>(
  function InspectorInset({ className, tone = "neutral", ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("rounded-xl border px-3 py-2.5", insetToneClassNames[tone], className)}
        {...props}
      />
    );
  },
);

interface InspectorOptionCardProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  layout?: "column" | "row";
  selected?: boolean;
  tone?: InspectorTone;
}

function InspectorOptionCard({
  asChild = false,
  className,
  layout = "row",
  selected = false,
  tone = "neutral",
  ...props
}: InspectorOptionCardProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "rounded-xl border text-left transition-colors",
        layout === "column" ? "flex flex-col items-center" : "flex items-start gap-2.5",
        selected
          ? optionToneClassNames[tone]
          : "border-gray-200/80 bg-white/75 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:border-white/20 dark:hover:bg-white/[0.08]",
        className,
      )}
      data-selected={selected ? "true" : "false"}
      {...props}
    />
  );
}

interface InspectorListRowProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  selected?: boolean;
  tone?: InspectorTone;
}

function InspectorListRow({
  asChild = false,
  className,
  selected = false,
  tone = "neutral",
  ...props
}: InspectorListRowProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "rounded-xl border px-2.5 py-2.5 transition-colors",
        selected
          ? listToneClassNames[tone]
          : "border-gray-200/70 bg-white/70 hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20",
        className,
      )}
      data-selected={selected ? "true" : "false"}
      {...props}
    />
  );
}

function InspectorSegmentedControl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-1 rounded-xl bg-gray-100/80 p-1 dark:bg-white/[0.04]", className)}
      {...props}
    />
  );
}

interface InspectorSegmentedControlItemProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  selected?: boolean;
  tone?: InspectorTone;
}

function InspectorSegmentedControlItem({
  asChild = false,
  className,
  selected = false,
  tone = "neutral",
  ...props
}: InspectorSegmentedControlItemProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "rounded-lg border px-2.5 py-2 text-[11px] font-medium leading-tight transition-colors",
        selected
          ? segmentedToneClassNames[tone]
          : "border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-800 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/80",
        className,
      )}
      data-selected={selected ? "true" : "false"}
      {...props}
    />
  );
}

export {
  InspectorInset,
  InspectorListRow,
  InspectorOptionCard,
  InspectorSegmentedControl,
  InspectorSegmentedControlItem,
};
