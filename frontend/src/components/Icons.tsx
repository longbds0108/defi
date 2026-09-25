import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ArrowRight = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <svg {...base} {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>
);

export const Sparkle = (p: IconProps) => (
  <svg {...base} strokeWidth={1.5} {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></svg>
);

export const Layers = (p: IconProps) => (
  <svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>
);

export const Coins = (p: IconProps) => (
  <svg {...base} {...p}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M15 11.5c3.3 0 6 1.3 6 3v3c0 1.7-2.7 3-6 3-2 0-3.8-.5-4.9-1.3" /></svg>
);

export const Gauge = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 16 4-5" /></svg>
);

export const Shield = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z" /></svg>
);

export const Split = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3v7M12 10 5 17M12 10l7 7M5 17v4M19 17v4" /></svg>
);

export const Book = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h14" /></svg>
);

export const Plus = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lumora-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B57DEE" />
          <stop offset="1" stopColor="#3F91FF" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="url(#lumora-mark)" strokeWidth="3.2" />
      <path d="M10.5 22.5 21.5 9.5" stroke="url(#lumora-mark)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
