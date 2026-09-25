import { useEffect, useState, type CSSProperties } from 'react';
import { BRAND, LINKS, NAV } from '../../config/site';
import { ArrowUpRight, LogoMark } from '../Icons';
import { PillButton } from '../PillButton';

// Sample just under the floating header: whatever section sits there decides
// the header theme, so it flips to paper colors over light sections.
const SAMPLE_LINE = 88;

export function Header({ onLaunch }: { onLaunch: () => void }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;

      const themed = Array.from(document.querySelectorAll<HTMLElement>('[data-header-theme]'));
      const under = themed.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top <= SAMPLE_LINE && rect.bottom > SAMPLE_LINE;
      });
      const current = under[under.length - 1];
      setTheme(current?.dataset.headerTheme === 'light' ? 'light' : 'dark');

      // The pill follows the last nav section whose top crossed 42% of the
      // viewport; sections outside the nav leave it where it was.
      const line = window.innerHeight * 0.42;
      let next: number | null = null;
      NAV.forEach((item, index) => {
        const el = document.getElementById(item.href.slice(1));
        if (el && el.getBoundingClientRect().top <= line) next = index;
      });
      setActiveIndex(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className={`site-header site-header--${theme}`}>
      <a className="site-header__brand" href="#top" aria-label={`${BRAND.name} home`}>
        <LogoMark />
        <span>{BRAND.wordmark}</span>
      </a>

      <nav
        className="site-header__nav"
        aria-label="Primary"
        style={{ '--nav-index': activeIndex ?? 0, '--nav-count': NAV.length + 1 } as CSSProperties}
      >
        <span className={`nav-pill${activeIndex === null ? ' is-hidden' : ''}`} aria-hidden="true" />
        {NAV.map((item, index) => (
          <a key={item.href} href={item.href} className={activeIndex === index ? 'is-active' : undefined}>
            {item.label.toUpperCase()}
          </a>
        ))}
        <a href={LINKS.docs}>
          DOCS <ArrowUpRight width={11} height={11} />
        </a>
      </nav>

      <div className="site-header__actions">
        <span className="network-chip">
          <i aria-hidden="true" />
          {BRAND.network}
        </span>
        <PillButton size="sm" external onClick={onLaunch}>
          Launch app
        </PillButton>
      </div>
    </header>
  );
}
