import { ArrowUpRight } from 'lucide-react';
import * as React from 'react';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';

interface ToolLinkButtonProps
  extends Omit<React.ComponentProps<'a'>, 'children' | 'href'> {
  href: string;
  label: string;
  compact?: boolean;
}

export function ToolLinkButton({
  className,
  compact = false,
  href,
  label,
  ...props
}: ToolLinkButtonProps) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        'justify-start bg-white/80 dark:bg-slate-900/60',
        compact && 'h-8 px-2.5 text-[11px]',
        className,
      )}
    >
      <a href={href} {...props}>
        <ArrowUpRight className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}
