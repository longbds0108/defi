import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/// Lenis smooth scroll synced with GSAP ScrollTrigger. Landing page only.
/// Anchor clicks go through Lenis so they interrupt existing momentum instead
/// of fighting it.
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -88, duration: 1.05 });
      history.replaceState(null, '', `#${id}`);
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}
