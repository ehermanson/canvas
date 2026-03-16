import { cn } from "../../lib/utils";
import * as React from "react";

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
        continue;
      }

      if (ref) {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

function getElementRef(element: React.ReactElement) {
  return (
    (element.props as { ref?: React.Ref<unknown> }).ref ??
    (element as React.ReactElement & { ref?: React.Ref<unknown> }).ref
  );
}

function isEventHandler(key: string) {
  return /^on[A-Z]/.test(key);
}

function mergeElementProps<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  slotProps: T,
  childProps: U,
) {
  const mergedProps: Record<string, unknown> = {
    ...slotProps,
    ...childProps,
  };

  for (const key of Object.keys(childProps)) {
    if (!isEventHandler(key)) {
      continue;
    }

    const childHandler = childProps[key];
    const slotHandler = slotProps[key];

    if (typeof childHandler === "function" && typeof slotHandler === "function") {
      mergedProps[key] = (...args: unknown[]) => {
        childHandler(...args);
        slotHandler(...args);
      };
    }
  }

  if (slotProps.className || childProps.className) {
    const slotClassName = typeof slotProps.className === "string" ? slotProps.className : undefined;
    const childClassName =
      typeof childProps.className === "string" ? childProps.className : undefined;
    mergedProps.className = cn(slotClassName, childClassName);
  }

  if (slotProps.style || childProps.style) {
    mergedProps.style = {
      ...(slotProps.style as React.CSSProperties | undefined),
      ...(childProps.style as React.CSSProperties | undefined),
    };
  }

  return mergedProps as T & U;
}

function cloneElementWithProps(element: React.ReactElement, props: Record<string, unknown>) {
  const mergedProps = mergeElementProps(props, element.props as Record<string, unknown>);

  const ref = props.ref as React.Ref<unknown> | undefined;
  const childRef = getElementRef(element);

  if (ref || childRef) {
    mergedProps.ref = composeRefs(ref, childRef);
  }

  return React.cloneElement(element, mergedProps);
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  [key: string]: unknown;
};

const Slot = React.forwardRef<HTMLElement, SlotProps>(function Slot({ children, ...props }, ref) {
  const child = React.Children.only(children);

  if (!React.isValidElement(child)) {
    return null;
  }

  return cloneElementWithProps(child, { ...props, ref });
});

export { Slot, cloneElementWithProps };
