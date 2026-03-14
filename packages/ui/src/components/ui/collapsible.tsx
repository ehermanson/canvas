import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import type * as React from 'react';

const Collapsible = (props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) => (
  <CollapsiblePrimitive.Root {...props} />
);

const CollapsibleTrigger = (
  props: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>
) => (
  <CollapsiblePrimitive.Trigger {...props} />
);

const CollapsibleContent = (
  props: React.ComponentProps<typeof CollapsiblePrimitive.Panel>
) => (
  <CollapsiblePrimitive.Panel {...props} />
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
