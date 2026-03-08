type IconProps = { className?: string };

export function RectangleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className}>
      <rect
        x="1"
        y="3"
        width="22"
        height="14"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function SquareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function LargeRectIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className}>
      <rect
        x="0.5"
        y="2"
        width="23"
        height="16"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function LShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 2h20v10h-8v10H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function TShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 2h20v8h-5v12H7V10H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function StudioIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 2h20v14h-5v6H7v-6H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export function BayWindowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 8h5V2h10v6h5v14H2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export const ROOM_SHAPE_ICONS: Record<string, React.FC<IconProps>> = {
  'Rectangle (12x10)': RectangleIcon,
  'Square (12x12)': SquareIcon,
  'Large (16x14)': LargeRectIcon,
  'L-Shape': LShapeIcon,
  'T-Shape': TShapeIcon,
  'Studio Apartment': StudioIcon,
  'Bay Window': BayWindowIcon,
};
