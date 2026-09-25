import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight } from './Icons';
import { TextScramble } from './TextScramble';

type Variant = 'light' | 'dark' | 'ghost' | 'outline';

interface PillButtonProps {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  external?: boolean;
  size?: 'md' | 'sm';
}

/// Rounded pill with a circular arrow cell on the right. `light` is the primary
/// action on dark surfaces, `dark` the primary action on paper surfaces.
export function PillButton({ children, variant = 'light', href, onClick, icon, external, size = 'md' }: PillButtonProps) {
  const className = `pill pill--${variant} pill--${size}`;
  const content = (
    <>
      {icon && <span className="pill__lead">{icon}</span>}
      <span>{children}</span>
      <span className="pill__arrow">{external ? <ArrowUpRight /> : <ArrowRight />}</span>
    </>
  );

  if (href) {
    return (
      <a className={className} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

/// Mono label framed by ✦ marks; the text resolves from random glyphs the
/// first time it scrolls into view.
export function Kicker({ children, tone = 'dark' }: { children: string; tone?: 'dark' | 'light' }) {
  return (
    <p className={`kicker kicker--${tone}`}>
      <span aria-hidden="true">✦</span>
      <TextScramble text={children} />
      <span aria-hidden="true">✦</span>
    </p>
  );
}
