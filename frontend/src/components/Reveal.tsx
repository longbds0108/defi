import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/// Fades children up once when they enter the viewport. Pass `stagger` to
/// animate direct children one after another (bento grids, columns).
export function Reveal({
  children,
  className,
  stagger = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  as?: 'div' | 'section' | 'ul';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = stagger ? Array.from(el.children) : el;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          stagger,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [stagger]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={className}>
      {children}
    </Tag>
  );
}
