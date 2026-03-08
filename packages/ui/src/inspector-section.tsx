import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { CollapsibleTrigger } from './components/ui/collapsible';
import { cn } from './lib/utils';

type InspectorSectionHeaderVariant = 'badge' | 'inline';

interface InspectorSectionHeaderProps
  extends React.ComponentProps<typeof CollapsibleTrigger> {
  icon: React.ComponentType<{ className?: string }>;
  iconBadgeClassName?: string;
  iconClassName?: string;
  label: React.ReactNode;
  labelClassName?: string;
  labelTrailing?: React.ReactNode;
  variant?: InspectorSectionHeaderVariant;
}

function InspectorSectionHeader({
  className,
  icon: Icon,
  iconBadgeClassName,
  iconClassName,
  label,
  labelClassName,
  labelTrailing,
  variant = 'badge',
  ...props
}: InspectorSectionHeaderProps) {
  if (variant === 'inline') {
    return (
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center gap-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-white/80 dark:hover:text-white',
          className,
        )}
        {...props}
      >
        <Icon className={cn('h-4 w-4', iconClassName)} />
        <span className={cn('flex-1 text-left', labelClassName)}>{label}</span>
        {labelTrailing}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
    );
  }

  return (
    <CollapsibleTrigger
      className={cn('group w-full', className)}
      {...props}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/90">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-lg',
            iconBadgeClassName,
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', iconClassName)} />
        </span>
        <span className={labelClassName}>{label}</span>
        {labelTrailing}
        <ChevronDown className="ml-auto h-4 w-4 text-gray-400 transition-transform group-data-[state=closed]:-rotate-90" />
      </h3>
    </CollapsibleTrigger>
  );
}

export { InspectorSectionHeader };
