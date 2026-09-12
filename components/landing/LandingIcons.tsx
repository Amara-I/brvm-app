/** Pictogrammes landing — traits extra-fins or, sans emoji ni pictos lourds. */

import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

const SW = 1.15;

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconFunnel({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M4.5 5.5h15l-5.4 6.6v4.6L10.9 18v-5.9L4.5 5.5Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTarget({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth={SW} />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth={SW} />
      <circle cx="12" cy="12" r="1.05" fill="currentColor" />
    </Svg>
  );
}

export function IconChart({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4.5 18.5V5.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M8.2 18.5V11" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M12 18.5V8.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M15.8 18.5V13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M19.5 18.5V6.8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconBriefcase({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3.5" y="8" width="17" height="12.5" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8" stroke="currentColor" strokeWidth={SW} />
      <path d="M3.5 13h17" stroke="currentColor" strokeWidth={SW} />
    </Svg>
  );
}

export function IconGrad({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M3.8 10.2 12 6.5l8.2 3.7L12 14 3.8 10.2Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M7 12.2v4.1c1.6 1.4 3.2 2.1 5 2.1s3.4-.7 5-2.1v-4.1" stroke="currentColor" strokeWidth={SW} />
      <path d="M20.2 10.4v5.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconBuilding({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h6A1.5 1.5 0 0 1 14 6.5V20" stroke="currentColor" strokeWidth={SW} />
      <path d="M14 10h3.5A1.5 1.5 0 0 1 19 11.5V20" stroke="currentColor" strokeWidth={SW} />
      <path d="M4 20h16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M8 8.5h2M8 12h2M8 15.5h2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCalendar({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M8 4v3.5M16 4v3.5M4 10h16" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconPie({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M12 4.5A7.5 7.5 0 1 0 19.5 12H12V4.5Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M13.4 4.7A7.5 7.5 0 0 1 19.3 10.6H13.4V4.7Z" stroke="currentColor" strokeWidth={SW} />
    </Svg>
  );
}

export function IconBook({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M5 6.2A2.2 2.2 0 0 1 7.2 4H19v14.2H7.4A2.4 2.4 0 0 0 5 20.6V6.2Z"
        stroke="currentColor"
        strokeWidth={SW}
      />
      <path d="M5 20.6h11.6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconStar({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="m12 4.4 2.1 4.4 4.8.7-3.5 3.4.8 4.8L12 15.5 7.8 17.7l.8-4.8-3.5-3.4 4.8-.7L12 4.4Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconArrow({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12h13" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="m13.5 6.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconFile({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke="currentColor"
        strokeWidth={SW}
      />
      <path d="M14 4.5V9h4.5" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconDividend({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth={SW} />
      <path d="M12 8v8M9.4 10.2c.6-.8 1.5-1.2 2.6-1.2 1.6 0 2.6.8 2.6 2 0 2.6-5.2 1.4-5.2 4 0 1.2 1.1 2.1 2.8 2.1 1.2 0 2.1-.4 2.7-1.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconTools({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M14.2 6.2a3.4 3.4 0 0 0 4.1 4.1L15 13.6 10.4 9l3.3-3.3c.16.18.33.35.5.52Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="m9.6 9.8-5 5a1.6 1.6 0 0 0 2.3 2.3l5-5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function IconShield({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M12 4.2 19 7v5.4c0 4.2-2.8 7.2-7 8.4-4.2-1.2-7-4.2-7-8.4V7l7-2.8Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSpark({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 16.5 9.4 11l3 3.1L19 7.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 7.2H19V11.6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
