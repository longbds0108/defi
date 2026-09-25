import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BRAND } from './config/site';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import { Header } from './components/sections/Header';
import { Hero } from './components/sections/Hero';
import { Meet } from './components/sections/Meet';
import { Markets } from './components/sections/Markets';
import { Architecture } from './components/sections/Architecture';
import { Risk } from './components/sections/Risk';
import { HowItWorks } from './components/sections/HowItWorks';
import { Surface } from './components/sections/Surface';
import { Faq } from './components/sections/Faq';
import { Closing } from './components/sections/Closing';
import './App.css';

export default function App() {
  useSmoothScroll();
  const [curtain, setCurtain] = useState(false);
  const [toast, setToast] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Route curtain: columns sweep over the page, then the app would mount
  // underneath. Until the testnet app ships, we say so instead of faking it.
  const launch = useCallback(() => {
    if (curtain) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    setCurtain(true);
    timers.current = [
      window.setTimeout(() => setToast(true), 620),
      window.setTimeout(() => setCurtain(false), 1_350),
      window.setTimeout(() => setToast(false), 4_600),
    ];
  }, [curtain]);

  return (
    <>
      <Header onLaunch={launch} />
      <main>
        <Hero onLaunch={launch} />
        <Meet />
        <Markets />
        <Architecture />
        <Risk />
        <HowItWorks />
        <Surface />
        <Faq />
      </main>
      <Closing onLaunch={launch} />

      <div className={`route-curtain${curtain ? ' route-curtain--active' : ''}`} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} style={{ '--curtain-index': index } as CSSProperties} />
        ))}
        <span>{BRAND.wordmark} / ENTERING PROTOCOL</span>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <i aria-hidden="true" />
            The {BRAND.name} app opens with the {BRAND.network} deployment. Connect this button to your app route.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
