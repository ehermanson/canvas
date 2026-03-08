import * as React from 'react';
import { DialogContent } from './components/ui/dialog';
import { cn } from './lib/utils';

function SuiteDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        'border-gray-200/70 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92',
        className,
      )}
      {...props}
    />
  );
}

export { SuiteDialogContent };
